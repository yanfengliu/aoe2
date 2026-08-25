// Owner-wide unit sweeps a completed technology triggers: replace a whole line
// with its next tier, add an armour bonus to every unit of a class, add
// Careening's pierce-only bonus to every ship, and rewrite half-trained units
// still sitting in a production queue. Split out of technologyOps.ts when the
// Dock technologies pushed it past the 500-LOC budget.
//
// Every one of them is the same shape — walk this owner's units (or queues) and
// mutate — which is why they belong together and why the switch-per-technology
// that calls them reads as decisions rather than loops.

import { bonusVisionRadius } from '../teamCombatBonuses';
import type {
  BuildingComponent,
  RenderableComponent,
  ResearchableTechnologyType,
  TrainableUnitType,
  UnitComponent,
  UnitType,
  VisionSourceComponent,
} from '../types';
import type { GameWorld } from './pureHelpers';
import type { BridgeStateAccessor } from './bridgeStateAccessor';
import type { CombatState } from './systems/systemTypes';
import { applyArmorTech } from '../armorTechBonuses';
import { CAREENING_SHIP_PIERCE_ARMOR } from '../dockTechEffects';
import { isWaterUnit } from '../unitDomain';
import { unitSize, unitTint, unitVisionRadius } from '../prototypeUnitRules';
import { playerCivilizationsCodec, playerTeamsCodec,
  combatStatesCodec,
  productionQueuesCodec,
} from './bridgeStateSerialize';

export interface TechnologyUnitSweepDeps {
  world: GameWorld;
  accessor: BridgeStateAccessor;
  createCombatState: (owner: number, unitType: UnitType) => CombatState;
  markOutOfBandRenderChange: () => void;
}

export function createTechnologyUnitSweeps(deps: TechnologyUnitSweepDeps) {
  const { world, accessor, createCombatState, markOutOfBandRenderChange } = deps;

  function upgradeOwnedUnits(owner: number, from: UnitType, to: UnitType): void {
    let didUpgrade = false;
    for (const id of world.query('unit')) {
      const unit = world.getComponent<UnitComponent>(id, 'unit');
      if (!unit || unit.owner !== owner || unit.unitType !== from) {
        continue;
      }

      const combat = accessor.get(combatStatesCodec).get(id);
      const hpRatio = combat && combat.maxHp > 0 ? combat.currentHp / combat.maxHp : 1;
      unit.unitType = to;

      const renderable = world.getComponent<RenderableComponent>(id, 'renderable');
      if (renderable) {
        renderable.tint = unitTint(to, owner);
        renderable.size = unitSize(to);
      }

      const vision = world.getComponent<VisionSourceComponent>(id, 'visionSource');
      if (vision) {
        vision.radius = unitVisionRadius(to)
          + bonusVisionRadius(
            accessor.get(playerTeamsCodec),
            accessor.get(playerCivilizationsCodec),
            owner,
            to,
            unitVisionRadius(to),
          );
      }

      const nextCombat = createCombatState(owner, to);
      if (combat) {
        nextCombat.cooldownTicks = combat.cooldownTicks;
      }
      nextCombat.currentHp = Math.max(
        1,
        Math.min(nextCombat.maxHp, Math.round(nextCombat.maxHp * hpRatio)),
      );
      accessor.mutate(combatStatesCodec, (m) => m.set(id, nextCombat));
      didUpgrade = true;
    }
    if (didUpgrade) {
      markOutOfBandRenderChange();
    }
  }

  // Apply an armor tech's bonus to every owned unit whose class matches. Shared
  // by all nine blacksmith armor cases so the per-unit iteration lives once;
  // `applyArmorTech` routes the symmetric vs asymmetric (pierce) split.
  function applyArmorTechToOwnedUnits(
    owner: number,
    tech: ResearchableTechnologyType,
    matchesClass: (unitType: UnitType) => boolean,
  ): void {
    for (const id of world.query('unit')) {
      const unit = world.getComponent<UnitComponent>(id, 'unit');
      const combat = accessor.get(combatStatesCodec).get(id);
      if (!unit || !combat || unit.owner !== owner || !matchesClass(unit.unitType)) {
        continue;
      }
      applyArmorTech(combat, tech);
    }
  }

  // Careening (Dock, Castle) is the one armour technology with NO melee half —
  // technologies.csv says "+0/+1" — so it bumps the pierce-only accumulator
  // directly instead of going through applyArmorTech, which always adds +1
  // melee. Scope is the water domain, so every ship afloat gains it.
  function applyCareeningToOwnedShips(owner: number): void {
    for (const id of world.query('unit')) {
      const unit = world.getComponent<UnitComponent>(id, 'unit');
      const combat = accessor.get(combatStatesCodec).get(id);
      if (!unit || !combat || unit.owner !== owner || !isWaterUnit(unit.unitType)) {
        continue;
      }
      combat.pierceArmorBonus = (combat.pierceArmorBonus ?? 0) + CAREENING_SHIP_PIERCE_ARMOR;
    }
  }

  function rewriteQueuedPredecessorUnits(
    owner: number,
    from: TrainableUnitType,
    to: TrainableUnitType,
  ): void {
    const productionQueues = accessor.get(productionQueuesCodec);
    let dirty = false;
    for (const [buildingId, queue] of productionQueues.entries()) {
      const building = world.getComponent<BuildingComponent>(buildingId, 'building');
      if (!building || building.owner !== owner) {
        continue;
      }
      for (const entry of queue) {
        if (entry.kind === 'unit' && entry.unitType === from) {
          entry.unitType = to;
          entry.label = to;
          dirty = true;
        }
      }
    }
    if (dirty) {
      accessor.markDirty(productionQueuesCodec);
    }
  }

  return {
    upgradeOwnedUnits,
    applyArmorTechToOwnedUnits,
    applyCareeningToOwnedShips,
    rewriteQueuedPredecessorUnits,
  };
}
