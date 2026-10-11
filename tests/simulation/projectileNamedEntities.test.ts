// Every entity a shot names, it acts on only while that entity is the one it
// named at launch (spec §10.4; defect register, "A stone aimed at a deleted
// House hit the foundation that took its id", 2026-10-11).
//
// THE CLASS: a shot names two entities by id, its target and its shooter, and
// acts on each when it lands. The target is a building (it takes the shot's
// building damage), a unit or an animal (each takes a hit if it stands where
// the shot lands). The shooter is spared its own blast, and an animal the shot
// hurts turns on it. civ-engine hands a freed id to the next entity it creates,
// so each of these is replaced here, while the shot is in the air, by a new
// entity that takes the dead one's id and stands where the dead one stood. A
// replaced target must take nothing; a unit that replaced the shooter must be
// treated as a stranger, caught by the blast and never turned on.
//
// Each case has two controls with nothing replaced, which show the harness
// sees the effect: one on fresh ids (generation 0) and one with the shooter
// and the target on recycled ids (generation 1), as most entities stand once a
// match is under way. The second is what a shot that stored a wrong generation
// would fail: on fresh ids a stored generation of 0 is right by accident.
//
// The world is civ-engine's own, so the id reuse is the engine's, not a stub's:
// every replacement asserts that it took the id. The player-visible case,
// through real commands, is `projectileTargetIdentity.test.ts`.
//
// BOUND: one shot per case, each resolved by `resolveDueProjectiles` alone,
// with no technology. What the projectile system around it does (when it runs,
// what it marks dirty) is unchanged by this rule and covered by the flight
// tests. A shot from a save or recording made before shots carried
// generations is `projectileGenerationSave.test.ts`, apart from the shooter's
// owner check, which is the last case here.

import { World, type Position } from 'civ-engine';
import { describe, expect, it } from 'vitest';

import { launchProjectile, resolveDueProjectiles } from '../../src/game/simulation/bridge/projectileOps';
import { createEmptyProjectileSlot, type ProjectileState } from '../../src/game/simulation/bridge/projectileTypes';
import type { GameCommands, GameComponents, GameEvents, GameWorld } from '../../src/game/simulation/bridge/pureHelpers';
import { registerComponentTypes } from '../../src/game/simulation/bridge/scenarioSeedOps';
import type { CombatState, WildlifeState } from '../../src/game/simulation/bridge/systems/systemTypes';
import type { BuildingType, UnitComponent, UnitType } from '../../src/game/simulation/types';

const MAP = { width: 40, height: 40 };

function combat(hp: number): CombatState {
  return { currentHp: hp, maxHp: hp, attackDamage: 0, attackRange: 0, reloadTicks: 20, cooldownTicks: 0, armor: 0, pierceArmorBonus: 0 };
}

/** A small battlefield on a real civ-engine world, with the side maps a shot
 *  reads when it lands. */
class Field {
  readonly world: GameWorld = new World<GameEvents, GameCommands, GameComponents>({ gridWidth: MAP.width, gridHeight: MAP.height, tps: 10 });
  readonly combat = new Map<number, CombatState>();
  readonly animals = new Map<number, WildlifeState>();
  readonly buildingDamage: Array<{ id: number; damage: number }> = [];
  readonly blows: Array<{ attackerId: number; targetId: number }> = [];
  readonly slot = createEmptyProjectileSlot();

  constructor() {
    registerComponentTypes(this.world);
  }

  private create(at: Position, add: (id: number) => void): number {
    return this.world.runMaintenance(() => {
      const id = this.world.createEntity();
      this.world.setPosition(id, { x: at.x, y: at.y });
      add(id);
      return id;
    });
  }

  unit(owner: number, unitType: UnitType, at: Position): number {
    const id = this.create(at, (created) => this.world.addComponent(created, 'unit', { owner, unitType }));
    this.combat.set(id, combat(100));
    return id;
  }

  building(owner: number, buildingType: BuildingType, at: Position): number {
    return this.create(at, (created) => this.world.addComponent(created, 'building', { owner, buildingType }));
  }

