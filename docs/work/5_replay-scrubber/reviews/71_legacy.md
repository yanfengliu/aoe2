# Phase 3C implementation review - impl-54

## Reviewers

- Codex `gpt-5.5`, xhigh, read-only sandbox: completed with two medium findings.
- Claude `claude-opus-4-7[1m]`: unreachable due to account limit (`You've hit your limit - resets 7pm America/Los_Angeles`).

## Findings

- [MEDIUM] `HotkeyRegistry` allowed every non-text `input` type to receive global hotkeys, not just the replay timeline range input. This could let annotation/save-load form checkbox or radio focus trigger app-level hotkeys. Fixed by scoping the exception to `input[type=range]` and adding checkbox/radio suppression coverage in `tests/control/HotkeyRegistry.test.ts`.
- [MEDIUM] `replaceLiveBridgeAfterReplayExit` exited replay before `createBridge()` succeeded, so failed load validation could kick the user out of replay without replacing the bridge. Fixed by constructing the replacement bridge first, then exiting replay immediately before install, with failure-path coverage in `tests/app/replaceBridgeForLoad.test.ts`.

## Disposition

Both findings were reproduced with failing tests first, fixed, and verified with `npm.cmd test -- tests/control/HotkeyRegistry.test.ts tests/app/replaceBridgeForLoad.test.ts` (2 files, 16 tests).
