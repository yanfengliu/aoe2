# A relic in a Monastery pays 0.5 gold a second, as in Definitive Edition

Status: active
Owner: Coordinator worker w127-relic-gold (coordinator: AOE2 repo coordinator setup)
Created: 2026-10-14
Updated: 2026-10-14

## Problem and outcome

`src/game/simulation/bridge/systems/relicGoldSystem.ts` pays +1 gold per garrisoned relic on every tick. The spec's target (design/spec-final.md, Appendix A: "target baseline: 0.5 gold per second per garrisoned relic") is DE's rate. Work 120 M4's worker reported the code at 10 gold a second, about 20 times the target. Confirm the tick rate before relying on that factor.

The Aztec team bonus ("Relics generate +33% gold") is paid as one extra gold every third tick on top of that, so it is wrong by the same factor.

Outcome: each relic garrisoned in a Monastery pays 0.5 gold a second, and the Aztec bonus pays a third more. Both are paid by deterministic integer accounting, so replays stay exact.

## Scope

- Reserved for this work: relicGoldSystem.ts, its tests, and the spec and HUD text that state the relic rate.
- Off limits while they run:
  - work 120 M4 (civBonusTable, civBonusEffects, the gather systems, civilizations.csv, civProfiles.ts);
  - work 125 (the HUD cost text);
  - work 126 (foundation claims, foundationStart, construction start, delete refunds);
  - work 123 (browser specs near their limits, the playwright reporters, .github/).
- If the AI's relic play or a self-play gate depends on the old rate, report it rather than retune the AI.

## Approach

Reproduce the rate in a match first: count the gold one relic yields over a fixed number of ticks. Pay it from an integer count of relic-ticks with no float. The Aztec rate follows from the same count. Say what a game saved mid-count does: a part-second remainder may be lost once at load, or kept if it is already in saved state; say which. Gate the rate over a long window for one relic, several relics, several Monasteries and an Aztec ally. Prove each gate red by mutation, and check that the HUD's relic readout, if any, states the same rate.

## Acceptance criteria

- One relic yields 0.5 gold a second over a long window, to the exact integer the accounting promises. N relics yield N times as much, and the Aztec team bonus yields a third more.
- Each gate goes red with the old per-tick rate restored.
- The register entry (agent-observed, found by work 120 M4), a changelog line with a version bump at landing, the devlog lines and the spec line are present.
- `npm run verify` exits 0 with its log read through the build, `node scripts/verify-receipt.mjs check` prints OK, and the change is on main.

## Implementation steps

- [x] Reproduce (2026-10-14). The simulation runs 10 ticks a second (`TPS = 10`; the bridge turns 1,000 ms into exactly 10 ticks). A relic a Monk carried into a Monastery through right-click orders paid 600 gold in each of ten minutes, 10 a second; three relics on an Aztec side paid 24,000 in ten minutes.
- [x] Fix with integer accounting. By the end of tick n a relic has earned floor(n × gold-per-minute / 600) gold, and each tick pays what that total crosses: one gold every 20th tick, every 15th on a side with the Aztecs (40 a minute, Forgotten Empires' 1.5 seconds a gold). No float and no new saved state: the schedule reads the tick number and the saved relic counts, so a game saved mid-period loads onto the same schedule and loses nothing. The part-period fraction DE keeps is not kept: a relic that comes or goes part way through a period can be paid up to one gold more or less.
- [x] Gate. `tests/simulation/relicGoldRate.test.ts`, 8 cases, 7 red with the old file, and seven other mutations each red. The two checks that pinned the old rate, and the AI relic case whose gold proxy measured it (coordinator-approved), are updated. 25 self-play and economy files are green: no relic is ever stored in the castle or lab gate matches.
- [x] Record: register entry, changelog line under "Unreleased — work 127", devlog lines, spec §6.9, the team-bonus line and Appendix A.
- [ ] Land: version, `npm run verify` under the gate lock, the receipt check, push.

## Outcome

Pending: phase 1 is on branch `relic-gold`, awaiting the coordinator's acceptance.
