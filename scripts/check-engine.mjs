import { execFile } from 'node:child_process';
import { lstat, readFile, realpath } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { promisify } from 'node:util';
import { runDirectly } from './run-directly.mjs';

const defaultRoot = fileURLToPath(new URL('..', import.meta.url));
const readJson = async (file) => JSON.parse(await readFile(file, 'utf8'));
const execute = promisify(execFile);

/**
 * The primary checkout that git lists `checkout` under as one of its linked worktrees, or null.
 * Asked of git itself, as `scripts/controlWorktree.mjs` asks, with the variables that point git
 * at another repository taken away: the primary is the first entry of `git worktree list` and
 * must not be bare, and `checkout` must be one of the entries after it. A directory that only
 * claims to be a worktree, a record the primary never made and a bare repository all give no
 * primary. When git itself cannot answer, what it said is kept for the refusal.
 */
async function primaryCheckoutOf(checkout) {
  const env = { ...process.env };
  for (const name of ['GIT_DIR', 'GIT_WORK_TREE', 'GIT_COMMON_DIR', 'GIT_INDEX_FILE']) delete env[name];
  const listing = await execute('git', ['-C', checkout, 'worktree', 'list', '--porcelain'], { env, windowsHide: true })
    .then((result) => result.stdout, (error) => ({ failure: String(error.stderr || error.message).trim().split(/\r?\n/)[0] }));
  if (typeof listing !== 'string') return { primary: null, gitSaid: listing.failure };
  const entries = listing.split(/\r?\n\r?\n/).map((block) => block.split(/\r?\n/)).filter((lines) => lines[0].startsWith('worktree '));
  if (entries.length < 2 || entries[0].includes('bare')) return { primary: null, gitSaid: null };
  const [primary, ...linked] = await Promise.all(entries.map((lines) => realpath(lines[0].slice('worktree '.length)).catch(() => null)));
  return { primary: primary !== null && primary !== checkout && linked.includes(checkout) ? primary : null, gitSaid: null };
}

