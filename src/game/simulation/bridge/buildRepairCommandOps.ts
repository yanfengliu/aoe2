// Build + repair villager command setters, extracted from unitCommandOps to
// keep that file under the 500-LOC cap. `setUnitBuildCommandDirect` queues
// construction on an in-progress building; `setUnitRepairCommandDirect` queues
// repair on a COMPLETE building (spec §8.1); the tryRepair* pair are the
// context-routing branches that queue a repair — the COST is charged
// continuously by the repair steps as hit points restore (v0.3.122).

import type { EntityRef, Position } from 'civ-engine';

import type { BuildingComponent, UnitComponent } from '../types';
import { isRepairableUnitType } from '../unitRepair';
import type { UnitCommand } from './sharedTypes';
import type { BridgeStateAccessor } from './bridgeStateAccessor';
import {
  buildingHealthStatesCodec,
  combatStatesCodec,
  constructionStatesCodec,
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

  // Repair (spec §8.1; charging model v0.3.122): a villager right-clicking a
  // friendly COMPLETE + DAMAGED building repairs it. The cost is charged
  // CONTINUOUSLY as hit points restore (the repair steps own that) — starting
  // is free, and a broke owner's repair simply stalls, exactly as in AoE2.
  function tryRepairCharge(
    unitId: number,
    targetEntityId: number,
    targetBuilding: BuildingComponent,
  ): boolean {
    void targetBuilding;
    const unit = world.getComponent<UnitComponent>(unitId, 'unit');
    if (!unit || unit.unitType !== 'villager') return false;
    const health = accessor.get(buildingHealthStatesCodec).get(targetEntityId);
    if (!health || health.currentHp >= health.maxHp) return false;
    return setUnitRepairCommandDirect(unitId, targetEntityId);
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
    // v0.3.122: no up-front charge — the repair step pays per restored tick.
    const targetRef = getEntityRef(targetEntityId);
    if (!targetRef) return false;
    clearGathererOrder(unitId);
    setUnitCommand(unitId, {
      type: 'repair',
      target: { x: targetPosition.x, y: targetPosition.y },
      targetEntityRef: targetRef,
      targetEntityKind: 'unit',
    });
    return true;
  }

  return { setUnitBuildCommandDirect, setUnitRepairCommandDirect, tryRepairCharge, tryRepairUnitCharge };
}
