// Per-tick apply handlers for the four Monk task kinds. Each handler
// updates side-map state for the Monk and its target; the behavior system
// invokes the right one once the Monk is within action range.

import { BYZANTINES_TEAM_HEAL_MULTIPLIER, teamHasCivilization } from '../teamBonuses';
import { isMonasticUnit } from '../monasticUnits';
import type { EntityRef, Position } from 'civ-engine';

import type {
  BuildingComponent,
  GathererComponent,
  RenderableComponent,
  ResourceComponent,
  UnitComponent,
  UnitType,
  VisionSourceComponent,
} from '../types';
import type { GameWorld } from './pureHelpers';
import type { BridgeState } from './bridgeState';
import type { BridgeStateAccessor } from './bridgeStateAccessor';
import {
  combatStatesCodec,
  conversionStateCodec,
  monkCarriedRelicCodec,
  monkFaithCodec,
  monkHealCountersCodec,
  playerTeamsCodec,
  populationCodec,
  relicsInMonasteryCodec,
  researchedTechnologiesCodec,
  unitCommandsCodec,
  queuedEntityOrdersCodec,
  playerCivilizationsCodec,
} from './bridgeStateSerialize';
import {
  convertedUnitDies,
  monkConvertProgressMultiplier,
  teamConvertResistanceMultiplier,
  monkGroupRestsOnConversion,
  monkMayConvert,
} from '../monasteryTechEffects';
import { MONK_FAITH_MAX } from './bridgeConstants';
import { isEnemyOwner } from '../alliances';
import { createMonkBuildingConversion } from './monkBuildingConversion';
import { monkTasksCodec } from './bridgeStateSerialize';
import { EMPTY_TECH_SET } from '../economyTechEffects';

export interface MonkTaskAppliersDeps {
  world: GameWorld;
  state: BridgeState;
  // Phase 2D — accessor for migrated slots (monkHealCounters).
  accessor: BridgeStateAccessor;
  clearUnitCommand: (id: number) => void;
  clearGathererOrder: (id: number) => void;
  markOutOfBandRenderChange: () => void;
  destroyResourceEntity: (id: number) => void;
  // Heresy: destroy the target unit (full cleanup — population, combat/monk
  // state, occupancy) instead of flipping its owner when conversion completes.
  destroyUnitEntity: (id: number) => void;
  isVisibleToOwner: (owner: number, x: number, y: number) => boolean;
  currentEntityId: (
    activeWorld: GameWorld,
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
    activeWorld: GameWorld,
  ): void;
  applyMonkPickup(monkId: number, relicId: number): void;
  applyMonkDeposit(
    monkId: number,
    monasteryId: number,
    monkUnit: UnitComponent,
    activeWorld: GameWorld,
  ): void;
}

