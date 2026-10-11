# An unstarted foundation is hidden from opponents, as in Definitive Edition

Status: planned
Owner: Coordinator worker w121-hidden-foundations (coordinator: AOE2 repo coordinator setup)
Created: 2026-10-11
Updated: 2026-10-11

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

- [ ] Source the exact DE rule, reproduce, fix, gate, land. Any fog-memory part waits for work 116.

## Outcome

Pending.
