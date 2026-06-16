import {
  MAP_HEIGHT,
  MAP_WIDTH,
  type PrototypeScenario,
} from '../prototypeScenario';
import { createGrassFixtureTerrain } from './common';

// Visual-only showcase scenario (M7 combat/gather-feedback slice, v0.1.45).
// Exercises the two dynamic feedback effects so the AGENTS.md visual-change
// protocol can capture them at a representative phase:
//
//   - Selection pulse: a lone, isolated P1 villager the capture script selects
//     (no combat near it, so the breathing ring is the only change there).
//   - Hit flash: a tight knot of P1 vs P2 melee units placed adjacent so
//     auto-aggression engages them within a few ticks — their HP drops on the
//     hit ticks, arming the impact flash on the units taking damage.
//
// All-visible to player 1 (generous vision + a P1 Town Center) at boot. Not
// referenced by gameplay tests — purely a capture target in the fixtures tree.
export function createFeedbackShowcaseFixture(seed: string): PrototypeScenario {
  return {
    seed,
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    terrain: createGrassFixtureTerrain(),
    starts: [
      { owner: 1, townCenter: { x: 8, y: 6 }, startingAge: 'castle-age' },
      // Owner 2's AI is disabled so its melee knot sits as a stationary target
      // (and retaliates only via auto-aggression off its own vision) — the same
      // pattern the auto-aggression fixtures use so the combat is deterministic
      // and not perturbed by an AI economy reassigning the military units.
      { owner: 2, townCenter: { x: 26, y: 22 }, startingAge: 'castle-age', disableAi: true },
    ],
    spawns: [
      {
        kind: 'town-center',
        x: 8,
        y: 6,
        owner: 1,
        baseOwner: 1,
        vision: { playerId: 1, radius: 16 },
      },
      // Lone villager for the selection-pulse capture (kept clear of combat).
      // Placed in the open lower-left, left of the HUD selection panel so the
      // pulsing ring is fully visible in the captured frame.
      { kind: 'villager', x: 6, y: 14, owner: 1, baseOwner: 1, vision: { playerId: 1, radius: 6 } },
      // A melee knot: three P1 vs three P2 units packed adjacent so
      // auto-aggression trades blows immediately → HP drops → hit flash. Kept in
      // the open upper-left (left of the HUD panel) so the flashes are visible.
      { kind: 'militia', x: 6, y: 8, owner: 1, baseOwner: 1, vision: { playerId: 1, radius: 5 } },
      { kind: 'militia', x: 6, y: 9, owner: 1, baseOwner: 1, vision: { playerId: 1, radius: 5 } },
      { kind: 'spearman', x: 6, y: 10, owner: 1, baseOwner: 1, vision: { playerId: 1, radius: 5 } },
      { kind: 'militia', x: 7, y: 8, owner: 2, baseOwner: 2, vision: { playerId: 2, radius: 5 } },
      { kind: 'militia', x: 7, y: 9, owner: 2, baseOwner: 2, vision: { playerId: 2, radius: 5 } },
      { kind: 'scout', x: 7, y: 10, owner: 2, baseOwner: 2, vision: { playerId: 2, radius: 5 } },
      {
        kind: 'town-center',
        x: 26,
        y: 22,
        owner: 2,
        baseOwner: 2,
        vision: { playerId: 2, radius: 7 },
      },
    ],
  };
}
