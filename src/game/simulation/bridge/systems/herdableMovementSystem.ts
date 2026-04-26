// Sheep follow per-target move orders. The path planner picks the nearest
// passable cell when the requested target is itself blocked. Once the
// transform reaches that planner destination the order is cleared so the
// sheep doesn't re-plan the same dead-end every tick.

import type { Position, World } from 'civ-engine';
import type { ResourceComponent, UnitTransformComponent } from '../../types';
import {
  gridPositionFromUnitTransform,
  isUnitTransformAtTarget,
  type GameCommands,
  type GameEvents,
  type GameWorld,
} from '../pureHelpers';
import type { UnitMovementPlan } from '../movementTypes';

type CivWorld = World<GameEvents, GameCommands>;

const SHEEP_SUBGRID_STEP_PER_TICK = 1;

export interface HerdableMovementSystemDeps {
  world: GameWorld;
  sheepMoveOrders: Map<number, Position>;
  getUnitTransform: (id: number, activeWorld: CivWorld) => UnitTransformComponent | null;
  findMovementPlan: (
    entityId: number,
    start: Position,
    candidates: Position[],
    preferCurrentCell: boolean,
    activeWorld?: CivWorld,
    isCellPassable?: (entityId: number, x: number, y: number, activeWorld: CivWorld) => boolean,
  ) => UnitMovementPlan | null;
  getNearestMoveCandidates: (target: Position) => Position[];
  isCellPassableForWildlife: (
    entityId: number,
    x: number,
    y: number,
    activeWorld: CivWorld,
  ) => boolean;
  moveUnitOneSubgridStep: (
    entityId: number,
    nextStep: Position,
    activeWorld?: CivWorld,
    stepPerTick?: number,
  ) => void;
  markOutOfBandRenderChange: () => void;
}

export function registerHerdableMovementSystem(deps: HerdableMovementSystemDeps): void {
  const {
    world,
    sheepMoveOrders,
    getUnitTransform,
    findMovementPlan,
    getNearestMoveCandidates,
    isCellPassableForWildlife,
    moveUnitOneSubgridStep,
    markOutOfBandRenderChange,
  } = deps;

  world.registerSystem({
    name: 'prototypeHerdableMovement',
    phase: 'update',
    before: ['prototypePlayerCommands'],
    execute(activeWorld) {
      for (const [sheepId, target] of [...sheepMoveOrders.entries()]) {
        const resource = activeWorld.getComponent<ResourceComponent>(sheepId, 'resource');
        const transform = getUnitTransform(sheepId, activeWorld);
        if (
          !resource
          || !transform
          || resource.resourceType !== 'sheep'
          || resource.amount <= 0
          || resource.owner === null
        ) {
          sheepMoveOrders.delete(sheepId);
          continue;
        }

        if (isUnitTransformAtTarget(transform, sheepId, target)) {
          sheepMoveOrders.delete(sheepId);
          continue;
        }

        const start = gridPositionFromUnitTransform(transform);
        const plan = findMovementPlan(
          sheepId,
          start,
          getNearestMoveCandidates(target),
          false,
          activeWorld,
          isCellPassableForWildlife,
        );
        if (!plan) {
          sheepMoveOrders.delete(sheepId);
          continue;
        }

        if (isUnitTransformAtTarget(transform, sheepId, plan.destination)) {
          sheepMoveOrders.delete(sheepId);
          continue;
        }

        moveUnitOneSubgridStep(sheepId, plan.nextStep, activeWorld, SHEEP_SUBGRID_STEP_PER_TICK);
        markOutOfBandRenderChange();
      }
    },
  });
}
