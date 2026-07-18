import {
  MAP_HEIGHT,
  MAP_WIDTH,
  type PrototypeScenario,
} from '../prototypeScenario';
import { createGrassFixtureTerrain, ownedSpawn } from './common';

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
      ownedSpawn('town-center', 1, 8, 6, { vision: 16 }),
      // Lone villager for the selection-pulse capture (kept clear of combat).
      // Placed in the open lower-left, left of the HUD selection panel so the
      // pulsing ring is fully visible in the captured frame.
      ownedSpawn('villager', 1, 6, 14, { vision: 6 }),
      // A melee knot: three P1 vs three P2 units packed adjacent so
      // auto-aggression trades blows immediately → HP drops → hit flash. Kept in
      // the open upper-left (left of the HUD panel) so the flashes are visible.
      ownedSpawn('militia', 1, 6, 8, { vision: 5 }),
      ownedSpawn('militia', 1, 6, 9, { vision: 5 }),
      ownedSpawn('spearman', 1, 6, 10, { vision: 5 }),
      ownedSpawn('militia', 2, 7, 8, { vision: 5 }),
      ownedSpawn('militia', 2, 7, 9, { vision: 5 }),
      ownedSpawn('scout', 2, 7, 10, { vision: 5 }),
      ownedSpawn('town-center', 2, 26, 22, { vision: 7 }),
    ],
  };
}
