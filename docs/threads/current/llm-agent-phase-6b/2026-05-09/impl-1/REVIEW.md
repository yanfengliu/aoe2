# Phase-6.B per-owner visibility-gating — impl-1 review synthesis

Date: 2026-05-09. Iteration 1. Reviewers: Codex (gpt-5.5 xhigh), Claude (Opus 4.7 1M, max effort).

## Verdict

**Both reviewers converged on one HIGH bug + one MED test gap + one LOW docstring inaccuracy.** All addressed inline. Plumbing layers (bridge interface, omniscient precedence, smoke baseline preservation, CLI flag chain, file sizes) verified clean by both.

## HIGH

### H1 — Buildings filtered by anchor cell only, not full footprint

**Surfaced by:** Codex finding 1, Claude finding HIGH (overlap).

**Issue:** `enemiesFor` ran `visibility(ownerId, Math.floor(b.x), Math.floor(b.y))` on buildings. But `EconomyState.buildings` carries multi-cell `footprintWidth`/`Height`, and the engine's renderer + target selection use the any-cell-visible rule (`isFootprintVisible(visibility, playerId, x, y, w, h)`). With anchor-only filtering, a 4x4 castle anchored at (5,5) with only cell (8,5) visible would be omitted from the snapshot — even though the LLM would see it in the screenshot. Inconsistent context = bad LLM decisions.

**Fix applied:** added an inlined `isFootprintVisible(visibility, ownerId, anchorX, anchorY, w, h)` helper to `agentSnapshot.ts` (5-line nested loop, mirrors `pureHelpers.ts:isFootprintVisible` semantics). Buildings now go through the footprint walk; units stay anchor-only (1x1). Inlining avoids importing engine internals from playtest/.

## MEDIUM

### M1 — No test coverage for the building filter path

**Surfaced by:** Claude finding MED.

**Issue:** All 5 new visibility-gating tests used `economyWithEnemyAt` which constructs a single-`unit` enemy. The building branch was untouched — which is exactly why the H1 bug slipped past initial review.

**Fix applied:** added 2 building-footprint tests:
- "shows buildings visible only at a far footprint corner (any-cell rule)" — 4x4 castle anchor (5,5), only cell (8,5) visible, asserts the building is included.
- "omits a fully-fogged building (no footprint cell visible)" — 4x4 castle, probe always false, asserts the building is dropped.

## LOW

### L1 — Bridge docstring overpromises composition with `isFootprintVisible`

**Surfaced by:** Claude finding LOW.

**Issue:** `SimulationBridge.isCellVisibleForOwner`'s docstring said the agent snapshot uses it "combined with `isFootprintVisible`," but the live impl was anchor-only. With H1 now fixed, the docstring describes the actual behavior — but I rewrote it to be more accurate (single-cell probe + caller composes the footprint walk for buildings, single-cell for units).

**Fix applied:** docstring updated.

## No-issue verifications

- **Bridge interface contract** (Codex + Claude): live impl is one-line `visibility.isVisible` pass-through, replay returns permissive `true`, `BrowserTestBridge` has the new method.
- **Omniscient precedence** (Codex + Claude): correct. omniscient=true wins over probe; default omniscient=false + no probe degrades to cheat-mode (backward compat).
- **Smoke baseline preserved** (Claude): `playtest-corpus-llm.json` smoke row now has `"omniscient": true`. Behavior bit-identical to pre-fix; baselines remain valid.
- **CLI flag plumbing end-to-end** (Codex + Claude): truthy guard in corpus runner, default in playtest-llm.mjs, captured by closure in makePlaywrightHost, page.evaluate forwards as 2nd arg.
- **File size budgets** (Claude): `agentSnapshot.ts` 230 LOC; test ~370 LOC; `createSimulationBridge.ts` ~451; `browserTestApi.ts` ~473. All under 500.
- **Backward compat for non-LLM consumers** (Claude): only `installBrowserTestApi` consumes `BrowserTestBridge`, always with the live `SimulationBridge`. Replay test stub uses an `as unknown as` cast and doesn't touch `isCellVisibleForOwner`. RunnerHost.snapshotForAgent stayed single-arg (omniscient is captured below the runner abstraction).

## Disposition

H1 + M1 + L1 addressed inline. Re-review next iteration.