  boar(at: Position): number {
    const id = this.create(at, (created) => this.world.addComponent(created, 'resource', {
      resourceType: 'boar', amount: 340, maxAmount: 340, owner: null, baseOwner: null,
    }));
    this.animals.set(id, { ...combat(75), autoAggro: false, isAlive: true, corpsePersists: true, aggroRange: 0, targetEntityRef: null });
    return id;
  }

  destroy(id: number): void {
    this.world.runMaintenance(() => this.world.destroyEntity(id));
    this.combat.delete(id);
    this.animals.delete(id);
  }

  /** `make` builds the replacement; it must take `id`, as civ-engine's next
   *  entity does. */
  replace(id: number, make: () => number): number {
    this.destroy(id);
    const replacement = make();
    expect(replacement, 'the premise: the new entity took the dead one\'s id').toBe(id);
    return replacement;
  }

  /** `make` builds an entity on an id a destroyed entity freed, so at a
   *  generation above 0. */
  onRecycledId(make: () => number): number {
    this.world.runMaintenance(() => this.world.destroyEntity(this.world.createEntity()));
    const id = make();
    expect(this.world.getEntityRef(id)!.generation, 'the premise: the entity stands on a recycled id').toBeGreaterThan(0);
    return id;
  }

  shoot(
    shooter: { id: number; owner: number; unitType: UnitType; at: Position },
    target: { id: number; kind: ProjectileState['targetKind']; at: Position },
  ): ProjectileState {
    return launchProjectile({
      world: this.world,
      slot: this.slot,
      tick: 0,
      attacker: {
        id: shooter.id, owner: shooter.owner, unitType: shooter.unitType, position: shooter.at,
        baseDamage: 10, ...(target.kind === 'building' ? { buildingDamage: 20 } : {}),
      },
      target: { id: target.id, kind: target.kind, position: target.at, destination: null },
      leads: false,
      accuracy: 1,
      mapSize: MAP,
    });
  }

  land(shot: ProjectileState): void {
    resolveDueProjectiles({
      world: this.world,
      slot: this.slot,
      tick: shot.impactTick,
      combatStates: this.combat,
      technologiesFor: () => new Set(),
      damageBuilding: (id, damage) => {
        this.buildingDamage.push({ id, damage });
        return false;
      },
      destroyUnit: (id) => this.destroy(id),
      addKill: () => {},
      markCombatDirty: () => {},
      markRender: () => {},
      teams: new Map(),
      animals: { states: this.animals, kill: () => {}, markDirty: () => {} },
      recordPlayerHit: (attackerId, _owner, targetId) => this.blows.push({ attackerId, targetId }),
    });
    expect(this.slot.inFlight.some((s) => s.id === shot.id), 'the shot did not land').toBe(false);
  }

  hp(id: number): number | undefined {
    return this.combat.get(id)?.currentHp ?? this.animals.get(id)?.currentHp;
  }
}

/** How the case is set up: the shooter and the target on fresh ids, both on
 *  recycled ids, or the target (or the shooter) replaced while the shot is in
 *  the air. */
type Mode = 'fresh' | 'recycled' | 'replaced';
const MODES: readonly Mode[] = ['fresh', 'recycled', 'replaced'];

function born(field: Field, mode: Mode, make: () => number): number {
  return mode === 'recycled' ? field.onRecycledId(make) : make();
}

const ARCHER_AT: Position = { x: 5, y: 5 };
const TARGET_AT: Position = { x: 10, y: 5 };

describe('a shot carries the generation of each entity it names', () => {
  it('records its shooter\'s and its target\'s generation at launch, on recycled ids', () => {
    const field = new Field();
    const archer = field.onRecycledId(() => field.unit(1, 'archer', ARCHER_AT));
    const target = field.onRecycledId(() => field.unit(2, 'villager', TARGET_AT));
    const shot = field.shoot({ id: archer, owner: 1, unitType: 'archer', at: ARCHER_AT }, { id: target, kind: 'unit', at: TARGET_AT });
    expect(shot.attackerGeneration).toBe(field.world.getEntityRef(archer)!.generation);
    expect(shot.targetGeneration).toBe(field.world.getEntityRef(target)!.generation);
  });
});

