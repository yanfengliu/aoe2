// The guard checks artifact identity/resolution; npm ci verifies archive bytes.
// Fixture copies let drift cases fail without changing the real installation.
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { lstat, mkdtemp, mkdir, readFile, realpath, rm, symlink, unlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

const execute = promisify(execFile);
const roots: string[] = [];
const pin = {
  version: '2.8.2',
  url: 'https://github.com/yanfengliu/civ-engine/releases/download/engine-dist/civ-engine-228380beb3673189ea9a6cc848362076777e6440.tgz',
  integrity: `sha512-${Buffer.alloc(64, 7).toString('base64')}`,
};
const json = (file: string, value: unknown) => writeFile(file, JSON.stringify(value));
async function check(root: string): Promise<{ version: string; packageRoot: string }> {
  const { stdout } = await execute(process.execPath, ['--input-type=module', '-e',
    "import { checkEngineInstall } from './scripts/check-engine.mjs'; console.log(JSON.stringify(await checkEngineInstall(process.argv[1])));", root],
  { cwd: process.cwd(), windowsHide: true });
  return JSON.parse(stdout) as { version: string; packageRoot: string };
}
async function expectPhysicalInstall(root: string, installed: string) {
  expect(await check(root)).toMatchObject({ version: pin.version, packageRoot: await realpath(installed) });
}
async function fixture() {
  const root = await mkdtemp(path.join(tmpdir(), 'aoe2-engine-pin-'));
  roots.push(root);
  const installed = path.join(root, 'node_modules/civ-engine');
  await mkdir(path.join(root, 'scripts'), { recursive: true });
  await mkdir(path.join(installed, 'dist'), { recursive: true });
  await json(path.join(root, 'scripts/civ-engine-pin.json'), pin);
  await json(path.join(root, 'package.json'), { dependencies: { 'civ-engine': pin.url } });
  await json(path.join(root, 'package-lock.json'), { packages: {
    '': { dependencies: { 'civ-engine': pin.url } },
    'node_modules/civ-engine': { version: pin.version, resolved: pin.url, integrity: pin.integrity },
  } });
  await json(path.join(installed, 'package.json'), { name: 'civ-engine', version: pin.version, type: 'module',
    exports: { '.': { import: './dist/index.js' }, './browser': './dist/index.browser.js', './package.json': './package.json' } });
  for (const entry of ['index.js', 'index.browser.js']) {
    await writeFile(path.join(installed, 'dist', entry), `export const ENGINE_VERSION = '${pin.version}';\n`);
  }
  return { root, installed };
}
afterEach(async () => { for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true }); });

describe('retained engine installation', () => {
  it('accepts the physical compiled package and both runtime versions', async () => {
    const { root, installed } = await fixture();
    await expectPhysicalInstall(root, installed);
  });

  it('accepts the same physical package through a checkout-root alias', async () => {
    const { root } = await fixture();
    const alias = path.join(root, 'checkout-alias');
    await symlink(root, alias, 'junction');
    try {
      expect(await realpath(alias), 'the alias must resolve to a different spelling').not.toBe(alias);
      await expectPhysicalInstall(alias, path.join(alias, 'node_modules/civ-engine'));
    } finally {
      await unlink(alias);
    }
  });

  const drift: [string, string[], unknown][] = [
    ['package.json', ['dependencies', 'civ-engine'], 'file:../civ-engine'],
    ['package-lock.json', ['packages', '', 'dependencies', 'civ-engine'], 'file:../civ-engine'],
    ['package-lock.json', ['packages', 'node_modules/civ-engine', 'resolved'], pin.url.replace(/civ-engine-[a-f0-9]+\.tgz$/, 'civ-engine.tgz')],
    ['package-lock.json', ['packages', 'node_modules/civ-engine', 'integrity'], `sha512-${Buffer.alloc(64, 8).toString('base64')}`],
    ['package-lock.json', ['packages', 'node_modules/civ-engine', 'link'], true],
    ['package-lock.json', ['packages', 'node_modules/civ-engine', 'version'], '2.5.0'],
    ['node_modules/civ-engine/package.json', ['version'], '2.5.0'],
  ];
  it.each(drift)('rejects drift in %s at %s with safe recovery advice', async (file, keys, value) => {
    const { root } = await fixture();
    const target = path.join(root, file);
    const data = JSON.parse(await readFile(target, 'utf8')) as Record<string, unknown>;
    let parent = data;
    for (const key of keys.slice(0, -1)) parent = parent[key] as Record<string, unknown>;
    parent[keys.at(-1)!] = value;
    await json(target, data);
    await expect(check(root)).rejects.toThrow(/Run npm ci --ignore-scripts after restoring/);
  });

  it.each(['index.js', 'index.browser.js'])('rejects stale compiled %s', async (entry) => {
    const { root, installed } = await fixture();
    await writeFile(path.join(installed, 'dist', entry), "export const ENGINE_VERSION = '2.5.0';\n");
    await expect(check(root)).rejects.toThrow(/runtime version/);
  });

  it.each(['engine', 'node_modules', 'dist'])('rejects linked %s with matching versions', async part => {
    const { root, installed } = await fixture();
    const shared = await fixture();
    const target = part === 'engine' ? installed : part === 'dist' ? path.join(installed, 'dist') : path.join(root, 'node_modules');
    const sharedTarget = part === 'engine' ? shared.installed : part === 'dist' ? path.join(shared.installed, 'dist') : path.join(shared.root, 'node_modules');
    await rm(target, { recursive: true });
    await symlink(sharedTarget, target, process.platform === 'win32' ? 'junction' : 'dir');
    await expect(check(root)).rejects.toThrow(/physical|linked|outside/);
  });
});

