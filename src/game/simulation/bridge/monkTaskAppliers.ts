// Per-tick apply handlers for the four Monk task kinds. Each handler
// updates side-map state for the Monk and its target; the behavior system
// invokes the right one once the Monk is within action range.

import type { EntityRef, Position, World } from 'civ-engine';

import type {
  BuildingComponent,
  GathererComponent,
  RenderableComponent,
  ResourceComponent,
  UnitComponent,
  UnitType,
  VisionSourceComponent,
} from '../types';
import type { GameCommands, GameEvents, GameWorld } from './pureHelpers';
import type { BridgeState } from './bridgeState';

export interface MonkTaskAppliersDeps {
  world: GameWorld;
  state: BridgeState;
  clearUnitCommand: (id: number) => void;
  clearGathererOrder: (id: number) => void;
  markOutOfBandRenderChange: () => void;
  destroyResourceEntity: (id: number) => void;
  isVisibleToOwner: (owner: number, x: number, y: number) => boolean;
  currentEntityId: (
    activeWorld: World<GameEvents, GameCommands>,
    ref: EntityRef | undefined | null,
  ) => number | null;
  unitTint: (unitType: UnitType, owner: number) => number;
  clearMonkTask: (monkId: number) => void;
  monkHealTickInterval: number;
  monkHealHpPerInterval: number;
  monkConvertProgressPerTick: number;
  monkConvertFlipThreshold: number;
}

export interface MonkTaskAppliers {
  applyMonkHeal(monkId: number, targetId: number, monkUnit: UnitComponent): void;
  applyMonkConvert(
    monkId: number,
    targetId: number,
    monkUnit: UnitComponent,
    activeWorld: World<GameEvents, GameCommands>,
  ): void;
  applyMonkPickup(monkId: number, relicId: number): void;
  applyMonkDeposit(
    monkId: number,
    monasteryId: number,
    monkUnit: UnitComponent,
    activeWorld: World<GameEvents, GameCommands>,
  ): void;
}

