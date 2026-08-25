// The idle villager bell (spec section 9, v0.3.103): AoE2's one-key answer to
// "who is standing around?". The bridge counts villagers with no command, no
// gather task, and no shelter; selecting cycles through them round-robin so
// repeated presses walk the whole set.

import { describe, it, expect } from 'vitest';

import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import { selectOwnedUnitDirect } from './createSimulationBridge.helpers';

describe('idle villagers', () => {
  it('counts the standing-around villagers and skips the busy ones', () => {
    // multi-villager-construction: five villagers idle at boot.
    const bridge = createSimulationBridge('multi-villager-construction-fixture');
    expect(bridge.countIdleVillagers()).toBe(5);
    // Send one to chop: it stops being idle.
    const tree = bridge.getEconomyState().resources.find((r) => r.resourceType === 'tree');
    if (tree) {
      expect(selectOwnedUnitDirect(bridge, 1, 'villager')).toBe(true);
      expect(bridge.issueContextCommand(tree.x, tree.y)).toBe(true);
      bridge.step(100);
      expect(bridge.countIdleVillagers()).toBe(4);
    }
  });

  it('selectNextIdleVillager cycles the whole set round-robin', () => {
    const bridge = createSimulationBridge('multi-villager-construction-fixture');
    const seen = new Set<number>();
    for (let index = 0; index < 5; index += 1) {
      expect(bridge.selectNextIdleVillager()).toBe(true);
      const sel = bridge.getSelectionState();
      expect(sel.selectedEntityType).toBe('villager');
      expect(sel.selectedCount).toBe(1);
      seen.add(sel.selectedEntityId!);
    }
    expect(seen.size).toBe(5); // five presses, five DIFFERENT villagers
    // A sixth press wraps around to one already seen.
    expect(bridge.selectNextIdleVillager()).toBe(true);
    expect(seen.has(bridge.getSelectionState().selectedEntityId!)).toBe(true);
  });

  it('returns false with nobody idle', () => {
    const bridge = createSimulationBridge('civ-koreans-tower-fixture'); // no villagers at all for owner 1
    expect(bridge.countIdleVillagers()).toBe(0);
    expect(bridge.selectNextIdleVillager()).toBe(false);
  });
});