// A linked git worktree shares its primary checkout's install: `scripts/controlWorktree.mjs`
// makes its `node_modules` a link to the primary's (docs/policies/rules/worktrees.md, whose
// "Gates inside a worktree" says every npm script runs there). The guard refused every such
// link from 2026-11-07, so no gate ran in a worktree; the owner chose on 2026-11-11 that it
// accepts that one link and checks the primary's install against the worktree's own pin.
// The fixtures are real repositories and real `git worktree add`s, linked as the controller
// links them, with npm's record of the install (`node_modules/.package-lock.json`) beside it.
// BOUND: one worktree of one repository, on this platform's link kind; git's listing is
// trusted for which checkout is the primary and which directories are its worktrees.
const LINK = process.platform === 'win32' ? 'junction' : 'dir';
const git = (cwd: string, ...args: string[]) => execute('git',
  ['-c', 'user.name=engine-install-test', '-c', 'user.email=engine-install-test@example.invalid', '-c', 'commit.gpgsign=false', ...args], { cwd, windowsHide: true });
const refusalOf = (root: string) => check(root).then(() => 'accepted', (error: Error) => error.message);
/** `check` in an environment of the case's own. */
async function checkWith(root: string, env: NodeJS.ProcessEnv): Promise<{ version: string; packageRoot: string }> {
  const { stdout } = await execute(process.execPath, ['--input-type=module', '-e',
    "import { checkEngineInstall } from './scripts/check-engine.mjs'; console.log(JSON.stringify(await checkEngineInstall(process.argv[1])));", root],
  { cwd: process.cwd(), windowsHide: true, env });
  return JSON.parse(stdout) as { version: string; packageRoot: string };
}
const gitPath = (file: string) => file.split(path.sep).join('/');
const UNSAFE_ADVICE = /Run npm ci --ignore-scripts after restoring/;
/** What npm records in an install about the engine it put there. */
const installRecord = (root: string, engine: typeof pin = pin) => json(path.join(root, 'node_modules/.package-lock.json'), { packages: {
  'node_modules/civ-engine': { version: engine.version, resolved: engine.url, integrity: engine.integrity },
} });
/** Writes a checkout's own pin, manifest and lock for one engine archive. */
async function pinTo(root: string, engine: typeof pin) {
  await mkdir(path.join(root, 'scripts'), { recursive: true });
  await json(path.join(root, 'scripts/civ-engine-pin.json'), engine);
  await json(path.join(root, 'package.json'), { dependencies: { 'civ-engine': engine.url } });
  await json(path.join(root, 'package-lock.json'), { packages: {
    '': { dependencies: { 'civ-engine': engine.url } },
    'node_modules/civ-engine': { version: engine.version, resolved: engine.url, integrity: engine.integrity },
  } });
}
/** Takes a link away before the fixtures are deleted. If it will not go, the fixture that
 *  holds it leaves the list of directories deleted recursively, and the test fails. */
