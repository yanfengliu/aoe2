import { describe, expect, it } from 'vitest';

import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import { researchedTechnologiesCodec } from '../../src/game/simulation/bridge/bridgeStateSerialize';
import { asSchema2Blob, worldStateOf } from './saveBlobTestUtils';
import {
  selectOwnedBuildingDirect,
  stepBridgeUntil,
} from './createSimulationBridge.helpers';
import { createCombatStateFactory } from '../../src/game/simulation/bridge/combatStateFactory';
import { pierceArmorTechBonus } from '../../src/game/simulation/armorTechBonuses';
import { dockResearchOptions } from '../../src/game/simulation/bridge/dockTechOptions';
import {
  CAREENING_TRANSPORT_BONUS,
  DRY_DOCK_TRANSPORT_BONUS,
  shipwrightTrainTimeMultiplier,
  shipwrightWoodCost,
} from '../../src/game/simulation/dockTechEffects';
import { effectiveTrainingCost } from '../../src/game/simulation/civBonusEffects';
import { movementSpeedPercent } from '../../src/game/simulation/movementTechEffects';
import {
  researchCost,
  researchTimeTicks,
  trainingCost,
} from '../../src/game/simulation/prototypeEconomyRules';
import { transportCapacity, TRANSPORT_CAPACITY } from '../../src/game/simulation/transportShip';
import type { ResearchableTechnologyType, UnitType } from '../../src/game/simulation/types';

type AgeType = 'dark-age' | 'feudal-age' | 'castle-age' | 'imperial-age';
const AGE_ORDER: AgeType[] = ['dark-age', 'feudal-age', 'castle-age', 'imperial-age'];

const NONE: ReadonlySet<ResearchableTechnologyType> = new Set();
const CAREENING: ReadonlySet<ResearchableTechnologyType> = new Set(['careening']);
const DRY_DOCK: ReadonlySet<ResearchableTechnologyType> = new Set(['careening', 'dry-dock']);
const SHIPWRIGHT: ReadonlySet<ResearchableTechnologyType> = new Set([
  'careening', 'dry-dock', 'shipwright',
]);

function techs(...list: ResearchableTechnologyType[]): ReadonlySet<ResearchableTechnologyType> {
  return new Set(list);
}

// The three technologies that finish the Dock's roster (technologies.csv):
// Careening (Castle, 250f/150g, 50s) "+0/+1 armor also transport ships carry +5
// units"; Dry Dock (Imperial, 600f/400g, 60s) "Movement rate * 1.15 and
// transport ships carry +10 units"; Shipwright (Imperial, 200w/1000f, 60s)
// "Wood cost * 0.8 and build time * 0.65". AoE2 DE chains them — Dry Dock needs
// Careening, Shipwright needs Dry Dock — which the CSV does not state.
describe('the Dock technologies — data and menu', () => {
  function optionsFor(age: AgeType, researched: ResearchableTechnologyType[] = []) {
    const have = new Set(researched);
    return dockResearchOptions(
      1,
      (_o, min) => AGE_ORDER.indexOf(age) >= AGE_ORDER.indexOf(min),
      (_o, tech) => have.has(tech),
    );
  }

  it('costs what technologies.csv says', () => {
    expect(researchCost('careening')).toEqual({ food: 250, gold: 150 });
    expect(researchTimeTicks('careening')).toBe(500); // 50 s x 10 TPS.
    expect(researchCost('dry-dock')).toEqual({ food: 600, gold: 400 });
    expect(researchTimeTicks('dry-dock')).toBe(600);
    expect(researchCost('shipwright')).toEqual({ wood: 200, food: 1000 });
    expect(researchTimeTicks('shipwright')).toBe(600);
  });

  it('offers Careening from the Castle Age and the other two only in Imperial', () => {
    expect(optionsFor('castle-age')).toContain('careening');
    expect(optionsFor('castle-age')).not.toContain('dry-dock');
    expect(optionsFor('castle-age')).not.toContain('shipwright');
  });

  it('chains them: Dry Dock needs Careening, Shipwright needs Dry Dock', () => {
    const imperial = optionsFor('imperial-age');
    expect(imperial).toContain('careening');
    expect(imperial).not.toContain('dry-dock');

    const withCareening = optionsFor('imperial-age', ['careening']);
    expect(withCareening).toContain('dry-dock');
    expect(withCareening).not.toContain('shipwright');

    const withDryDock = optionsFor('imperial-age', ['careening', 'dry-dock']);
    expect(withDryDock).toContain('shipwright');
  });

  it('drops each one once it is researched', () => {
    const all = optionsFor('imperial-age', ['careening', 'dry-dock', 'shipwright']);
    for (const tech of ['careening', 'dry-dock', 'shipwright'] as const) {
      expect(all).not.toContain(tech);
    }
  });
});

