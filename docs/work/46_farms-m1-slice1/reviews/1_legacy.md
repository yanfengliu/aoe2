# Farms (M1 slice 1, v0.1.34) — Review iteration 2 (fix verification)

The subagent fixed all four iter-1 findings; the main agent re-verified (typecheck/lint + 14 affected tests green, the `canGatherResource` helper read + confirmed) and ran a focused iter-2 3-CLI review asking each reviewer to confirm each fix is COMPLETE (especially whether the HIGH covers ALL gather entry points) and scan for new issues.

Reviewers: Codex, Claude (opus[1m]), Gemini — all read the live codebase. Full suite re-run by the main agent: 1282 passed, 0 failed.

## Verdict: UNANIMOUS APPROVE — all four fixes complete + correct, no new issues

| Fix | Codex | Claude | Gemini |
|---|---|---|---|
| HIGH food-theft (canGatherResource at 3 paths) | ✅ complete | ✅ complete | ✅ complete |
| MEDIUM visibility owner (building-first) | ✅ | ✅ | ✅ |
| MEDIUM rallyPoints orphan | ✅ | ✅ | ✅ |
| LOW selectable double-count | ✅ | ✅ | ✅ |

## Key verification (the HIGH — all gather paths)
Claude grepped EVERY `targetResourceId =` write: only two sites assign a specific resource and both are gated — `assignNearestResource` (villagerEconomySystem, the single function behind all three auto-assign callers incl. the stuck-reseek path) and `setUnitGatherCommandDirect` (the sole mutation behind `unit.gather` + both context routes). Every other write is `= null`. The intent-only paths (rally-to-resource `productionQueueSystem`, AI rebalance `aiDecisionOps`) set only `desiredResource` and route through the gated `assignNearestResource`, so they inherit the gate (an enemy-farm rally resolves to other food/idle, never theft); the context routes additionally hit the building→ATTACK branch before gather. `unitGatherValidator` gates the command channel. Codex + Gemini independently confirmed the same. `resourceIsOwnedStructure = getComponent(id,'building')!==undefined` is true only for farms (the sole resource+building hybrid), so no false positives. The integration test is non-vacuous (P2's villager genuinely seeks food via `assignVillagerRole` ordinal-0 + `shouldMaintainGatheringOrder` true for non-human; only the gate stops it).

## New-issue scan: none blocking
Determinism clean (no random/time). No wrong-block of legitimate gather (own farm allowed; a neutral resource with a building component cannot exist). Informational only (no action this slice): the gate keys on `resource.baseOwner` while visibility keys on `building.owner` — set equal at creation, no ownership-transfer mechanic exists; ownership is checked at assignment not re-checked mid-gather. Revisit both IF a future slice adds farm capture.

## Lesson
The multi-CLI review earned its keep: a fresh-context subagent + the main agent's own read BOTH missed the food-theft HIGH (an owned-structure resource leaking into neutral-gather paths); only Codex's adversarial pass caught it. Delegating implementation to a subagent does NOT reduce the need for the independent multi-CLI gate — if anything it raises it, since the implementer's context can't see its own blind spot.
