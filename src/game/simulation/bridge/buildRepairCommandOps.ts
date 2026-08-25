// Build + repair villager command setters, extracted from unitCommandOps to
// keep that file under the 500-LOC cap. `setUnitBuildCommandDirect` queues
// construction on an in-progress building; `setUnitRepairCommandDirect` queues
// repair on a COMPLETE building (spec §8.1); `tryRepairCharge` is the context-
// routing branch that charges the repair cost up front and queues the repair.

import type { EntityRef, Position } from 'civ-engine';

import type { BuildingComponent, UnitComponent } from '../types';
import { isRepairableUnitType, unitRepairCost } from '../unitRepair';
import type { TrainableUnitType } from '../types';
import { canAfford, repairCost, spendResources } from '../prototypeEconomyRules';
import type { UnitCommand } from './sharedTypes';
import type { BridgeStateAccessor } from './bridgeStateAccessor';
import {
  buildingHealthStatesCodec,
  combatStatesCodec,
  constructionStatesCodec,
  playerResourcesCodec,
} from './bridgeStateSerialize';
import type { GameWorld } from './pureHelpers';

export interface BuildRepairCommandOps {
  setUnitBuildCommandDirect(unitId: number, buildingId: number): boolean;
  setUnitRepairCommandDirect(unitId: number, buildingId: number): boolean;
  tryRepairCharge(unitId: number, targetEntityId: number, targetBuilding: BuildingComponent): boolean;
  tryRepairUnitCharge(unitId: number, targetEntityId: number): boolean;
}

export function createBuildRepairCommandOps(deps: {
  world: GameWorld;
  accessor: BridgeStateAccessor;
  getEntityRef: (id: number) => EntityRef | null;
  clearGathererOrder: (id: number) => void;
  setUnitCommand: (unitId: number, command: UnitCommand) => void;
}): BuildRepairCommandOps {
  const { world, accessor, getEntityRef, clearGathererOrder, setUnitCommand } = deps;

  // Shared body for the build/repair command setters — they differ only in the
  // construction precondition and the queued command type.
  function setBuildOrRepair(unitId: number, buildingId: number, mode: 'build' | 'repair'): boolean {
    const unit = world.getComponent<UnitComponent>(unitId, 'unit');
    if (!unit || unit.unitType !== 'villager') return false;
    const buildingPosition = world.getComponent<Position>(buildingId, 'position');
    const targetBuilding = world.getComponent<BuildingComponent>(buildingId, 'building');
    if (!buildingPosition || !targetBuilding || targetBuilding.owner !== unit.owner) return false;
    const construction = accessor.get(constructionStatesCodec).get(buildingId);
    const underConstruction = Boolean(construction && !construction.isComplete);
    // 'build' needs an in-progress building; 'repair' needs a complete one.
    if (mode === 'build' ? !underConstruction : underConstruction) return false;
    const buildingRef = getEntityRef(buildingId);
    if (!buildingRef) return false;
    clearGathererOrder(unitId);
    setUnitCommand(unitId, {
      type: mode,
      target: { x: buildingPosition.x, y: buildingPosition.y },
      buildingRef,
    });
    return true;
  }

  const setUnitBuildCommandDirect = (unitId: number, buildingId: number): boolean =>
    setBuildOrRepair(unitId, buildingId, 'build');
  const setUnitRepairCommandDirect = (unitId: number, buildingId: number): boolean =>
    setBuildOrRepair(unitId, buildingId, 'repair');

  // Repair (spec §8.1): a villager right-clicking a friendly COMPLETE + DAMAGED
  // building repairs it — the cost (a fraction of the build cost, scaled by the
  // missing HP) is charged up front, then the build-command loop restores HP.
  function tryRepairCharge(
    unitId: number,
    targetEntityId: number,
    targetBuilding: BuildingComponent,
  ): boolean {
    const unit = world.getComponent<UnitComponent>(unitId, 'unit');
    if (!unit || unit.unitType !== 'villager') return false;
    const health = accessor.get(buildingHealthStatesCodec).get(targetEntityId);
    if (!health || health.currentHp >= health.maxHp) return false;
    const cost = repairCost(targetBuilding.buildingType, health.maxHp - health.currentHp, health.maxHp);
    const stockpile = accessor.get(playerResourcesCodec).get(unit.owner);
    if (!stockpile || !canAfford(stockpile, cost) || !setUnitRepairCommandDirect(unitId, targetEntityId)) {
      return false;
    }
    spendResources(stockpile, cost);
    accessor.markDirty(playerResourcesCodec);
    return true;
  }

  // Unit repair (spec §8.1, v0.3.107): the same up-front economics applied to
  // a friendly damaged siege engine or ship. The command reuses the 'repair'
  // word with a UNIT target ref, so saves and replays carry it for free.
  function tryRepairUnitCharge(unitId: number, targetEntityId: number): boolean {
    const unit = world.getComponent<UnitComponent>(unitId, 'unit');
    if (!unit || unit.unitType !== 'villager') return false;
    const target = world.getComponent<UnitComponent>(targetEntityId, 'unit');
    const targetPosition = world.getComponent<Position>(targetEntityId, 'position');
    if (!target || !targetPosition || target.owner !== unit.owner) return false;
    if (!isRepairableUnitType(target.unitType)) return false;
    const combat = accessor.get(combatStatesCodec).get(targetEntityId);
    if (!combat || combat.currentHp >= combat.maxHp) return false;
    const cost = unitRepairCost(
      target.unitType as TrainableUnitType,
      combat.maxHp - combat.currentHp,
      combat.maxHp,
    );
    const stockpile = accessor.get(playerResourcesCodec).get(unit.owner);
    if (!stockpile || !canAfford(stockpile, cost)) return false;
    const targetRef = getEntityRef(targetEntityId);
    if (!targetRef) return false;
    clearGathererOrder(unitId);
    setUnitCommand(unitId, {
      type: 'repair',
      target: { x: targetPosition.x, y: targetPosition.y },
      targetEntityRef: targetRef,
      targetEntityKind: 'unit',
    });
    spendResources(stockpile, cost);
    accessor.markDirty(playerResourcesCodec);
    return true;
  }

  return { setUnitBuildCommandDirect, setUnitRepairCommandDirect, tryRepairCharge, tryRepairUnitCharge };
}
