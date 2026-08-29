// Sheep follow per-target move orders. The path planner picks the nearest
// passable cell when the requested target is itself blocked. Once the
// transform reaches that planner destination the order is cleared so the
// sheep doesn't re-plan the same dead-end every tick.

import type { Position } from 'civ-engine';
import type { ResourceComponent, UnitTransformComponent } from '../../types';
import {
  gridPositionFromUnitTransform,
  mapSizeOf,
  isUnitTransformAtTarget,
  type GameWorld,
} from '../pureHelpers';
import type { UnitMovementPlan } from '../movementTypes';
import type { BridgeStateAccessor } from '../bridgeStateAccessor';
import { sheepMoveOrdersCodec } from '../bridgeStateSerialize';

type CivWorld = GameWorld;

// §12.4.2 clock (v0.3.160): the herd contract is HALF villager speed. A
// villager earns 0.32 fine units/tick, so a sheep's contract is 0.16; 1 step
// per 6 ticks lands on 0.1667 — 4% hot, the closest a whole-step throttle
// gets (1/7 = 0.143 is 11% slow) — one whole
// subgrid step every 6th tick via the same tick-modulo throttle the wander
// path uses (a fractional carry has no meaning for the replanned-per-tick
// herd step either).
const SHEEP_SUBGRID_STEP_PER_TICK = 1;
const SHEEP_STEP_TICK_INTERVAL = 6;

export interface HerdableMovementSystemDeps {
  world: GameWorld;
  // Phase 2D: sheepMoveOrders migrated to world.state.aoe2.* via accessor.
  accessor: BridgeStateAccessor;
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
    accessor,
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
      const sheepMoveOrders = accessor.get(sheepMoveOrdersCodec);
      let dirty = false;
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
          dirty = true;
          continue;
        }

        if (isUnitTransformAtTarget(transform, sheepId, target)) {
          sheepMoveOrders.delete(sheepId);
          dirty = true;
          continue;
        }

        const start = gridPositionFromUnitTransform(transform, mapSizeOf(activeWorld));
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
          dirty = true;
          continue;
        }

        if (isUnitTransformAtTarget(transform, sheepId, plan.destination)) {
          sheepMoveOrders.delete(sheepId);
          dirty = true;
          continue;
        }

        if (activeWorld.tick % SHEEP_STEP_TICK_INTERVAL === 0) {
          moveUnitOneSubgridStep(sheepId, plan.nextStep, activeWorld, SHEEP_SUBGRID_STEP_PER_TICK);
          markOutOfBandRenderChange();
        }
      }
      if (dirty) {
        accessor.markDirty(sheepMoveOrdersCodec);
      }
    },
  });
}
