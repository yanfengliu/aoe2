import { describe, expect, it } from 'vitest';

import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import {
  placeBuildingNearTownCenter,
  selectOwnedBuildingDirect,
  selectOwnedUnitDirect,
} from './createSimulationBridge.helpers';

describe('createSimulationBridge age-up progression', () => {
  it('does not offer Feudal Age research until two qualifying Dark Age buildings are complete', () => {
    const bridge = createSimulationBridge('feudal-missing-prereq-fixture');

    expect(bridge.selectEntityAtCell(8, 8)).toBe(true);
    expect(bridge.getSelectionState()).toMatchObject({
      selectedEntityType: 'town-center',
      visibleResearchOptions: ['feudal-age'],
      researchOptions: [],
    });
    expect(bridge.queueResearch('feudal-age')).toBe(false);
  });

  it('can research Feudal Age, build an Archery Range, and train an Archer', () => {
    const bridge = createSimulationBridge('feudal-age-fixture');

    expect(bridge.selectEntityAtCell(8, 8)).toBe(true);
    expect(bridge.getSelectionState()).toMatchObject({
      selectedEntityType: 'town-center',
      visibleResearchOptions: ['feudal-age'],
      researchOptions: ['feudal-age'],
    });
    expect(bridge.queueResearch('feudal-age')).toBe(true);
    // Phase 1B queue.research: spend lands at start of next step's processCommands.
    bridge.step(100);
    expect(bridge.getHudState().playerResources.food).toBe(200);

    for (let index = 0; index < 1320; index += 1) {
      bridge.step(100);
    }

    expect(bridge.getHudState().currentAge).toBe('feudal-age');

    expect(selectOwnedUnitDirect(bridge, 1, 'villager')).toBe(true);
    expect(bridge.getSelectionState().buildOptions).toContain('archery-range');
    placeBuildingNearTownCenter(bridge, 'archery-range');

    for (let index = 0; index < 280; index += 1) {
      bridge.step(100);
    }

    expect(selectOwnedBuildingDirect(bridge, 1, 'archery-range')).toBe(true);
    expect(bridge.getSelectionState()).toMatchObject({
      selectedEntityType: 'archery-range',
    });
    expect(bridge.getSelectionState().trainOptions).toContain('archer');
    expect(bridge.queueTrainUnit('archer')).toBe(true);

    for (let index = 0; index < 380; index += 1) {
      bridge.step(100);
    }

    expect(
      bridge.getEconomyState().units.filter((unit) => unit.owner === 1 && unit.unitType === 'archer'),
    ).toHaveLength(1);
  }, 180_000); // x2 2026-06-12: engine-1.0.x sim-throughput regression (+50-75% observed; see docs/engine-feedback/current.md)

  it('does not offer Castle Age research until two qualifying Feudal buildings are complete', () => {
    const bridge = createSimulationBridge('feudal-stable-fixture');

    expect(bridge.selectEntityAtCell(8, 8)).toBe(true);
    expect(bridge.getSelectionState()).toMatchObject({
      selectedEntityType: 'town-center',
      // Wheelbarrow (Feudal, no building prereq) is offered at the TC even
      // before Castle Age's two-building prerequisite is met.
      visibleResearchOptions: ['castle-age', 'wheelbarrow'],
      researchOptions: ['wheelbarrow'],
    });
    expect(bridge.queueResearch('castle-age')).toBe(false);
  });

  it('can research Castle Age and train a Knight', () => {
    const bridge = createSimulationBridge('castle-age-fixture');

    expect(bridge.selectEntityAtCell(8, 8)).toBe(true);
    expect(bridge.getSelectionState()).toMatchObject({
      selectedEntityType: 'town-center',
      visibleResearchOptions: ['castle-age', 'wheelbarrow'],
      researchOptions: ['castle-age', 'wheelbarrow'],
    });
    expect(bridge.queueResearch('castle-age')).toBe(true);
    // Phase 1B queue.research: spend lands at start of next step's processCommands.
    bridge.step(100);
    expect(bridge.getHudState().playerResources).toMatchObject({
      food: 200,
      gold: 200,
    });

    for (let index = 0; index < 1620; index += 1) {
      bridge.step(100);
    }

    expect(bridge.getHudState().currentAge).toBe('castle-age');

    expect(selectOwnedBuildingDirect(bridge, 1, 'stable')).toBe(true);
    expect(bridge.getSelectionState()).toMatchObject({
      selectedEntityType: 'stable',
    });
    expect(bridge.getSelectionState().trainOptions).toContain('knight');
    expect(bridge.queueTrainUnit('knight')).toBe(true);
    // Phase 1B queue.train: spend lands at start of next step's processCommands.
    bridge.step(100);
    expect(bridge.getHudState().playerResources).toMatchObject({
      food: 140,
      gold: 125,
    });

    for (let index = 0; index < 320; index += 1) {
      bridge.step(100);
    }

    const playerKnights = bridge
      .getEconomyState()
      .units.filter((unit) => unit.owner === 1 && unit.unitType === 'knight');
    expect(playerKnights).toHaveLength(1);
    expect(playerKnights[0]).toMatchObject({
      attackDamage: 10,
      attackRange: 1,
    });
  }, 120_000); // x2 2026-06-12: engine-1.0.x sim-throughput regression (+50-75% observed; see docs/engine-feedback/current.md)

  // Slice 7A: mirror the Feudal → Castle "missing prereq" case at the
  // Castle → Imperial boundary. With zero Castle-Age-unlocked buildings,
  // Imperial Age is visible on the TC but not queueable.
  it('does not offer Imperial Age research until two qualifying Castle Age buildings are complete', () => {
    const bridge = createSimulationBridge('imperial-missing-prereq-fixture');

    expect(bridge.selectEntityAtCell(8, 8)).toBe(true);
    expect(bridge.getSelectionState()).toMatchObject({
      selectedEntityType: 'town-center',
      // In Castle Age both carry techs are offered regardless of the
      // Imperial-Age building prerequisite.
      visibleResearchOptions: ['imperial-age', 'wheelbarrow', 'hand-cart'],
      researchOptions: ['wheelbarrow', 'hand-cart'],
    });
    expect(bridge.queueResearch('imperial-age')).toBe(false);
  });

  // Slice 7A: positive age-up path. Two Castle-Age-unlocked buildings are
  // pre-placed (Monastery + Castle); queueing Imperial Age + stepping the
  // research clock flips the HUD age to 'imperial-age'.
  it('can research Imperial Age at the Town Center', () => {
    const bridge = createSimulationBridge('imperial-age-fixture');

    expect(bridge.selectEntityAtCell(8, 8)).toBe(true);
    expect(bridge.getSelectionState()).toMatchObject({
      selectedEntityType: 'town-center',
      visibleResearchOptions: ['imperial-age', 'wheelbarrow', 'hand-cart'],
      researchOptions: ['imperial-age', 'wheelbarrow', 'hand-cart'],
    });
    expect(bridge.queueResearch('imperial-age')).toBe(true);

    for (let index = 0; index < 1920; index += 1) {
      bridge.step(100);
    }

    expect(bridge.getHudState().currentAge).toBe('imperial-age');
  }, 120_000); // x2 2026-06-12: engine-1.0.x sim-throughput regression (+50-75% observed; see docs/engine-feedback/current.md)
});
