// DE's twenty control groups (work 142 M2b-2b-2b): DE's GROUP_COMMAND_HOTKEYS
// give groups 1 to 10 the digit keys and 11 to 20 the same keys with Alt. Here a
// group is an index 0-19: the digit for groups 1-10 (Ctrl+0 is group 10, index
// 0, as before work 142) and 10 plus the digit for 11-20. The coordinator's
// terms (2026-11-05): a backward-compatible widening of the saved range 0-9 to
// 0-19, held by three save tests — a save holding groups 0 to 9 loads unchanged,
// groups 10 to 19 round-trip, a group out of range is still refused. Beside them
// DE's Append Group (Shift), Ungroup (U), and one group per unit, as DE's
// players report it (spec §9.4).
//
// BOUND: the civ-teutons fixture's own units, the real bridge and its save.

import type { EntityRef } from 'civ-engine';
import { describe, expect, it } from 'vitest';

import { createSimulationBridge, type SimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import { worldSnapshotState } from '../../src/game/simulation/saveBlobReaders';

const CONTROL_GROUPS_SLOT = 'aoe2.controlGroups';

function ownUnits(bridge: SimulationBridge): number[] {
  const ids = bridge.getEconomyState().units.filter((unit) => unit.owner === 1).map((unit) => unit.id).sort((a, b) => a - b);
  expect(ids.length, 'the fixture gives the human six units or more').toBeGreaterThanOrEqual(6);
  return ids;
}

function select(bridge: SimulationBridge, ids: readonly number[]): readonly EntityRef[] {
  expect(bridge.selectUnitsByIds([...ids])).toBe(true);
  return bridge.getSelectedEntityRefs();
}

const selected = (bridge: SimulationBridge): number[] => [...bridge.getSelectionState().selectedEntityIds].sort((a, b) => a - b);

/** Recalls a group from nothing selected and returns whom it selected. */
function recall(bridge: SimulationBridge, group: number): number[] | null {
  bridge.clearSelection();
  return bridge.recallControlGroup(group) ? selected(bridge) : null;
}

describe("DE's twenty control groups (work 142 M2b-2b-2b)", () => {
  it('loads a save holding groups 0 to 9 unchanged', () => {
    const bridge = createSimulationBridge('civ-teutons-fixture');
    const [a, b, c, d] = ownUnits(bridge);
    // The slot as every save before work 142 wrote it: [group, refs] pairs,
    // groups 0 to 9 only, written here by hand rather than by the new code.
    const old: Array<[number, readonly EntityRef[]]> = [[0, select(bridge, [a!])], [1, select(bridge, [b!, c!])], [9, select(bridge, [d!])]];
    bridge.clearSelection();
    const blob = bridge.saveGame();
    worldSnapshotState(blob)[CONTROL_GROUPS_SLOT] = old.map(([group, refs]) => [group, refs.map((ref) => ({ ...ref }))]);
    const loaded = createSimulationBridge(undefined, { savedGame: blob });
    expect(recall(loaded, 0)).toEqual([a]);
    expect(recall(loaded, 1)).toEqual([b, c].sort((x, y) => x! - y!));
    expect(recall(loaded, 9)).toEqual([d]);
    expect(recall(loaded, 5), 'a group the save does not hold recalls nothing').toBeNull();
  });

  it('round-trips groups 10 to 19 through a save', () => {
    const bridge = createSimulationBridge('civ-teutons-fixture');
    const [a, b, c, d] = ownUnits(bridge);
    const groups: Array<[number, number[]]> = [[10, [a!]], [11, [b!, c!]], [19, [d!]]];
    for (const [group, ids] of groups) {
      select(bridge, ids);
      expect(bridge.assignControlGroup(group), `group index ${group} was refused`).toBe(true);
    }
    const blob = bridge.saveGame();
    const slot = worldSnapshotState(blob)[CONTROL_GROUPS_SLOT] as Array<[number, EntityRef[]]>;
    expect(slot.map(([group]) => group).sort((x, y) => x - y)).toEqual([10, 11, 19]);
    const loaded = createSimulationBridge(undefined, { savedGame: blob });
    for (const [group, ids] of groups) expect(recall(loaded, group), `group index ${group} after the load`).toEqual(ids);
  });

  it('still refuses a group out of range', () => {
    const bridge = createSimulationBridge('civ-teutons-fixture');
    const [a] = ownUnits(bridge);
    select(bridge, [a!]);
    for (const group of [20, -1, 2.5, Number.NaN]) {
      expect(bridge.assignControlGroup(group), `assign ${group}`).toBe(false);
      expect(bridge.appendToControlGroup(group), `append ${group}`).toBe(false);
      expect(bridge.recallControlGroup(group), `recall ${group}`).toBe(false);
    }
    expect(worldSnapshotState(bridge.saveGame())[CONTROL_GROUPS_SLOT] ?? []).toEqual([]);
  });

  it('appends the selection to a group, making the group if it has none, and leaves the selection', () => {
    const bridge = createSimulationBridge('civ-teutons-fixture');
    const [a, b, c] = ownUnits(bridge);
    select(bridge, [a!]);
    expect(bridge.appendToControlGroup(3), 'append made no group').toBe(true);
    select(bridge, [b!, c!]);
    expect(bridge.appendToControlGroup(3)).toBe(true);
    expect(selected(bridge), 'append changed the selection').toEqual([b, c]);
    expect(recall(bridge, 3)).toEqual([a, b, c]);
    select(bridge, [b!]);
    expect(bridge.appendToControlGroup(3), 'appending a member again').toBe(true);
    expect(recall(bridge, 3), 'a member appended again is counted once').toEqual([a, b, c]);
    bridge.clearSelection();
    expect(bridge.appendToControlGroup(3), 'an empty selection appends nothing').toBe(false);
  });

  it('keeps a unit in one group: binding or appending it takes it out of its old group', () => {
    const bridge = createSimulationBridge('civ-teutons-fixture');
    const [a, b, c] = ownUnits(bridge);
    select(bridge, [a!, b!]);
    expect(bridge.assignControlGroup(1)).toBe(true);
    select(bridge, [b!]);
    expect(bridge.assignControlGroup(2)).toBe(true);
    expect(recall(bridge, 1), 'binding group 2 left its unit in group 1').toEqual([a]);
    select(bridge, [a!]);
    expect(bridge.appendToControlGroup(2)).toBe(true);
    expect(recall(bridge, 1), 'a group left empty is forgotten').toBeNull();
    expect(recall(bridge, 2)).toEqual([a, b]);
    select(bridge, [c!]);
    expect(bridge.assignControlGroup(12)).toBe(true);
    expect(recall(bridge, 2), 'a group of 11 to 20 takes a unit like any other').toEqual([a, b]);
  });

  it('draws a recalled group selected on a paused frame', () => {
    const bridge = createSimulationBridge('civ-teutons-fixture');
    const [a] = ownUnits(bridge);
    select(bridge, [a!]);
    expect(bridge.assignControlGroup(1)).toBe(true);
    bridge.setPaused(true);
    bridge.clearSelection();
    bridge.step(16);
    const drawnSelected = (): boolean | undefined => bridge.getRenderState().entities.find((entity) => entity.id === a)?.selected;
    expect(drawnSelected()).toBe(false);
    expect(bridge.recallControlGroup(1)).toBe(true);
    bridge.step(16);
    expect(drawnSelected(), 'the paused frame did not draw the recalled unit selected').toBe(true);
  });

  it('ungroups the selection: it leaves its groups, and a group left empty is forgotten', () => {
    const bridge = createSimulationBridge('civ-teutons-fixture');
    const [a, b, c] = ownUnits(bridge);
    select(bridge, [a!, b!]);
    expect(bridge.assignControlGroup(1)).toBe(true);
    select(bridge, [c!]);
    expect(bridge.assignControlGroup(11)).toBe(true);
    select(bridge, [b!, c!]);
    expect(bridge.ungroupSelection()).toBe(true);
    expect(selected(bridge), 'ungroup changed the selection').toEqual([b, c]);
    expect(recall(bridge, 1)).toEqual([a]);
    expect(recall(bridge, 11), 'a group left empty is forgotten').toBeNull();
    select(bridge, [c!]);
    expect(bridge.ungroupSelection(), 'a selection in no group ungroups nothing').toBe(false);
  });
});
