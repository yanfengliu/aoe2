// Passive garrison healing (AoE2). Each tick every unit garrisoned inside a
// building regenerates HP toward its maxHp at a fixed deterministic rate.
// Garrisoned units keep their `combatStates` entry (currentHp/maxHp) while
// hidden — only `position`/`visionSource` are removed on garrison — so this
// system reads/mutates that entity-keyed slot directly. It iterates the
// garrison side-map (building -> unit ids) rather than a world query, since
// garrisoned units have no `position` component to query on.
//
// Determinism: the heal is a fixed fraction per tick (no Math.random /
// Date.now). Dead units (currentHp <= 0) are never revived and full units
// (currentHp >= maxHp) are never over-healed.

import type { GameWorld } from '../pureHelpers';
import type { BridgeStateAccessor } from '../bridgeStateAccessor';
import type { UnitComponent, ResearchableTechnologyType } from '../../types';
import {
  combatStatesCodec,
  garrisonedByBuildingCodec,
  researchedTechnologiesCodec,
} from '../bridgeStateSerialize';
import { garrisonHealRateMultiplier } from '../../monasteryTechEffects';

const NO_RESEARCHED_TECHS: ReadonlySet<ResearchableTechnologyType> = new Set();

// 0.4 HP/tick at 10 TPS = 4 HP/sec. A base-25-HP villager heals from near
// death in ~6s; a 40-HP (post-Loom) villager in ~10s — a gentle, meaningful
// regen that never outpaces combat but rewards retreating into a building.
export const GARRISON_HEAL_HP_PER_TICK = 0.4;

// Pure per-tick heal step for a single garrisoned unit. Returns the next
// currentHp: unchanged when dead (<= 0) or already full (>= maxHp), otherwise
// currentHp + rate clamped to maxHp.
export function garrisonHealStep(
  currentHp: number,
  maxHp: number,
  rate: number = GARRISON_HEAL_HP_PER_TICK,
): number {
  if (currentHp <= 0 || currentHp >= maxHp) {
    return currentHp;
  }
  return Math.min(maxHp, currentHp + rate);
}

export interface GarrisonHealSystemDeps {
  world: GameWorld;
  // combatStates + garrisonedByBuilding flow through world.state.aoe2.* via
  // the accessor (Phase 2D). No world query is used — the garrison side-map
  // is the only enumeration of garrisoned (position-less) unit ids.
  accessor: BridgeStateAccessor;
}

export function registerGarrisonHealSystem(deps: GarrisonHealSystemDeps): void {
  const { world, accessor } = deps;

  world.registerSystem({
    name: 'prototypeGarrisonHeal',
    phase: 'update',
    execute() {
      const garrisonedByBuilding = accessor.get(garrisonedByBuildingCodec);
      if (garrisonedByBuilding.size === 0) {
        return;
      }
      const combatStates = accessor.get(combatStatesCodec);
      const researchedTechnologies = accessor.get(researchedTechnologiesCodec);
      // Herbal Medicine multiplies an owner's garrison-heal rate ×4 (DERIVED).
      // Cache the rate per owner so a full garrison isn't re-derived per unit;
      // owners without the tech keep the base rate (byte-identical).
      const rateByOwner = new Map<number, number>();
      let healedAny = false;
      for (const unitIds of garrisonedByBuilding.values()) {
        for (const unitId of unitIds) {
          const combat = combatStates.get(unitId);
          if (!combat) {
            continue;
          }
          const owner = world.getComponent<UnitComponent>(unitId, 'unit')?.owner;
          let rate = owner === undefined ? GARRISON_HEAL_HP_PER_TICK : rateByOwner.get(owner);
          if (rate === undefined && owner !== undefined) {
            rate = GARRISON_HEAL_HP_PER_TICK
              * garrisonHealRateMultiplier(researchedTechnologies.get(owner) ?? NO_RESEARCHED_TECHS);
            rateByOwner.set(owner, rate);
          }
          const next = garrisonHealStep(combat.currentHp, combat.maxHp, rate);
          if (next !== combat.currentHp) {
            combat.currentHp = next;
            healedAny = true;
          }
        }
      }
      if (healedAny) {
        accessor.markDirty(combatStatesCodec);
      }
    },
  });
}