describe('a shot\'s target is acted on only while it is the entity the shot was aimed at', () => {
  const control = (mode: Mode) => (mode === 'fresh' ? 'control' : 'control on recycled ids');

  for (const mode of MODES) {
    const label = mode === 'replaced'
      ? 'a building that took a destroyed building\'s id takes nothing'
      : `${control(mode)}: the building it was aimed at takes the hit`;
    it(label, () => {
      const field = new Field();
      const archer = born(field, mode, () => field.unit(1, 'archer', ARCHER_AT));
      let house = born(field, mode, () => field.building(2, 'house', TARGET_AT));
      const shot = field.shoot({ id: archer, owner: 1, unitType: 'archer', at: ARCHER_AT }, { id: house, kind: 'building', at: TARGET_AT });
      if (mode === 'replaced') house = field.replace(house, () => field.building(1, 'house', TARGET_AT));
      field.land(shot);
      expect(field.buildingDamage).toEqual(mode === 'replaced' ? [] : [{ id: house, damage: 20 }]);
      expect(field.blows).toEqual(mode === 'replaced' ? [] : [{ attackerId: archer, targetId: house }]);
    });
  }

  for (const mode of MODES) {
    const label = mode === 'replaced'
      ? 'a unit that took a dead unit\'s id, standing where the shot lands, takes nothing'
      : `${control(mode)}: the unit it was aimed at takes the hit`;
    it(label, () => {
      const field = new Field();
      const archer = born(field, mode, () => field.unit(1, 'archer', ARCHER_AT));
      let villager = born(field, mode, () => field.unit(2, 'villager', TARGET_AT));
      const shot = field.shoot({ id: archer, owner: 1, unitType: 'archer', at: ARCHER_AT }, { id: villager, kind: 'unit', at: TARGET_AT });
      expect(shot.willHit, 'the premise: the shot is on target').toBe(true);
      if (mode === 'replaced') villager = field.replace(villager, () => field.unit(1, 'villager', TARGET_AT));
      field.land(shot);
      if (mode === 'replaced') {
        expect(field.hp(villager), 'the shot hit the unit that took its dead target\'s id').toBe(100);
        expect(field.blows).toEqual([]);
      } else {
        expect(field.hp(villager), 'the shot missed the unit it was aimed at').toBeLessThan(100);
        expect(field.blows).toEqual([{ attackerId: archer, targetId: villager }]);
      }
    });
  }

  for (const mode of MODES) {
    const label = mode === 'replaced'
      ? 'an animal that took a dead animal\'s id, standing where the shot lands, takes nothing'
      : `${control(mode)}: the animal it was aimed at takes the hit and turns on the shooter`;
    it(label, () => {
      const field = new Field();
      const archer = born(field, mode, () => field.unit(1, 'archer', ARCHER_AT));
      let boar = born(field, mode, () => field.boar(TARGET_AT));
      const shot = field.shoot({ id: archer, owner: 1, unitType: 'archer', at: ARCHER_AT }, { id: boar, kind: 'wildlife', at: TARGET_AT });
      if (mode === 'replaced') boar = field.replace(boar, () => field.boar(TARGET_AT));
      field.land(shot);
      if (mode === 'replaced') {
        expect(field.hp(boar), 'the shot hit the animal that took its dead target\'s id').toBe(75);
        expect(field.animals.get(boar)!.targetEntityRef).toBeNull();
      } else {
        expect(field.hp(boar), 'the shot missed the animal it was aimed at').toBe(65);
        expect(field.animals.get(boar)!.targetEntityRef).toEqual(field.world.getEntityRef(archer));
      }
    });
  }
});

