// What a civilization changes about the OPENING (spec §9.2): starting
// stockpile deltas (Chinese -50w -200f, Huns -100w, Persians +50w +50f,
// Mayans -50f) and extra starting units (Chinese +3 villagers, Mayans +1,
// the Inca llama — this build's sheep, a herdable claimed by proximity).
// Deltas apply only where the scenario did not pin its own stockpile, and the
// units spawn only for procedural starts — a fixture pins its own roster.
// Split from scenarioSeedOps for the 500-LOC budget.

import type { PlayerStartSpec } from '../prototypeScenario';
import type { PlayerResources } from '../types';
import { civBonusesFor } from '../civBonusTable';
import { defaultCivilizationName } from './pureHelpers';
import type { ScenarioSeedDeps } from './scenarioSeedOps';

export function civOpeningResources(
  start: PlayerStartSpec,
  resources: PlayerResources,
): PlayerResources {
  if (start.startingResources !== undefined) return resources;
  const delta = civBonusesFor(
    start.civilization ?? defaultCivilizationName(start.owner),
  )?.startingResourcesDelta;
  for (const key of ['food', 'wood', 'gold', 'stone'] as const) {
    resources[key] = Math.max(0, resources[key] + (delta?.[key] ?? 0));
  }
  return resources;
}

// Civ opening units (spec §9.2): Chinese +3 villagers, Mayans +1, the Inca
// llama (this build's sheep — a herdable claimed by proximity). Spawned last,
// near each Town Center through the same safe-spawn search every scenario
// unit uses, and only for procedural starts — a fixture pins its own roster.
export function seedCivOpeningUnits(deps: ScenarioSeedDeps): void {
  const { scenario, addUnitEntity, addResourceEntity, findScenarioSpawnPosition } = deps;
  for (const start of scenario.starts) {
    const entry = civBonusesFor(start.civilization ?? defaultCivilizationName(start.owner));
    for (const extra of entry?.extraStartingUnits ?? []) {
      for (let index = 0; index < extra.count; index += 1) {
        const position = findScenarioSpawnPosition({
          x: start.townCenter.x + 2 + index,
          y: start.townCenter.y + 5,
        });
        if (!position) continue;
        if (extra.kind === 'sheep') {
          addResourceEntity('sheep', position, 100, start.owner);
        } else {
          addUnitEntity(start.owner, extra.kind, position, {
            playerId: start.owner,
            radius: 4,
          });
        }
      }
    }
  }
}
