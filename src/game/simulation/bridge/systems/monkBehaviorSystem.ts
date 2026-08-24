// Monk task subsystem step. Each Monk's pending task (heal / convert /
// pickup / deposit) is processed once per tick. Distance / range checks
// gate whether to walk closer or apply the task. Conversion uses a
// per-target single-progress guard so multiple Monks in range don't
// stack progress on the same enemy.

import type { Position } from 'civ-engine';
import type { UnitComponent } from '../../types';
import {
  currentEntityId,
  manhattanDistance,
  type GameWorld,
} from '../pureHelpers';
import type { UnitMovementPlan } from '../movementTypes';
import type { BridgeStateAccessor } from '../bridgeStateAccessor';
import {
  monkCarriedRelicCodec,
  monkFaithCodec,
  monkTasksCodec,
  researchedTechnologiesCodec,
} from '../bridgeStateSerialize';
import { monkFaithRegenPerTick, monkConvertRangeBonus } from '../../monasteryTechEffects';
import { EMPTY_TECH_SET } from '../../economyTechEffects';
import { MONK_FAITH_MAX } from '../bridgeConstants';

type CivWorld = GameWorld;

const MONK_ACTION_RANGE = 4;

export type MonkTaskKind = 'heal' | 'convert' | 'pickup' | 'deposit';

export interface MonkTask {
  kind: MonkTaskKind;
  targetEntityRef: import('civ-engine').EntityRef | null;
}

export interface MonkBehaviorSystemDeps {
  world: GameWorld;
  monkConvertProcessedThisTick: Map<number, number>;
  // Phase 2D: monkTasks + monkCarriedRelic migrated to world.state.aoe2.* via accessor.
  accessor: BridgeStateAccessor;
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
    monkConvertProcessedThisTick,
    accessor,
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

  /**
   * Faith comes back linearly for every monk that has spent it (spec §12). An
   * absent entry means full faith, so the map holds only the RESTING monks and
   * an entry is deleted the moment it tops out — which is also why a save from
   * before the mechanic existed loads as every monk rested.
   */
  function regainFaith(activeWorld: GameWorld): void {
    const faith = accessor.get(monkFaithCodec);
    if (faith.size === 0) return;
    let dirty = false;
    for (const [monkId, current] of [...faith.entries()]) {
      const monkUnit = activeWorld.getComponent<UnitComponent>(monkId, 'unit');
      if (!monkUnit || monkUnit.unitType !== 'monk') {
        faith.delete(monkId);
        dirty = true;
        continue;
      }
      const researched =
        accessor.get(researchedTechnologiesCodec).get(monkUnit.owner) ?? EMPTY_TECH_SET;
      const next = current + monkFaithRegenPerTick(researched);
      if (next >= MONK_FAITH_MAX) faith.delete(monkId);
      else faith.set(monkId, next);
      dirty = true;
    }
    if (dirty) accessor.markDirty(monkFaithCodec);
  }

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
      regainFaith(activeWorld);
      const monkTasks = accessor.get(monkTasksCodec);
      let monkTasksDirty = false;
      const deleteMonkTask = (monkId: number): void => {
        if (monkTasks.delete(monkId)) monkTasksDirty = true;
      };
      for (const [monkId, task] of [...monkTasks.entries()]) {
        const monkUnit = activeWorld.getComponent<UnitComponent>(monkId, 'unit');
        const monkPosition = activeWorld.getComponent<Position>(monkId, 'position');
        if (!monkUnit || !monkPosition || monkUnit.unitType !== 'monk') {
          deleteMonkTask(monkId);
          continue;
        }

        const targetId = currentEntityId(activeWorld, task.targetEntityRef);
        if (targetId === null) {
          deleteMonkTask(monkId);
          continue;
        }

        const targetPosition = activeWorld.getComponent<Position>(targetId, 'position');
        if (!targetPosition) {
          deleteMonkTask(monkId);
          continue;
        }

        const distance =
          task.kind === 'deposit'
            ? distanceToBuilding(targetId, monkPosition)
            : manhattanDistance(monkPosition, targetPosition);

        // Block Printing (Monastery, derived): +monk CONVERSION range for the
        // monk's owner. Applies only to convert tasks; heal/pickup/deposit keep
        // the base range. Un-teched owners read +0 → behaviour-identical.
        const actionRange =
          task.kind === 'convert'
            ? MONK_ACTION_RANGE
              + monkConvertRangeBonus(
                accessor.get(researchedTechnologiesCodec).get(monkUnit.owner) ?? EMPTY_TECH_SET,
              )
            : MONK_ACTION_RANGE;

        if (distance > actionRange) {
          const plan =
            task.kind === 'deposit'
              ? findBuildingApproachPlan(monkId, targetId, actionRange, activeWorld)
              : findUnitRangePlan(monkId, targetPosition, actionRange, activeWorld);
          if (!plan) {
            deleteMonkTask(monkId);
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
      if (monkTasksDirty) accessor.markDirty(monkTasksCodec);

      // Carried-relic follow: every Monk carrying a relic this tick moves the
      // relic entity to the Monk's current cell so the rendered position
      // tracks.
      const monkCarriedRelic = accessor.get(monkCarriedRelicCodec);
      let carriedDirty = false;
      for (const [monkId, relicId] of [...monkCarriedRelic.entries()]) {
        const monkPosition = activeWorld.getComponent<Position>(monkId, 'position');
        const relicPosition = activeWorld.getComponent<Position>(relicId, 'position');
        if (!monkPosition || !relicPosition) {
          monkCarriedRelic.delete(monkId);
          carriedDirty = true;
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
      if (carriedDirty) {
        accessor.markDirty(monkCarriedRelicCodec);
      }
    },
  });
}