export function createMonkTaskAppliers(deps: MonkTaskAppliersDeps): MonkTaskAppliers {
  const {
    world,
    state,
    clearUnitCommand,
    clearGathererOrder,
    markOutOfBandRenderChange,
    destroyResourceEntity,
    isVisibleToOwner,
    currentEntityId,
    unitTint,
    clearMonkTask,
    monkHealTickInterval,
    monkHealHpPerInterval,
    monkConvertProgressPerTick,
    monkConvertFlipThreshold,
  } = deps;
  const {
    monkTasks,
    monkCarriedRelic,
    monkHealCounters,
    monkConvertProcessedThisTick,
    conversionState,
    relicsInMonastery,
    combatStates,
    unitCommands,
    population,
  } = state;

  function applyMonkHeal(monkId: number, targetId: number, monkUnit: UnitComponent): void {
    const targetUnit = world.getComponent<UnitComponent>(targetId, 'unit');
    const targetCombat = combatStates.get(targetId);
    if (!targetUnit || !targetCombat || targetUnit.owner !== monkUnit.owner) {
      clearMonkTask(monkId);
      monkHealCounters.delete(monkId);
      return;
    }
    if (targetCombat.currentHp >= targetCombat.maxHp) {
      clearMonkTask(monkId);
      monkHealCounters.delete(monkId);
      return;
    }
    const counter = (monkHealCounters.get(monkId) ?? 0) + 1;
    if (counter >= monkHealTickInterval) {
      targetCombat.currentHp = Math.min(
        targetCombat.maxHp,
        targetCombat.currentHp + monkHealHpPerInterval,
      );
      markOutOfBandRenderChange();
      monkHealCounters.set(monkId, 0);
    } else {
      monkHealCounters.set(monkId, counter);
    }
  }

  function applyMonkConvert(
    monkId: number,
    targetId: number,
    monkUnit: UnitComponent,
    activeWorld: World<GameEvents, GameCommands>,
  ): void {
    const targetUnit = activeWorld.getComponent<UnitComponent>(targetId, 'unit');
    if (!targetUnit || targetUnit.owner === monkUnit.owner) {
      clearMonkTask(monkId);
      conversionState.delete(targetId);
      return;
    }
    // Iter-3 V3-7: vision/LOS interrupt. Moving the converting unit out
    // of vision interrupts conversion — preserve in-flight progress but
    // skip incrementing this tick.
    const targetPosition = activeWorld.getComponent<Position>(targetId, 'position');
    if (
      targetPosition
      && !isVisibleToOwner(monkUnit.owner, targetPosition.x, targetPosition.y)
    ) {
      return;
    }
    const convState = conversionState.get(targetId) ?? { byOwner: monkUnit.owner, progress: 0 };
    // Per-tick guard FIRST (review C-1): two enemy Monks processed in
    // the same tick must not flip-flop progress to zero. The first-
    // processed Monk wins ownership of the increment; later Monks just
    // store the existing state and bail. V4-14: guard is tick-tagged
    // (Map<targetId, tick>) so the per-tick contract holds even if the
    // periodic clear in monkBehaviorSystem misses a phase boundary.
    if (monkConvertProcessedThisTick.get(targetId) === activeWorld.tick) {
      conversionState.set(targetId, convState);
      return;
    }
    if (convState.byOwner !== monkUnit.owner) {
      convState.byOwner = monkUnit.owner;
      convState.progress = 0;
    }
    monkConvertProcessedThisTick.set(targetId, activeWorld.tick);
    convState.progress += monkConvertProgressPerTick;
    if (convState.progress >= monkConvertFlipThreshold) {
      flipConvertedUnit(targetId, targetUnit, monkUnit, monkId, activeWorld);
      return;
    }
    conversionState.set(targetId, convState);
  }

  function flipConvertedUnit(
    targetId: number,
    targetUnit: UnitComponent,
    monkUnit: UnitComponent,
    monkId: number,
    activeWorld: World<GameEvents, GameCommands>,
  ): void {
    const previousOwner = targetUnit.owner;
    targetUnit.owner = monkUnit.owner;
    const previousPopulation = population.get(previousOwner);
    if (previousPopulation) {
      previousPopulation.current = Math.max(0, previousPopulation.current - 1);
    }
    const nextPopulation = population.get(monkUnit.owner);
    if (nextPopulation) {
      nextPopulation.current += 1;
    }
    const visionSource = activeWorld.getComponent<VisionSourceComponent>(
      targetId,
      'visionSource',
    );
    if (visionSource) {
      visionSource.playerId = monkUnit.owner;
    }
    const renderable = activeWorld.getComponent<RenderableComponent>(targetId, 'renderable');
    if (renderable) {
      renderable.tint = unitTint(targetUnit.unitType, monkUnit.owner);
    }
    // Post-conversion cleanup: drop the unit's prior orders and any new-
    // owner attack commands targeting it.
    clearUnitCommand(targetId);
    monkTasks.delete(targetId);
    const targetGatherer = activeWorld.getComponent<GathererComponent>(targetId, 'gatherer');
    if (targetGatherer) {
      clearGathererOrder(targetId);
    }
    for (const [commanderId, command] of unitCommands) {
      if (command.type !== 'attack' || !command.targetEntityRef) {
        continue;
      }
      const resolved = currentEntityId(activeWorld, command.targetEntityRef);
      if (resolved !== targetId) {
        continue;
      }
      const commander = activeWorld.getComponent<UnitComponent>(commanderId, 'unit');
      if (commander && commander.owner === monkUnit.owner) {
        clearUnitCommand(commanderId);
      }
    }
    conversionState.delete(targetId);
    clearMonkTask(monkId);
    markOutOfBandRenderChange();
  }

  function applyMonkPickup(monkId: number, relicId: number): void {
    const relic = world.getComponent<ResourceComponent>(relicId, 'resource');
    if (!relic || relic.resourceType !== 'relic') {
      clearMonkTask(monkId);
      return;
    }
    for (const [otherMonkId, carriedId] of monkCarriedRelic.entries()) {
      if (carriedId === relicId && otherMonkId !== monkId) {
        monkCarriedRelic.delete(otherMonkId);
      }
    }
    monkCarriedRelic.set(monkId, relicId);
    clearMonkTask(monkId);
    markOutOfBandRenderChange();
  }

  function applyMonkDeposit(
    monkId: number,
    monasteryId: number,
    monkUnit: UnitComponent,
    activeWorld: World<GameEvents, GameCommands>,
  ): void {
    const relicId = monkCarriedRelic.get(monkId);
    const building = activeWorld.getComponent<BuildingComponent>(monasteryId, 'building');
    if (
      relicId === undefined
      || !building
      || building.buildingType !== 'monastery'
      || building.owner !== monkUnit.owner
    ) {
      clearMonkTask(monkId);
      return;
    }
    destroyResourceEntity(relicId);
    monkCarriedRelic.delete(monkId);
    relicsInMonastery.set(monasteryId, (relicsInMonastery.get(monasteryId) ?? 0) + 1);
    clearMonkTask(monkId);
    markOutOfBandRenderChange();
  }

  return {
    applyMonkHeal,
    applyMonkConvert,
    applyMonkPickup,
    applyMonkDeposit,
  };
}
