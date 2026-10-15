# The computer's Monks collect the relics it knows about, as in Definitive Edition

Status: planned
Owner: Claude coordinator (Game orchestrator todos); worker to be named
Created: 2026-10-15
Updated: 2026-10-15

## Problem and outcome

The computer never stores a relic in a full match. Work 127's worker measured it on 2026-10-14 with a probe of the castle self-play configuration on `aoe2-prototype` (45,000 ticks, relics at (24,24) and (36,10)): owner 2 reached the Imperial Age, built its first Monastery at tick 24,200 and its first Monk at 25,000, and had two Monks at the end; it had seen (36,10) at tick 1,000 and (24,24) at 24,400. Neither relic was ever picked up, and the lab configuration did the same. The cause it named: the AI's Monks look only for a relic in sight at that moment (`findNearestVisibleNeutralRelic` in `src/game/simulation/bridge/monkAiSearchHelpers.ts`, called from `monkTaskOps.ts`), so a relic the AI found and then lost sight of is never sought.

In Definitive Edition the computer gathers relics with its Monks once it has a Monastery, which is a large part of its Castle Age play and of its gold. Outcome: a computer seat with a Monastery and Monks goes for the relics it knows about and brings them home, by DE's rules for what the computer knows, so a match against it plays the relic game as DE does.

## Scope

- Reserved for this work: `monkAiSearchHelpers.ts`, the AI Monk task code in `monkTaskOps.ts` and its appliers, their tests, a fixture, and the spec lines on the computer's relic play.
- Included if the source says DE does it: how many Monks the computer sends for relics, and whether it explores to find them.
- Excluded: the human player's Monks; relic gold (work 127); Atheism (a card in work 106's queue); retuning other AI behaviour to make a self-play gate pass.
- Off limits while they run: work 126 (foundation claims, foundation start, placement and construction-start files), work 124 M2 (scripts/verify-receipt*, scripts/run-directly.mjs and its callers, AGENTS.md, local-rules, docs/learning).

## Approach

Reproduce first: a fixture where a computer seat with a Monastery and a Monk has explored a relic that is now out of sight, and the 45,000-tick castle configuration. Source DE's rule for what the computer knows about relics (AI scripting references, patch notes, the AI's own behaviour as documented); if no source settles it, the fair rule is the ground the seat has explored, stated as a bound. The computer may not use what its seat has never seen unless DE's computer does.

## Acceptance criteria

- A fixture case, red before the fix: a computer Monk fetches a relic its seat explored but no longer sees, and stores it in its Monastery. A second case shows it does not go for a relic its seat never saw, unless the DE source says the computer does.
- The castle self-play configuration that stored no relic in 45,000 ticks is run again, and the handoff reports how many relics each seat stores and when, with the probe named.
- Every self-play and AI test file is run; any outcome that changes is reported with before and after, never retuned to pass.
- Each new gate goes red with the old search restored.
- The spec says what the computer knows about relics, a register entry records the defect, the changelog line and version bump land at landing, the devlog lines are written.
- `npm run verify` exits 0 with its log read through the build, `node scripts/verify-receipt.mjs check` prints OK, and the change is on main.

## Implementation steps

- [ ] Reproduce, source DE's rule, fix, gate, record, land.

## Outcome

Pending. Record the verified revision, checks and limitations at closure.
