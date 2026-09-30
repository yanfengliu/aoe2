# PLAN — ai-age-up-priority (campaign-11 finding c)

1. VERIFY the finding via ground-truth replay (done): `replay:inspect` campaign-11 → owner 2 food 510 at tick 3000, 3 complete prereqs, idle TC, stuck Dark Age 6000 ticks massing Militia. Custom probe confirmed prereqs complete.
2. Diagnose root cause in `aiSystem.ts` (done): Militia pushed before the age-up research; FIFO handler spends Militia first; age-up no-ops; `savingForAgeUp` turns off at ≥500 food so the cycle repeats.
3. TDD red (done): add `ai-age-up-priority-fixture` (520 food, deep gold, no food income, TC+Barracks+Mill complete, 6 villagers) + an `aiPlayer.test.ts` integration test asserting the AI reaches Feudal within 2500 ticks. Confirmed RED (`age=dark-age food=460 militia=1`).
4. Implement fix (done, 2 iterations): iter-1 fully SUPPRESSED military while a fundable age-up was pending — green on the fixture but REGRESSED "5+ military" on the rich `ai-planner-fixture` (perpetual fundable age-up → no military). iter-2 switched to a RESERVE (`ageUpReserve` + `canAffordWithReserve`): military spends only above the age-up cost. Both green.
5. Regression guard: re-run full `aiPlayer.test.ts` (ages-up / 5+-military / barracks-rush / difficulty / monk / wonder). Then the four project gates (full `npm test`, typecheck, lint, build), re-run by the lead.
6. Docs: spec §13.2 age-up-priority rule (done), changelog + package.json bump c (user-visible AI behavior), summary, devlog (## top, reviewer pending), roadmap finding (c) resolved, this thread.
7. MANDATORY 3-CLI review (Codex + Claude + Gemini), codebase-grounded + AoE2-fidelity; synthesize `2026-06-17/1/REVIEW.md`; verify each finding vs live code; address; converge.
8. Fold reviewer comments into the devlog; `git mv` thread current → done; commit + push.

## Remaining campaign-11 findings after (c)
- (b) accepted-vs-executed UX gap (no "cannot reach target / stuck" signal). The v0.1.47 gather-reroute already removed the specific deadlock; (b) is the broader feedback-signal gap.
