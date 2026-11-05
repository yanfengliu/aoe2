// DE's twenty control groups (work 142 M2b-2b-2b): DE's GROUP_COMMAND_HOTKEYS
// give groups 1 to 10 the digit keys and 11 to 20 the same keys with Alt. Here a
// group is an index 0-19: the digit for groups 1-10 (Ctrl+0 is group 10, index
// 0, as before work 142) and 10 plus the digit for 11-20. The coordinator's
// terms (2026-11-05): a backward-compatible widening of the saved range 0-9 to
// 0-19, held by three save tests — a save holding groups 0 to 9 loads unchanged,
// groups 10 to 19 round-trip, a group out of range is still refused. Beside them
// DE's Append Group (Shift: the group joins the selection, DE's default since
// update 36202), Ungroup (U), one group per unit, and every selection a key
// makes drawn on a paused frame (spec §9.4).
//
// BOUND: the civ-teutons fixture's own units and `aoe2-prototype`'s idle ones,
// the real bridge and its save.

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

/** The groups as the save stores them: group index to member ids. */
function savedGroups(bridge: SimulationBridge): Record<number, number[]> {
  const slot = (worldSnapshotState(bridge.saveGame())[CONTROL_GROUPS_SLOT] ?? []) as Array<[number, EntityRef[]]>;
  return Object.fromEntries(slot.map(([group, refs]) => [group, refs.map((ref) => ref.id)]));
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

  it('still refuses a group out of range, even one a save holds', () => {
    const bridge = createSimulationBridge('civ-teutons-fixture');
    const [a] = ownUnits(bridge);
    const refs = select(bridge, [a!]);
    for (const group of [20, -1, 2.5, Number.NaN]) {
      expect(bridge.assignControlGroup(group), `assign ${group}`).toBe(false);
    }
    expect(savedGroups(bridge), 'an out-of-range group was stored').toEqual({});
    // A save written by hand with groups outside 0-19 loads, and no key reaches them.
    const blob = bridge.saveGame();
    worldSnapshotState(blob)[CONTROL_GROUPS_SLOT] = [[20, refs.map((ref) => ({ ...ref }))], [-1, refs.map((ref) => ({ ...ref }))]];
    const loaded = createSimulationBridge(undefined, { savedGame: blob });
    for (const group of [20, -1]) {
      expect(recall(loaded, group), `recall ${group}`).toBeNull();
      expect(loaded.appendControlGroupToSelection(group), `append ${group}`).toBe(false);
    }
  });

  it('adds a group to the selection on Shift, and changes no group', () => {
    const bridge = createSimulationBridge('civ-teutons-fixture');
    const [a, b, c] = ownUnits(bridge);
    select(bridge, [a!, b!]);
    expect(bridge.assignControlGroup(3)).toBe(true);
    select(bridge, [c!]);
    expect(bridge.appendControlGroupToSelection(3), 'Shift with group 3\'s key added nothing').toBe(true);
    expect(selected(bridge), 'the group did not join the selection').toEqual([a, b, c]);
    expect(savedGroups(bridge), 'adding a group to the selection changed a group').toEqual({ 3: [a, b] });
    expect(bridge.appendControlGroupToSelection(4), 'a group with no members adds nothing').toBe(false);
    expect(selected(bridge)).toEqual([a, b, c]);
  });

  it('keeps a unit in one group: binding a group takes its units out of their old one', () => {
    const bridge = createSimulationBridge('civ-teutons-fixture');
    const [a, b, c] = ownUnits(bridge);
    select(bridge, [a!, b!]);
    expect(bridge.assignControlGroup(1)).toBe(true);
    select(bridge, [b!]);
    expect(bridge.assignControlGroup(2)).toBe(true);
    expect(savedGroups(bridge), 'binding group 2 left its unit in group 1').toEqual({ 1: [a], 2: [b] });
    select(bridge, [a!, c!]);
    expect(bridge.assignControlGroup(12)).toBe(true);
    expect(savedGroups(bridge), 'a group left empty is forgotten, and groups 11-20 take units like the rest')
      .toEqual({ 2: [b], 12: [a, c] });
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
    expect(savedGroups(bridge)).toEqual({ 1: [a] });
    select(bridge, [c!]);
    expect(bridge.ungroupSelection(), 'a selection in no group ungroups nothing').toBe(false);
  });
});

// Review round 10 (Codex): a selection the bridge makes outside its wrapped
// selectors did not tell the paused renderer, so a paused frame drew the old
// rings: a group's recall (found here first), and '.' and ',' (the idle cycles).
describe('a selection made by a key is drawn on a paused frame (work 142)', () => {
  const drawnSelected = (bridge: SimulationBridge): number[] => bridge.getRenderState().entities
    .filter((entity) => entity.selected).map((entity) => entity.id).sort((a, b) => a - b);

  const cases: ReadonlyArray<readonly [string, string, (bridge: SimulationBridge) => boolean]> = [
    ['a recalled group', 'civ-teutons-fixture', (bridge) => bridge.recallControlGroup(1)],
    ['a group added on Shift', 'civ-teutons-fixture', (bridge) => bridge.appendControlGroupToSelection(1)],
    ['the next idle villager', 'aoe2-prototype', (bridge) => bridge.selectNextIdleVillager()],
    ['the next idle soldier', 'aoe2-prototype', (bridge) => bridge.selectNextIdleMilitary()],
  ];
  for (const [name, seed, act] of cases) {
    it(`draws ${name} selected`, () => {
      const bridge = createSimulationBridge(seed);
      const first = bridge.getEconomyState().units.filter((unit) => unit.owner === 1).map((unit) => unit.id).sort((a, b) => a - b)[0]!;
      select(bridge, [first]);
      expect(bridge.assignControlGroup(1)).toBe(true);
      bridge.setPaused(true);
      bridge.clearSelection();
      bridge.step(16);
      expect(drawnSelected(bridge)).toEqual([]);
      expect(act(bridge), `${name}: nothing was selected`).toBe(true);
      bridge.step(16);
      expect(drawnSelected(bridge), `the paused frame did not draw ${name} selected`).toEqual(selected(bridge));
    });
  }
});
