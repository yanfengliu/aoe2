// Tech-tree denial (spec §11.1, v0.3.138): AoE2's civilizations are defined
// by their HOLES. The Aztecs field no stables and the Eagle line belongs to
// the mesoamericans alone; the Franks lack Bracer; the Spanish archer line
// stops at Archer; the Turks make no Elite Skirmisher. Denials filter the
// OPTION menus (HUD, AI, and free-tech grants all read those) and the
// recorded-command validators re-check, so nothing slips through a replay.

import { describe, expect, it } from 'vitest';

import { civDenies } from '../../src/game/simulation/civTechTree';
import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import {
  selectOwnedBuildingDirect,
  stepBridgeUntil,
} from './createSimulationBridge.helpers';

function boot(civ: string) {
  return createSimulationBridge('castle-upgrades-fixture', {
    civilizationsByOwner: new Map([[1, civ]]),
  });
}

describe('the denial table', () => {
  it('carries the famous holes', () => {
    expect(civDenies('Aztecs', 'knight')).toBe(true);
    expect(civDenies('Aztecs', 'bloodlines')).toBe(true);
    expect(civDenies('Franks', 'bracer')).toBe(true);
    expect(civDenies('Spanish', 'crossbowman-upgrade')).toBe(true);
    expect(civDenies('Turks', 'elite-skirmisher-upgrade')).toBe(true);
    expect(civDenies('Britons', 'eagle-warrior')).toBe(true);
    expect(civDenies('Aztecs', 'eagle-warrior')).toBe(false);
    expect(civDenies('Byzantines', 'paladin-upgrade')).toBe(false);
    expect(civDenies(undefined, 'bracer')).toBe(false);
  });
});

describe('denials reach the live menus and validators', () => {
  it('an Aztec stable has nothing to offer, and a knight order bounces', () => {
    const bridge = boot('Aztecs');
    const stable = bridge.getEconomyState().buildings.find(
      (b) => b.owner === 1 && b.buildingType === 'stable',
    );
    if (!stable) throw new Error('the fixture has no stable');
    expect(bridge.selectEntityById(stable.id)).toBe(true);
    expect(bridge.getSelectionState().trainOptions ?? []).toHaveLength(0);
    // The validator refuses even a direct recorded command.
    const rejected = bridge.world.submitWithResult('queue.train', {
      buildingId: stable.id,
      unitType: 'knight',
    });
    expect(rejected.accepted).toBe(false);
  });

  // The honest contrast: the SAME imperial fixture, the SAME
  // fletching→bodkin-arrow chain researched for real — then bracer is offered
  // to the Briton and never to the Frank. (An earlier version of this test
  // ran in a castle-age fixture where bracer is absent for EVERYONE, so it
  // passed with the denial filter deleted — the critic caught it.)
  function researchArcherChainThen(civ: string): readonly string[] {
    // imperial-arbalest-fixture: Imperial Age with a spawned blacksmith and
    // deep starting resources — the chain researches for real.
    const bridge = createSimulationBridge('imperial-arbalest-fixture', {
      civilizationsByOwner: new Map([[1, civ], [2, civ]]),
    });
    for (const tech of ['fletching', 'bodkin-arrow'] as const) {
      expect(selectOwnedBuildingDirect(bridge, 1, 'blacksmith')).toBe(true);
      expect(bridge.getSelectionState().researchOptions).toContain(tech);
      expect(bridge.queueResearch(tech)).toBe(true);
      expect(stepBridgeUntil(
        bridge,
        () => {
          selectOwnedBuildingDirect(bridge, 1, 'blacksmith');
          return !bridge.getSelectionState().researchOptions.includes(tech);
        },
        { maxSteps: 1_200 },
      )).toBe(true);
    }
    selectOwnedBuildingDirect(bridge, 1, 'blacksmith');
    return bridge.getSelectionState().researchOptions ?? [];
  }

  it('after Bodkin Arrow, the blacksmith offers Bracer to a Briton and never to a Frank', () => {
    expect(researchArcherChainThen('Britons')).toContain('bracer');
    expect(researchArcherChainThen('Franks')).not.toContain('bracer');
  }, 60_000);

  it('a non-meso barracks never offers the Eagle line', () => {
    const bridge = boot('Vikings');
    const barracks = bridge.getEconomyState().buildings.find(
      (b) => b.owner === 1 && b.buildingType === 'barracks',
    );
    if (!barracks) throw new Error('no barracks');
    expect(bridge.selectEntityById(barracks.id)).toBe(true);
    expect(bridge.getSelectionState().trainOptions ?? []).not.toContain('eagle-warrior');
  });
});

