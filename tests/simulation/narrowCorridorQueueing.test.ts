import { World, type Position } from 'civ-engine';
import { describe, expect, it } from 'vitest';

import { BridgeStateAccessor } from '../../src/game/simulation/bridge/bridgeStateAccessor';
import { unitCommandsCodec } from '../../src/game/simulation/bridge/bridgeStateSerialize';
import { createMovementTrafficOps } from '../../src/game/simulation/bridge/movementTrafficOps';
import type { GathererComponent } from '../../src/game/simulation/types';
import type {
  GameCommands,
  GameComponents,
  GameEvents,
  GameWorld,
} from '../../src/game/simulation/bridge/pureHelpers';
import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';

type Bridge = ReturnType<typeof createSimulationBridge>;

interface UnitTrace {
  id: number;
  coarseX: number;
  coarseY: number;
  fineX: number;
  fineY: number;
}

const FIXTURE = 'narrow-corridor-fixture';
const CORRIDOR_MIN_X = 12;
const CORRIDOR_MAX_X = 28;
const CORRIDOR_Y = 8;
const EAST_EXIT = { x: 31, y: CORRIDOR_Y } as const;
const LATERAL_EPSILON = 1e-9;

function humanVillagerIds(bridge: Bridge): number[] {
  return bridge
    .getEconomyState()
    .units.filter((unit) => unit.owner === 1 && unit.unitType === 'villager')
    .map((unit) => unit.id)
    .sort((a, b) => a - b);
}

function traceUnits(bridge: Bridge, unitIds: readonly number[]): UnitTrace[] {
  return bridge
    .getDebugSnapshot()
    .coarseVsFine.filter((unit) => unitIds.includes(unit.id))
    .map((unit) => ({ ...unit }))
    .sort((a, b) => a.id - b.id);
}

function createQueuedMove(): { bridge: Bridge; unitIds: number[] } {
  const bridge = createSimulationBridge(FIXTURE);
  const unitIds = humanVillagerIds(bridge);

  expect(unitIds).toHaveLength(4);
  expect(bridge.selectOwnedUnitsByTypeInRect('villager', 10, 7, 11, 9)).toBe(true);
  expect(bridge.getSelectionState().selectedCount).toBe(unitIds.length);
  expect(bridge.issueMoveCommand(EAST_EXIT.x, EAST_EXIT.y)).toBe(true);

  return { bridge, unitIds };
}

function isInsideCorridor(unit: UnitTrace): boolean {
  return unit.coarseY === CORRIDOR_Y
    && unit.coarseX >= CORRIDOR_MIN_X
    && unit.coarseX <= CORRIDOR_MAX_X;
}

function stepTrace(bridge: Bridge, unitIds: readonly number[], ticks: number): UnitTrace[][] {
  const trace: UnitTrace[][] = [];
  for (let tick = 0; tick < ticks; tick += 1) {
    bridge.step(100);
    trace.push(traceUnits(bridge, unitIds));
  }
  return trace;
}

function createTrafficWorld(): GameWorld {
  const world = new World<GameEvents, GameCommands, GameComponents>({
    gridWidth: 8,
    gridHeight: 8,
    seed: 'movement-traffic-test',
    tps: 10,
  });
  world.registerComponent('position');
  world.registerComponent('unit');
  world.registerComponent('unitTransform');
  world.registerComponent('gatherer');
  return world;
}

function addTrafficVillager(
  world: GameWorld,
  position: Position,
  options: { gathering?: boolean } = {},
): number {
  const id = world.createEntity();
  world.setPosition(id, position);
  world.addComponent(id, 'unit', { owner: 1, unitType: 'villager' });
  world.addComponent(id, 'unitTransform', {
    fineX: position.x * 4,
    fineY: position.y * 4,
  });
  if (options.gathering) {
    world.addComponent(id, 'gatherer', {
      desiredResource: 'wood',
      hasExplicitGatherOrder: true,
      task: 'to-resource',
      targetResourceId: 999,
      dropOffBuildingId: null,
      carriedResource: null,
      carriedAmount: 0,
      carryCapacity: 10,
      gatherProgressTicks: 0,
    });
  }
  return id;
}

function addIdleGatherer(world: GameWorld, id: number): void {
  world.addComponent(id, 'gatherer', {
    desiredResource: 'wood',
    hasExplicitGatherOrder: true,
    task: 'idle',
    targetResourceId: null,
    dropOffBuildingId: null,
    carriedResource: null,
    carriedAmount: 0,
    carryCapacity: 10,
    gatherProgressTicks: 0,
  });
}