async function detach(link: string) {
  await unlink(link).catch(() => undefined);
  // Only "no such file" shows the link is gone: any other answer keeps the fixture off the list.
  if (await lstat(link).then(() => false, (error: NodeJS.ErrnoException) => error.code === 'ENOENT')) return;
  for (let index = roots.length - 1; index >= 0; index -= 1) {
    if (link.startsWith(`${roots[index]}${path.sep}`)) roots.splice(index, 1);
  }
  throw new Error(`SAFETY: ${link} is still there; its fixture is left on disk rather than deleted through the link`);
}
async function emptyDirectory(prefix: string) {
  const directory = await mkdtemp(path.join(tmpdir(), prefix));
  roots.push(directory);
  return directory;
}
async function repository() {
  const made = await fixture();
  await installRecord(made.root);
  await git(made.root, 'init', '-q');
  await git(made.root, 'add', 'package.json', 'package-lock.json', 'scripts/civ-engine-pin.json');
  await git(made.root, 'commit', '-q', '-m', 'the pinned manifest');
  return made;
}
async function linkedWorktree() {
  const primary = await repository();
  const worktree = await emptyDirectory('aoe2-engine-pin-worktree-');
  await git(primary.root, 'worktree', 'add', '-q', worktree);
  const link = path.join(worktree, 'node_modules');
  await symlink(path.join(primary.root, 'node_modules'), link, LINK);
  return { primary, worktree, link };
}
/** Runs `body`, then takes the worktree's link away before the fixtures are deleted. */
async function withLinkedWorktree(body: (made: Awaited<ReturnType<typeof linkedWorktree>>) => Promise<void>) {
  const made = await linkedWorktree();
  try { await body(made); } finally { await detach(made.link); }
}

