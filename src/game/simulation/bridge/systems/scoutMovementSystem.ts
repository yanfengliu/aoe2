// AI-owned scout wander. Bounces a scout's velocity off its WanderBounds
// and steps the unit one subgrid step per tick — without going through the
// command queue. Human-owned scouts skip this loop so manual move orders
// take precedence.

import type { Position, World } from 'civ-engine';
import type {
  UnitComponent,
  UnitTransformComponent,
  VelocityComponent,
  WanderBoundsComponent,
} from '../../types';
import {
  clamp,
  getUnitTargetTransformForCell,
  gridPositionFromUnitTransform,
  type GameCommands,
  type GameEvents,
  type GameWorld,
} from '../pureHelpers';
import { UNIT_SUBGRID_RESOLUTION, UNIT_SUBGRID_STEP_PER_TICK } from '../pureHelpers';
import { unitCommandsCodec } from '../bridgeStateSerialize';

type CivWorld = World<GameEvents, GameCommands>;

export interface ScoutMovementSystemDeps {
  world: GameWorld;
  humanPlayerId: number;
  accessor: import('../bridgeStateAccessor').BridgeStateAccessor;
  isCellPassableForUnit: (
    entityId: number,
    x: number,
    y: number,
    activeWorld: CivWorld,
  ) => boolean;
  setPositionAndSyncOccupancy: (
    entityId: number,
    position: Position,
    activeWorld?: CivWorld,
  ) => void;
  syncUnitTransformToPosition: (
    entityId: number,
    position: Position,
    activeWorld?: CivWorld,
  ) => void;
}

export function registerScoutMovementSystem(deps: ScoutMovementSystemDeps): void {
  const {
    world,
    humanPlayerId,
    accessor,
    isCellPassableForUnit,
    setPositionAndSyncOccupancy,
    syncUnitTransformToPosition,
  } = deps;

  world.registerSystem({
    name: 'prototypeScoutMovement',
    phase: 'update',
    after: ['prototypePlayerCommands'],
    execute(activeWorld) {
      const unitCommands = accessor.get(unitCommandsCodec);
      for (const id of activeWorld.query('position', 'velocity', 'wanderBounds')) {
        if (unitCommands.has(id)) {
          continue;
        }

        const position = activeWorld.getComponent<Position>(id, 'position');
        const velocity = activeWorld.getComponent<VelocityComponent>(id, 'velocity');
        const bounds = activeWorld.getComponent<WanderBoundsComponent>(id, 'wanderBounds');
        const transform = activeWorld.getComponent<UnitTransformComponent>(id, 'unitTransform');
        if (!position || !velocity || !bounds) {
          continue;
        }

        const unit = activeWorld.getComponent<UnitComponent>(id, 'unit');
        if (!unit || unit.unitType !== 'scout' || unit.owner === humanPlayerId) {
          continue;
        }

        const slottedPosition = getUnitTargetTransformForCell(id, position);
        const currentFineX = transform?.fineX ?? slottedPosition.fineX;
        const currentFineY = transform?.fineY ?? slottedPosition.fineY;
        const nextX = currentFineX + velocity.dx * UNIT_SUBGRID_STEP_PER_TICK;
        const nextY = currentFineY + velocity.dy * UNIT_SUBGRID_STEP_PER_TICK;

        if (
          nextX < bounds.minX * UNIT_SUBGRID_RESOLUTION
          || nextX > bounds.maxX * UNIT_SUBGRID_RESOLUTION
        ) {
          velocity.dx *= -1;
        }
        if (
          nextY < bounds.minY * UNIT_SUBGRID_RESOLUTION
          || nextY > bounds.maxY * UNIT_SUBGRID_RESOLUTION
        ) {
          velocity.dy *= -1;
        }

        if (transform) {
          transform.fineX = clamp(
            currentFineX + velocity.dx * UNIT_SUBGRID_STEP_PER_TICK,
            bounds.minX * UNIT_SUBGRID_RESOLUTION,
            bounds.maxX * UNIT_SUBGRID_RESOLUTION,
          );
          transform.fineY = clamp(
            currentFineY + velocity.dy * UNIT_SUBGRID_STEP_PER_TICK,
            bounds.minY * UNIT_SUBGRID_RESOLUTION,
            bounds.maxY * UNIT_SUBGRID_RESOLUTION,
          );
          const nextGridPosition = gridPositionFromUnitTransform(transform);
          if (
            (nextGridPosition.x !== position.x || nextGridPosition.y !== position.y)
            && isCellPassableForUnit(id, nextGridPosition.x, nextGridPosition.y, activeWorld)
          ) {
            setPositionAndSyncOccupancy(id, nextGridPosition, activeWorld);
          } else if (
            nextGridPosition.x !== position.x
            || nextGridPosition.y !== position.y
          ) {
            syncUnitTransformToPosition(id, position, activeWorld);
          }
          continue;
        }

        const nextPosition = {
          x: clamp(position.x + velocity.dx, bounds.minX, bounds.maxX),
          y: clamp(position.y + velocity.dy, bounds.minY, bounds.maxY),
        };
        if (isCellPassableForUnit(id, nextPosition.x, nextPosition.y, activeWorld)) {
          setPositionAndSyncOccupancy(id, nextPosition, activeWorld);
        }
      }
    },
  });
}
