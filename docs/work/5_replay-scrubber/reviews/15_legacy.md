# Replay Scrubber Design Iter-16 Review

**Date:** 2026-04-30
**Iteration:** design-16 → produces design-17 (v17 in spec)
**Reviewers:** Codex `gpt-5.5` xhigh + Claude `claude-opus-4-7[1m]` max
**Disposition:** ITERATE → near-convergence (Codex 2 BLOCKERs + 1 MAJOR; Claude 2 MAJORs + 1 MINOR — all mechanical accuracy fixes; design substantively unchanged)

## Codex BLOCKER 1 — validator return shape

DESIGN/PLAN said validators return `null` to accept. Ground truth `CommandValidationResult = boolean | CommandValidationRejection` per `world.ts:130` + `world-internal.ts:81`. `null` is invalid and throws.

**Fix in v17:** `return true` to accept; `false` for generic reject; `{ code, message, ... }` for detailed reject. NEVER `null`. Updated DESIGN §6.2 + PLAN Phase 1B step 1.

## Codex BLOCKER 2 / Claude MINOR — helper unit-existence guard weaker than facade

`world.isAlive(unitId)` returns true for any alive entity (buildings, resources). Facade uses `world.getComponent('unit')` which is null unless entity is alive AND has the unit component. v16's helper used `isAlive` only — a non-unit entity could get a move command attached.

**Fix in v17:** helper uses `getComponent<UnitComponent>(unitId, 'unit')` to exactly mirror the facade. All paths (live, replay, deterministic-system) use the same guard.

## Codex MAJOR / Claude MAJOR-1+2 — `result.kind === 'success'` stale

`submitWithResult` returns `CommandSubmissionResult = { accepted: boolean, code, message, details?, tick, sequence }` (`world.ts:132-144`). No `kind` field. v16 fixed §6.2 example but missed §6.3 facade pseudocode and v15-deltas line 64 prose.

**Fix in v17:** §6.3 → `if (result.accepted) issued = true;`. Line 64 prose → "Recorder still captures the execution as `executed: true` (handler ran without throwing)..."

## Other findings cross-checked clean

- ✓ All earlier iterations' fixes hold.
- ✓ Validator/handler timing matches civ-engine.
- ✓ No civ-engine API changes required.
- ✓ Handler-side coordinate clamping is sound.
- ✓ PLAN v4 phase structure matches v17 design.
- ✓ Wildlife reclassification, monk split naming, intention/dispatcher pattern all cleanly verified.

## v17 changes summary

1. Validator returns `true | false | CommandValidationRejection`, never `null`.
2. Helper uses `getComponent('unit')` not `isAlive`.
3. `result.accepted` (not `result.kind`) throughout examples.
4. Recorder captures `executed: true` (not `kind: 'success'`).
5. PLAN.md v4 step 1 wording aligned with v17 validator API.

## Convergence assessment

After 16 iterations, the architecture is settled across all axes:
- Bridge-state migration to `world.state.aoe2.*` (Phase A, v1-v11).
- Commandify input via 15 commands (v13-v17 §6.1-§6.6).
- AI intention/dispatcher pattern (v14 §6.5 — addresses civ-engine determinism contract).
- Validator + handler split with handler re-checks for state-dependent commands (v15 §6.2).
- Facade-vs-helper duality for ops modules (v15 §6.4).
- Replay scrubber UI on top of bridge-state migration + commandify (§5.3-§5.7).

v17 fixes accuracy-only items. Reviewers agree the design is at convergence; v17 → ACCEPT expected.

## Process notes for design-17 reviewer

- v17 deltas at top of DESIGN.md.
- Verify all `result.kind` references gone (grep `kind:` and `result.kind`).
- Verify all `null` validator returns gone (grep `return null` in DESIGN/PLAN).
- Verify helper uses `getComponent` not `isAlive`.
- Both reviewers should ACCEPT this round; if anything new surfaces, escalate.
