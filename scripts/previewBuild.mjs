// Whether the vite preview on a port is serving a checkout's own, current build: the two refusals
// scripts/captureMapScreenshot.mjs makes before it trusts a frame, as functions, for scripts/saveFrameRate.mjs.
//
// WHY. vite preview serves `dist/`, not the working tree, so a measurement taken after an edit and before a
// rebuild is of the previous build; and with several worktrees on one machine, a sibling's preview on the same port
// would be measured as if it were this checkout's. An A/B of two builds is two checkouts, each with its own `dist/`
// and its own preview, so both checks take the checkout as an argument.
import { readdir, readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';

async function newestModification(directory) {
  let newest = 0;
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
    const path = join(directory, entry.name);
    newest = Math.max(newest, entry.isDirectory() ? await newestModification(path) : (await stat(path)).mtimeMs);
  }
  return newest;
}

/** The hashed assets an index.html names, as one comparable string: vite names every asset by its content. */
export function hashedAssets(html) {
  return [...new Set(html.match(/assets\/[\w.-]+/g) ?? [])].sort().join(' ');
}

/** Refuses a checkout with no build, or one whose build is older than its `src/`. Returns its index.html. */
export async function readCurrentBuild(tree) {
  const indexPath = join(tree, 'dist', 'index.html');
  const builtAt = await stat(indexPath).then((entry) => entry.mtimeMs, () => {
    throw new Error(`No build at ${indexPath}. vite preview serves the BUILD, not the working tree: run \`npm run build\` in ${tree} first.`);
  });
  const sourceAt = await newestModification(join(tree, 'src'));
  if (sourceAt > builtAt) {
    throw new Error(
      `${join(tree, 'dist')} is older than ${join(tree, 'src')} (built ${new Date(builtAt).toISOString()}, newest `
      + `source ${new Date(sourceAt).toISOString()}), so the preview would serve the PREVIOUS build. Run \`npm run build\` in ${tree} first.`,
    );
  }
  return readFile(indexPath, 'utf8');
}

/** Refuses a port that no preview answers on, or whose preview serves another build than `tree`'s. */
export async function assertPreviewServes(tree, port) {
  const local = hashedAssets(await readCurrentBuild(tree));
  const served = hashedAssets(await fetch(`http://127.0.0.1:${String(port)}/`).then((response) => response.text(), (error) => {
    throw new Error(
      `No vite preview answered on port ${String(port)} (${error.message}). Start one in ${tree} `
      + `(node node_modules/vite/bin/vite.js preview --host 127.0.0.1 --port ${String(port)} --strictPort).`,
    );
  }));
  if (served !== local) {
    throw new Error(
      `The preview on port ${String(port)} serves [${served || 'no hashed assets'}] but ${join(tree, 'dist')} holds `
      + `[${local}]: another checkout's (or a stale) preview holds the port. Start the preview in ${tree}, or pass that preview's --tree.`,
    );
  }
  return local;
}
