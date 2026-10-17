# The computer's Monks collect the relics it knows about, as in Definitive Edition

Status: active
Owner: Claude coordinator (Game orchestrator todos); implementation worker in worktree ai-relics (review round 0 fixed and handed back for a focused re-review; the landing waits for the coordinator and work 126)
Created: 2026-10-15
Updated: 2026-10-17

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

- [x] Reproduce. `scripts/selfplay-audit.mjs` gained a relic ledger (pickups and stores read from the world state every tick, and the tick each seat first saw each relic) and a `--config castle|lab` switch. On main `83b6ffa3` it showed the brief's premise was half wrong: owner 2's Monks did pick relics up (castle match: (24,24) at 26,011, (36,10) at 26,968) and could not walk home with them. A carried relic claimed its Monk's cell (work 126 found the player's move order refused the same way). The visible-only search was the second cause.
- [x] Source DE's rule. None found: the AI scripting reference (airef) says only that computer players ignore relics on the easiest level, and DE's AI was previewed as one that must scout (E3 2019). The rule is the ground the seat has explored, own or shared, with the present-position bound stated (spec §13.3).
- [x] Fix both causes and gate them. A carried relic claims no cell (`transformOps`, the pickup, the carrier's death and the follow step's let-go). The AI fetches relics on explored ground, and only a Monk is sent. `monkCarriedRelic.test.ts` (5), `aiMonkKnownRelics.test.ts` (3), and the follow case in `monastery.relic.test.ts` strengthened. Seven mutations, each red.
- [x] Record: spec §6.9 and §13.3, register (the fixed entry, and the OPEN entry on one Monk taking a relic from another), decisions, changelog under Unreleased, devlog.
- [x] Three self-play gates moved: under the Standard rules the castle match now ends by Relic victory at 29,650 (with the 2,000-tick countdown of the time), and the lab census changed. As the coordinator decided, `aiReachesCastleAge.test.ts` and `villagersAvoidEnemyDefencesSelfPlay.test.ts` play conquest-only with the reason in their headers and no floor dropped (both green), the lab census is re-recorded with its direction, and `aiRelicsSelfPlay.test.ts` gates the Standard outcome up to the countdown's start, never its length.
- [x] Review round 0 ([record](reviews/0_implementation.md)): no blocker, six should-fix findings and nits, all repaired. A dropped relic lands on the nearest cell nothing claims, shared with the Monastery spill (`relicGround.ts`); the computer sends a Monk only for a relic it can reach (`unitRangeReach.ts`) and heals otherwise; no Monk takes a relic from another's hands, and the OPEN entry on it is closed; the instruments' castle configuration plays conquest-only; the census is re-recorded. `monkCarriedRelic.test.ts` (11), `aiMonkKnownRelics.test.ts` (6), `unitRangeReach.test.ts` (4).
- [ ] Land, after work 126 M1 and then work 132 (the coordinator's order of 2026-10-15; 132 makes the Wonder and Relic countdowns DE's 10,000 ticks for two to four players, so a relic victory comes 10,000 ticks after the last store, not 2,000): take the gate lock; rebase onto main; re-measure the Standard-rules victory ticks once with `--config standard`, or leave them stated as measured with the 2,000-tick countdown; re-run the census rather than merging its JSON, and give the census commit its direction; take work 126's rule that a spilled relic lands on an unstarted foundation as on open ground into `findRelicLandingCells` (its `relicSpillFoundation.test.ts` must stay green); remove 126's carried-relic stand-aside only with every 126 relic case green, and rewrite or drop `foundationStartAnimals`' "monk with relic" case; close 126's duplicate Monk move-order entry as fixed by 128; keep `transformOps.ts` and `wirePostSeedOps.ts` under 500 lines by splitting by role; take the version; `npm run verify`, its Vitest and Playwright summaries read; `node scripts/verify-receipt.mjs check`; push; release the lock; close this plan; remove the worktree.

## Outcome

Recovered on 2026-10-17 at `5dee1545`. The existing detailed-devlog overlay only qualifies the historical 29,650 victory tick with its then-current 2,000-tick countdown; it is preserved. The four focused relic files passed 27 tests before further changes. A newly found return-path defect is fixed test-first: an unreachable nearest own Monastery is skipped for a reachable farther one, using the mover's existing building-approach planner; the seven known-relic cases, TypeScript and scoped eslint pass. Review round 0's placeholders are replaced with the retained evidence and its failed Castle Age suite-hook bound. Final foundation/countdown integration, independent review, full gate, final combined self-play census, version, main merge and worktree cleanup remain with the integration owner. No browser, server or long-running process was started by this recovery worker.

## Current-DE comparison correction, 2026-10-17

The user's comparison steering exposed an obsolete requirement: this branch refused Missionary relic transport, but installed string 26691 and official DE update 169123 permit it, with base speed 0.9 only while carrying. The integration coordinator authorized this in-scope correction. The prior delivered overlay is retained as tree `3394f83a26c152d81f9932c39b895c2d2436bb2d`; the next patch is incremental to that tree. The refusal cases are replaced by sourced player pickup/deposit, AI collection-before-healing, loaded/unloaded movement and mid-walk save cases. Seven focused files pass 52 tests; TypeScript and scoped lint pass. No cost or other stat changes are made. [Comparison table and source bindings](snapshots/de-comparison-2026-10-17.md) distinguish supported rules, approximations and open gaps without claiming a played or visually inspected DE match. Final integrated review and gates remain pending.

## Integrated Standard witness and test contract, 2026-10-17

The first full integrated gate reproduced a changed strategic trajectory: owner 2 deposits one known relic at 35,511; the other remains unexplored to that seat while owner 1 stays Feudal without a collector. The maintained ledger/history run confirms pickup at 35,155, held movement and own completed-Monastery delivery, with no transport stall. Reviews 5–6 accept the same Standard seed/settings/45,000-tick maximum with positive correlated transport, conservation and no premature clock, plus a separate unconditional three-known-relic AI delivery/countdown case. Its initial save changes only prior exploration, not product behavior. Both cases pass healthy code, both reject the original carried-ground claim, and both pass after exact restoration. The short mutant fails on the all-pickup set; later travel/countdown assertions are not reached. The former all-relic-victory trajectory remains historical. Full integrated gate, certification and main publication remain pending.
