// The bridge's half of the one seam every hit on a building reads (work 140):
// the building's DE armor from its type and its owner's age and researched
// set, the attacker's DE attack from its type and its owner's state, and DE's
// per-class damage between them (buildingArmor.ts, buildingAttack.ts). The
// melee delivery calls it when a blow lands and the projectile pass calls it
// when a shot lands, so neither keeps a damage rule of its own, and nothing
// here is saved: it is read again at every hit.

import { buildingArmor, type BuildingArmor } from '../buildingArmor';
import {
  attackOnBuilding,
  buildingArrowOnBuilding,
  damageOnBuilding,
  type AttackOnBuilding,
} from '../buildingAttack';
import { EMPTY_TECH_SET } from '../economyTechEffects';
import type { AttackType } from '../prototypeUnitRules';
import { teamBuildingAttackBonus } from '../teamCombatBonuses';
import type { BuildingComponent, UnitType } from '../types';
import type { BridgeStateAccessor } from './bridgeStateAccessor';
import {
  playerAgesCodec,
  playerCivilizationsCodec,
  playerTeamsCodec,
  researchedTechnologiesCodec,
} from './bridgeStateSerialize';
import type { GameWorld } from './pureHelpers';

/** What lands on a building: the attacker's type (`null` for a building's
 *  arrow), the attack stat the blow carries, and whose it is. A shot passes
 *  the damage family it was loosed with, which a direct hit keeps (spec
 *  §10.2); a blow in person takes its unit's own. */
export interface BuildingHitAttacker {
  readonly unitType: UnitType | null;
  readonly attackDamage: number;
  readonly owner: number;
  readonly family?: AttackType;
}

/** A building's armor now, under its owner's age and researched set. */
export function currentBuildingArmor(
  accessor: BridgeStateAccessor,
  building: Pick<BuildingComponent, 'buildingType' | 'owner'>,
): BuildingArmor {
  return buildingArmor(
    building.buildingType,
    accessor.get(playerAgesCodec).get(building.owner) ?? 'dark-age',
    accessor.get(researchedTechnologiesCodec).get(building.owner) ?? EMPTY_TECH_SET,
  );
}

/** The attacker's attack on a building now, under its owner's state. */
export function currentAttackOnBuilding(
  accessor: BridgeStateAccessor,
  attacker: BuildingHitAttacker,
): AttackOnBuilding {
  if (attacker.unitType === null) return buildingArrowOnBuilding(attacker.attackDamage);
  const civilizations = accessor.get(playerCivilizationsCodec);
  const attack = attackOnBuilding(attacker.unitType, attacker.attackDamage, {
    technologies: accessor.get(researchedTechnologiesCodec).get(attacker.owner) ?? EMPTY_TECH_SET,
    civilization: civilizations.get(attacker.owner),
    age: accessor.get(playerAgesCodec).get(attacker.owner) ?? 'dark-age',
    teamBonus: teamBuildingAttackBonus(accessor.get(playerTeamsCodec), civilizations, attacker.owner, attacker.unitType),
  });
  return attacker.family === undefined ? attack : { ...attack, family: attacker.family };
}

/** One hit's damage on this building, or null when no building stands there. */
export function buildingHitDamage(
  world: GameWorld,
  accessor: BridgeStateAccessor,
  attacker: BuildingHitAttacker,
  buildingId: number,
): number | null {
  const building = world.getComponent<BuildingComponent>(buildingId, 'building');
  if (!building) return null;
  return damageOnBuilding(currentAttackOnBuilding(accessor, attacker), currentBuildingArmor(accessor, building));
}
