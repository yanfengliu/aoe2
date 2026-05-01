# Phase 1B building.action Implementation Review (impl-14)

**Date:** 2026-05-01
**Iteration:** impl-14 → addressed inline (1 review fix folded)
**Reviewers:** Codex `gpt-5.5` xhigh + Claude `claude-opus-4-7[1m]` max
**Disposition:** ACCEPT after inline fix (both reviewers converged on the same headline finding)

## Both reviewers converged on the same finding — handler exhaustiveness

Codex (Medium) + Claude F1 (real): the handler's switch on `BuildingActionType` was not compile-time exhaustive. With `BuildingActionType = ActionType` today (only `'ungarrison'`), a future addition to the union would compile silently, validator's `SUPPORTED_ACTIONS` set would still accept based on its own list, and the handler would fall through with no action — accepting the command but doing nothing.

**Fix:** added a `default: return assertNeverBuildingAction(data.actionType)` arm to the switch, with a `function assertNeverBuildingAction(value: never): never` helper that throws. New `BuildingActionType` members now force a compile error in the handler until they're wired. `SUPPORTED_ACTIONS` validator set is still author-maintained per Phase 1B convention; ratifying a `Record<BuildingActionType, true>` form is a project-wide consideration outside this commit's scope.

## Claude F2 (deferred) — `issueAction('ungarrison')` return-value semantic shift

Pre-1B: `issueAction('ungarrison')` returned `false` when the building had `garrisonedUnits.length === 0` (no-op). Post-1B: validator has no garrison-state check (would require extra deps); handler discards `ungarrisonBuildingDirect`'s boolean. So a valid, owned, completed building with empty garrison now returns `true` from the bridge facade.

**Production HUD impact:** none — `selectionPanel.ts:475` discards the return.

**Test surface impact:** none — utility tests exercise the post-garrison path.

This is a Phase 1B B2 trade-off: validator best-effort, handler authoritative + silent on stale state. The pre-1B semantic was effectively "did the action succeed?", post-1B it's "was the action accepted into the queue?". Documented in REVIEW + devlog.

## Anti-regression checklist verified clean

- ✓ Validator returns `true | { code, message }`, never `null`. 5 reject codes (invalid_building_id, unknown_action, building_not_found, not_a_building, under_construction).
- ✓ Validator's `actionType` set extensible via `SUPPORTED_ACTIONS` Set.
- ✓ Handler now compile-time exhaustive (impl-14 fix).
- ✓ Bridge facade preserves pre-1B silent-no-op on non-owned/no-selection (early-returns false without `submitWithResult`).
- ✓ `wireBridgeOps` + `registerCommandHandlers` wiring complete; `ungarrisonBuilding` dropped from `createHumanInputOps` args + `registerBridgeSystems` threading.
- ✓ Test coverage: 5 reject codes + accept + handler dispatch = 7 tests.
- ✓ `utility.test.ts`: 2 ungarrison integration tests gain `bridge.step(100)` before reading post-action state.

## Test count + gates

- 648 passed + 1 skipped (was 641 + 7 net new tests this commit).
- typecheck, lint, build, full test suite all green.
- Codex review: ~3 min. Claude review: ~5 min. Both run in parallel.

## Phase 1B → next steps

13 of 15 commands complete. Next per PLAN v4: `trebuchet.pack` and `trebuchet.unpack` — last 2 commits to close Phase 1B. Both are unique within Phase 1B because pre-1B `beginTrebuchetPack` / `beginTrebuchetUnpack` are called by `playerCommandsSystem` (deterministic-resolution), not by the HUD. Per design, these still get commandified for replay observability — but the recorded "user input" set doesn't change (the trebuchet pack/unpack INTENTION is system-derived from a player's move/attack command + trebuchet state). The implementation pattern will resemble unit.attack's AI-decision intention path: the deterministic system pushes `pendingCommands` intentions, the dispatcher drains, the handler applies. Or — more conservatively — the existing direct calls become typed commands without changing the call site, just for replay-stream observability.
