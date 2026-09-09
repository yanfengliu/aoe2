# REVIEW — dark-age-palisade, iteration 1 (2026-06-14)

**Change:** enable Palisade Walls in the Dark Age (move `palisade-wall` from the Feudal+barracks block into the always-available Dark-Age list in `getBuildOptions`). Surfaced by campaign-7 (ground-truth replay): the LLM agent was rushed and wiped out by the AI in the Dark Age with no walling option. AoE2: the Palisade Wall is a Dark-Age building with no prerequisite.

**Reviewers:** Codex (gpt-5.5 xhigh) · Claude (opus[1m]) · Gemini (gemini-3.1-pro). Diff via stdin.

## Verdicts — converged (2/3 clean; Codex inconclusive)

| Reviewer | Verdict |
|---|---|
| Gemini | **Correct and complete, fully verified** (all 6 points). |
| Claude | **Correct and complete — "ship it"** (all 6 points; verified even the secondary gate `trainingMarketOps.ts:389` + the agent prompt path `llmPromptBuilder`). |
| Codex | **Inconclusive** — its read-only sandbox blocked its attempt to run the tests ("Access is denied" on the vitest config); it surfaced no substantive code finding, only the expected thread-path note (changelog references `docs/threads/done/...` while the thread is in `current/` — resolved by the standard thread→done move at commit). |

Both clean reviewers independently confirmed: `getBuildOptions` is the **single** gate for surfacing AND placement validation (`buildingPlaceConfirmValidator.ts:88` + the authoritative re-check `trainingMarketOps.ts:389` + HUD `selectionStateOps` + agent `llmPromptBuilder`), so the one change enables building, placing, and seeing palisade-wall; it appears **exactly once** per age (moved, not duplicated); it's a **functional** building (250 HP, 2 wood, 1×1, attackable obstacle); **no regression** (only the one exact-match test `createSimulationBridge.darkAge.test.ts` needed updating; all others use `.toContain`/`arrayContaining` or stub `getBuildOptions`; no test asserts `not.toContain('palisade-wall')`); **AoE2-accurate**; docs accurate.

## Findings & disposition

| ID | Severity | Source | Finding | Disposition |
|---|---|---|---|---|
| 1 | LOW (cosmetic) | Claude | `fu3DefensiveFire.test.ts:267`'s name/fixture imply a "Feudal + Barracks → palisade-wall" prerequisite that no longer exists; it still passes (`.toContain`) but no longer tests a real gate. | **Deferred (documented follow-up).** Non-blocking, not a regression — rename/repurpose when convenient. |
| 2 | LOW | Claude | Devlog entry not yet written. | **Fixed** — devlog detailed + summary added this iteration. |
| 3 | INFO | Codex (sandbox) / process | Codex couldn't run tests (read-only sandbox denied the config); Claude initially returned empty (subscription throttled after a heavy session: campaign-7 + findings + prior reviews), then returned on completion. | **Noted.** Review CLIs degrade under heavy session load; convergence rests on Gemini + Claude (both clean) + all gates green. Retry Codex's clean verdict next iteration if material. |

## Gates

`typecheck` ✅ · `lint` ✅ · `build` ✅ · **full suite ✅ (1255 passed, 2 skipped)** · affected tests (buildOptionsDarkAge 4, darkAge 6, buildingPlaceConfirm 20, buildingOptionsOps 6). Contamination audit after Gemini: clean.

**Disposition: ship.** Converged (2/3 clean, no substantive findings); the one exact-match test updated + a new test pins the invariant (Dark-Age availability, no barracks prereq, no duplicate). The live early-defense impact is validated by the next playtest re-run (per the roadmap's campaign-7 follow-ups).
