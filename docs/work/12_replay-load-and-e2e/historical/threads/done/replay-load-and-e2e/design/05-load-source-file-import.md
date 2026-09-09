# Slice 4 — File import (v0.1.11)

## Goal

A HUD-side file picker that takes a user-selected `SessionBundle` JSON file and enters replay mode.

## User-visible changes

- A new "Replay (from file)" button in the same HUD region as Save/Load and the slice-2 button. Clicking opens a native `<input type="file" accept=".json">` picker.
- After file selection: parse → validate structure → enter replay. On error, toast a clear message ("invalid bundle file: <reason>").
- Invalid bundles never partially apply: the controller is only called after structural validation passes.

## Surface changes

- New `src/ui/replay/ReplayFileImport.ts` exporting `createReplayFileImport({ replayController, toast })`. Returns `{ promptForFile(): void; dispose(): void }`. The factory mounts a hidden `<input type="file">` inside a wrapping element supplied by the caller.
- New `src/game/replay/parseSessionBundleFile.ts` exporting `parseSessionBundleFile(text: string): { ok: true; bundle: SessionBundle } | { ok: false; reason: string }`. Validates the minimal `SessionBundle` shape: `metadata.sessionId`, `metadata.startTick`, `metadata.endTick`, `commands` array, `markers` array, `initialSnapshot`. Anything else is a `reason: 'missing field <name>'` error.
- HUD wiring: `createHudController` adds an optional `replayFromFile?: () => void` callback that triggers the file picker.

## Test contract

`tests/replay/parseSessionBundleFile.test.ts` (NEW):
1. Valid bundle JSON returns `{ ok: true, bundle }`.
2. Bundle missing `metadata.sessionId` returns `{ ok: false, reason: 'missing field metadata.sessionId' }`.
3. Bundle missing `commands` returns `{ ok: false, reason: 'missing field commands' }`.
4. Non-JSON input returns `{ ok: false, reason: 'invalid JSON' }`.
5. Bundle whose `commands` is not an array returns `{ ok: false, reason: 'commands is not an array' }`.

`tests/replay/replayFileImport.test.ts` (NEW, jsdom):
1. Calling `promptForFile()` triggers a click on the hidden file input.
2. `change` event with a valid JSON file calls `replayController.enterReplay`.
3. `change` event with an invalid file calls `toast.showToast('invalid bundle file: ...')` and does NOT call `enterReplay`.

## Risks and mitigations

- **Large file blocking the main thread:** small bundles (typical < 1 MB) are fine; the file is parsed synchronously after `FileReader.readAsText` resolves. If we need to support large bundles in the future, switch to a streaming JSON parser — out of scope here.
- **Cross-version bundles:** `metadata.schemaVersion` may not match the running `SESSION_BUNDLE_SCHEMA_VERSION`. We accept any structurally valid bundle and let the controller reject incompatible payloads at replay time. The toast for that case is the controller's error message, not a special pre-check.
- **Browser security: file picker requires user gesture.** The button click counts as the user gesture; `promptForFile()` triggers a programmatic click on the same call stack so the gesture chain is preserved.
