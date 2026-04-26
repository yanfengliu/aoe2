// Monk task subsystem step. Each Monk's pending task (heal / convert /
// pickup / deposit) is processed once per tick. Distance / range checks
// gate whether to walk closer or apply the task. Conversion uses a
// per-target single-progress guard so multiple Monks in range don't
// stack progress on the same enemy.

import type { Position, World } from 'civ-engine';
import type { UnitComponent } from '../../types';
import {
  currentEntityId,
  manhattanDistance,
  type GameCommands,
  type GameEvents,
  type GameWorld,
} from '../pureHelpers';
import type { UnitMovementPlan } from '../movementTypes';

type CivWorld = World<GameEvents, GameCommands>;

const MONK_ACTION_RANGE = 4;

export type MonkTaskKind = 'heal' | 'convert' | 'pickup' | 'deposit';

export interface MonkTask {
  kind: MonkTaskKind;
  targetEntityRef: import('civ-engine').EntityRef | null;
}

export interface MonkBehaviorSystemDeps {
  world: GameWorld;
  monkTasks: Map<number, MonkTask>;
  monkConvertProcessedThisTick: Map<number, number>;
  monkCarriedRelic: Map<number, number>;
  distanceToBuilding: (id: number, position: Position) => number;
  findBuildingApproachPlan: (
    unitId: number,
    targetId: number,
    range: number,
    activeWorld: CivWorld,
  ) => UnitMovementPlan | null;
  findUnitRangePlan: (
    unitId: number,
    targetPosition: Position,
    range: number,
    activeWorld: CivWorld,
  ) => UnitMovementPlan | null;
  moveUnitOneSubgridStep: (
    entityId: number,
    nextStep: Position,
    activeWorld?: CivWorld,
    stepPerTick?: number,
  ) => void;
  setPositionAndSyncOccupancy: (
    entityId: number,
    position: Position,
    activeWorld?: CivWorld,
  ) => void;
  applyMonkHeal: (monkId: number, targetId: number, monkUnit: UnitComponent) => void;
  applyMonkConvert: (
    monkId: number,
    targetId: number,
    monkUnit: UnitComponent,
    activeWorld: CivWorld,
  ) => void;
  applyMonkPickup: (monkId: number, targetId: number) => void;
  applyMonkDeposit: (
    monkId: number,
    targetId: number,
    monkUnit: UnitComponent,
    activeWorld: CivWorld,
  ) => void;
}

export function registerMonkBehaviorSystem(deps: MonkBehaviorSystemDeps): void {
  const {
    world,
    monkTasks,
    monkConvertProcessedThisTick,
    monkCarriedRelic,
    distanceToBuilding,
    findBuildingApproachPlan,
    findUnitRangePlan,
    moveUnitOneSubgridStep,
    setPositionAndSyncOccupancy,
    applyMonkHeal,
    applyMonkConvert,
    applyMonkPickup,
    applyMonkDeposit,
  } = deps;

  world.registerSystem({
    name: 'prototypeMonkBehavior',
    phase: 'update',
    after: ['prototypePlayerCommands'],
    execute(activeWorld) {
      // V4-14: drop stale-tick entries to keep the guard map bounded.
      // The guard is tick-tagged so a missed clear() doesn't break the
      // per-tick contract; this loop is purely for memory hygiene.
      for (const [id, tick] of monkConvertProcessedThisTick) {
        if (tick !== activeWorld.tick) monkConvertProcessedThisTick.delete(id);
      }
      for (const [monkId, task] of [...monkTasks.entries()]) {
        const monkUnit = activeWorld.getComponent<UnitComponent>(monkId, 'unit');
        const monkPosition = activeWorld.getComponent<Position>(monkId, 'position');
        if (!monkUnit || !monkPosition || monkUnit.unitType !== 'monk') {
          monkTasks.delete(monkId);
          continue;
        }

        const targetId = currentEntityId(activeWorld, task.targetEntityRef);
        if (targetId === null) {
          monkTasks.delete(monkId);
          continue;
        }

        const targetPosition = activeWorld.getComponent<Position>(targetId, 'position');
        if (!targetPosition) {
          monkTasks.delete(monkId);
          continue;
        }

        const distance =
          task.kind === 'deposit'
            ? distanceToBuilding(targetId, monkPosition)
            : manhattanDistance(monkPosition, targetPosition);

        if (distance > MONK_ACTION_RANGE) {
          const plan =
            task.kind === 'deposit'
              ? findBuildingApproachPlan(monkId, targetId, MONK_ACTION_RANGE, activeWorld)
              : findUnitRangePlan(monkId, targetPosition, MONK_ACTION_RANGE, activeWorld);
          if (!plan) {
            monkTasks.delete(monkId);
            continue;
          }
          moveUnitOneSubgridStep(monkId, plan.nextStep, activeWorld);
          continue;
        }

        if (task.kind === 'heal') {
          applyMonkHeal(monkId, targetId, monkUnit);
          continue;
        }

        if (task.kind === 'convert') {
          applyMonkConvert(monkId, targetId, monkUnit, activeWorld);
          continue;
        }

        if (task.kind === 'pickup') {
          applyMonkPickup(monkId, targetId);
          continue;
        }

        if (task.kind === 'deposit') {
          applyMonkDeposit(monkId, targetId, monkUnit, activeWorld);
          continue;
        }
      }

      // Carried-relic follow: every Monk carrying a relic this tick moves the
      // relic entity to the Monk's current cell so the rendered position
      // tracks.
      for (const [monkId, relicId] of [...monkCarriedRelic.entries()]) {
        const monkPosition = activeWorld.getComponent<Position>(monkId, 'position');
        const relicPosition = activeWorld.getComponent<Position>(relicId, 'position');
        if (!monkPosition || !relicPosition) {
          monkCarriedRelic.delete(monkId);
          continue;
        }
        if (relicPosition.x !== monkPosition.x || relicPosition.y !== monkPosition.y) {
          setPositionAndSyncOccupancy(
            relicId,
            { x: monkPosition.x, y: monkPosition.y },
            activeWorld,
          );
        }
      }
    },
  });
}