describe('Careening — +0 melee / +1 pierce for ships', () => {
  function armor(unitType: UnitType, researched: ReadonlySet<ResearchableTechnologyType>) {
    const factory = createCombatStateFactory({
      hasTechnology: (_owner, tech) => researched.has(tech),
      getCivilization: () => 'Byzantines',
    });
    const state = factory(1, unitType);
    return { melee: state.armor, pierce: pierceArmorTechBonus(state) };
  }

  it('adds pierce armour only — a ship gains nothing in melee', () => {
    expect(armor('galley', CAREENING)).toEqual({ melee: 0, pierce: 1 });
    expect(armor('fishing-ship', CAREENING)).toEqual({ melee: 0, pierce: 1 });
    expect(armor('transport-ship', CAREENING)).toEqual({ melee: 0, pierce: 1 });
  });

  it('covers the unique warships too', () => {
    expect(armor('turtle-ship', CAREENING)).toEqual({ melee: 0, pierce: 1 });
    expect(armor('longboat', CAREENING)).toEqual({ melee: 0, pierce: 1 });
  });

  it('leaves land units alone', () => {
    for (const unitType of ['archer', 'knight', 'militia', 'villager'] as const) {
      expect(armor(unitType, CAREENING)).toEqual({ melee: 0, pierce: 0 });
    }
  });

  it('does nothing without the technology', () => {
    expect(armor('galley', NONE)).toEqual({ melee: 0, pierce: 0 });
  });
});

describe('Dry Dock — ships move 15% faster', () => {
  it('raises a ship’s speed percent and nothing else’s', () => {
    const base = movementSpeedPercent(NONE, 'galley');
    expect(movementSpeedPercent(DRY_DOCK, 'galley')).toBe(Math.round(base * 1.15));
    // Careening alone is not a speed technology.
    expect(movementSpeedPercent(CAREENING, 'galley')).toBe(base);
    expect(movementSpeedPercent(DRY_DOCK, 'knight')).toBe(movementSpeedPercent(NONE, 'knight'));
    expect(movementSpeedPercent(DRY_DOCK, 'villager')).toBe(movementSpeedPercent(NONE, 'villager'));
  });

  it('applies to every ship, fishing and fighting alike', () => {
    for (const unitType of ['fishing-ship', 'transport-ship', 'galleon', 'longboat'] as const) {
      expect(movementSpeedPercent(DRY_DOCK, unitType))
        .toBe(Math.round(movementSpeedPercent(NONE, unitType) * 1.15));
    }
  });
});

describe('Shipwright — ships cost 20% less wood and build 35% faster', () => {
  it('discounts the WOOD only', () => {
    // units.csv Galley: 90 wood + 30 gold. 90 x 0.8 = 72, gold untouched.
    expect(trainingCost('galley')).toEqual({ wood: 90, gold: 30 });
    expect(shipwrightWoodCost(SHIPWRIGHT, 'galley', trainingCost('galley')))
      .toEqual({ wood: 72, gold: 30 });
  });

  it('reaches the cost a player is actually charged', () => {
    expect(effectiveTrainingCost('Byzantines', 'imperial-age', 'galley', SHIPWRIGHT))
      .toEqual({ wood: 72, gold: 30 });
    expect(effectiveTrainingCost('Byzantines', 'imperial-age', 'galley', NONE))
      .toEqual({ wood: 90, gold: 30 });
  });

  it('leaves land units at full price', () => {
    const knight = trainingCost('knight');
    expect(effectiveTrainingCost('Byzantines', 'imperial-age', 'knight', SHIPWRIGHT))
      .toEqual(knight);
  });

  it('stacks with a civ cost bonus rather than replacing it', () => {
    // Goths infantry is a LAND discount, so a ship keeps only the ship one —
    // the two never apply to the same unit, and that is the assertion.
    expect(effectiveTrainingCost('Goths', 'imperial-age', 'galley', SHIPWRIGHT))
      .toEqual({ wood: 72, gold: 30 });
  });

  it('cuts ship build time by 35% and no other unit’s', () => {
    expect(shipwrightTrainTimeMultiplier(SHIPWRIGHT, 'galley')).toBeCloseTo(0.65, 10);
    expect(shipwrightTrainTimeMultiplier(SHIPWRIGHT, 'knight')).toBe(1);
    expect(shipwrightTrainTimeMultiplier(DRY_DOCK, 'galley')).toBe(1);
  });
});