export function createMonkTaskAppliers(deps: MonkTaskAppliersDeps): MonkTaskAppliers {
  const {
    world,
    state,
    accessor,
    clearUnitCommand,
    clearGathererOrder,
    markOutOfBandRenderChange,
    destroyResourceEntity,
    destroyUnitEntity,
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
    monkConvertProcessedThisTick,
    monksByOwner,
  } = state;

  function applyMonkHeal(monkId: number, targetId: number, monkUnit: UnitComponent): void {
    const targetUnit = world.getComponent<UnitComponent>(targetId, 'unit');
    const targetCombat = accessor.get(combatStatesCodec).get(targetId);
    const monkHealCounters = accessor.get(monkHealCountersCodec);
    if (!targetUnit || !targetCombat || targetUnit.owner !== monkUnit.owner) {
      clearMonkTask(monkId);
      if (monkHealCounters.delete(monkId)) {
        accessor.markDirty(monkHealCountersCodec);
      }
      return;
    }
    if (targetCombat.currentHp >= targetCombat.maxHp) {
      clearMonkTask(monkId);
      if (monkHealCounters.delete(monkId)) {
        accessor.markDirty(monkHealCountersCodec);
      }
      return;
    }
    // Byzantine team bonus: monks heal 50% faster — the interval between
    // heal pulses shrinks by a third (10 → 7 ticks, ceil, deterministic).
    const interval = teamHasCivilization(
      accessor.get(playerTeamsCodec),
      accessor.get(playerCivilizationsCodec),
      monkUnit.owner,
      'Byzantines',
    )
      ? Math.max(1, Math.ceil(monkHealTickInterval / BYZANTINES_TEAM_HEAL_MULTIPLIER))
      : monkHealTickInterval;
    const counter = (monkHealCounters.get(monkId) ?? 0) + 1;
    if (counter >= interval) {
      targetCombat.currentHp = Math.min(
        targetCombat.maxHp,
        targetCombat.currentHp + monkHealHpPerInterval,
      );
      accessor.markDirty(combatStatesCodec);
      markOutOfBandRenderChange();
      monkHealCounters.set(monkId, 0);
    } else {
      monkHealCounters.set(monkId, counter);
    }
    accessor.markDirty(monkHealCountersCodec);
  }

  /**
   * Empty the faith of the monk that just completed a conversion — and, unless
   * its owner has Theocracy, of every other monk of the same owner that was
   * converting the same target. That group is what Theocracy is about: five
   * monks on one unit all rest without it, one rests with it.
   */
  function spendFaith(monkId: number, owner: number, targetId: number): void {
    const faith = accessor.get(monkFaithCodec);
    faith.set(monkId, 0);
    const researched = accessor.get(researchedTechnologiesCodec).get(owner) ?? EMPTY_TECH_SET;
    if (monkGroupRestsOnConversion(researched)) {
      for (const [otherMonkId, task] of accessor.get(monkTasksCodec)) {
        if (otherMonkId === monkId || task.kind !== 'convert') continue;
        if (task.targetEntityRef?.id !== targetId) continue;
        const otherUnit = world.getComponent<UnitComponent>(otherMonkId, 'unit');
        if (!otherUnit || otherUnit.owner !== owner) continue;
        faith.set(otherMonkId, 0);
      }
    }
    accessor.markDirty(monkFaithCodec);
  }

  const buildingConversion = createMonkBuildingConversion({
    accessor,
    clearMonkTask,
    spendFaith,
    isVisibleToOwner,
    markOutOfBandRenderChange,
    monkConvertProcessedThisTick,
    monkConvertProgressPerTick,
    monkConvertFlipThreshold,
  });

  function applyMonkConvert(
    monkId: number,
    targetId: number,
    monkUnit: UnitComponent,
    activeWorld: GameWorld,
  ): void {
    const targetUnit = activeWorld.getComponent<UnitComponent>(targetId, 'unit');
    const conversionState = accessor.get(conversionStateCodec);
    // Redemption's building half (v0.3.100): a convert task whose target is a
    // BUILDING runs its own lane — same faith, resistance, and per-tick
    // guards, its own flip.
    if (!targetUnit) {
      const targetBuilding = activeWorld.getComponent<BuildingComponent>(targetId, 'building');
      if (targetBuilding) {
        buildingConversion.applyMonkConvertOnBuilding(
          monkId, targetId, targetBuilding, monkUnit, activeWorld,
        );
        return;
      }
    }
    // An ALLY's unit is not a conversion target either: with teams, "not mine"
    // stopped meaning "an enemy", and converting a teammate's knight would be
    // the same defect as shooting at them.
    if (
      !targetUnit
      || !isEnemyOwner(accessor.get(playerTeamsCodec), monkUnit.owner, targetUnit.owner)
    ) {
      clearMonkTask(monkId);
      conversionState.delete(targetId);
      accessor.markDirty(conversionStateCodec);
      return;
    }
    // Redemption and Atonement widen what a monk may take: without Atonement an
    // enemy MONK is not a valid target, and without Redemption neither is a
    // siege engine. Abandoning the task rather than stalling on it means the
    // monk is free for something it can actually do.
    if (!monkMayConvert(
      { kind: 'unit', unitType: targetUnit.unitType },
      accessor.get(researchedTechnologiesCodec).get(monkUnit.owner) ?? EMPTY_TECH_SET,
    )) {
      clearMonkTask(monkId);
      conversionState.delete(targetId);
      accessor.markDirty(conversionStateCodec);
      return;
    }
    // Faith: a monk that has already converted somebody is spent until it has
    // rested (spec §12). It KEEPS the task and stands there — the same shape as
    // the vision interrupt below — so it resumes the moment its faith is back
    // rather than silently dropping the player's order.
    if ((accessor.get(monkFaithCodec).get(monkId) ?? MONK_FAITH_MAX) < MONK_FAITH_MAX) {
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
      accessor.markDirty(conversionStateCodec);
      return;
    }
    if (convState.byOwner !== monkUnit.owner) {
      convState.byOwner = monkUnit.owner;
      convState.progress = 0;
    }
    monkConvertProcessedThisTick.set(targetId, activeWorld.tick);
    // The target owner's researched set drives two conversion techs: Faith
    // (halves incoming progress) and Heresy (the unit dies at the flip instead
    // of switching sides). Un-teched → resistance ×1, no Heresy.
    const targetOwnerResearched =
      accessor.get(researchedTechnologiesCodec).get(targetUnit.owner) ?? EMPTY_TECH_SET;
    const resistance = monkConvertProgressMultiplier(targetOwnerResearched)
      // Teuton team bonus stacks with Faith, AoE2's own composition: a
      // Teuton-allied owner with Faith converts at a quarter rate.
      * teamConvertResistanceMultiplier(teamHasCivilization(
        accessor.get(playerTeamsCodec),
        accessor.get(playerCivilizationsCodec),
        targetUnit.owner,
        'Teutons',
      ));
    convState.progress += monkConvertProgressPerTick * resistance;
    if (convState.progress >= monkConvertFlipThreshold) {
      // A completed conversion empties the monk's faith whichever way it ends —
      // Heresy denies the converter the unit, not the effort.
      spendFaith(monkId, monkUnit.owner, targetId);
      if (convertedUnitDies(targetOwnerResearched)) {
        // Heresy: deny the unit to the converter — it dies rather than flips.
        // destroyUnitEntity clears conversionState + population + all side maps.
        destroyUnitEntity(targetId);
        markOutOfBandRenderChange();
        return;
      }
      flipConvertedUnit(targetId, targetUnit, monkUnit, monkId, activeWorld);
      return;
    }
    conversionState.set(targetId, convState);
    accessor.markDirty(conversionStateCodec);
  }

  function flipConvertedUnit(
    targetId: number,
    targetUnit: UnitComponent,
    monkUnit: UnitComponent,
    monkId: number,
    activeWorld: GameWorld,
  ): void {
    const previousOwner = targetUnit.owner;
    targetUnit.owner = monkUnit.owner;
    const populationMap = accessor.get(populationCodec);
    const previousPopulation = populationMap.get(previousOwner);
    if (previousPopulation) {
      previousPopulation.current = Math.max(0, previousPopulation.current - 1);
      accessor.markDirty(populationCodec);
    }
    const nextPopulation = populationMap.get(monkUnit.owner);
    if (nextPopulation) {
      nextPopulation.current += 1;
      accessor.markDirty(populationCodec);
    }
    // V5-1: keep the monksByOwner side map in sync if a Monk is converted.
    // Canonical AoE2 makes Monks immune to conversion, but the contract
    // must hold either way — without this update, a converted Monk would
    // remain in the old owner's set forever.
    if (isMonasticUnit(targetUnit.unitType)) {
      const previousSet = monksByOwner.get(previousOwner);
      if (previousSet) {
        previousSet.delete(targetId);
        if (previousSet.size === 0) {
          monksByOwner.delete(previousOwner);
        }
      }
      let nextSet = monksByOwner.get(monkUnit.owner);
      if (!nextSet) {
        nextSet = new Set();
        monksByOwner.set(monkUnit.owner, nextSet);
      }
      nextSet.add(targetId);
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
    clearMonkTask(targetId);
    // v0.3.141: the shift-queued chain is a prior order too — leaving it
    // would let the OLD owner's stale chain drive the converted unit.
    {
      const chains = accessor.get(queuedEntityOrdersCodec);
      if (chains.delete(targetId)) accessor.markDirty(queuedEntityOrdersCodec);
    }
    const unitCommands = accessor.get(unitCommandsCodec);
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
    accessor.mutate(conversionStateCodec, (m) => m.delete(targetId));
    clearMonkTask(monkId);
    markOutOfBandRenderChange();
  }

  function applyMonkPickup(monkId: number, relicId: number): void {
    const relic = world.getComponent<ResourceComponent>(relicId, 'resource');
    if (!relic || relic.resourceType !== 'relic') {
      clearMonkTask(monkId);
      return;
    }
    accessor.mutate(monkCarriedRelicCodec, (m) => {
      for (const [otherMonkId, carriedId] of m.entries()) {
        if (carriedId === relicId && otherMonkId !== monkId) {
          m.delete(otherMonkId);
        }
      }
      m.set(monkId, relicId);
    });
    clearMonkTask(monkId);
    markOutOfBandRenderChange();
  }

  function applyMonkDeposit(
    monkId: number,
    monasteryId: number,
    monkUnit: UnitComponent,
    activeWorld: GameWorld,
  ): void {
    const relicId = accessor.get(monkCarriedRelicCodec).get(monkId);
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
    accessor.mutate(monkCarriedRelicCodec, (m) => m.delete(monkId));
    accessor.mutate(relicsInMonasteryCodec, (m) => m.set(monasteryId, (m.get(monasteryId) ?? 0) + 1));
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
