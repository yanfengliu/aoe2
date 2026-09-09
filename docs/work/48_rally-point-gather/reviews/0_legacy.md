# Rally-point-to-resource auto-gather (v0.1.31) — Review iteration 1

Change under review: a villager trained from a building whose rally point sits on a harvestable resource auto-gathers it (sets `gatherer.desiredResource` + `hasExplicitGatherOrder` and lets `villagerEconomySystem` route it), instead of moving to the rally cell and idling. Contained to `src/game/simulation/bridge/systems/productionQueueSystem.ts` (+ a one-line dep wire) + `tests/simulation/createSimulationBridge.darkAge.test.ts` + spec §9.3 + docs.

Reviewers: Codex (gpt-5.5, xhigh, read-only sandbox), Claude (opus[1m], --effort max, Read/Glob/Grep), Gemini (gemini-3.1-pro-preview, plan mode). All three read the live codebase. Gemini hit transient SSL `ERR_SSL_SSLV3_ALERT_BAD_RECORD_MAC` errors and recovered after backoff (review completed). Post-run contamination audit: clean (no unstaged working-tree writes).

## Verdict: SHIP — converged

Gemini APPROVED ("no issues found"). Claude: ship — no code defects, one real doc-hygiene finding. Codex: two MEDIUM (one real correctness edge, one doc-hygiene). All three independently verified determinism (direct mutation only — no mid-system `submitWithResult`), the hand-off to `villagerEconomySystem` (the `shouldMaintainGatheringOrder` gate flips true once `hasExplicitGatherOrder` is set; the fresh villager has position+gatherer+no command so idle→assign picks it up every tick), and boundedness (non-villager / empty-ground / non-economy / depleted / missing-gatherer all fall back to MOVE). No functional defect survived.

## Findings and disposition

| # | Severity | Source | Finding | Disposition |
|---|---|---|---|---|
| 1 | MEDIUM | Codex (Claude noted as minor) | `rallyResourceKind` gated on `amount > 0`, not the canonical `isHarvestableResource`. A live boar/sheep maps to `food` but is not gatherable until killed (`cellPassability.ts:197-208` rejects live wildlife), so a rally onto a live animal handed the new villager a generic food intent → it sought some OTHER food node instead of preserving MOVE. | FIXED — threaded `isHarvestableResource` (already in `registerAllSystems` scope) into the system and use it in `rallyResourceKind`; a rally onto live wildlife / relics now falls through to MOVE. Spec §9.3 notes the live-animal case. |
| 2 | LOW | Codex + Claude | Docs ahead of reality: changelog claimed "full suite green" and linked `docs/threads/done/rally-point-gather/`, but the thread was under `current/` and the devlog said review/suite "pending". | FIXED — this REVIEW.md written, thread moved `current/`→`done/`, devlog reviewer-comments + suite-status placeholders filled. The full suite is green, so the changelog claim now holds. |
| 3 | TRIVIAL | Codex | "new villager defaults to food" wording: Codex said the 4th villager defaults to gold. Claude verified the *trained* villager here is the 7th (ordinal 6) → `food` via `assignVillagerRole`, and the assertion is a robust delta regardless. | FIXED — test comment reworded to reference the ordinal-6 default + the delta-robustness rather than a blanket "defaults to food". |
| — | minor | Claude + Gemini | The full-map `world.query('position','resource')` scan per rallied spawn is O(resources); `rallyResourceKind` picks the first resource on the cell (cell-exclusivity makes this a safe deterministic tie-break). | No change — runs only on the rare spawn-from-rallied-building event; mirrors the economy system's existing scan. |

## Verified-correct claims (cross-checked against the codebase by all three)

- **Determinism:** the new code submits no commands; it reads (`world.query`/`getComponent` + the pure `resourceKindToEconomyResource`) and directly mutates the new villager's gatherer — the sanctioned analog of the `issueUnitMoveCommand: setUnitMoveCommandDirect` wiring (`registerAllSystems.ts`). The only `submitWithResult` on the path (`building.setRallyPoint`) runs as a human-input op outside the tick.
- **Hand-off:** `shouldMaintainGatheringOrder = owner !== HUMAN || hasExplicitGatherOrder` (`pureHelpers.ts`) → the human villager qualifies once the flag is set; idle→assign (`villagerEconomySystem.ts:278`) runs for the command-less fresh villager every tick → always assigned (same tick if execution follows registration order, else next).
- **`task='idle'` (not `'to-resource'`):** correct — idle→assign sets `task`+`targetResourceId` itself; setting `to-resource` with a null target would bounce back to idle.
- **Test:** genuinely RED without the fix (training the ordinal-6 → food villager can't raise the wood count); `getUnitTaskState` reports `to-resource`/`gathering` (not masked as `moving`, since no move command is issued); 250-tick train budget < the test's 600-tick window — not flaky.
- **Cleanliness:** 189 LOC (< 500); the ~10-line cell scan intentionally does NOT reuse the human-fog-gated `findResourceAtCell` (wrong for a deterministic system) and returns an economy kind, not an entity id.