/** npm ci verifies archive bytes; this checks the selected artifact and runtime identity. */
export async function checkEngineInstall(root = defaultRoot) {
  const checkout = await realpath(root);
  const [pin, manifest, lock] = await Promise.all([
    readJson(path.join(root, 'scripts/civ-engine-pin.json')),
    readJson(path.join(root, 'package.json')),
    readJson(path.join(root, 'package-lock.json')),
  ]);
  // A linked git worktree shares its primary checkout's install: `scripts/controlWorktree.mjs`
  // makes its `node_modules` a link to the primary's (docs/policies/rules/worktrees.md). That
  // is the one link accepted (owner decision, 2026-11-11), and only to that primary's own
  // `node_modules`. Everything below is then checked in the primary's install, against this
  // checkout's own pin, manifest and lock, so a worktree on another pin is still refused.
  const modules = path.join(checkout, 'node_modules');
  const linked = (await lstat(modules)).isSymbolicLink();
  const { primary, gitSaid } = linked ? await primaryCheckoutOf(checkout) : { primary: null, gitSaid: null };
  const installModules = primary === null ? modules : path.join(primary, 'node_modules');
  // npm ci deletes node_modules first, so wherever it is a link the advice is never to run it there.
  const advice = !linked
    ? 'Run npm ci --ignore-scripts after restoring the verified pin and lockfile.'
    : primary === null
      ? 'Never run npm ci here while node_modules is a link: npm would install through it. A worktree is made, and its link removed, only by scripts/controlWorktree.mjs (docs/policies/rules/worktrees.md).'
      : `Never run npm ci in this worktree, whose node_modules is a link: restore the verified pin and lockfile and run npm ci --ignore-scripts in the primary checkout ${primary}.`;
  const requireMatch = (condition, message) => {
    if (!condition) throw new Error(`Engine installation: ${message}. ${advice}`);
  };
  requireMatch(!linked || (primary !== null && await realpath(modules).catch(() => null) === installModules),
    `${modules} must be a physical directory, or a git worktree's link to its primary checkout's node_modules${gitSaid === null ? '' : ` (git could not list this checkout's worktrees: ${gitSaid})`}`);
  const packageRoot = path.join(installModules, 'civ-engine');
  requireMatch(/^https:\/\/github\.com\/yanfengliu\/civ-engine\/releases\/download\/engine-dist\/civ-engine-[a-f0-9]{40}\.tgz$/.test(pin.url), 'pin must name a retained commit archive');
  requireMatch(/^sha512-[A-Za-z0-9+/]{86}==$/.test(pin.integrity), 'pin must contain the verified SHA-512 integrity');
  requireMatch(manifest.dependencies?.['civ-engine'] === pin.url, 'package dependency differs from the pin');
  requireMatch(lock.packages?.['']?.dependencies?.['civ-engine'] === pin.url, 'root lock dependency differs from the pin');
  const entry = lock.packages?.['node_modules/civ-engine'];
  requireMatch(entry && !entry.link && entry.resolved === pin.url && entry.integrity === pin.integrity && entry.version === pin.version, 'locked engine archive, integrity, or version differs from the pin');

  for (const directory of [installModules, packageRoot]) {
    const stat = await lstat(directory);
    requireMatch(stat.isDirectory() && !stat.isSymbolicLink(), `${directory} must be a physical directory, not linked`);
    requireMatch(await realpath(directory) === directory, `${directory} resolves outside its physical location`);
  }
  if (primary !== null) {
    // The shared install was made from the primary's lock, not this worktree's, and two archives
    // can carry one version. npm's own record of what it installed there (`.package-lock.json`)
    // must name this worktree's archive and integrity, not only its version. It is a record, not a
    // second check of the installed bytes: npm ci made that check when it installed.
    const record = await readJson(path.join(installModules, '.package-lock.json'))
      .then((installedLock) => installedLock.packages?.['node_modules/civ-engine'], () => undefined);
    requireMatch(record && !record.link && record.resolved === pin.url && record.integrity === pin.integrity && record.version === pin.version,
      "the shared install's engine archive, by npm's record of what it installed, differs from this worktree's pin");
  }
  const resolve = createRequire(path.join(root, 'package.json')).resolve;
  const manifestPath = await realpath(resolve('civ-engine/package.json'));
  requireMatch(manifestPath === path.join(packageRoot, 'package.json'), 'resolved engine package is outside the private installation');
  const installed = await readJson(manifestPath);
  requireMatch(installed.name === 'civ-engine' && installed.version === pin.version, 'installed package version differs from the pin');
  const browserExport = installed.exports?.['./browser'];
  const entries = [installed.exports?.['.']?.import, typeof browserExport === 'string' ? browserExport : browserExport?.default];
  for (const relativeEntry of entries) {
    requireMatch(typeof relativeEntry === 'string', 'compiled Node or browser export is missing');
    const runtimePath = await realpath(path.resolve(packageRoot, relativeEntry));
    const relative = path.relative(packageRoot, runtimePath);
    requireMatch(relative.startsWith(`dist${path.sep}`) && !path.isAbsolute(relative), 'runtime entry resolves outside the private compiled package');
    const runtime = await import(pathToFileURL(runtimePath).href);
    requireMatch(runtime.ENGINE_VERSION === pin.version, `runtime version in ${relativeEntry} differs from ${pin.version}`);
  }
  return { version: pin.version, url: pin.url, integrity: pin.integrity, packageRoot, primaryCheckout: primary };
}

if (runDirectly(import.meta.url)) {
  try {
    const result = await checkEngineInstall();
    console.log(`civ-engine ${result.version}: verified retained archive and private Node/browser runtimes`);
    console.log(result.packageRoot);
    if (result.primaryCheckout !== null) console.log(`shared through this worktree's node_modules link to the primary checkout ${result.primaryCheckout}`);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
