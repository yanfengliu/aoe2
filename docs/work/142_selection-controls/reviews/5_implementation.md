# Review 5: implementation

## Target

aoe2, work 142 M2b-1: commits `4ce41724` ("Work 142 M2b-1: the military card's keys and the unit cards as in DE") and `3f5dbeb4` (the ground-order comments), their combined diff against main `45a76681`; HEAD `3f5dbeb4` was reviewed.

## Reviewers and coverage

Codex `gpt-6-astra` with `model_reasoning_effort=xhigh`, `--sandbox read-only`, `--ephemeral`, one lane, run after the AI lane's own Codex run had ended (the runbook's one-sandbox-at-a-time rule). The prompt named the claims (the military card's keys, DE's civilians, the Fishing Ship's Q, the older keys gone, no browser key swallowed) and asked about the branch order of the key handler, mixed and enemy selections, buttons the unit table could match, the attack-ground check, civilians losing stances, and the tests. It read outside the diff: `src/game/simulation/bridge/monkTaskAppliers.ts:326` and `src/game/simulation/bridge/selectionInputOps.ts:410`; the second was spot-checked, and `getSelectedEntityIds` there drops only references to removed entities. The run log shows no sandbox failure (no exit `-1073741502`), and the tree's `git status --porcelain` and `git diff HEAD` were empty before and after. Claude lane: not run; one lane was judged enough for a change of this size, and its single finding was repaired with a test.

## Reports

### Codex (`gpt-6-astra`)

One P2 finding. Attack-ground eligibility counts enemy units: `commandCardHotkeys.ts:120` checks the selected ids and unit types without checking ownership. With the player's Scout and Mangonel selected, an enemy Monk's conversion changes the Mangonel's owner without clearing the selection (`monkTaskAppliers.ts:326`), and selection pruning removes only stale references (`selectionInputOps.ts:410`). The owned Scout keeps the military card, and the enemy Mangonel wrongly enables T: R then T replaces a valid armed attack-move with an attack-ground order no owned unit can carry out, and the next click is spent without an order. The reviewer reproduced that state with the real bridge, command panel and registry in memory. Civilian classification, the two soldier and civilian mixtures, the Fish Trap on Q and Ctrl+R passed its checks, and it found no weakened assertion in the adapted browser tests. It changed no file; it did not rerun the browser suites or the visual checks, and remote CI was out of its network reach.

## Findings and disposition

1. **P2, T counted a converted unit as the player's** (`commandCardHotkeys.ts:120`). Repaired: the check takes only units the human owns (`HUMAN_PLAYER_ID`) that may attack the ground. Regression: `tests/app/commandCardHotkeys.test.ts`, "arms attack-ground on T for the player's Mangonel, and not for one an enemy converted", red on `3f5dbeb4`'s handler and green on the repair.

## Verification

Besides the finding, the first full gate on `3f5dbeb4` failed in `tests/app/commandCardHotkeys.test.ts`, an M2a case that pinned A as attack-move on a Fishing Ship until M2b gave its card DE's keys. It was adapted to DE's Fishing Ship (Q builds the Fish Trap at once, A arms nothing), with a new case for a Scout's stance key before the HUD redraws; both went red on main's handler and green on the branch. The full gate then ran on the final commit (see the plan's M2b-1 outcome).

## Round outcome

The one finding is repaired with a test. No further round: the repair is a one-line ownership filter that its own test pins.
