# gather-stall — impl iteration 1

Reviewers: Codex (`gpt-5.5` xhigh, sandbox read-only) + Gemini (`gemini-3.1-pro` plan-mode). Gemini contamination check clean.

## Verdicts
- **Gemini: full approval** — "well-targeted, fully deterministic, untangles the gridlock without breaking the AI's tuned behavior. No modifications required." Explicitly validated thrash-prevention, the `gatherProgressTicks` reuse (reset on every entry/exit; cannot bleed into gathering progress), the same-tick reservation, determinism (stable sort, no `Math.random`/Map-order), AI/common-case preservation (normal path passes `preferUnsaturated=false`), and the test (fails without the fix). Noted the stale within-tick count as a feature (piled villagers evacuate simultaneously).
- **Codex: 1 HIGH + 1 MEDIUM**, both fixed; iter-2 **CONVERGED (findings none)**.

## Findings + dispositions
| ID | Sev | Finding | Disposition |
|---|---|---|---|
| Codex-1 | **HIGH** | `preferUnsaturated` compared saturation BEFORE the owner/baseOwner tier, so fan-out could send a villager to an unsaturated ENEMY/neutral tree over a saturated home tree — broader than "fan out within the local pile-up". | **FIXED** — owner preference is compared first; the saturation tiebreak applies only within the same owner tier (and only when `preferUnsaturated`). iter-2 verified. |
| Codex-2 | MEDIUM | Reassignment incremented the new target's count but never decremented the old one, so the stale count could move MORE than the excess (violating "only extras redistribute") and double-count on a same-resource fallback. | **FIXED** — the timeout path captures `previousTarget`, decrements its count (reservation MOVE), then reassigns/reserves the new target. Once the excess leaves, the target is no longer over-subscribed and within-cap gatherers stay put. iter-2 verified. |

## Outcome
CONVERGED. Code clean, deterministic, AI-preserving. The fix was found and root-caused with the engine's replay debugging (not a synthetic repro) — both the LLM conformance finding ("wood gather broken") and a subagent's synthetic-repro hypothesis ("enemy attrition") were disproven by replaying the actual bundle. TDD: `villagerGatherSpread.test.ts` (discriminating); AI age-up regression preserved.
