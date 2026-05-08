// Regression for full-review iter-1 R2-M1 (Claude MAJOR): autoAggression's
// `hasPendingUnitCommand` filter previously only matched `unit.move` /
// `unit.attack`, missing `building.placeConfirm` and `unit.gather` /
// `unit.context*` / `sheep.move` / `monk.contextAtEntity`. This let
// autoAggression push an attack intention for a villager that aiSystem
// had just queued for `building.placeConfirm` in the same tick — at
// handler time the build command landed first, then the attack command
// overwrote it, orphaning the foundation and wasting resources.

import { describe, expect, it } from 'vitest';

import { hasPendingUnitCommand } from '../../src/game/simulation/bridge/pendingCommandQuery';
import type { PendingCommand } from '../../src/game/simulation/dispatcher';

describe('hasPendingUnitCommand — pending-intention filter for autoAggression', () => {
  it('returns false when no pending commands exist', () => {
    expect(hasPendingUnitCommand([], 42)).toBe(false);
  });

  it('matches unit.move by unitId', () => {
    const queue: PendingCommand[] = [
      { type: 'unit.move', data: { unitId: 42, target: { x: 1, y: 1 } } },
    ];
    expect(hasPendingUnitCommand(queue, 42)).toBe(true);
    expect(hasPendingUnitCommand(queue, 43)).toBe(false);
  });

  it('matches unit.attack by unitId', () => {
    const queue: PendingCommand[] = [
      { type: 'unit.attack', data: { unitId: 42, targetEntityId: 99, targetEntityKind: 'unit' } },
    ];
    expect(hasPendingUnitCommand(queue, 42)).toBe(true);
  });

  // R2-M1 finding: the next 5 cases were ALL false-negative pre-fix.
  it('matches unit.gather by unitId (R2-M1)', () => {
    const queue: PendingCommand[] = [
      { type: 'unit.gather', data: { unitId: 42, resourceId: 99 } },
    ];
    expect(hasPendingUnitCommand(queue, 42)).toBe(true);
  });

  it('matches unit.context by unitId (R2-M1)', () => {
    const queue: PendingCommand[] = [
      { type: 'unit.context', data: { unitId: 42, target: { x: 1, y: 1 } } },
    ];
    expect(hasPendingUnitCommand(queue, 42)).toBe(true);
  });

  it('matches unit.contextAtEntity by unitId (R2-M1)', () => {
    const queue: PendingCommand[] = [
      { type: 'unit.contextAtEntity', data: { unitId: 42, targetEntityId: 99 } },
    ];
    expect(hasPendingUnitCommand(queue, 42)).toBe(true);
  });

  it('matches building.placeConfirm by builderId (R2-M1 — primary case)', () => {
    const queue: PendingCommand[] = [
      { type: 'building.placeConfirm', data: { builderId: 42, buildingType: 'house', position: { x: 1, y: 1 } } },
    ];
    expect(hasPendingUnitCommand(queue, 42)).toBe(true);
    // Critically, builderId is the unit id, NOT a building/foundation id.
    expect(hasPendingUnitCommand(queue, 0)).toBe(false);
  });

  it('matches building.placeConfirm by additionalBuilderIds (multi-villager build)', () => {
    const queue: PendingCommand[] = [
      {
        type: 'building.placeConfirm',
        data: {
          builderId: 5,
          buildingType: 'house',
          position: { x: 1, y: 1 },
          additionalBuilderIds: [42, 99],
        },
      },
    ];
    expect(hasPendingUnitCommand(queue, 5)).toBe(true);
    expect(hasPendingUnitCommand(queue, 42)).toBe(true);
    expect(hasPendingUnitCommand(queue, 99)).toBe(true);
    expect(hasPendingUnitCommand(queue, 7)).toBe(false);
  });

  it('matches sheep.move by sheepId (R2-M1)', () => {
    const queue: PendingCommand[] = [
      { type: 'sheep.move', data: { sheepId: 42, target: { x: 1, y: 1 } } },
    ];
    expect(hasPendingUnitCommand(queue, 42)).toBe(true);
  });

  it('matches monk.contextAtEntity by unitId (R2-M1)', () => {
    const queue: PendingCommand[] = [
      { type: 'monk.contextAtEntity', data: { unitId: 42, targetEntityId: 99 } },
    ];
    expect(hasPendingUnitCommand(queue, 42)).toBe(true);
  });

  it('matches trebuchet.pack/unpack by unitId', () => {
    const queueA: PendingCommand[] = [{ type: 'trebuchet.pack', data: { unitId: 42 } }];
    const queueB: PendingCommand[] = [{ type: 'trebuchet.unpack', data: { unitId: 42 } }];
    expect(hasPendingUnitCommand(queueA, 42)).toBe(true);
    expect(hasPendingUnitCommand(queueB, 42)).toBe(true);
  });

  it('does NOT match queue.train/queue.research (no unit-id payload field)', () => {
    const trainQ: PendingCommand[] = [
      { type: 'queue.train', data: { buildingId: 42, unitType: 'villager' } },
    ];
    const researchQ: PendingCommand[] = [
      { type: 'queue.research', data: { buildingId: 42, technologyType: 'feudal-age' } },
    ];
    // 42 is the BUILDING id here, not a unit. queue.train doesn't overwrite
    // unitCommand[id] for any unit, so the filter returns false.
    expect(hasPendingUnitCommand(trainQ, 42)).toBe(false);
    expect(hasPendingUnitCommand(researchQ, 42)).toBe(false);
  });

  it('does NOT match building.setRallyPoint / building.action / market.action', () => {
    const queues: PendingCommand[][] = [
      [{ type: 'building.setRallyPoint', data: { buildingId: 42, target: { x: 1, y: 1 } } }],
      [{ type: 'building.action', data: { buildingId: 42, actionType: 'ungarrison' } }],
      [{ type: 'market.action', data: { playerId: 42, actionType: 'sell-food' } }],
    ];
    for (const q of queues) {
      expect(hasPendingUnitCommand(q, 42)).toBe(false);
    }
  });
});
