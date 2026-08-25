// Attack-ground execution (spec §10.7, v0.3.117): walk into range of the
// ORDERED CELL, then bombard it on the ordinary reload — the shot flies with
// a dead target id, so the impact resolves as pure blast at the aim point
// (the resolver's `isArea` path). The order never self-clears: ground cannot
// die, so the bombardment stands until the player says otherwise, exactly
// AoE2's behaviour.

import type { Position } from 'civ-engine';

import type { UnitComponent } from '../../types';
import { unitMinAttackRange } from '../../prototypeUnitRules';
import type { BridgeStateAccessor } from '../bridgeStateAccessor';
import { combatStatesCodec, projectilesCodec } from '../bridgeStateSerialize';
import { launchProjectile } from '../projectileOps';
import type { GameWorld } from '../pureHelpers';
import type { UnitCommand } from '../sharedTypes';
import type { UnitMovementPlan } from '../movementTypes';

function manhattanDistance(a: Position, b: Position): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

export function runAttackGroundStep(deps: {
  world: GameWorld;
  accessor: BridgeStateAccessor;
  id: number;
  unit: UnitComponent;
  position: Position;
  command: UnitCommand;
  findUnitRangePlan: (
    unitId: number,
    targetPosition: Position,
    range: number,
    activeWorld: GameWorld,
  ) => UnitMovementPlan | null;
  moveUnitOneSubgridStep: (id: number, target: Position, activeWorld?: GameWorld) => void;
  clearUnitCommand: (id: number) => void;
  markRender: () => void;
}): void {
  const {
    world, accessor, id, unit, position, command,
    findUnitRangePlan, moveUnitOneSubgridStep, clearUnitCommand, markRender,
  } = deps;

  const combat = accessor.get(combatStatesCodec).get(id);
  if (!combat || !command.target) {
    clearUnitCommand(id);
    return;
  }
  const cell = command.target;

  if (manhattanDistance(position, cell) > combat.attackRange) {
    const plan = findUnitRangePlan(id, cell, combat.attackRange, world);
    if (!plan) {
      clearUnitCommand(id);
      return;
    }
    moveUnitOneSubgridStep(id, plan.nextStep, world);
    return;
  }
  if (manhattanDistance(position, cell) < unitMinAttackRange(unit.unitType)) {
    // Too close to lob — hold, as at a too-close entity target.
    return;
  }
  if (combat.cooldownTicks > 0) return;

  // A dead target id makes the direct-hit branch a no-op; the area blast at
  // the aim point is the entire attack. Friendly fire included, as always.
  launchProjectile({
    slot: accessor.get(projectilesCodec),
    tick: world.tick,
    attacker: {
      id,
      owner: unit.owner,
      unitType: unit.unitType,
      position,
      baseDamage: combat.attackDamage,
    },
    target: { id: -1, kind: 'unit', position: { x: cell.x, y: cell.y } },
    leads: false,
    mapSize: { width: world.grid.width, height: world.grid.height },
  });
  combat.cooldownTicks = combat.reloadTicks;
  accessor.markDirty(combatStatesCodec);
  accessor.markDirty(projectilesCodec);
  markRender();
}
