// Redemption's building half (spec §12, v0.3.100), extracted from
// monkTaskAppliers for the 500-LOC budget: the convert-a-building lane and
// its ownership flip. Shares the faith, resistance, and per-tick guards with
// the unit lane through injected collaborators.

import type { Position } from 'civ-engine';
import type {
  BuildingComponent,
  RenderableComponent,
  UnitComponent,
  VisionSourceComponent,
} from '../types';
import type { GameWorld } from './pureHelpers';
import type { BridgeStateAccessor } from './bridgeStateAccessor';
import {
  constructionStatesCodec,
  conversionStateCodec,
  garrisonedByBuildingCodec,
  monkFaithCodec,
  playerCivilizationsCodec,
  playerTeamsCodec,
  populationCodec,
  productionQueuesCodec,
  researchedTechnologiesCodec,
} from './bridgeStateSerialize';
import {
  monkConvertProgressMultiplier,
  monkMayConvert,
  teamConvertResistanceMultiplier,
} from '../monasteryTechEffects';
import { teamHasCivilization } from '../teamBonuses';
import { EMPTY_TECH_SET } from '../economyTechEffects';
import { MONK_FAITH_MAX } from './bridgeConstants';
import { isEnemyOwner } from '../alliances';
import { buildingPopulationProvided, buildingTint } from '../prototypeBuildingRules';
import { civPopulationProvidedBonus } from '../civBonusEffects';
import { ownerHardPopCap } from './ownerPopCap';
import { deriveCap } from './bridgeConstants';

