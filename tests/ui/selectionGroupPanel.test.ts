import { describe, expect, it } from 'vitest';

import {
  groupMemberHealth,
  groupMemberTooltip,
  groupPanelGesture,
  inGroupPanelOrder,
  selectionAfterGroupPanelClick,
  type GroupMember,
} from '../../src/ui/hud/selectionPanel/groupPanel';

// Work 146 M2: the rules of Definitive Edition's group panel (spec §14.2; the
// sources are in docs/work/146_de-selection): a click on an icon selects only
// that unit, Ctrl+click drops it, Shift+click keeps its type and
// Ctrl+Shift+click drops its type (strings 43121-43122; AoK/HD's "Selection
// queue actions", openage); the icons are sorted by type (a DE player, forum
// t/72939, 2020); each carries its unit's hit points (Lesson 5).

// A box's order: villagers, a sheep and Militia interleaved, the primary first.
const MIXED: readonly GroupMember[] = [
  { id: 11, kind: 'villager' },
  { id: 40, kind: 'sheep' },
  { id: 12, kind: 'villager' },
  { id: 70, kind: 'militia' },
  { id: 13, kind: 'villager' },
  { id: 41, kind: 'sheep' },
];

describe('the group panel\'s clicks (DE strings 43121-43122)', () => {
  it('reads a plain click, Ctrl, Shift and Ctrl+Shift as DE\'s four gestures', () => {
    expect(groupPanelGesture({ ctrlKey: false, shiftKey: false })).toBe('select-only');
    expect(groupPanelGesture({ ctrlKey: true, shiftKey: false })).toBe('drop');
    expect(groupPanelGesture({ ctrlKey: false, shiftKey: true })).toBe('keep-type');
    expect(groupPanelGesture({ ctrlKey: true, shiftKey: true })).toBe('drop-type');
  });

  it('a click selects only the unit, and Ctrl+click takes only it out', () => {
    expect(selectionAfterGroupPanelClick(MIXED, 12, 'select-only')).toEqual([12]);
    expect(selectionAfterGroupPanelClick(MIXED, 12, 'drop')).toEqual([11, 40, 70, 13, 41]);
  });

  it('Shift+click keeps every unit of the type, and Ctrl+Shift+click takes them all out, in the selection\'s order', () => {
    expect(selectionAfterGroupPanelClick(MIXED, 12, 'keep-type')).toEqual([11, 12, 13]);
    expect(selectionAfterGroupPanelClick(MIXED, 41, 'keep-type')).toEqual([40, 41]);
    expect(selectionAfterGroupPanelClick(MIXED, 12, 'drop-type')).toEqual([40, 70, 41]);
    expect(selectionAfterGroupPanelClick(MIXED, 70, 'drop-type')).toEqual([11, 40, 12, 13, 41]);
  });

  it('on a group of one type, Shift keeps it whole and Ctrl+Shift empties it', () => {
    const militia: GroupMember[] = [{ id: 1, kind: 'militia' }, { id: 2, kind: 'militia' }];
    expect(selectionAfterGroupPanelClick(militia, 2, 'keep-type')).toEqual([1, 2]);
    expect(selectionAfterGroupPanelClick(militia, 2, 'drop-type')).toEqual([]);
  });

  it('a click on an icon whose unit has left the selection changes nothing', () => {
    expect(selectionAfterGroupPanelClick(MIXED, 99, 'select-only')).toEqual(MIXED.map((member) => member.id));
    expect(selectionAfterGroupPanelClick(MIXED, 99, 'drop-type')).toEqual(MIXED.map((member) => member.id));
  });

  it('names its unit in DE\'s tooltip, with the type clauses for a group of several types', () => {
    expect(groupMemberTooltip('militia', 1))
      .toBe('Click to select only this Militia. Hold down CTRL and click to unselect this unit.');
    expect(groupMemberTooltip('villager', 3))
      .toBe('Click to select only this Villager. Hold down CTRL and click to unselect this unit. '
        + 'Hold down SHIFT and click to select all units of this type. Hold down CTRL+SHIFT and click to unselect all units of this type.');
  });
});

describe('the group panel\'s icons', () => {
  it('sorts them by type, the types in the order the selection first lists them, each type in the selection\'s order', () => {
    expect(inGroupPanelOrder(MIXED).map((member) => member.id)).toEqual([11, 12, 13, 40, 41, 70]);
    expect(inGroupPanelOrder([{ id: 5, kind: 'barracks' }, { id: 6, kind: 'stable' }, { id: 7, kind: 'barracks' }])
      .map((member) => member.id)).toEqual([5, 7, 6]);
  });

  it('draws each unit\'s hit points as a share of its bar, toned as the bars over the units are', () => {
    expect(groupMemberHealth({ currentHp: 40, maxHp: 40 })).toEqual({ current: 40, max: 40, percent: 100, tone: 'high' });
    expect(groupMemberHealth({ currentHp: 30, maxHp: 40 })).toEqual({ current: 30, max: 40, percent: 75, tone: 'high' });
    expect(groupMemberHealth({ currentHp: 20, maxHp: 40 })).toEqual({ current: 20, max: 40, percent: 50, tone: 'mid' });
    expect(groupMemberHealth({ currentHp: 10, maxHp: 40 })).toEqual({ current: 10, max: 40, percent: 25, tone: 'low' });
    // The panel shows whole hit points, as the single unit's Health line does.
    expect(groupMemberHealth({ currentHp: 12.6, maxHp: 25 })).toMatchObject({ current: 12, max: 25 });
    expect(groupMemberHealth({ currentHp: 50, maxHp: 40 })).toMatchObject({ percent: 100 });
    expect(groupMemberHealth({ currentHp: 0, maxHp: 0 })).toBeNull();
    expect(groupMemberHealth(null)).toBeNull();
  });
});
