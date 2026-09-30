# Replay Scrubber Design Iter-15 Review

**Date:** 2026-04-30
**Iteration:** design-15 → produces design-16 (v16 in spec)
**Reviewers:** Codex `gpt-5.5` xhigh + Claude `claude-opus-4-7[1m]` max
**Disposition:** ITERATE (Codex BLOCKER + MAJOR; Claude MAJOR-1 + MAJOR-2 + 3 MINOR/NITs — convergent on example-code accuracy; no architectural changes needed)

This iteration verified the validator/handler split and PLAN consistency. Issues found are example-code accuracy against ground truth, not design defects.

## Convergent BLOCKER/MAJOR — `setUnitMoveCommandDirect` doesn't fully mirror facade

`unitCommandOps.ts:116-130`'s `issueUnitMoveCommand` enforces FIVE invariants. v15 spec listed only three:

| # | Invariant | Source | In v15 spec? |
|---|-----------|--------|--------------|
| 1 | Unit-existence guard | `unitCommandOps.ts:117-118` | ❌ |
| 2 | `clearGathererOrder(unitId)` | `unitCommandOps.ts:120` | ✓ |
| 3 | `monkTasks.delete(unitId)` | `unitCommandOps.ts:121` | ✓ |
| 4 | `movePathCache.delete(unitId)` (in `setUnitCommand`) | `bridgeHelpers.ts:112` | ❌ |
| 5 | Target clamp `[0, mapWidth-1] × [0, mapHeight-1]` | `unitCommandOps.ts:124-127` | ❌ |

#4 is consequential: stale `movePathCache` makes the unit follow the OLD A* path after a new move command. Manifests as freshly-spawned units briefly following defunct paths.

**Fix in v16:** spec body shows the helper as 5 explicit steps + delegates to existing `setUnitCommand` helper (which internally handles steps 4 + 5b). Handler `unitMoveHandler` delegates to the helper — single code path for live, replay, deterministic-system.

## Codex MAJOR / Claude MINOR — civ-engine API references stale

- `world.hasEntity` → ground truth is `world.isAlive(entityId)` (`world.ts:424`).
- `result.kind === 'rejected'` → `submitWithResult` returns `{ accepted: boolean, ... }` per `world.ts:792, 132`.
- "Submit unknown command throws" → ground truth queues then fails at `processCommands` with `missing_handler` (`world.ts:1774`).

**Fix in v16:** corrected references in §6.2 example + PLAN test wording.

## Claude MAJOR-2 — coordinate clamping unspecified

`unitCommandOps.ts:124-127`, `placementOps.ts:109-110/162-163`, `trainingMarketOps.ts:350-353` all clamp coordinates before mutation. New handlers in §6.2/§6.4 didn't mention clamping.

**Fix in v16:** §6.2 B2 fix prose adds explicit "Coordinate clamping" paragraph: HANDLER clamps; validator rejects only structurally-invalid (NaN, non-integer). All position-bearing commands (`unit.move`, `sheep.move`, `unit.context`, `building.setRallyPoint`, `building.placeConfirm`).

## Claude MINOR-2 — validator code/message mismatch

`'unit_not_owned'` code with message "Entity is not a unit" describe different failure modes.

**Fix in v16:** code → `'not_a_unit'` (matches the actual failure mode).

## Claude NIT-1 — `issuedAt` field not in current UnitCommand

`sharedTypes.ts:10` `UnitCommand` doesn't include `issuedAt`; current `setUnitCommand` doesn't write it.

**Fix in v16:** removed from sample handler. If needed for replay analysis, plan-stage decision adds it to the type explicitly.

## Claude NIT-3 — cost re-derivation subtlety

For `market.action`, gold cost depends on `marketExchangeRates` which prior handlers in the same frame may have mutated. v15 said "same pattern" without making cost-must-be-re-derived explicit.

**Fix in v16:** §6.2 B2 fix prose adds: "**cost MUST be re-derived from current `marketExchangeRates`**". Same applies to `queue.research`'s `inFlightTechByOwner` re-check (per `trainingMarketOps.ts:195`).

## Other findings cross-checked clean

- ✓ Validator/handler timing matches civ-engine semantics.
- ✓ No civ-engine API changes required.
- ✓ PLAN v4 internal consistency (header, Phase 1B, Phase 1C, Phase 2G, Phase 3A.5, success criteria, risks all aligned).
- ✓ Wildlife reclassification, monk split naming preserve constraint chains.
- ✓ Facade-vs-helper split conceptually sufficient (only `unit.move` direct helper needed today).
- ✓ Handler re-check pattern preserves UX + economic invariant.

## v16 changes summary

1. **Helper invariant set spelled out** — 5 explicit steps; handler delegates to helper for single code path.
2. **API names corrected** throughout — `world.isAlive`, `submitWithResult` returns `{accepted}`, unknown command queues+fails-at-processing.
3. **Coordinate clamping** specified as handler responsibility.
4. **Cost re-derivation** explicit for `market.action` and `inFlightTechByOwner` for `queue.research`.
5. **Validator code/message** mismatch fixed.
6. **`issuedAt` removed** from sample (deferred to plan-stage).
7. **PLAN test wording** corrected for unknown-command behavior.

## Process notes for design-16 reviewer

- v16 is the convergence iteration. Substantively unchanged since v15; all updates are example-code accuracy.
- Verify the 5-step helper body matches `unitCommandOps.ts:116-130` + `bridgeHelpers.ts:111-114` invariant set. Any missed invariant → flag.
- Verify `world.isAlive` exists at `world.ts:424` and `submitWithResult` returns shape `{ accepted: boolean, ... }` (Codex+Claude both verified).
- Both reviewers should ACCEPT this round. If new issues surface, they should be plan-stage detail only.