describe('building denials', () => {
  it('an Aztec villager cannot place a Stable; a Saracen one can', () => {
    // The mesoamericans have no stables AT ALL — the building itself is
    // denied, not merely everything it would train (the critic caught the
    // first table denying only the units, leaving a buildable dead shell).
    // feudal-stable-fixture: Feudal Age, completed barracks, a villager — the
    // one fixture where 'stable' genuinely appears in build options, so the
    // Saracen half proves the filter and not a missing prerequisite.
    const aztec = createSimulationBridge('feudal-stable-fixture', {
      civilizationsByOwner: new Map([[1, 'Aztecs']]),
    });
    const villager = aztec.getEconomyState().units.find(
      (u) => u.owner === 1 && u.unitType === 'villager',
    );
    if (!villager) throw new Error('no villager');
    expect(aztec.selectUnitsByIds([villager.id])).toBe(true);
    expect(aztec.getSelectionState().buildOptions ?? []).not.toContain('stable');
    expect(aztec.beginBuildingPlacement('stable')).toBe(false);

    const saracen = createSimulationBridge('feudal-stable-fixture', {
      civilizationsByOwner: new Map([[1, 'Saracens']]),
    });
    const villager2 = saracen.getEconomyState().units.find(
      (u) => u.owner === 1 && u.unitType === 'villager',
    );
    expect(saracen.selectUnitsByIds([villager2!.id])).toBe(true);
    expect(saracen.getSelectionState().buildOptions ?? []).toContain('stable');
  });

  it('a Goth villager cannot place stone walls; a Teuton one can', () => {
    const goth = createSimulationBridge('unit-repair-fixture', {
      civilizationsByOwner: new Map([[1, 'Goths']]),
    });
    const villager = goth.getEconomyState().units.find(
      (u) => u.owner === 1 && u.unitType === 'villager',
    );
    if (!villager) throw new Error('no villager');
    expect(goth.selectUnitsByIds([villager.id])).toBe(true);
    const options = goth.getSelectionState().buildOptions ?? [];
    expect(options).not.toContain('stone-wall');
    expect(options).not.toContain('stone-gate');
    expect(goth.beginBuildingPlacement('stone-wall')).toBe(false);

    const teuton = createSimulationBridge('unit-repair-fixture', {
      civilizationsByOwner: new Map([[1, 'Teutons']]),
    });
    const villager2 = teuton.getEconomyState().units.find(
      (u) => u.owner === 1 && u.unitType === 'villager',
    );
    expect(teuton.selectUnitsByIds([villager2!.id])).toBe(true);
    expect(teuton.getSelectionState().buildOptions ?? []).toContain('stone-wall');
  });
});

describe('mesoamerican starting unit', () => {
  // DE gives scout-less civilizations an Eagle Scout as their opening unit;
  // this roster's stand-in is the Eagle Warrior. Caught by an AI smoke run:
  // an Aztec player STARTED with a Scout their own tree denies.
  it('replaces the starting Scout with an Eagle Warrior for a scout-denied civilization', () => {
    const bridge = createSimulationBridge('aoe2-prototype', {
      civilizationsByOwner: new Map([[1, 'Aztecs'], [2, 'Britons']]),
    });
    const units = bridge.getEconomyState().units;
    const kinds = (owner: number) => units
      .filter((unit) => unit.owner === owner)
      .map((unit) => unit.unitType);
    expect(kinds(1)).toContain('eagle-warrior');
    expect(kinds(1)).not.toContain('scout');
    // The Briton opponent keeps the ordinary Scout on the same map.
    expect(kinds(2)).toContain('scout');
    expect(kinds(2)).not.toContain('eagle-warrior');
  });
});
