// The guard checks artifact identity/resolution; npm ci verifies archive bytes.
// Fixture copies let drift cases fail without changing the real installation.
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from 'node:fs/promises';
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
    expect(await check(root)).toMatchObject({ version: pin.version, packageRoot: installed });
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