describe('a shot\'s shooter is acted on only while it is the unit that loosed the shot', () => {
  const MANGONEL_AT: Position = { x: 5, y: 20 };
  const GROUND: Position = { x: 10, y: 20 };

  for (const mode of MODES) {
    const label = mode === 'replaced'
      ? 'a unit that took a dead Mangonel\'s id is caught by the Mangonel\'s blast'
      : `${mode === 'fresh' ? 'control' : 'control on a recycled id'}: the Mangonel itself, standing in its own blast, is spared`;
    it(label, () => {
      const field = new Field();
      const mangonel = born(field, mode, () => field.unit(1, 'mangonel', MANGONEL_AT));
      // A stone at the ground, as attack-ground looses one: the blast is the attack.
      const shot = field.shoot({ id: mangonel, owner: 1, unitType: 'mangonel', at: MANGONEL_AT }, { id: -1, kind: 'unit', at: GROUND });
      expect(shot.isArea, 'the premise: a Mangonel\'s stone blasts').toBe(true);
      let standing: number;
      if (mode === 'replaced') {
        standing = field.replace(mangonel, () => field.unit(2, 'villager', GROUND));
      } else {
        field.world.runMaintenance(() => field.world.setPosition(mangonel, { x: GROUND.x, y: GROUND.y }));
        standing = mangonel;
      }
      field.land(shot);
      if (mode === 'replaced') {
        expect(field.hp(standing), 'the blast spared the unit that took its dead shooter\'s id').toBeLessThan(100);
        // The blow is recorded in the shot's name, as a direct hit's is.
        expect(field.blows).toEqual([{ attackerId: mangonel, targetId: standing }]);
      } else {
        expect(field.hp(standing), 'the Mangonel\'s blast caught the Mangonel').toBe(100);
        expect(field.blows).toEqual([]);
      }
    });
  }

  for (const mode of MODES) {
    const label = mode === 'replaced'
      ? 'an animal the shot hurts does not turn on a unit of the shooter\'s owner that took the dead shooter\'s id'
      : `${mode === 'fresh' ? 'control' : 'control on a recycled id'}: an animal the shot hurts turns on the shooter`;
    it(label, () => {
      const field = new Field();
      let archer = born(field, mode, () => field.unit(1, 'archer', ARCHER_AT));
      const boar = field.boar(TARGET_AT);
      const shot = field.shoot({ id: archer, owner: 1, unitType: 'archer', at: ARCHER_AT }, { id: boar, kind: 'wildlife', at: TARGET_AT });
      if (mode === 'replaced') archer = field.replace(archer, () => field.unit(1, 'villager', { x: 30, y: 30 }));
      field.land(shot);
      expect(field.hp(boar), 'the premise: the shot hit the animal').toBe(65);
      expect(field.animals.get(boar)!.targetEntityRef).toEqual(mode === 'replaced' ? null : field.world.getEntityRef(archer));
    });
  }

  for (const saved of ['now', 'before shots carried generations'] as const) {
    const label = saved === 'now'
      ? 'an animal the shot hurts turns on its shooter after a Monk converted the shooter in the shot\'s flight'
      : 'BOUND: a shot from before shots carried generations tells its shooter by owner, so an animal it hurts does not turn on a converted shooter';
    it(label, () => {
      const field = new Field();
      const archer = field.unit(1, 'archer', ARCHER_AT);
      const boar = field.boar(TARGET_AT);
      const shot = field.shoot({ id: archer, owner: 1, unitType: 'archer', at: ARCHER_AT }, { id: boar, kind: 'wildlife', at: TARGET_AT });
      if (saved !== 'now') {
        const old: Record<string, unknown> = { ...shot };
        delete old.attackerGeneration;
        delete old.targetGeneration;
        field.slot.inFlight = [old as unknown as ProjectileState];
      }
      // A conversion keeps the entity and changes its owner in place, as
      // `flipConvertedUnit` does.
      field.world.getComponent<UnitComponent>(archer, 'unit')!.owner = 2;
      field.land(shot);
      expect(field.hp(boar), 'the premise: the shot hit the animal').toBe(65);
      expect(field.animals.get(boar)!.targetEntityRef).toEqual(saved === 'now' ? field.world.getEntityRef(archer) : null);
    });
  }
});
