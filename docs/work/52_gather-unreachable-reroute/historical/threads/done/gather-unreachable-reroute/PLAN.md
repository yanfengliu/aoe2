# PLAN — gather-unreachable reroute (v0.1.47)

Root cause and design are in `DESIGN.md`. Execution (all INLINE — subagents were flaky last session):

1. **Reproduce / confirm (done).** Replay campaign-11 with `replay:inspect` + `tmp/` probes; confirm by elimination that villagers oscillate on unreachable owned sheep (`prog=0` every tick ⇒ branch-A idle→reassign, not the prog-gated give-up). Corroborated by the `playtest:findings` [high] finding.
2. **Make the change easy (done).** Extract `assignNearestResource` from `villagerEconomySystem.ts` (499 LOC, at the cap) into `bridge/villagerGatherAssignment.ts`, behaviour-preserving. Add optional `requireReachable` + `excludeResourceId` (default off → byte-identical hot paths).
3. **Make the easy change (done).** Split the `to-resource` branch A: depleted/gone → idle (as before); unreachable-but-harvestable → release slot + reachability-aware reassign excluding the unreachable target.
4. **TDD red-green (done).** Mechanism test (`villagerGatherAssignment.test.ts`, 5 incl. the probe-cap bound) + integration regression (`villagerGatherReroute.test.ts`, boxed-farm fixture; reproduces via below-fan-out-cap food-villager count, not tier). Verified the integration test fails pre-fix (food flat) and passes post-fix.
5. **Four gates (done).** `npm test` ALONE 1477/2 (+5, clean blast radius), typecheck/lint/build clean, all files < 500 LOC.
6. **Docs (done).** spec §6.4, changelog 0.1.47, summary (≤50, compacted one old line), this thread, devlog entry, roadmap campaign-11 log. `package.json` → 0.1.47.
7. **Mandatory 3-CLI review (in progress).** Codex gpt-5.5 xhigh + Claude opus[1m] max + Gemini gemini-3.1-pro plan → `2026-06-16/1/REVIEW.md`; verify each finding vs code; address; iterate to nitpick convergence.
8. **Close.** Fill the devlog reviewer line, `git mv` thread → done, commit + push v0.1.47.

## Out of scope (campaign-11 secondary findings → later slices)
- Houses may not count toward the Feudal 2-building prerequisite.
- Accepted-vs-executed UX gap (no "cannot reach target" signal).
- AI age-up prioritization (sat on 510 food in Dark Age).
- Fully-boxed villager with NO reachable resource does not gather and re-evaluates each tick, but the bounded reachability probe (`MAX_REACHABILITY_PROBES`) caps the per-tick pathfinding (3-CLI review fix; bounded, not unbounded).