export function createMonkBuildingConversion(deps: {
  accessor: BridgeStateAccessor;
  clearMonkTask: (monkId: number) => void;
  spendFaith: (monkId: number, owner: number, targetId: number) => void;
  isVisibleToOwner: (owner: number, x: number, y: number) => boolean;
  markOutOfBandRenderChange: () => void;
  /** worldOccupancy.notePassabilityChange — a building changing hands changes
   *  who its gate would admit. No gate can change hands today (the wall line
   *  refuses conversion), so this is the rule kept mechanical rather than a
   *  live defect: see the KNOWN BOUNDARY note on `structuralRevision`. */
  notePassabilityChange: () => void;
  monkConvertProcessedThisTick: Map<number, number>;
  monkConvertProgressPerTick: number;
  monkConvertFlipThreshold: number;
}) {
  const {
    accessor,
    clearMonkTask,
    spendFaith,
    isVisibleToOwner,
    markOutOfBandRenderChange,
    notePassabilityChange,
    monkConvertProcessedThisTick,
    monkConvertProgressPerTick,
    monkConvertFlipThreshold,
  } = deps;

  function applyMonkConvertOnBuilding(
    monkId: number,
    targetId: number,
    targetBuilding: BuildingComponent,
    monkUnit: UnitComponent,
    activeWorld: GameWorld,
  ): void {
    const conversionState = accessor.get(conversionStateCodec);
    const abandon = (): void => {
      clearMonkTask(monkId);
      conversionState.delete(targetId);
      accessor.markDirty(conversionStateCodec);
    };
    if (!isEnemyOwner(accessor.get(playerTeamsCodec), monkUnit.owner, targetBuilding.owner)) {
      abandon();
      return;
    }
    if (!monkMayConvert(
      { kind: 'building', buildingType: targetBuilding.buildingType },
      accessor.get(researchedTechnologiesCodec).get(monkUnit.owner) ?? EMPTY_TECH_SET,
    )) {
      abandon();
      return;
    }
    // An OCCUPIED building holds out: while anyone shelters inside, the monk
    // keeps the task and waits, exactly like the faith-rest stall.
    if ((accessor.get(garrisonedByBuildingCodec).get(targetId) ?? []).length > 0) {
      return;
    }
    if ((accessor.get(monkFaithCodec).get(monkId) ?? MONK_FAITH_MAX) < MONK_FAITH_MAX) {
      return;
    }
    const targetPosition = activeWorld.getComponent<Position>(targetId, 'position');
    if (
      targetPosition
      && !isVisibleToOwner(monkUnit.owner, targetPosition.x, targetPosition.y)
    ) {
      return;
    }
    const convState = conversionState.get(targetId) ?? { byOwner: monkUnit.owner, progress: 0 };
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
    // Faith and the Teuton team resistance defend buildings exactly as they
    // defend units; Heresy does not — it is "converted UNITS die".
    const targetOwnerResearched =
      accessor.get(researchedTechnologiesCodec).get(targetBuilding.owner) ?? EMPTY_TECH_SET;
    const resistance = monkConvertProgressMultiplier(targetOwnerResearched)
      * teamConvertResistanceMultiplier(teamHasCivilization(
        accessor.get(playerTeamsCodec),
        accessor.get(playerCivilizationsCodec),
        targetBuilding.owner,
        'Teutons',
      ));
    convState.progress += monkConvertProgressPerTick * resistance;
    if (convState.progress >= monkConvertFlipThreshold) {
      spendFaith(monkId, monkUnit.owner, targetId);
      flipConvertedBuilding(targetId, targetBuilding, monkUnit, monkId, activeWorld);
      return;
    }
    conversionState.set(targetId, convState);
    accessor.markDirty(conversionStateCodec);
  }

  function flipConvertedBuilding(
    targetId: number,
    targetBuilding: BuildingComponent,
    monkUnit: UnitComponent,
    monkId: number,
    activeWorld: GameWorld,
  ): void {
    const previousOwner = targetBuilding.owner;
    targetBuilding.owner = monkUnit.owner;
    notePassabilityChange();

    // POPULATION SUPPLY travels with the roof: subtract what this building
    // contributed to its old owner (their civ bonus included) and add what it
    // provides the new one — a Chinese Town Center is not a Chinese Town
    // Center in Briton hands. Both caps re-derive through ownerHardPopCap.
    const construction = accessor.get(constructionStatesCodec).get(targetId);
    const civs = accessor.get(playerCivilizationsCodec);
    const populationMap = accessor.get(populationCodec);
    const providedToOld = construction?.populationProvided
      ?? (buildingPopulationProvided(targetBuilding.buildingType)
        + civPopulationProvidedBonus(civs.get(previousOwner), targetBuilding.buildingType));
    const providedToNew = buildingPopulationProvided(targetBuilding.buildingType)
      + civPopulationProvidedBonus(civs.get(monkUnit.owner), targetBuilding.buildingType);
    const oldPopulation = populationMap.get(previousOwner);
    if (oldPopulation && providedToOld > 0) {
      oldPopulation.rawSupply = Math.max(0, oldPopulation.rawSupply - providedToOld);
      oldPopulation.cap = deriveCap(oldPopulation.rawSupply, ownerHardPopCap(accessor, previousOwner));
      accessor.markDirty(populationCodec);
    }
    const newPopulation = populationMap.get(monkUnit.owner);
    if (newPopulation && providedToNew > 0) {
      newPopulation.rawSupply += providedToNew;
      newPopulation.cap = deriveCap(newPopulation.rawSupply, ownerHardPopCap(accessor, monkUnit.owner));
      accessor.markDirty(populationCodec);
    }
    if (construction) {
      construction.populationProvided = providedToNew;
      accessor.markDirty(constructionStatesCodec);
    }

    const visionSource = activeWorld.getComponent<VisionSourceComponent>(targetId, 'visionSource');
    if (visionSource) {
      visionSource.playerId = monkUnit.owner;
    }
    const renderable = activeWorld.getComponent<RenderableComponent>(targetId, 'renderable');
    if (renderable) {
      renderable.tint = buildingTint(targetBuilding.buildingType, monkUnit.owner, true);
    }
    // Whatever the old owner had queued dies with the flip — the new owner
    // did not pay for it and must not receive it. (No refund: the spend was
    // the loser's, and AoE2 refunds nothing on a conversion either.)
    accessor.mutate(productionQueuesCodec, (m) => {
      if (m.delete(targetId)) { /* queue gone with the ownership */ }
    });
    const conversionState = accessor.get(conversionStateCodec);
    conversionState.delete(targetId);
    accessor.markDirty(conversionStateCodec);
    clearMonkTask(monkId);
    markOutOfBandRenderChange();
  }

  return { applyMonkConvertOnBuilding };
}
