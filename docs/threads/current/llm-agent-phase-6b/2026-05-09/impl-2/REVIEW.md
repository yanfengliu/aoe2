# Phase-6.B per-owner visibility-gating — impl-2 review synthesis

Date: 2026-05-09. Iteration 2. Reviewers: Codex (gpt-5.5 xhigh), Claude (Opus 4.7 1M, max effort).

## Verdict

**Both reviewers APPROVE.** Phase-6.B converged.

- Codex: "No substantive issues found. Ship it from this review's perspective."
- Claude: "All three iter-1 findings (H1, M1, L1) are correctly addressed. No new issues. Ready to merge."

## Per-finding verification

- **H1 (building footprint)** — Both reviewers verified `isFootprintVisible` in `agentSnapshot.ts` is semantically equivalent to the engine's `pureHelpers.ts:isFootprintVisible`: floors anchor, walks `0..h-1 × 0..w-1`, returns true on first visible cell. Building branch in `enemiesFor` now uses it; unit branch unchanged.
- **M1 (test coverage)** — Both verified the new far-corner test correctly fails under the iter-1 anchor-only impl and passes under iter-2. Symmetric negative test (fully-fogged building) included.
- **L1 (docstring)** — Both verified the bridge docstring now matches the live composition (single-cell probe in bridge, footprint walk in caller).

## Other verified-clean items (Codex + Claude)

- Unit (1x1) path unaffected by the building changes.
- `EconomyState.buildings.footprintWidth/Height` are required `number` fields per `types.ts:336-340` — TypeScript guarantees no `undefined` slips through `isFootprintVisible`. The engine's `buildingFootprint(buildingType)` table covers every `BuildingType`.
- Architecture: helper hoisted to module scope, exported `VisibilityProbe` type, `agentSnapshot.ts` 267 LOC (<500), no engine-internal imports.
- The decision to inline the helper rather than import from `pureHelpers.ts` is a sensible decoupling — playtest harness doesn't cross the engine-internal boundary.

## Disposition

Phase-6.B converged. Landing.
