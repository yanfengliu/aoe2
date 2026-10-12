// Chinese Town Centers see 7 farther (work 120 M2; defect register 2026-10-11,
// "The Chinese Town Center's +7 line of sight had no implementation").
//
// SOURCE: the Chinese help text in SiegeEngineers/aoe2techtree
// data/locales/en/strings.json at 3bb43b14 (DE update 185872): "Town Centers
// +7 line of sight and provide +15 population space". It is a civilization
// bonus: the Chinese Team Bonus is "Farms +10% food", so an ally's Town Center
// gets nothing.
//
// THE CLASS: building sight bonuses from a civilization or its team. Every
// site that gives a building its sight adds `teamBuildingVisionBonus`: a
// seeded building (buildingSeedVision.ts), a finished one and one restored
// from an old save (completedBuildingVisionRadius). The census asks, for
// every civilization and building type, that an owner gets exactly what an
// ally gets from the team lines plus DE's owner-only lines, the Chinese one.
//
// BOUNDS: the team lines are read from the code, so a team line scoped wrong
// is not caught here (DE's Ethiopian line names Outposts only, and the code
// also gives it to towers; spec §11.11 lists that). A Town Center saved before
// this change keeps the sight it was saved with.

import { describe, expect, it } from 'vitest';

import { teamBuildingVisionBonus } from '../../src/game/simulation/civBuildingBonuses';
import { CIVILIZATION_NAMES } from '../../src/game/simulation/civilizationNames';
import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import type { BuildingType } from '../../src/game/simulation/types';
import { selectOwnedUnitDirect, stepBridgeUntil } from './createSimulationBridge.helpers';

// Every building type; a new one fails typecheck here until it is listed.
const BUILDING_TYPES: Record<BuildingType, true> = {
  'town-center': true, house: true, mill: true, 'lumber-camp': true, 'mining-camp': true,
  barracks: true, 'watch-tower': true, 'bombard-tower': true, stable: true, 'archery-range': true,
  blacksmith: true, market: true, 'siege-workshop': true, monastery: true, university: true,
  castle: true, wonder: true, 'stone-wall': true, 'palisade-wall': true, 'stone-gate': true,
  'palisade-gate': true, farm: true, dock: true, outpost: true, 'fish-trap': true,
};

/** DE's owner-only building sight lines in this roster: the Chinese one. */
function deOwnerOnlySight(civilization: string, building: BuildingType): number {
  return civilization === 'Chinese' && building === 'town-center' ? 7 : 0;
}

describe('building sight bonuses', () => {
  it('an owner gets what an ally gets from the team lines, plus its own civilization lines, for every civilization and building', () => {
    const SOLO = new Map<number, number>();
    const ALLIED = new Map([[1, 1], [2, 1]]);
    for (const civilization of CIVILIZATION_NAMES) {
      for (const building of Object.keys(BUILDING_TYPES) as BuildingType[]) {
        const solo = teamBuildingVisionBonus(SOLO, new Map([[1, civilization]]), 1, building);
        const asAlly = teamBuildingVisionBonus(ALLIED, new Map([[1, 'Britons'], [2, civilization]]), 1, building);
        expect(solo, `${civilization} ${building}`).toBe(asAlly + deOwnerOnlySight(civilization, building));
      }
    }
  });

  it('a Chinese Town Center sees +7, and an ally of the Chinese gets nothing from it', () => {
    expect(teamBuildingVisionBonus(new Map(), new Map([[1, 'Chinese']]), 1, 'town-center')).toBe(7);
    expect(teamBuildingVisionBonus(new Map([[1, 1], [2, 1]]), new Map([[1, 'Britons'], [2, 'Chinese']]), 1, 'town-center')).toBe(0);
    expect(teamBuildingVisionBonus(new Map(), new Map([[1, 'Chinese']]), 1, 'castle')).toBe(0);
  });
});

describe('a Chinese Town Center in a match', () => {
  type Bridge = ReturnType<typeof createSimulationBridge>;
  const sightOf = (bridge: Bridge, id: number): number | undefined =>
    bridge.world.getComponent<{ radius: number }>(id, 'visionSource')?.radius;

  function townCenterSight(civilization: string): { seeded: number; built: number } {
    const bridge = createSimulationBridge('castle-town-center-fixture', {
      civilizationsByOwner: new Map([[1, civilization]]),
    });
    const ownTownCenters = () => bridge.getEconomyState().buildings
      .filter((b) => b.owner === 1 && b.buildingType === 'town-center');
    const seeded = ownTownCenters()[0]!;
    // A second Town Center, built by the player's villager: the completion path.
    expect(selectOwnedUnitDirect(bridge, 1, 'villager')).toBe(true);
    expect(bridge.beginBuildingPlacement('town-center')).toBe(true);
    expect(bridge.confirmBuildingPlacement(14, 8)).toBe(true);
    expect(stepBridgeUntil(
      bridge,
      () => ownTownCenters().some((b) => b.x === 14 && b.y === 8 && b.isComplete),
      { maxSteps: 2_400 },
    ), `${civilization} never finished the second Town Center`).toBe(true);
    const built = ownTownCenters().find((b) => b.x === 14 && b.y === 8)!;
    return { seeded: sightOf(bridge, seeded.id)!, built: sightOf(bridge, built.id)! };
  }

  it('sees 7 farther than a control Town Center, seeded and built alike', () => {
    const chinese = townCenterSight('Chinese');
    const control = townCenterSight('Britons');
    expect(chinese.seeded - control.seeded, 'the seeded Town Center').toBe(7);
    expect(chinese.built - control.built, 'the Town Center built in the match').toBe(7);
  }, 60_000);
});
