# An unstarted foundation is hidden from opponents, as in Definitive Edition

Status: complete
Owner: Coordinator worker w121-hidden-foundations (coordinator: AOE2 repo coordinator setup)
Created: 2026-10-11
Updated: 2026-10-13

## Problem and outcome

Work 118's research (`docs/work/118_foundation-sight/design.md`) found that Definitive Edition hides a foundation nobody has started building from opponents. The patch notes cited there are 46295, 58259, 61321 and 185872, with forum reports beside them.

Here, any foundation is a valid target in `src/game/simulation/bridge/targetFindingOps.ts`, and work 118 found no code that hides an unstarted one. In the owner's reproduction, two enemy Militia took a Barracks foundation from 1,200 to 711 hit points (defect register, "Only seven building types gave their owner any sight"). If that Barracks had not been started, this divergence is the real cause.

Outcome: an opponent neither sees nor targets a foundation that nobody has started building, and nothing in the game reveals it to them. Once building starts, the foundation behaves as it does today.

## Scope

First establish exactly what Definitive Edition hides and from whom, from the cited notes: drawing, selection, the minimap, automatic targeting, the AI's own targeting and explicit attack orders. Then check every place this game exposes a foundation to an opponent.

May edit `targetFindingOps.ts`, the code that draws or lists enemy foundations, and the AI's target choice, with new tests.

Must not edit:
- `systems/fogMemorySystem.ts` (work 116);
- the building sight files (work 118);
- the save format, including the hydrate files (work 114).

If hiding a foundation from an opponent's fog memory needs `fogMemorySystem.ts`, do that part after work 116 lands.

## Approach

Reproduce the opponent's view of an unstarted foundation first: what it draws, what it targets, and what the AI does. Then change each exposure the notes rule out, keeping one rule for what "started" means. The batch protocol is in `docs/policies/local-rules.md`.

## Acceptance criteria

- Tests show an opponent's units and AI ignore an unstarted foundation, and attack it once building starts. Putting the old targeting back turns them red.
- No view an opponent has (the world, the minimap, selection) shows an unstarted foundation.
- The change carries a defect-register entry citing the notes, the spec rule, a changelog line and a version bump. `npm run verify` exits 0 under the gate lock, and the change is merged to main and pushed.

## Implementation steps

- [x] Source the exact DE rule, reproduce, fix, gate, land. Any fog-memory part waits for work 116.

## Outcome

**Shipped in v0.3.252 as `c71496a9` on 2026-10-13**, pushed to main as `ea704401..c71496a9`. The branch was rebased once, under the gate lock, onto main at `ea704401` (v0.3.251, with works 120 M2, 123 M1 and 124). The rebase changed no code: the diff the six work commits make to `src`, `tests` and `scripts` is the same bytes against `d68f0289` and against `ea704401` (sha256 `9d66f556106ad43f…`). The reviews name commits from before the rebase. Each became, in order: `107c7ecb` → `07357c2f`, `99d449b4` → `3ff09c59`, `aa2a1ea6` → `15212cf3`, `4688b86a` → `fa81541b`, `74289ef3` → `3b3cb0fe`, `9d5e3bce` → `0e7b983c`. Two commits followed. `a73376d7` is the version and the docs upkeep: the register rollover, the detailed devlog's split and the summary's compaction. `c71496a9` repairs a work 114 test that the first gate run found.

**Checks.** `npm run verify` ran twice under the gate lock. The first run, on `a73376d7`, exited 1 after its unit stage: 2 of 4,574 tests failed, both in work 114's `tests/simulation/projectileGenerationSave.test.ts` ("the Mangonel was refused the attack"). Its recycled-target scene ordered a Mangonel at a foundation nobody had started, which this change refuses. In `c71496a9` the foundation's builder starts it and walks off before the order, and the scene checks that nobody builds it while the stone flies. Those cases are about the target's generation, which is still 1. The second run, on `c71496a9`, exited 0 in 21 minutes, and its log shows the whole chain: content validation; 595 unit-test files and 4,571 tests passed (1 file and 3 tests skipped) in 451.8 s; the typecheck; 236 browser specs passed and 2 skipped in 12.5 minutes; lint; the build; and the receipt for tree `09e5a44a`. `node scripts/verify-receipt.mjs check` printed OK, naming HEAD's tree. Before the landing, 25 mutations, each restored after, all went red; the register entry lists them. The captures of `hidden-foundation-view-fixture` at `FOCUS=14,12`, with the rule off and then on, differ in 22,799 of 480,000 pixels, all of them on the foundation and its minimap mark.

**Acceptance.** Every criterion is met. The tests show an enemy's soldiers and AI ignore an unstarted foundation and attack it once building starts, and putting each old path back turns them red. No view an enemy has shows one: the world, the minimap, selection, fog memory or the replay viewer. The change carries the register entry citing the notes, the spec rule (§12.2), the changelog section and the version bump, and it is on main.

**Review.** Two rounds are in `reviews/`: an independent read-only review of `99d449b4`, then a focused re-review of `99d449b4..4688b86a`. Neither found anything blocking. Every finding was fixed, except F1 and three nits left as asked (R8 to R10). The test repair in `c71496a9` came after both rounds and had no review: it changes one test's setup, not the game.

**Open, and where each lives.**
- An unstarted foundation still blocks other players' movement and building, which DE update 185872 says it should not, and a refused placement or walk order names it (F1). Register entry of 2026-10-12, OPEN; a card is queued, to follow work 122's placement change.
- Cards the coordinator queued: an AI's own Town Center reference naming its own unstarted Town Center; a remembered construction site drawn at full height; the winner oracle not counting garrisoned or transported units (R10).
- Left as asked: the playtest agent's opt-in all-seeing mode lists everything (R8), and one shot in flight in a save from before v0.3.252 can still land on a hidden foundation (R9).
