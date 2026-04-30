// Browser shim for `node:fs` — civ-engine's FileSink and BundleCorpus
// import filesystem APIs from this module. aoe2 does not use FileSink /
// BundleCorpus at runtime (they are server-side surfaces), but Vite
// includes them in the module graph because civ-engine's barrel re-exports
// them and lacks `sideEffects: false`.
//
// All exports throw on call so a regression that accidentally invokes one
// of these from browser code surfaces immediately rather than silently.

const browserOnly = (api: string) => (): never => {
  throw new Error(`[aoe2] node:fs.${api} is not available in the browser; this module should not be reachable at runtime.`);
};

export const appendFileSync = browserOnly('appendFileSync');
export const existsSync = browserOnly('existsSync');
export const mkdirSync = browserOnly('mkdirSync');
export const readdirSync = browserOnly('readdirSync');
export const readFileSync = browserOnly('readFileSync');
export const renameSync = browserOnly('renameSync');
export const rmSync = browserOnly('rmSync');
export const writeFileSync = browserOnly('writeFileSync');
export const statSync = browserOnly('statSync');
export const lstatSync = browserOnly('lstatSync');
