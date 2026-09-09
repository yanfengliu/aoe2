# Phase 1B sheep.move Implementation Review (impl-7)

**Date:** 2026-05-01
**Iteration:** impl-7 → ACCEPT, no fixes needed
**Reviewers:** Codex `gpt-5.5` xhigh + Claude `claude-opus-4-7[1m]` max
**Disposition:** ACCEPT (both reviewers ACCEPT, no real findings)

## Both reviewers reachable

For the first time across recent Phase 1B commits, Codex completed the diff review without hitting the Windows constrained-language-mode block. Diff was small (256 lines, 6 files) and Codex did not need to explore the workspace beyond the piped diff.

## Codex verdict — No findings

> "The diff matches the expected Phase 1B shape: facade submits `sheep.move`, validator returns `CommandValidationResult` without `null`, handler delegates to the extracted direct helper, wiring is present in both `registerCommandHandlers` and `wireBridgeOps`, and tests cover the listed validator branches plus handler delegation."

## Claude verdict — No blocking issues

All 6 anti-regression checklist items verified:

1. ✓ `setSheepMoveCommandDirect` body byte-for-byte identical to pre-impl-7 `issueSheepMoveCommand` body. Same 4-part guard (`!resource || resourceType !== 'sheep' || owner !== humanPlayerId || amount <= 0`), same `sheepMoveOrders.set` with `clamp(target.x/y)`.
2. ✓ Validator return shape `true | false | { code, message }`, never `null`.
3. ✓ `registerCommandHandlers` wiring complete — `setSheepMoveCommandDirect` in `CommandHandlerDeps`, validator + handler registered.
4. ✓ `wireBridgeOps` wiring complete — destructured at line 328, threaded into `registerCommandHandlers` deps at line 440.
5. ✓ Test coverage includes all 5 validator branches (`invalid_sheep_id`, `invalid_target`, `sheep_not_found`, `not_a_resource`, `not_a_sheep`) plus handler delegation. No coverage gap (impl-4 was caught missing `not_a_resource`; impl-7 has it).
6. ✓ Validator + handler files cite DESIGN v17 §6.2 / §6.4. No stale signatures in the diff.

### Two non-blocking observations (no action)

- **`accepted` vs mutation property** — post-1B `issueSheepMoveCommand` returns `result.accepted` (validator-passed = queued), while pre-1B returned the helper's "actually-mutated" boolean. The validator is structural-only (no ownership / amount check), so a non-owned or `amount=0` sheep would now make the facade return `true` even though `setSheepMoveCommandDirect` will silently no-op at handler time. **Harmless** — every existing call site (`humanInputOps.ts:96/134/176`) iterates `getSelectedOwnedSheepIds()`, which already filters by `owner === humanPlayerId && amount > 0`. Only race window is mid-tick ownership transfer, not exercised today. Sibling commits (`unit.move`, `unit.attack`, `unit.gather`) have the same property — accepted as the design's intentional B1/B2 split.
- **Test fixture shape** — `not_a_sheep` test constructs a `ResourceComponent` missing `maxAmount` + `baseOwner` (the type defined at `src/game/simulation/types.ts:196-202` requires both). `tsc --noEmit` passes because `world.addComponent` does not enforce exact shape, and the validator only reads `resource.resourceType`. Cosmetic; no action needed.

## Test count + gates

- 7 commands tests added (5 validator branches + 1 handler + 1 redundant — actually 6 tests in the new file).
- Total: 580 passed + 1 skipped (was 580 in the prior commit's run; the +1 net is the unit.contextAtEntity tests already counted last commit; this commit adds 6 sheep.move tests so prior was 574 + 6 = 580).
- typecheck, lint, build, full test suite all green.
- Codex review: ~3 min. Claude review: ~5 min. Both run in parallel.

## Phase 1B → next steps

6 of 15 commands complete (`unit.move`, `unit.attack`, `unit.gather`, `unit.context`, `unit.contextAtEntity`, `sheep.move`). Next per PLAN v4: `monk.contextAtEntity` — the dedicated monk context-at-entity facade that the bridge already routes to from the `unit.context` / `unit.contextAtEntity` HUD-fast-path. Then `trebuchet.pack`, `trebuchet.unpack`, `queue.train`, `queue.research`, `market.action`, `building.placeConfirm`, `building.setRallyPoint`, `building.action`.