function activateGatherer(world: GameWorld, id: number): void {
  const gatherer = world.getComponent<GathererComponent>(id, 'gatherer');
  if (!gatherer) throw new Error(`Missing gatherer component for ${id}`);
  world.setComponent(id, 'gatherer', {
    ...gatherer,
    task: 'to-resource',
    targetResourceId: 999,
  });
}

function trafficResolver(
  world: GameWorld,
  accessor: BridgeStateAccessor,
  passableCells: ReadonlySet<string>,
): ReturnType<typeof createMovementTrafficOps>['resolveMovementTraffic'] {
  return createMovementTrafficOps({
    world,
    accessor,
    isCellPassableForUnit: (_unitId, x, y) => passableCells.has(`${x},${y}`),
  }).resolveMovementTraffic;
}

describe('narrow-corridor temporary-unit queueing', () => {
  it('forms one longitudinal lane and admits at most one villager into the choke per tick', () => {
    const { bridge, unitIds } = createQueuedMove();
    let previous = traceUnits(bridge, unitIds);
    let observedMultipleUnitsInCorridor = false;
    let firstViolation: string | undefined;

    for (let tick = 1; tick <= 80; tick += 1) {
      bridge.step(100);
      const current = traceUnits(bridge, unitIds);
      const previousById = new Map(previous.map((unit) => [unit.id, unit]));
      for (const unit of current) {
        const prior = previousById.get(unit.id);
        if (!prior) continue;
        const stepDistance = Math.abs(unit.fineX - prior.fineX)
          + Math.abs(unit.fineY - prior.fineY);
        expect(stepDistance, `tick ${tick}: villager ${unit.id} jumped ${stepDistance} world units`)
          .toBeLessThanOrEqual(0.5 + LATERAL_EPSILON);
      }
      const entrants = current.filter((unit) => {
        const prior = previousById.get(unit.id);
        return prior !== undefined
          && prior.coarseX < CORRIDOR_MIN_X
          && unit.coarseX >= CORRIDOR_MIN_X
          && unit.coarseX <= CORRIDOR_MAX_X
          && unit.coarseY === CORRIDOR_Y;
      });
      if (entrants.length > 1) {
        firstViolation = `tick ${tick}: ${entrants.length} villagers entered the one-cell choke together (${entrants.map((unit) => unit.id).join(', ')})`;
        break;
      }

      const inside = current.filter(isInsideCorridor);
      if (inside.length > 1) {
        observedMultipleUnitsInCorridor = true;
        const fineYs = inside.map((unit) => unit.fineY);
        const lateralSpread = Math.max(...fineYs) - Math.min(...fineYs);
        if (lateralSpread > LATERAL_EPSILON) {
          firstViolation = `tick ${tick}: corridor lane spread ${lateralSpread} (${inside.map((unit) => `${unit.id}@${unit.fineX},${unit.fineY}`).join('; ')})`;
          break;
        }
      }

      previous = current;
    }

    expect(firstViolation, firstViolation).toBeUndefined();
    expect(observedMultipleUnitsInCorridor).toBe(true);
  });

  it('eventually lets every queued villager clear the permanent tree choke', () => {
    const { bridge, unitIds } = createQueuedMove();
    let cleared = false;

    for (let tick = 0; tick < 1_200; tick += 1) {
      bridge.step(100);
      const current = traceUnits(bridge, unitIds);
      if (current.every((unit) => unit.coarseX > CORRIDOR_MAX_X)) {
        cleared = true;
        break;
      }
    }

    expect(cleared, `final=${JSON.stringify(traceUnits(bridge, unitIds))}`).toBe(true);
  });

  it('repeats the same authoritative queue trace for the same command stream', () => {
    const first = createQueuedMove();
    const second = createQueuedMove();

    expect(stepTrace(first.bridge, first.unitIds, 100)).toEqual(
      stepTrace(second.bridge, second.unitIds, 100),
    );
  });

  it('resumes a mid-queue save with the same authoritative movement trace', () => {
    const uninterrupted = createQueuedMove();
    stepTrace(uninterrupted.bridge, uninterrupted.unitIds, 12);

    const savedGame = uninterrupted.bridge.saveGame();
    const restored = createSimulationBridge(FIXTURE, { savedGame });
    const restoredIds = humanVillagerIds(restored);

    expect(restoredIds).toEqual(uninterrupted.unitIds);
    expect(traceUnits(restored, restoredIds)).toEqual(
      traceUnits(uninterrupted.bridge, uninterrupted.unitIds),
    );
    expect(stepTrace(restored, restoredIds, 100)).toEqual(
      stepTrace(uninterrupted.bridge, uninterrupted.unitIds, 100),
    );
  });
});

