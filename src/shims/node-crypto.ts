// Browser shim for `node:crypto` — civ-engine's SessionRecorder imports
// `randomUUID` from this module name. globalThis.crypto.randomUUID is
// available in Chrome 92+, Firefox 95+, Safari 15.4+ and matches the
// Node API exactly.

export const randomUUID = (): string => crypto.randomUUID();
