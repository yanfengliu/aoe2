# Review 4: work 147 M3a's record (DE's farm model measured and not adopted)

## Target

aoe2 commit bffbbfa2 on branch `ai-spending-m3-1106`, reviewed as `git diff 19eef443 bffbbfa2`, docs only: the spec §13.2 paragraph "DE's farm model, measured and not adopted", plan 147's M3a outcome and M3b starting state, plan 106's dated card lines and its new economy technology card, and the devlogs. Round 2 checked the repairs, `git diff bffbbfa2 1803a514`.

## Reviewers and coverage

- Codex `gpt-6-astra`, `model_reasoning_effort=xhigh`, read-only sandbox, run from the worktree's ignored `tmp/m3/review/`, twice. It read the installed Promisory scripts and the measurement's records (`tmp/m3/`, pooled with `tmp/m3/tally.mjs`).
- No Claude review: the brief asked for Codex, and the change is docs only.

## Reports

The two raw reports are `codex-report.md` and `codex-report2.md` were in the worktree's ignored `tmp/m3/review/`, removed with it; this file is their synthesis. Neither could reach remote CI (network access denied in the sandbox).

## Findings and disposition

Round 1 found no blocker:

- Major: the record claimed DE's engine reseeds the computer's farms from the stock as this game's do; the scripts show only that DE's AI has no reseed rule. Repaired in the spec and plan 147: the engine's behaviour is stated as not verified.
- Minor: plan 106's economy technology card said M3a adds Horse Collar. Repaired: tested and not adopted.
- Minor: the Heavy Plow rule (buildings.per 4994-5001) was summarized without its branch for Heavy Plow researched with 610 wood, and its Imperial branch asks Heavy Plow unavailable. Repaired in both places.
- Minor: the census seat's peak army is 38, not 36. Repaired.
- Minor: the castle configuration's farm and wood series overstated their span. Repaired (farms: 13 from 20,000 to 35,000 ticks; wood: its interval stated).
- Minor: the idle Castle-click range is 2 to 20 minutes, not 1 to 20. Repaired everywhere.

## Verification

Confirmed by round 1: the counts table, the lab's named building losses and the census failure match the records; dropping M3a follows the count-based rule; the age predicates, the civilization constants, the Castle research's bypass and Horse Collar's sources hold; the Dark Age and flush buffer paragraphs still describe main.

## Round outcome

Round 2: Five findings fixed; the wood series still lacked its interval at the end of the matches. Repaired after round 2 (median wood 37-93 in both arms from 5,000 to 45,000 ticks, the later lows named), checked by the worker against the records, not reviewed again.
