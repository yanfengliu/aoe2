# Implementation plan — gather-stall

1. **Diagnose via engine replay** (per the new AGENTS rule): `replay-inspect` campaign-4 → confirm 14/18 villagers piled on one tree, 0 gathering. ✅
2. **Test** (`tests/simulation/villagerGatherSpread.test.ts`): pile every player-1 villager onto one tree; run short (before the tree depletes); assert they fan out (>=2 of player-1's nearby trees chopped) + the target's wood drops. Verify it FAILS without the fix. ✅
3. **Fix** (`villagerEconomySystem.ts`): per-tick `gatherTargetCounts`; over-subscribed-timeout-redistribute (preferUnsaturated reassign); reservation move. ✅
4. **Guard the AI**: keep normal idle→assign nearest-first (`preferUnsaturated=false`); confirm the AI age-up test passes (the global-saturation version broke it). ✅
5. Gates → multi-CLI review (Codex + Gemini): Gemini APPROVED; Codex HIGH (owner-pref ordering) + MEDIUM (reservation move) fixed → iter-2 confirm. ✅
6. v0.1.24 + changelog + spec note (none needed — no new rule, an existing-behavior bugfix); devlog. ✅
7. Loop 2: re-run a short playtest → replay-inspect to confirm wood flows + surface the next bug.
