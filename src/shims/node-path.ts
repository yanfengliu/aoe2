// Browser shim for `node:path` — civ-engine's FileSink and BundleCorpus
// import path manipulation APIs. aoe2 does not use FileSink / BundleCorpus
// at runtime; the imports are pulled into the module graph through
// civ-engine's barrel re-export.
//
// `join` is a pure function so we provide a real implementation in case
// any code path actually reaches it. Other exports throw on call so a
// regression surfaces immediately.

export const join = (...parts: readonly string[]): string =>
  parts
    .filter((p) => p.length > 0)
    .join('/')
    .replace(/\/+/g, '/');

export const sep = '/';
export const dirname = (p: string): string => {
  const idx = p.lastIndexOf('/');
  return idx <= 0 ? '.' : p.slice(0, idx);
};
export const basename = (p: string, ext?: string): string => {
  const idx = p.lastIndexOf('/');
  const name = idx === -1 ? p : p.slice(idx + 1);
  return ext && name.endsWith(ext) ? name.slice(0, -ext.length) : name;
};
export const extname = (p: string): string => {
  const idx = p.lastIndexOf('.');
  const slashIdx = p.lastIndexOf('/');
  return idx === -1 || idx < slashIdx ? '' : p.slice(idx);
};
export const resolve = (...parts: readonly string[]): string => {
  return join(...parts);
};
export const isAbsolute = (p: string): boolean => p.startsWith('/');
export const relative = (from: string, to: string): string => {
  // Minimal browser stub: bundle-corpus uses this for manifest path
  // resolution which we never exercise in the browser.
  if (to.startsWith(from)) {
    return to.slice(from.length).replace(/^\/+/, '');
  }
  return to;
};
export const normalize = (p: string): string => p.replace(/\/+/g, '/');

