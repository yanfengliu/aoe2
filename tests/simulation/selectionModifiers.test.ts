// Work 146 M1: the selection rules behind DE's modifier clicks and its cap,
// through the real bridge (spec §9.4; sources in docs/work/146_de-selection).
// - Shift adds: DE's "Learn to play", Lesson 1, "Holding down Shift allows you
//   to select multiple units at the same time through individual selection or
//   multiple selection boxes". What joins is what a box takes, the player's own
//   units and livestock; a selection of anything else is replaced, as a box
//   replaces it.
// - Ctrl takes a selected unit out (a DE player, forums.ageofempires.com
//   t/74555, 2020: "If you hold ctrl when left clicking on selected units it
//   deselects them").
// - A selection holds at most 60 (forum thread 226116, 2023; 60 in AoE2 HD by
//   the openage reverse engineering). Which units DE keeps past 60 is
//   unsourced: here the first 60 in the order the gesture lists them, and an
//   addition keeps what was already selected.
//
// BOUND: the selection-controls fixture (three villagers, a sheep, another
// player's villager, a boar, a tree, a House and a Town Center of the human's)
// and the selection-cap fixture (64 Militia); the human's selection only.

import { describe, expect, it } from 'vitest';

import { createSimulationBridge, type SimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import { SELECTION_CONTROLS_BOX_SHEEP, SELECTION_CONTROLS_BOX_VILLAGERS, SELECTION_CONTROLS_MIXED_BOX } from '../../src/game/simulation/fixtures/selectionControls';

const DE_SELECTION_LIMIT = 60;

const selected = (bridge: SimulationBridge): number[] => [...bridge.getSelectionState().selectedEntityIds];

function unitAt(bridge: SimulationBridge, owner: number, cell: { x: number; y: number }): number {
  const unit = bridge.getEconomyState().units.find((candidate) => candidate.owner === owner && candidate.x === cell.x && candidate.y === cell.y);
  expect(unit, `no unit of player ${owner} on (${cell.x},${cell.y})`).toBeDefined();
  return unit!.id;
}

function resourceAt(bridge: SimulationBridge, kind: string, cell: { x: number; y: number }): number {
  const resource = bridge.getEconomyState().resources.find((candidate) => candidate.resourceType === kind && candidate.x === cell.x && candidate.y === cell.y);
  expect(resource, `no ${kind} on (${cell.x},${cell.y})`).toBeDefined();
  return resource!.id;
}

function buildingOf(bridge: SimulationBridge, type: string): number {
  const building = bridge.getEconomyState().buildings.find((candidate) => candidate.owner === 1 && candidate.buildingType === type);
  expect(building, `the human has no ${type}`).toBeDefined();
  return building!.id;
}

/** The cap fixture's Militia in the box's order: by row, then column. */
function militiaByRow(bridge: SimulationBridge): number[] {
  const militia = bridge.getEconomyState().units
    .filter((unit) => unit.owner === 1 && unit.unitType === 'militia')
    .sort((left, right) => left.y - right.y || left.x - right.x || left.id - right.id)
    .map((unit) => unit.id);
  expect(militia.length, 'the cap fixture gives the human 64 Militia').toBe(64);
  return militia;
}

describe('Shift adds to the selection (work 146)', () => {
  it('adds units after the selection, which keeps its order', () => {
    const bridge = createSimulationBridge('selection-controls-fixture');
    const [a, b, c] = SELECTION_CONTROLS_BOX_VILLAGERS.map((cell) => unitAt(bridge, 1, cell));
    expect(bridge.selectUnitsByIds([b!])).toBe(true);
    expect(bridge.addUnitsToSelection([a!, c!])).toBe(true);
    expect(selected(bridge)).toEqual([b, a, c]);
    // The sheep is livestock, which a box takes too.
    const sheep = resourceAt(bridge, 'sheep', SELECTION_CONTROLS_BOX_SHEEP);
    expect(bridge.addUnitsToSelection([sheep])).toBe(true);
    expect(selected(bridge)).toEqual([b, a, c, sheep]);
  });

  it('adds nothing that is already selected, and says so', () => {
    const bridge = createSimulationBridge('selection-controls-fixture');
    const [a, b] = SELECTION_CONTROLS_BOX_VILLAGERS.map((cell) => unitAt(bridge, 1, cell));
    bridge.selectUnitsByIds([a!, b!]);
    expect(bridge.addUnitsToSelection([b!])).toBe(false);
    expect(selected(bridge)).toEqual([a, b]);
  });

  it('adds only what a box takes: never another player\'s unit, a wild animal, a tree or a building', () => {
    const bridge = createSimulationBridge('selection-controls-fixture');
    const mixed = SELECTION_CONTROLS_MIXED_BOX;
    const villager = unitAt(bridge, 1, mixed.villager);
    const others = [
      unitAt(bridge, 2, mixed.enemyVillager),
      resourceAt(bridge, 'boar', mixed.boar),
      resourceAt(bridge, 'tree', mixed.tree),
      buildingOf(bridge, 'house'),
      buildingOf(bridge, 'town-center'),
    ];
    bridge.selectUnitsByIds([villager]);
    expect(bridge.addUnitsToSelection(others)).toBe(false);
    expect(selected(bridge)).toEqual([villager]);
  });

  it('replaces a selection a box could not have made, as a box does', () => {
    const bridge = createSimulationBridge('selection-controls-fixture');
    const [a] = SELECTION_CONTROLS_BOX_VILLAGERS.map((cell) => unitAt(bridge, 1, cell));
    expect(bridge.selectEntityById(buildingOf(bridge, 'town-center'))).toBe(true);
    expect(bridge.addUnitsToSelection([a!])).toBe(true);
    expect(selected(bridge)).toEqual([a]);
  });

  // Review round 0's FINDING-2: a control group's Shift can make a selection of
  // a building and a unit, and a Shift+click on its unit replaced it.
  it('changes nothing for a unit already in a selection a box could not have made', () => {
    const bridge = createSimulationBridge('selection-controls-fixture');
    const [villager] = SELECTION_CONTROLS_BOX_VILLAGERS.map((cell) => unitAt(bridge, 1, cell));
    const townCenter = buildingOf(bridge, 'town-center');
    bridge.selectUnitsByIds([villager!]);
    const villagerRefs = bridge.getSelectedEntityRefs();
    bridge.selectEntityById(townCenter);
    bridge.select([...bridge.getSelectedEntityRefs(), ...villagerRefs]);
    expect(selected(bridge)).toEqual([townCenter, villager]);
    expect(bridge.addUnitsToSelection([villager!])).toBe(false);
    expect(selected(bridge)).toEqual([townCenter, villager]);
  });

  it('selects from nothing, as a plain box would', () => {
    const bridge = createSimulationBridge('selection-controls-fixture');
    const [a, b] = SELECTION_CONTROLS_BOX_VILLAGERS.map((cell) => unitAt(bridge, 1, cell));
    bridge.clearSelection();
    expect(bridge.addUnitsToSelection([a!, b!])).toBe(true);
    expect(selected(bridge)).toEqual([a, b]);
  });
});

describe('Ctrl takes a selected unit out (work 146)', () => {
  it('drops the unit and keeps the rest in order', () => {
    const bridge = createSimulationBridge('selection-controls-fixture');
    const [a, b, c] = SELECTION_CONTROLS_BOX_VILLAGERS.map((cell) => unitAt(bridge, 1, cell));
    bridge.selectUnitsByIds([a!, b!, c!]);
    expect(bridge.removeFromSelection([b!])).toBe(true);
    expect(selected(bridge)).toEqual([a, c]);
  });

  it('changes nothing for a unit not selected, and says so', () => {
    const bridge = createSimulationBridge('selection-controls-fixture');
    const [a, b, c] = SELECTION_CONTROLS_BOX_VILLAGERS.map((cell) => unitAt(bridge, 1, cell));
    bridge.selectUnitsByIds([a!, b!]);
    expect(bridge.removeFromSelection([c!])).toBe(false);
    expect(selected(bridge)).toEqual([a, b]);
  });

  it('dropping the last unit leaves nothing selected', () => {
    const bridge = createSimulationBridge('selection-controls-fixture');
    const [a] = SELECTION_CONTROLS_BOX_VILLAGERS.map((cell) => unitAt(bridge, 1, cell));
    bridge.selectUnitsByIds([a!]);
    expect(bridge.removeFromSelection([a!])).toBe(true);
    expect(bridge.getSelectionState().selectedCount).toBe(0);
    expect(bridge.getSelectionState().selectedEntityId).toBeNull();
  });
});

describe('a selection holds at most DE\'s 60 units (work 146)', () => {
  it('a box or a double-click over 64 takes the first 60 it lists', () => {
    const bridge = createSimulationBridge('selection-cap-fixture');
    const militia = militiaByRow(bridge);
    expect(bridge.selectUnitsByIds(militia)).toBe(true);
    expect(bridge.getSelectionState().selectedCount).toBe(DE_SELECTION_LIMIT);
    expect(selected(bridge)).toEqual(militia.slice(0, DE_SELECTION_LIMIT));
  });

  it('a control group or a select-all key over 64 keeps the first 60', () => {
    const bridge = createSimulationBridge('selection-cap-fixture');
    const militia = militiaByRow(bridge);
    bridge.selectUnitsByIds(militia.slice(0, 32));
    const firstHalf = bridge.getSelectedEntityRefs();
    bridge.selectUnitsByIds(militia.slice(32));
    const secondHalf = bridge.getSelectedEntityRefs();
    bridge.select([...firstHalf, ...secondHalf]);
    expect(selected(bridge)).toEqual(militia.slice(0, DE_SELECTION_LIMIT));
  });

  it('Shift adds up to 60 and no further, keeping what was selected first', () => {
    const bridge = createSimulationBridge('selection-cap-fixture');
    const militia = militiaByRow(bridge);
    bridge.selectUnitsByIds(militia.slice(4, 62));
    expect(bridge.addUnitsToSelection(militia.slice(0, 4))).toBe(true);
    expect(selected(bridge)).toEqual([...militia.slice(4, 62), ...militia.slice(0, 2)]);
    expect(bridge.addUnitsToSelection([militia[63]!])).toBe(false);
    expect(bridge.getSelectionState().selectedCount).toBe(DE_SELECTION_LIMIT);
    // Room made by Ctrl lets one more join.
    expect(bridge.removeFromSelection([militia[4]!])).toBe(true);
    expect(bridge.addUnitsToSelection([militia[63]!])).toBe(true);
    expect(selected(bridge)).toEqual([...militia.slice(5, 62), ...militia.slice(0, 2), militia[63]]);
  });

  it('a control group made from 60 recalls all 60', () => {
    const bridge = createSimulationBridge('selection-cap-fixture');
    const militia = militiaByRow(bridge);
    bridge.selectUnitsByIds(militia);
    bridge.assignControlGroup(1);
    bridge.clearSelection();
    expect(bridge.recallControlGroup(1)).toBe(true);
    expect(selected(bridge)).toEqual(militia.slice(0, DE_SELECTION_LIMIT));
  });
});
