# gather-idle-spread — impl iteration 1

Reviewers: Codex (`gpt-5.5` xhigh, sandbox read-only) + Gemini (`gemini-3.1-pro` plan-mode).

## Verdicts — both CONVERGED
- **Gemini:** "Outstanding surgical fix. No regressions, off-by-ones, or thrashing paths found." Validated: cap 4 masks saturation for the AI's natural 2-3 clustering (sorts by distance as before) while spreading piles > 4; the dual-cap synergy (assign cap 4 / redistribute trigger > 2 + spread cap 2); determinism (stable sort, no Map-order/random); O(N) per-tick count; the all-saturated fallback can't ping-pong.
- **Codex:** "CONVERGED. I found no correctness, determinism, performance, or thrash issue." Confirmed the cap coherence (idle saturated at >= 4; redistribute triggers at > 2, spreads at < 2), owner-tier resolved before saturation (no cross-tier jumps), deterministic count lookup, and the release-before-redistribute reservation move.

## Note (non-blocking)
Codex: the existing `villagerGatherSpread` test mostly exercises the explicit pile/to-resource (redistribute) path; the AI age-up test guards the cap=2 regression. A targeted idle→assign regression test would harden it, but Codex "would not block this change on that." It is hard to write via the bridge API (`EconomyState.villagers` exposes no `targetResourceId`); a world-level test seam (like `replay-inspect` uses) would be needed. Logged as a follow-up.

## Outcome
CONVERGED. The generous-cap design is the load-bearing choice — it reconciles "spread the player's extreme pile" with "leave the AI's tuned economy untouched," proven by the AI age-up test passing at cap 4 where it failed at cap 2. Found via engine replay of campaign-5; a confirming playtest is deferred (claude subscription degraded mid-loop).
