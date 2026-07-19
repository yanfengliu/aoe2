import { World, type Position } from 'civ-engine';
import { describe, expect, it } from 'vitest';

import { BridgeStateAccessor } from '../../src/game/simulation/bridge/bridgeStateAccessor';
import { unitCommandsCodec } from '../../src/game/simulation/bridge/bridgeStateSerialize';
import { createMovementTrafficOps } from '../../src/game/simulation/bridge/movementTrafficOps';
import type {
  GameCommands,
  GameComponents,
  GameEvents,
  GameWorld,
} from '../../src/game/simulation/bridge/pureHelpers';
import type { UnitTransformComponent } from '../../src/game/simulation/types';

type TrafficProvenanceTransform = UnitTransformComponent & {
  trafficIntentKey?: string;
  trafficAttemptTick?: number;
};

function createTrafficWorld(): GameWorld {
  const world = new World<GameEvents, GameCommands, GameComponents>({
    gridWidth: 8,
    gridHeight: 8,
    seed: 'movement-traffic-edge-cases',
    tps: 10,
  });
  world.registerComponent('position');
  world.registerComponent('unit');
  world.registerComponent('unitTransform');
  world.registerComponent('gatherer');
  return world;
}

function addUnit(world: GameWorld, position: Position, owner = 1): number {
  const id = world.createEntity();
  world.setPosition(id, position);
  world.addComponent(id, 'unit', { owner, unitType: 'villager' });
  world.addComponent(id, 'unitTransform', {
    fineX: position.x * 4,
    fineY: position.y * 4,
  });
  return id;
}

function setRememberedTraffic(
  world: GameWorld,
  id: number,
  direction: Position,
  provenance: { intentKey: string; attemptTick: number },
): void {
  const transform = world.getComponent<UnitTransformComponent>(id, 'unitTransform');
  if (!transform) throw new Error(`Missing unit transform for ${id}`);
  world.setComponent(id, 'unitTransform', {
    ...transform,
    trafficDirectionX: direction.x,
    trafficDirectionY: direction.y,
    trafficIntentKey: provenance.intentKey,
    trafficAttemptTick: provenance.attemptTick,
  } as TrafficProvenanceTransform);
}

function resolver(
  world: GameWorld,
  accessor: BridgeStateAccessor,
  passableCells: ReadonlySet<string> = new Set(),
): ReturnType<typeof createMovementTrafficOps>['resolveMovementTraffic'] {
  return createMovementTrafficOps({
    world,
    accessor,
    isCellPassableForUnit: (_id, x, y) => passableCells.has(`${x},${y}`),
  }).resolveMovementTraffic;
}

describe('movement traffic arbitration edge cases', () => {
  it('ignores a stale opposite remembered leg after the front unit receives a new same-flow order', () => {
    const world = createTrafficWorld();
    const followerId = addUnit(world, { x: 1, y: 2 });
    const frontId = addUnit(world, { x: 2, y: 2 });
    setRememberedTraffic(world, frontId, { x: -1, y: 0 }, {
      intentKey: 'old-west-order',
      attemptTick: world.tick - 1,
    });
    const accessor = new BridgeStateAccessor(() => world);
    accessor.mutate(unitCommandsCodec, (commands) => {
      commands.set(followerId, { type: 'move', target: { x: 6, y: 2 } });
      commands.set(frontId, { type: 'move', target: { x: 6, y: 2 } });
    });
    const resolveTraffic = resolver(
      world,
      accessor,
      new Set(['1,2', '2,2', '3,2', '4,2', '5,2', '6,2']),
    );

    expect(resolveTraffic(followerId, { x: 2, y: 2 }).kind).toBe('wait');
  });

  it('waits when a cycle peer shares the next cell with an active acyclic occupant', () => {
    const world = createTrafficWorld();
    const moverId = addUnit(world, { x: 1, y: 2 });
    const cyclePeerId = addUnit(world, { x: 2, y: 2 });
    const stationaryPeerId = addUnit(world, { x: 2, y: 2 });
    const accessor = new BridgeStateAccessor(() => world);
    accessor.mutate(unitCommandsCodec, (commands) => {
      commands.set(moverId, { type: 'move', target: { x: 6, y: 2 } });
      commands.set(cyclePeerId, { type: 'move', target: { x: 1, y: 2 } });
      commands.set(stationaryPeerId, { type: 'move', target: { x: 2, y: 2 } });
    });

    expect(resolver(world, accessor)(moverId, { x: 2, y: 2 }).kind).toBe('wait');
  });

  it('does not let a real caller claim a cycle whose lower-id peer never attempted recently', () => {
    const world = createTrafficWorld();
    const unattemptedId = addUnit(world, { x: 2, y: 2 });
    const callerId = addUnit(world, { x: 1, y: 2 });
    setRememberedTraffic(world, unattemptedId, { x: -1, y: 0 }, {
      intentKey: 'matching-but-unattempted-order',
      attemptTick: world.tick - 2,
    });
    const accessor = new BridgeStateAccessor(() => world);
    accessor.mutate(unitCommandsCodec, (commands) => {
      commands.set(unattemptedId, { type: 'move', target: { x: 1, y: 2 } });
      commands.set(callerId, { type: 'move', target: { x: 2, y: 2 } });
    });

    // Conservative waiting is valid: the lower-id peer has an active command,
    // but did not make a current or previous-tick traffic attempt.
    expect(resolver(world, accessor)(callerId, { x: 2, y: 2 }).kind).toBe('wait');
  });

  it('keeps co-located origin reservations independent between owners', () => {
    const world = createTrafficWorld();
    const playerOneId = addUnit(world, { x: 1, y: 2 }, 1);
    const playerTwoId = addUnit(world, { x: 1, y: 2 }, 2);
    const accessor = new BridgeStateAccessor(() => world);
    accessor.mutate(unitCommandsCodec, (commands) => {
      commands.set(playerOneId, { type: 'move', target: { x: 6, y: 2 } });
      commands.set(playerTwoId, { type: 'move', target: { x: 6, y: 2 } });
    });
    const resolveTraffic = resolver(
      world,
      accessor,
      new Set(['1,2', '2,2', '3,2', '4,2', '5,2', '6,2']),
    );

    expect(resolveTraffic(playerOneId, { x: 2, y: 2 }).kind).toBe('proceed');
    expect(resolveTraffic(playerTwoId, { x: 2, y: 2 }).kind).toBe('proceed');
  });
});