describe('a linked worktree that shares its primary checkout\'s install', () => {
  it('is accepted, and names the primary\'s physical package', async () => {
    await withLinkedWorktree(async ({ primary, worktree }) => {
      expect(await check(worktree)).toMatchObject({ version: pin.version, packageRoot: await realpath(primary.installed) });
    });
  });

  it('is accepted whatever repository GIT_DIR names, since the guard asks about this checkout', async () => {
    await withLinkedWorktree(async ({ primary, worktree }) => {
      const elsewhere = await repository();
      const identity = await checkWith(worktree, { ...process.env, GIT_DIR: path.join(elsewhere.root, '.git'), GIT_WORK_TREE: elsewhere.root });
      expect(identity).toMatchObject({ version: pin.version, packageRoot: await realpath(primary.installed) });
    });
  });

  it('is refused when its own pin is another version, and is told to install in the primary', async () => {
    await withLinkedWorktree(async ({ primary, worktree }) => {
      await pinTo(worktree, { ...pin, version: '2.9.9' });
      const refusal = await refusalOf(worktree);
      expect(refusal).toMatch(/differs from this worktree's pin/);
      expect(refusal, 'npm ci inside a worktree would install through the link').toMatch(/Never run npm ci in this worktree/);
      expect(refusal).not.toMatch(UNSAFE_ADVICE);
      expect(refusal).toContain(await realpath(primary.root));
    });
  });

  it.each([
    ['address', { ...pin, url: pin.url.replace(/[a-f0-9]{40}/, 'b'.repeat(40)) }],
    ['integrity', { ...pin, integrity: `sha512-${Buffer.alloc(64, 9).toString('base64')}` }],
  ])('is refused when its own pin is another archive of the same version, by %s alone', async (_part, other) => {
    await withLinkedWorktree(async ({ worktree }) => {
      await pinTo(worktree, other);
      expect(await refusalOf(worktree)).toMatch(/differs from this worktree's pin/);
    });
  });

  it('is refused with what git said when git cannot list the worktrees', async () => {
    await withLinkedWorktree(async ({ worktree }) => {
      // No git on the path: the guard cannot ask, so it refuses, says so, and still forbids npm ci here.
      const noGit = Object.fromEntries(Object.entries(process.env).filter(([name]) => name.toLowerCase() !== 'path'));
      const refusal = await checkWith(worktree, { ...noGit, PATH: await emptyDirectory('aoe2-engine-pin-no-git-') })
        .then(() => 'accepted', (error: Error) => error.message);
      expect(refusal).toMatch(/git could not list this checkout's worktrees: \S/);
      expect(refusal).toMatch(/Never run npm ci here/);
      expect(refusal).not.toMatch(UNSAFE_ADVICE);
    });
  });

  it('is refused when the shared install carries no record of what npm installed', async () => {
    await withLinkedWorktree(async ({ primary, worktree }) => {
      await rm(path.join(primary.root, 'node_modules/.package-lock.json'));
      expect(await refusalOf(worktree)).toMatch(/differs from this worktree's pin/);
    });
  });

  it('is refused when the link leaves its primary checkout', async () => {
    await withLinkedWorktree(async ({ worktree, link }) => {
      const stranger = await fixture();
      await installRecord(stranger.root);
      await detach(link);
      await symlink(path.join(stranger.root, 'node_modules'), link, LINK);
      const refusal = await refusalOf(worktree);
      expect(refusal).toMatch(/its primary checkout's node_modules/);
      expect(refusal).not.toMatch(UNSAFE_ADVICE);
    });
  });

  it('is refused when the shared install\'s engine is itself linked', async () => {
    await withLinkedWorktree(async ({ primary, worktree }) => {
      const stranger = await fixture();
      await rm(primary.installed, { recursive: true });
      await symlink(stranger.installed, primary.installed, LINK);
      try {
        expect(await refusalOf(worktree)).toMatch(/civ-engine must be a physical directory/);
      } finally {
        await detach(primary.installed);
      }
    });
  });

  it('is refused when the primary does not list the checkout as its worktree', async () => {
    await withLinkedWorktree(async ({ primary, worktree }) => {
      // A directory that only claims to be that worktree: the same `.git` pointer and the same link.
      const claimant = await emptyDirectory('aoe2-engine-pin-claimant-');
      await pinTo(claimant, pin);
      await writeFile(path.join(claimant, '.git'), await readFile(path.join(worktree, '.git')));
      const link = path.join(claimant, 'node_modules');
      await symlink(path.join(primary.root, 'node_modules'), link, LINK);
      try {
        const refusal = await refusalOf(claimant);
        expect(refusal).toMatch(/its primary checkout's node_modules/);
        expect(refusal, 'no primary is known, and npm ci here would still install through the link').toMatch(/Never run npm ci here/);
        expect(refusal).not.toMatch(UNSAFE_ADVICE);
      } finally {
        await detach(link);
      }
    });
  });

  it('is refused when its git record is one the primary never made', async () => {
    const primary = await repository();
    // A real worktree too, so the listing has entries and only membership can refuse the forged one.
    await git(primary.root, 'worktree', 'add', '-q', await emptyDirectory('aoe2-engine-pin-real-worktree-'));
    const forged = await emptyDirectory('aoe2-engine-pin-forged-');
    await pinTo(forged, pin);
    // A hand-made administrative directory inside the checkout itself, naming the primary's repository.
    const admin = path.join(forged, 'local-admin');
    await mkdir(admin);
    await writeFile(path.join(forged, '.git'), `gitdir: ${gitPath(admin)}\n`);
    await writeFile(path.join(admin, 'commondir'), `${gitPath(path.join(primary.root, '.git'))}\n`);
    await writeFile(path.join(admin, 'gitdir'), `${gitPath(path.join(forged, '.git'))}\n`);
    await writeFile(path.join(admin, 'HEAD'), await readFile(path.join(primary.root, '.git/HEAD')));
    const link = path.join(forged, 'node_modules');
    await symlink(path.join(primary.root, 'node_modules'), link, LINK);
    try {
      const refusal = await refusalOf(forged);
      expect(refusal).toMatch(/its primary checkout's node_modules/);
      expect(refusal).not.toMatch(UNSAFE_ADVICE);
    } finally {
      await detach(link);
    }
  });

  it('is refused when its repository is bare, which has no primary checkout', async () => {
    const source = await repository();
    const home = await fixture();
    await installRecord(home.root);
    await git(home.root, 'clone', '-q', '--bare', source.root, path.join(home.root, '.git'));
    const worktree = await emptyDirectory('aoe2-engine-pin-bare-worktree-');
    await git(home.root, `--git-dir=${path.join(home.root, '.git')}`, 'worktree', 'add', '-q', worktree);
    const link = path.join(worktree, 'node_modules');
    await symlink(path.join(home.root, 'node_modules'), link, LINK);
    try {
      const refusal = await refusalOf(worktree);
      expect(refusal).toMatch(/its primary checkout's node_modules/);
      expect(refusal).not.toMatch(UNSAFE_ADVICE);
    } finally {
      await detach(link);
    }
  });
});

describe('a linked node_modules outside any worktree', () => {
  it('is refused, and is never told to run npm ci there', async () => {
    const { root } = await fixture();
    const shared = await fixture();
    const link = path.join(root, 'node_modules');
    await rm(link, { recursive: true });
    await symlink(path.join(shared.root, 'node_modules'), link, LINK);
    try {
      const refusal = await refusalOf(root);
      expect(refusal).toMatch(/must be a physical directory/);
      expect(refusal).toMatch(/Never run npm ci here/);
      expect(refusal).not.toMatch(UNSAFE_ADVICE);
    } finally {
      await detach(link);
    }
  });
});
