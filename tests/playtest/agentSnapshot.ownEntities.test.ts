import { describe, it, expect } from 'vitest';
import { buildAgentSnapshot } from '../../src/game/playtest/agentSnapshot';
import type { EconomyState } from '../../src/game/simulation/types';
import { SCREEN, makeEconomy, makeSelection } from './agentSnapshotTestKit';

describe('buildAgentSnapshot — own-entity context (playtest-fixes A)', () => {
    function unit(id: number, owner: number, unitType = 'villager', task: unknown = 'idle') {
      return {
        id, owner, unitType, x: id, y: id, task, attackDamage: 0, attackRange: 0, armor: 0,
      } as EconomyState['units'][number];
    }
    function building(id: number, owner: number, buildingType = 'town-center', isComplete = true) {
      return {
        id, owner, buildingType, x: id, y: id, footprintWidth: 2, footprintHeight: 2,
        isComplete, buildProgressTicks: 0, totalBuildTicks: 100, populationProvided: 0, queue: [],
      } as EconomyState['buildings'][number];
    }
    function resource(id: number, resourceType = 'berry-bush', x = 0, y = 0, amount = 100) {
      return {
        id, resourceType, amount, maxAmount: amount, owner: null, baseOwner: null, x, y,
      } as EconomyState['resources'][number];
    }

    it('ownUnits lists only the owner\'s units with entityId, kind, position, task', () => {
      const snap = buildAgentSnapshot({
        ownerId: 2,
        tick: 0,
        tps: 50,
        economy: makeEconomy({
          units: [unit(10, 2, 'villager', 'idle'), unit(11, 2, 'scout', 'moving'), unit(20, 1)],
        }),
        selection: makeSelection(),
        screenMapping: SCREEN,
      });
      expect(snap.ownUnits).toEqual([
        { entityId: 10, kind: 'villager', position: { x: 10, y: 10 }, task: 'idle' },
        { entityId: 11, kind: 'scout', position: { x: 11, y: 11 }, task: 'moving' },
      ]);
    });

    it('ownBuildings lists only the owner\'s buildings with isComplete', () => {
      const snap = buildAgentSnapshot({
        ownerId: 2,
        tick: 0,
        tps: 50,
        economy: makeEconomy({
          buildings: [building(30, 2, 'town-center', true), building(31, 2, 'house', false), building(40, 1)],
        }),
        selection: makeSelection(),
        screenMapping: SCREEN,
      });
      expect(snap.ownBuildings).toEqual([
        { entityId: 30, kind: 'town-center', position: { x: 30, y: 30 }, isComplete: true },
        { entityId: 31, kind: 'house', position: { x: 31, y: 31 }, isComplete: false },
      ]);
    });

    it('caps ownUnits at 150 and ownBuildings at 64', () => {
      const units = Array.from({ length: 160 }, (_, i) => unit(1000 + i, 2));
      const buildings = Array.from({ length: 70 }, (_, i) => building(2000 + i, 2));
      const snap = buildAgentSnapshot({
        ownerId: 2,
        tick: 0,
        tps: 50,
        economy: makeEconomy({ units, buildings }),
        selection: makeSelection(),
        screenMapping: SCREEN,
      });
      expect(snap.ownUnits).toHaveLength(150);
      expect(snap.ownBuildings).toHaveLength(64);
    });

    it('nearbyResources are sorted by distance to the first own building, capped at 64, and carry amount', () => {
      const snap = buildAgentSnapshot({
        ownerId: 2,
        tick: 0,
        tps: 50,
        economy: makeEconomy({
          buildings: [building(30, 2, 'town-center')],
          resources: [
            resource(50, 'gold-mine', 90, 90, 800),
            resource(51, 'berry-bush', 31, 31, 125),
            resource(52, 'tree', 40, 40, 100),
          ],
        }),
        selection: makeSelection(),
        screenMapping: SCREEN,
      });
      expect(snap.nearbyResources.map((r) => r.entityId)).toEqual([51, 52, 50]);
      expect(snap.nearbyResources[0]).toEqual({
        entityId: 51, kind: 'berry-bush', position: { x: 31, y: 31 }, amount: 125,
      });
    });

    it('nearbyResources respect the visibility probe (fog-hidden resources excluded) unless omniscient', () => {
      const economy = makeEconomy({
        buildings: [building(30, 2, 'town-center')],
        resources: [resource(50, 'gold-mine', 90, 90, 800), resource(51, 'berry-bush', 31, 31, 125)],
      });
      const onlyNearVisible = (_owner: number, x: number) => x < 50;
      const fogged = buildAgentSnapshot({
        ownerId: 2, tick: 0, tps: 50, economy,
        selection: makeSelection(), screenMapping: SCREEN,
        visibility: onlyNearVisible,
      });
      expect(fogged.nearbyResources.map((r) => r.entityId)).toEqual([51]);
      const omniscient = buildAgentSnapshot({
        ownerId: 2, tick: 0, tps: 50, economy,
        selection: makeSelection(), screenMapping: SCREEN,
        visibility: onlyNearVisible, omniscient: true,
      });
      expect(omniscient.nearbyResources.map((r) => r.entityId)).toEqual([51, 50]);
    });

    it('own entities are NEVER visibility-filtered (you always know your own forces)', () => {
      const snap = buildAgentSnapshot({
        ownerId: 2, tick: 0, tps: 50,
        economy: makeEconomy({
          units: [unit(10, 2)],
          buildings: [building(30, 2)],
        }),
        selection: makeSelection(), screenMapping: SCREEN,
        visibility: () => false,
      });
      expect(snap.ownUnits).toHaveLength(1);
      expect(snap.ownBuildings).toHaveLength(1);
    });
  });

// playtest-fixes iter-2 (Codex MED 2): non-gatherable resource entities
// (wolves, relics) must not be presented as gather targets.
describe('nearbyResources gatherability filter', () => {
  function building(id: number, owner: number) {
    return {
      id, owner, buildingType: 'town-center', x: 0, y: 0, footprintWidth: 2, footprintHeight: 2,
      isComplete: true, buildProgressTicks: 0, totalBuildTicks: 100, populationProvided: 0, queue: [],
    } as EconomyState['buildings'][number];
  }
  it('excludes wolves and relics from nearbyResources', () => {
    const snap = buildAgentSnapshot({
      ownerId: 2,
      tick: 0,
      tps: 50,
      economy: makeEconomy({
        buildings: [building(30, 2)],
        resources: [
          { id: 50, resourceType: 'berry-bush', amount: 125, maxAmount: 125, owner: null, baseOwner: null, x: 2, y: 2 },
          { id: 51, resourceType: 'wolf', amount: 1, maxAmount: 1, owner: null, baseOwner: null, x: 3, y: 3 },
          { id: 52, resourceType: 'relic', amount: 1, maxAmount: 1, owner: null, baseOwner: null, x: 4, y: 4 },
        ] as EconomyState['resources'],
      }),
      selection: makeSelection(),
      screenMapping: SCREEN,
    });
    expect(snap.nearbyResources.map((r) => r.entityId)).toEqual([50]);
  });
});
