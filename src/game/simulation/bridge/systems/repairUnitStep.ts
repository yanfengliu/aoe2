// The per-tick body of a villager repairing a MECHANICAL unit (spec §8.1,
// v0.3.107) — the sibling of `builderWorkStep`, for a target that can move.
// Pursue to melee range like an attacker, then restore HP at the target's
// own training rate; the cost was already charged when the order was given.

import type { Position } from 'civ-engine';

import type { TrainableUnitType, UnitComponent } from '../../types';
import { unitRepairRatePerTick } from '../../unitRepair';
import type { BridgeStateAccessor } from '../bridgeStateAccessor';
import { combatStatesCodec, playerResourcesCodec, repairAccrualCodec } from '../bridgeStateSerialize';
import { unitRepairCost } from '../../unitRepair';
import { chargeRepairTick, clearRepairAccrual } from '../../repairCharging';
import type { GameWorld } from '../pureHelpers';
import type { UnitCommand } from '../sharedTypes';
import type { UnitMovementPlan } from '../movementTypes';

export function runRepairUnitStep(deps: {
  world: GameWorld;
  accessor: BridgeStateAccessor;
  id: number;
  command: UnitCommand;
  currentEntityId: (world: GameWorld, ref: UnitCommand['targetEntityRef']) => number | null;
  findUnitRangePlan: (
    unitId: number,
    targetPosition: Position,
    range: number,
    activeWorld: GameWorld,
  ) => UnitMovementPlan | null;
  isUnitAtTarget: (id: number, target: Position, activeWorld: GameWorld) => boolean;
  moveUnitOneSubgridStep: (id: number, target: Position, activeWorld?: GameWorld) => void;
  clearUnitCommand: (id: number) => void;
}): void {
  const {
    world, accessor, id, command,
    currentEntityId, findUnitRangePlan, isUnitAtTarget,
    moveUnitOneSubgridStep, clearUnitCommand,
  } = deps;

  const targetId = command.targetEntityRef
    ? currentEntityId(world, command.targetEntityRef)
    : null;
  if (targetId === null) {
    clearUnitCommand(id);
    return;
  }
  const combat = accessor.get(combatStatesCodec).get(targetId);
  const target = world.getComponent<UnitComponent>(targetId, 'unit');
  if (!combat || !target || combat.currentHp >= combat.maxHp) {
    clearUnitCommand(id);
    return;
  }

  const targetPosition = world.getComponent<Position>(targetId, 'position');
  if (!targetPosition) {
    clearUnitCommand(id);
    return;
  }
  const plan = findUnitRangePlan(id, targetPosition, 1, world);
  if (!plan) {
    clearUnitCommand(id);
    return;
  }
  if (!isUnitAtTarget(id, plan.destination, world)) {
    moveUnitOneSubgridStep(id, plan.nextStep, world);
    return;
  }

  const rate = unitRepairRatePerTick(target.unitType as TrainableUnitType, combat.maxHp);
  const deltaHp = Math.min(rate, combat.maxHp - combat.currentHp);
  // Continuous charging (v0.3.122): pay per restored tick; broke = stall.
  const repairer = world.getComponent<UnitComponent>(id, 'unit');
  const stockpile = repairer
    ? accessor.get(playerResourcesCodec).get(repairer.owner)
    : undefined;
  const paid = stockpile !== undefined && chargeRepairTick({
    accrualByTarget: accessor.get(repairAccrualCodec),
    targetId,
    costPerFullRepair: unitRepairCost(
      target.unitType as TrainableUnitType,
      combat.maxHp,
      combat.maxHp,
    ),
    maxHp: combat.maxHp,
    deltaHp,
    stockpile,
  });
  if (!paid) return;
  accessor.markDirty(playerResourcesCodec);
  accessor.markDirty(repairAccrualCodec);
  combat.currentHp = Math.min(combat.maxHp, combat.currentHp + deltaHp);
  accessor.markDirty(combatStatesCodec);
  if (combat.currentHp >= combat.maxHp) {
    clearRepairAccrual(accessor.get(repairAccrualCodec), targetId);
    clearUnitCommand(id);
  }
}
