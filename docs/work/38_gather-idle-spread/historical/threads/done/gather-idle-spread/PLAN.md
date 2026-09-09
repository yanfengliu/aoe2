# Implementation plan — gather-idle-spread (Loop 1 follow-up)

1. **Find** (engine replay, per the AGENTS rule): replay campaign-5 → 15 of 16 woodcutters still on ONE tree; idle→assign re-piles them. ✅
2. **Change** (`villagerEconomySystem.ts`): `assignNearestResource` gains `spreadCap`; idle→assign fans out at the generous `IDLE_ASSIGN_SPREAD_CAP=4`; the stuck-villager redistribute keeps the tight cap (2). ✅
3. **Guard the AI**: the generous cap clears the AI's natural 2-3 clustering. Confirmed: AI age-up FAILS at cap 2, PASSES at cap 4. ✅
4. Gates → multi-CLI review (Codex + Gemini): both CONVERGED. ✅
5. v0.1.25 + changelog; devlog. ✅
6. (follow-up) Codex note: a targeted idle→assign regression test (hard via the bridge API — no targetResourceId exposed; would need a world-level seam). Not blocking.
7. (deferred) A confirming playtest once the claude CLI recovers — the subscription degraded mid-loop (campaign-6 stalled).
