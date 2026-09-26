// A blow on an animal (spec §5.6, §10.7). A wolf or a boar is a resource
// entity with a wildlife state, not a unit, so neither the unit damage path nor
// the blast's unit query reaches one. Every way an attack lands on an animal
// comes here: a melee blow (`attackDelivery.ts`), a shot that lands on it
// (`projectileOps.ts`) and a blast that catches it (`blastDamage.ts`). Until
// v0.3.238 the attack step took the damage off the animal's hit points itself,
// at once, so an archer's or a mangonel's attack on a boar flew no shot and
// blasted nothing (defect register, "A blast landed where DE's does not",
// 2026-09-26).

import type { EntityRef } from 'civ-engine';

import type { WildlifeState } from './systems/systemTypes';

export interface AnimalDamageDeps {
  /** Every animal's state by entity id (`wildlifeStatesCodec`), changed in place. */
  readonly states: Map<number, WildlifeState>;
  /** Turns a killed animal into its carcass, or removes it (`killWildlifeEntity`). */
  kill: (id: number) => void;
  /** Marks the wildlife slot changed, so the blow survives a save. */
  markDirty: () => void;
}

/**
 * Deals `damage` to a living animal and kills it at 0 hit points. It turns on
 * `attackerRef`, as a boar or a wolf does in AoE2 when something hurts it; a
 * shot whose shooter is gone leaves its target as it was. Animals carry no
 * armour here, so a blow deals the attacker's attack whole. Returns true when
 * the animal died.
 */
export function damageAnimal(
  deps: AnimalDamageDeps,
  id: number,
  damage: number,
  attackerRef: EntityRef | null,
): boolean {
  const animal = deps.states.get(id);
  if (!animal?.isAlive) return false;
  animal.currentHp -= damage;
  if (attackerRef !== null) animal.targetEntityRef = attackerRef;
  deps.markDirty();
  if (animal.currentHp > 0) return false;
  deps.kill(id);
  return true;
}