describe('transport capacity — 5, then 10, then 20', () => {
  it('is the base five without either technology', () => {
    expect(transportCapacity(NONE)).toBe(TRANSPORT_CAPACITY);
    expect(TRANSPORT_CAPACITY).toBe(5);
  });

  it('is ten with Careening and twenty with Dry Dock as well', () => {
    // units.csv Transport Ship: "Garrison inside 5 (10 with careening and 20
    // with dry dock)" — the two bonuses ADD to the base.
    expect(CAREENING_TRANSPORT_BONUS).toBe(5);
    expect(DRY_DOCK_TRANSPORT_BONUS).toBe(10);
    expect(transportCapacity(CAREENING)).toBe(10);
    expect(transportCapacity(DRY_DOCK)).toBe(20);
  });

  it('gives Dry Dock its bonus even if Careening is somehow absent', () => {
    // The menu chains them, but the capacity rule must not depend on the menu.
    expect(transportCapacity(techs('dry-dock'))).toBe(15);
  });
});

// The number Careening and Dry Dock change has to be VISIBLE, or the player
// buys a capacity they cannot see. A transport's cargo is its inventory line.
describe('a transport reports its cargo against the teched capacity', () => {
  it('reads "0 / 5 aboard" untouched and "0 / 20 aboard" with both technologies', () => {
    const bridge = createSimulationBridge('transport-fixture');
    const ship = bridge.getEconomyState().units.find((u) => u.unitType === 'transport-ship');
    expect(ship).toBeDefined();
    expect(bridge.selectEntityAtCell(ship!.x, ship!.y)).toBe(true);
    expect(bridge.getSelectionState().inventory).toBe('0 / 5 aboard');

    const blob = asSchema2Blob(bridge.saveGame());
    worldStateOf(blob)[researchedTechnologiesCodec.slot] = [
      [ship!.owner, ['careening', 'dry-dock']],
    ];
    const teched = createSimulationBridge('transport-fixture', { savedGame: blob });
    const sameShip = teched.getEconomyState().units.find((u) => u.id === ship!.id)!;
    expect(teched.selectEntityAtCell(sameShip.x, sameShip.y)).toBe(true);
    expect(teched.getSelectionState().inventory).toBe('0 / 20 aboard');
  });
});

// The two unique ships are trained at the Dock, so their ELITE upgrades belong
// there — and until v0.3.51 the Dock offered them while the validator refused
// them, the same defect as the Transport Ship. Proved end to end here: a
// Viking Dock offers it, researching it completes.
describe('the unique ships’ elite upgrades are researchable at the Dock', () => {
  it('lets a Viking research the Elite Longboat at its Dock', () => {
    const bridge = createSimulationBridge('naval-imperial-fixture', {
      civilizationsByOwner: new Map([[1, 'Vikings']]),
    });
    expect(selectOwnedBuildingDirect(bridge, 1, 'dock')).toBe(true);
    expect(bridge.getSelectionState().researchOptions).toContain('elite-longboat-upgrade');
    expect(bridge.queueResearch('elite-longboat-upgrade')).toBe(true);

    expect(stepBridgeUntil(
      bridge,
      () => {
        selectOwnedBuildingDirect(bridge, 1, 'dock');
        return !bridge.getSelectionState().researchOptions.includes('elite-longboat-upgrade');
      },
      { maxSteps: 1_500 },
    )).toBe(true);
  }, 60_000);

  it('lets a Korean research the Elite Turtle Ship at its Dock', () => {
    const bridge = createSimulationBridge('naval-imperial-fixture', {
      civilizationsByOwner: new Map([[1, 'Koreans']]),
    });
    expect(selectOwnedBuildingDirect(bridge, 1, 'dock')).toBe(true);
    expect(bridge.getSelectionState().researchOptions).toContain('elite-turtle-ship-upgrade');
    expect(bridge.queueResearch('elite-turtle-ship-upgrade')).toBe(true);

    expect(stepBridgeUntil(
      bridge,
      () => {
        selectOwnedBuildingDirect(bridge, 1, 'dock');
        return !bridge.getSelectionState().researchOptions.includes('elite-turtle-ship-upgrade');
      },
      { maxSteps: 1_500 },
    )).toBe(true);
  }, 60_000);
});