describe('movement traffic arbitration coverage', () => {
  it('breaks a head-on adjacent-unit deadlock by stable entity priority', () => {
    const world = createTrafficWorld();
    const lowerId = addTrafficVillager(world, { x: 1, y: 2 });
    const higherId = addTrafficVillager(world, { x: 2, y: 2 });
    const accessor = new BridgeStateAccessor(() => world);
    accessor.mutate(unitCommandsCodec, (commands) => {
      commands.set(lowerId, { type: 'move', target: { x: 2, y: 2 } });
      commands.set(higherId, { type: 'move', target: { x: 1, y: 2 } });
    });
    const resolveTraffic = trafficResolver(
      world,
      accessor,
      new Set(['0,2', '1,2', '2,2', '3,2']),
    );

    const higherDecision = resolveTraffic(higherId, { x: 1, y: 2 });
    const lowerDecision = resolveTraffic(lowerId, { x: 2, y: 2 });

    expect(lowerDecision.kind).toBe('proceed');
    expect(higherDecision.kind).toBe('wait');
  });

  it('uses learned immediate steps to break a misleading head-on deadlock by the next tick', () => {
    const world = createTrafficWorld();
    const lowerId = addTrafficVillager(world, { x: 1, y: 2 });
    const higherId = addTrafficVillager(world, { x: 2, y: 2 });
    const accessor = new BridgeStateAccessor(() => world);
    accessor.mutate(unitCommandsCodec, (commands) => {
      // Both final-target headings are the reverse of the immediate path legs.
      commands.set(lowerId, { type: 'move', target: { x: 0, y: 2 } });
      commands.set(higherId, { type: 'move', target: { x: 3, y: 2 } });
    });
    const resolveTraffic = trafficResolver(
      world,
      accessor,
      new Set(['0,2', '1,2', '2,2', '3,2']),
    );
    const attemptInBadOrder = () => world.runMaintenance(() => [
      resolveTraffic(lowerId, { x: 2, y: 2 }),
      resolveTraffic(higherId, { x: 1, y: 2 }),
    ]);

    attemptInBadOrder();
    world.step();
    const secondTick = attemptInBadOrder();

    expect(secondTick.filter((decision) => decision.kind === 'proceed')).toHaveLength(1);
  });

  it('elects a stable winner from a directed four-unit occupied-cell cycle', () => {
    const world = createTrafficWorld();
    const units = [
      { id: addTrafficVillager(world, { x: 1, y: 1 }), next: { x: 2, y: 1 } },
      { id: addTrafficVillager(world, { x: 2, y: 1 }), next: { x: 2, y: 2 } },
      { id: addTrafficVillager(world, { x: 2, y: 2 }), next: { x: 1, y: 2 } },
      { id: addTrafficVillager(world, { x: 1, y: 2 }), next: { x: 1, y: 1 } },
    ];
    const accessor = new BridgeStateAccessor(() => world);
    accessor.mutate(unitCommandsCodec, (commands) => {
      for (const unit of units) {
        commands.set(unit.id, { type: 'move', target: unit.next });
      }
    });
    // This direct-op fixture forces every attempted edge through arbitration;
    // the occupied cells themselves encode the directed dependency cycle.
    const resolveTraffic = trafficResolver(world, accessor, new Set());
    const reverseOrder = [...units].reverse();

    world.runMaintenance(() => {
      for (const unit of reverseOrder) resolveTraffic(unit.id, unit.next);
    });
    world.step();
    const secondTick = world.runMaintenance(() => new Map(reverseOrder.map((unit) => [
      unit.id,
      resolveTraffic(unit.id, unit.next),
    ])));

    expect(secondTick.get(units[0].id)?.kind).toBe('proceed');
  });

  it('queues a gatherer activated after the tick traffic snapshot was built', () => {
    const world = createTrafficWorld();
    const firstId = addTrafficVillager(world, { x: 2, y: 2 });
    const secondId = addTrafficVillager(world, { x: 1, y: 2 });
    addIdleGatherer(world, firstId);
    addIdleGatherer(world, secondId);
    const accessor = new BridgeStateAccessor(() => world);
    const resolveTraffic = trafficResolver(
      world,
      accessor,
      new Set(['1,2', '2,2', '3,2']),
    );

    // Build and cache this tick's traffic snapshot while both gatherers are idle.
    expect(resolveTraffic(firstId, { x: 3, y: 2 }).kind).toBe('proceed');

    activateGatherer(world, firstId);
    const firstDecision = resolveTraffic(firstId, { x: 3, y: 2 });
    activateGatherer(world, secondId);
    const secondDecision = resolveTraffic(secondId, { x: 2, y: 2 });

    expect(firstDecision.kind).toBe('proceed');
    expect(secondDecision.kind).toBe('wait');
  });

  it('gives one late-activated co-located gatherer projection priority', () => {
    const world = createTrafficWorld();
    const rearId = addTrafficVillager(world, { x: 1, y: 2 });
    const frontId = addTrafficVillager(world, { x: 1, y: 2 });
    world.setComponent(rearId, 'unitTransform', { fineX: 4.25, fineY: 8 });
    world.setComponent(frontId, 'unitTransform', { fineX: 4.75, fineY: 8 });
    addIdleGatherer(world, rearId);
    addIdleGatherer(world, frontId);
    const accessor = new BridgeStateAccessor(() => world);
    const resolveTraffic = trafficResolver(
      world,
      accessor,
      new Set(['1,2', '2,2', '3,2']),
    );

    // Prime the snapshot without recording a movement attempt for either unit.
    expect(resolveTraffic(rearId, { x: 1, y: 2 }).kind).toBe('proceed');
    activateGatherer(world, rearId);
    activateGatherer(world, frontId);
    const rearDecision = resolveTraffic(rearId, { x: 2, y: 2 });
    const frontDecision = resolveTraffic(frontId, { x: 2, y: 2 });

    expect(rearDecision.kind).toBe('wait');
    expect(frontDecision.kind).toBe('proceed');
  });

  it('queues task-driven gatherers even though they have no explicit move command', () => {
    const world = createTrafficWorld();
    addTrafficVillager(world, { x: 2, y: 2 }, { gathering: true });
    const followerId = addTrafficVillager(world, { x: 1, y: 2 }, { gathering: true });
    const accessor = new BridgeStateAccessor(() => world);
    const resolveTraffic = trafficResolver(
      world,
      accessor,
      new Set(['1,2', '2,2', '3,2']),
    );

    expect(resolveTraffic(followerId, { x: 2, y: 2 })).toEqual({ kind: 'wait' });
  });

  it('keeps a follower out of an occupied corner in a one-cell bend', () => {
    const world = createTrafficWorld();
    const leaderId = addTrafficVillager(world, { x: 2, y: 2 });
    const followerId = addTrafficVillager(world, { x: 1, y: 2 });
    const accessor = new BridgeStateAccessor(() => world);
    accessor.mutate(unitCommandsCodec, (commands) => {
      commands.set(leaderId, { type: 'move', target: { x: 2, y: 4 } });
      commands.set(followerId, { type: 'move', target: { x: 2, y: 4 } });
    });
    const resolveTraffic = trafficResolver(
      world,
      accessor,
      new Set(['1,2', '2,2', '2,3', '2,4']),
    );

    expect(resolveTraffic(followerId, { x: 2, y: 2 })).toEqual({ kind: 'wait' });
  });

  it('keeps the first post-load traffic decision on serialized authority', () => {
    const world = createTrafficWorld();
    const detouringId = addTrafficVillager(world, { x: 1, y: 2 });
    const moverId = addTrafficVillager(world, { x: 1, y: 2 });
    const liveAccessor = new BridgeStateAccessor(() => world);
    liveAccessor.mutate(unitCommandsCodec, (commands) => {
      commands.set(detouringId, { type: 'move', target: { x: 6, y: 4 } });
      commands.set(moverId, { type: 'move', target: { x: 6, y: 2 } });
    });
    liveAccessor.flush();
    const passableCells = new Set(['0,2', '1,2', '2,2', '3,2']);
    const liveResolve = trafficResolver(world, liveAccessor, passableCells);

    const loadedWorld = World.deserialize<GameEvents, GameCommands, GameComponents>(world.serialize());
    const loadedAccessor = new BridgeStateAccessor(() => loadedWorld);
    const loadedResolve = trafficResolver(
      loadedWorld,
      loadedAccessor,
      passableCells,
    );

    const liveDecision = liveResolve(moverId, { x: 2, y: 2 });
    const loadedDecision = loadedResolve(moverId, { x: 2, y: 2 });
    expect(liveDecision).toEqual({ kind: 'wait' });
    expect(loadedDecision).toEqual(liveDecision);
  });
});
