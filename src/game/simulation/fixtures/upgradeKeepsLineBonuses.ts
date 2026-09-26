import type { Position } from 'civ-engine';

import {
  MAP_HEIGHT,
  MAP_WIDTH,
  type PrototypeScenario,
} from '../prototypeScenario';
import type { ResearchableTechnologyType } from '../technologyTypes';
import { createGrassFixtureTerrain, ownedSpawn } from './common';

// An upgrade keeps the unique technology its line had (tests/simulation/
// uniqueTechnologies.test.ts; defect register, 2026-09-26, "The Siege Onager,
// the Capped Ram and the Elite Skirmisher were left out of tables that named
// the rest of their line"). Researching an upgrade rebuilds each unit it
// replaces from the new type, so a tier a unique technology's list leaves out
// loses the bonus the moment the research completes.
//
// Two seeds, one scene. Owner 1 starts in the Imperial Age with an Onager, a
// Battering Ram and a Skirmisher, two Siege Workshops and an Archery Range, so
// each upgrade has a building of its own and they research side by side. The
// seed picks the civilization and what it has already researched, because a
// unit takes only its own civilization's unique technologies: the Celts bring
// Furor Celtica to the siege lines, the Britons Yeomen to the Skirmisher.
// Owner 2 is far away and has no AI, so nothing interferes.

export const UPGRADE_BONUS_SIEGE_ONAGER_WORKSHOP: Position = { x: 14, y: 6 };
export const UPGRADE_BONUS_CAPPED_RAM_WORKSHOP: Position = { x: 20, y: 6 };
export const UPGRADE_BONUS_ARCHERY_RANGE: Position = { x: 26, y: 6 };

const CIVILIZATIONS: Record<string, { civilization: string; researched: ResearchableTechnologyType[] }> = {
  // The Onager upgrade is in because the Siege Onager one is offered only
  // after it.
  'upgrade-keeps-line-bonuses-celts-fixture': { civilization: 'Celts', researched: ['onager-upgrade', 'furor-celtica'] },
  'upgrade-keeps-line-bonuses-britons-fixture': { civilization: 'Britons', researched: ['yeomen'] },
};

export const UPGRADE_KEEPS_LINE_BONUSES_SEEDS = Object.keys(CIVILIZATIONS);

export function createUpgradeKeepsLineBonusesFixture(seed: string): PrototypeScenario {
  const start = CIVILIZATIONS[seed];
  if (!start) {
    throw new Error(
      `Scenario '${seed}' is not an upgrade-bonus seed; expected one of ${UPGRADE_KEEPS_LINE_BONUSES_SEEDS.join(', ')}.`,
    );
  }
  return {
    seed,
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    terrain: createGrassFixtureTerrain(),
    starts: [
      {
        owner: 1,
        townCenter: { x: 8, y: 8 },
        startingAge: 'imperial-age',
        civilization: start.civilization,
        startingResearchedTechnologies: start.researched,
        startingResources: { food: 3000, wood: 1000, gold: 3000, stone: 200 },
      },
      { owner: 2, townCenter: { x: 48, y: 28 }, startingAge: 'imperial-age', disableAi: true },
    ],
    spawns: [
      ownedSpawn('town-center', 1, 8, 8, { vision: 7 }),
      ownedSpawn('siege-workshop', 1, UPGRADE_BONUS_SIEGE_ONAGER_WORKSHOP.x, UPGRADE_BONUS_SIEGE_ONAGER_WORKSHOP.y),
      ownedSpawn('siege-workshop', 1, UPGRADE_BONUS_CAPPED_RAM_WORKSHOP.x, UPGRADE_BONUS_CAPPED_RAM_WORKSHOP.y),
      ownedSpawn('archery-range', 1, UPGRADE_BONUS_ARCHERY_RANGE.x, UPGRADE_BONUS_ARCHERY_RANGE.y),
      ownedSpawn('onager', 1, 14, 14, { vision: 4 }),
      ownedSpawn('battering-ram', 1, 18, 14, { vision: 4 }),
      ownedSpawn('skirmisher', 1, 22, 14, { vision: 4 }),
      ownedSpawn('town-center', 2, 48, 28, { vision: 7 }),
    ],
  };
}
