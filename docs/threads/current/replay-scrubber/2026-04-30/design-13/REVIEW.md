# Replay Scrubber Design Iter-13 Review

**Date:** 2026-04-30
**Iteration:** design-13 → produces design-14 (v15 in spec)
**Reviewers:** Codex `gpt-5.5` xhigh + Claude `claude-opus-4-7[1m]` max
**Disposition:** ITERATE (Codex 2 BLOCKERs + 3 MAJORs; Claude 2 MAJORs + 3 MINORs + 2 NITs — convergent on facade-vs-helper split + queue-aware affordability)

## Convergent BLOCKER 1 — deterministic systems calling commandified facade reintroduces mid-tick submission

`productionQueueSystem` (deterministic-resolution, runs in BOTH live and replay) calls `issueUnitMoveCommand(unitId, rallyPoint)` mid-tick at `productionQueueSystem.ts:103-105` for auto-rally on unit spawn. PLAN v3 Phase 1B step 4 turned `issueUnitMoveCommand` into `world.submitWithResult('unit.move', ...)` — every existing call site, including the legitimate productionQueueSystem rally call, becomes a mid-tick submission. Reintroduces B2 (the violation v14's intention/dispatcher pattern was meant to fix).

**Fix in v15:** every `issueXCommand` ops module gets two exports — a public commandified facade (used by HUD/hotkey handlers/AI dispatcher) and a private direct-mutation helper (used by deterministic-resolution systems). `productionQueueSystem`'s rally call switches from `issueUnitMoveCommand` (facade) to `setUnitMoveCommandDirect` (helper). Plan-stage deliverable: cross-system call-site audit classifying every existing call site as "external-input" vs "deterministic-system."

## Convergent BLOCKER 2 — batched validators see pre-deduction state in AI dispatcher path

`submitWithResult` validates BEFORE queuing. Handlers run at start of next step. So in a single frame, the AI dispatcher submits N intentions; all N validators run sequentially over `world.state` BEFORE any handler deducts; all N can pass `canAfford` even when only K can actually be afforded.

This is a live-game behavior change in AI economy: AI gets observably looser. (v14's MINOR ['validators rerun'] only covered replay byte-equivalence, not live-game semantics.)

**Fix in v15:** handlers do a re-check at execution time. Validators do structural validation only (entity exists, in bounds); handlers do RESOURCE-DEPENDENT validation as a guard, abort silently on insufficient state. Recorder captures `kind: 'success'` regardless of handler's silent-noop branch — replay re-runs handler against same state → same outcome. Determinism preserved. Live UX matches today's synchronous-deduct semantics.

Same pattern for `queue.train`, `queue.research`, `market.action`, `building.placeConfirm`. Documented as "validator-plus" in §6.2.

## Codex MAJOR — wildlife auto-aggro misclassified

v14 split table marked "Wildlife wolf-decision" as live-only. Per `wildlifeCombatSystem.ts:80-...`, `prototypeWildlifeCombat` is currently ONE system doing target-acquisition + movement + damage as deterministic resolution. No separable decision half exists in code today.

**Fix in v15:** §6.6 reclassifies as deterministic resolution (always). Plan-stage: if someday wolf decisions need replay-recorded inputs, refactor then.

## Codex MAJOR / Claude MINOR-1 — stale v13 prose

§6.4 still listed `unit.action` (removed in v14) in the migration order. References to non-existent `world.registerCommandHandler` in places.

**Fix in v15:** §6.4 regenerated to match §6.1's 15-command surface. References updated to `registerHandler`/`registerValidator`.

## Codex MAJOR — PLAN re-phasing has stale references

Phase 2G said "round-trip via commands"; risk section mentioned Phase 1 round-trip; success criteria named "Phase 1C round-trip."

**Fix in v15:** Phase 2G clarified as migration equivalence (no commands); risk section updated; success criteria points to Phase 3A.5 round-trip + validator-replay-consistency.

## Claude MINOR-2 — `monkBehaviorSystem` split naming

Resolution half MUST keep `'prototypeMonkBehavior'` (because `relicGoldSystem.ts:19` declares `after: ['prototypeMonkBehavior']` and reads relic-carrier state mutated by resolution). Decision half gets new name `'prototypeMonkBehaviorDecision'`.

**Fix in v15:** §6.6 spells this out explicitly.

## Claude MINOR-3 + NIT-1 — PLAN Phase 1A wording + success criterion stale

Fixed in v15 PLAN.

## Claude NIT-2 — `BuildingActionType` naming

Today `types.ts:122` exports `ActionType = 'ungarrison'`. v15 PLAN Phase 1B step 12 renames `ActionType` → `BuildingActionType`.

## Other findings cross-checked clean

- v14's intention/dispatcher timing (live: AI pushes during step K, dispatcher submits with `submissionTick = K+1`, handler runs at start of step K+1; replay: openAt resubmits at iter t = K+1 BEFORE step processes K+1 — same boundary). ✓
- 15-command surface covers all gameplay-mutating bridge methods. ✓
- `wireReplaySystems` stub registrations cover all `before`/`after` constraint refs. ✓
- No civ-engine API changes required. ✓

## v15 changes summary

1. **NEW: facade-vs-helper split** for every `issueXCommand` ops module. `setXCommandDirect(...)` private helper for deterministic systems; commandified facade for external input.
2. **NEW: handler re-check pattern** for resource-dependent commands (`queue.train`, `queue.research`, `market.action`, `building.placeConfirm`). Silent no-op on stale-state miss.
3. **§6.6 wildlife reclassified** to deterministic resolution.
4. **§6.6 monk split naming** explicit: resolution = `prototypeMonkBehavior`, decision = `prototypeMonkBehaviorDecision`.
5. **§6.4 migration order** regenerated for 15-command surface; `unit.action` removed; per-command commit checklist expanded.
6. **PLAN Phase 2G clarified** as migration equivalence only (no commands).
7. **PLAN Phase 1A wording** softened.
8. **PLAN Phase 1B step 12** renames `ActionType` → `BuildingActionType`.
9. **PLAN risk + success criteria** updated to reference Phase 3A.5 instead of Phase 1C.

## Process notes for design-14 reviewer

- v15 deltas at top of DESIGN.md.
- Verify the facade-vs-helper pattern is comprehensive — audit which deterministic-resolution systems call which `issueXCommand` ops, and ensure each has a `setXCommandDirect` helper available.
- Verify handler re-check pattern is sufficient: any other resource-dependent commands besides queue/market/place?
- Verify the monk split naming preserves the relicGoldSystem dependency chain.
- Both reviewers should converge to ACCEPT this round IF v15 fixes land cleanly. Remaining substantive issues should escalate; otherwise plan-stage detail items only.
