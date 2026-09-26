// An attack on an animal flies as a shot when the attacker shoots (defect
// register, "A blast landed where DE's does not", 2026-09-26; spec §10.4 and
// §10.7).
//
// THE DEFECT: an attack on a wolf or a boar took a path of its own in the
// attack step, which took the attacker's damage off the animal's hit points on
// the tick the order reached range, with no shot and no blast, even for an
// archer or the mangonel line. In Definitive Edition a unit has one attack,
// whatever it is aimed at: its combat task takes gaia targets like any other
// (DE's data, the Combat task's owner type 5, "Gaia, neutral and enemy
// objects"), and the shot it fires is the unit's own (`ProjectileUnitID`).
//
// THE CLASS: an attack that lands somewhere other than where the attacker's
// weapon puts it. The blast census (`blastCensus.test.ts`) plays every unit
// with a blast at a boar, where the stone must land on the animal's cell and
// blast there; this file holds the arrow's half, that a shot at an animal can
// be seen in the air, rolls to hit and hurts it only when it lands, and that a
// melee blow still lands at once.
//
// BOUNDS: an Archer and a Militia, each against a boar that stands still, with
// no technology; the roll is asked of the launch alone, and a Demolition
// Ship's charge at an animal of the delivery function on a stub world. A
// wolf's own bite is `wildlifeRetaliation.test.ts`'s.
import type { EntityRef, Position } from 'civ-engine';
import { describe, expect, it } from 'vitest';

import { deliverUnitAttackOnAnimal } from '../../src/game/simulation/bridge/attackDelivery';
import { launchProjectile } from '../../src/game/simulation/bridge/projectileOps';
import { createEmptyProjectileSlot } from '../../src/game/simulation/bridge/projectileTypes';
import type { GameWorld } from '../../src/game/simulation/bridge/pureHelpers';
import type { WildlifeState } from '../../src/game/simulation/bridge/systems/systemTypes';
import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import { MAP_HEIGHT, MAP_WIDTH } from '../../src/game/simulation/mapGeneration/constants';
import {
  WILDLIFE_SHOTS_ARCHER,
  WILDLIFE_SHOTS_ARCHER_BOAR,
  WILDLIFE_SHOTS_MILITIA,
  WILDLIFE_SHOTS_MILITIA_BOAR,
} from '../../src/game/simulation/fixtures/wildlifeShots';

type Bridge = ReturnType<typeof createSimulationBridge>;

const SEED = 'wildlife-shots-fixture';
const MAX_TICKS = 300;

interface AnimalState {
  currentHp: number;
  isAlive: boolean;
  targetEntityRef: EntityRef | null;
}

/** A boar's state at `hp`, for the stub-world case. */
function boarState(hp: number): WildlifeState {
  return {
    currentHp: hp, maxHp: hp, attackDamage: 7, attackRange: 1, reloadTicks: 14, cooldownTicks: 0,
    armor: 0, pierceArmorBonus: 0, autoAggro: false, isAlive: true, corpsePersists: true, aggroRange: 3,
    targetEntityRef: null,
  };
}

function animal(bridge: Bridge, id: number): AnimalState {
  const rows = (bridge.world.getState('aoe2.wildlifeStates') ?? []) as Array<[number, AnimalState]>;
  const row = rows.find(([rowId]) => rowId === id);
  if (!row) throw new Error(`${SEED} has no animal #${id}`);
  return row[1];
}

function unitAt(bridge: Bridge, cell: Position) {
  const unit = bridge.getEconomyState().units.find((u) => u.owner === 1 && u.x === cell.x && u.y === cell.y);
  if (!unit) throw new Error(`${SEED} has no unit of owner 1 at (${cell.x}, ${cell.y})`);
  return unit;
}

function boarAt(bridge: Bridge, cell: Position) {
  const boar = bridge.getEconomyState().resources.find((r) => r.resourceType === 'boar' && r.x === cell.x && r.y === cell.y);
  if (!boar) throw new Error(`${SEED} has no boar at (${cell.x}, ${cell.y})`);
  return boar;
}

function orderAttack(bridge: Bridge, attackerId: number, targetId: number): void {
  expect(bridge.selectUnitsByIds([attackerId]), 'the attacker could not be selected').toBe(true);
  expect(bridge.issueContextCommandAtEntity(targetId), 'the attack on the boar was refused').toBe(true);
}

describe('an attack on an animal is the attacker\'s own attack', () => {
  it('an Archer\'s arrow at a boar hurts it on the tick the arrow lands, and the boar turns on the Archer', () => {
    const bridge = createSimulationBridge(SEED);
    const archer = unitAt(bridge, WILDLIFE_SHOTS_ARCHER);
    const boar = boarAt(bridge, WILDLIFE_SHOTS_ARCHER_BOAR);
    const before = animal(bridge, boar.id).currentHp;
    orderAttack(bridge, archer.id, boar.id);

    // Step until the boar is hurt, noting every arrow the Archer looses at it.
    const arrows = new Map<number, { impactTick: number; willHit: boolean }>();
    let hurtOnTick: number | null = null;
    for (let step = 0; step < MAX_TICKS && hurtOnTick === null; step += 1) {
      bridge.step(100);
      for (const shot of bridge.getInFlightProjectiles()) {
        if (shot.attackerId === archer.id && shot.targetId === boar.id) {
          arrows.set(shot.id, { impactTick: shot.impactTick, willHit: shot.willHit });
        }
      }
      // The engine advances its tick after the systems run.
      if (animal(bridge, boar.id).currentHp < before) hurtOnTick = bridge.world.tick - 1;
    }
    expect(arrows.size, 'the Archer\'s attack on the boar loosed no arrow: its damage landed with no shot').toBeGreaterThan(0);
    expect(hurtOnTick, `the boar was not hurt in ${MAX_TICKS} ticks`).not.toBeNull();
    const landing = [...arrows.values()].filter((arrow) => arrow.willHit && arrow.impactTick === hurtOnTick);
    expect(landing, `the boar was hurt on tick ${hurtOnTick}, when no arrow of the Archer's that hits landed `
      + `(arrows: ${JSON.stringify([...arrows.values()])})`).toHaveLength(1);
    // The Archer's own attack, as any direct blow on an animal deals it.
    expect(before - animal(bridge, boar.id).currentHp).toBe(archer.attackDamage);
    // And the boar knows who shot it.
    expect(animal(bridge, boar.id).targetEntityRef?.id, 'the boar did not turn on the Archer that shot it').toBe(archer.id);
  }, 30_000);

  it('an arrow at an animal rolls to hit, as one at a unit does', () => {
    // The same launch, fifty times over: the Archer's 80% accuracy (units.csv)
    // has to show as misses. Rolled at launch from the shot's identity, so this
    // is the same fifty every run.
    const slot = createEmptyProjectileSlot();
    const rolls: boolean[] = [];
    for (let tick = 0; tick < 50; tick += 1) {
      rolls.push(launchProjectile({
        slot,
        tick,
        attacker: { id: 1, owner: 1, unitType: 'archer', position: { x: 10, y: 10 }, baseDamage: 4 },
        target: { id: 2, kind: 'wildlife', position: { x: 14, y: 10 }, destination: null },
        leads: false,
        mapSize: { width: MAP_WIDTH, height: MAP_HEIGHT },
      }).willHit);
    }
    const misses = rolls.filter((hit) => !hit).length;
    expect(misses, 'none of fifty arrows at the animal missed: the Archer\'s accuracy is not rolled for it').toBeGreaterThan(0);
    expect(misses, `${misses} of fifty arrows missed, far more than 80% accuracy allows`).toBeLessThan(25);
  });

  it('a Demolition Ship\'s charge at an animal goes off as its charge at anything does', () => {
    // At the delivery function, on a stub world: a ship beside an animal on the
    // shore needs a fixture of land and sea that the census does not have. The
    // boar it rams takes the blow, the blast catches the animal 2.24 cells from
    // the ship, which turns on it, and the ship is spent.
    const states = new Map<number, WildlifeState>([[5, boarState(75)], [6, boarState(200)]]);
    const positions: Record<number, Position> = { 1: { x: 10, y: 10 }, 5: { x: 11, y: 10 }, 6: { x: 9, y: 12 } };
    const world = {
      getComponent: (id: number, key: string) => (key === 'position' ? positions[id] : undefined),
      getEntityRef: (id: number) => ({ id, generation: 0 }),
      query: () => [][Symbol.iterator](),
      grid: { width: MAP_WIDTH, height: MAP_HEIGHT },
    } as unknown as GameWorld;
    const killed: number[] = [];
    const destroyed: number[] = [];
    const died = deliverUnitAttackOnAnimal({
      world,
      combatStates: new Map(),
      projectiles: createEmptyProjectileSlot(),
      tick: 0,
      attacker: { id: 1, unitType: 'demolition-ship', owner: 1, combat: { ...boarState(50), attackDamage: 110, attackRange: 1 } },
      target: { id: 5, position: positions[5]! },
      teams: new Map(),
      animals: { states, kill: (id) => killed.push(id), markDirty: () => {} },
      destroyUnit: (id) => destroyed.push(id),
      addKill: () => {},
      markCombatDirty: () => {},
      markRender: () => {},
      recordPlayerHit: () => {},
    });
    expect(died, 'the boar it rammed did not die of 110 damage').toBe(true);
    expect(killed).toEqual([5]);
    expect(states.get(6)!.currentHp, 'the blast did not reach the animal 2.24 cells from the ship').toBe(90);
    expect(states.get(6)!.targetEntityRef?.id).toBe(1);
    expect(destroyed, 'the Demolition Ship was not spent').toEqual([1]);
  });

  it('a Militia\'s blow at a boar lands at once, with no shot', () => {
    const bridge = createSimulationBridge(SEED);
    const militia = unitAt(bridge, WILDLIFE_SHOTS_MILITIA);
    const boar = boarAt(bridge, WILDLIFE_SHOTS_MILITIA_BOAR);
    const before = animal(bridge, boar.id).currentHp;
    orderAttack(bridge, militia.id, boar.id);
    let hurt = false;
    for (let step = 0; step < MAX_TICKS && !hurt; step += 1) {
      bridge.step(100);
      expect(bridge.getInFlightProjectiles().filter((shot) => shot.attackerId === militia.id), 'a Militia loosed a shot').toEqual([]);
      hurt = animal(bridge, boar.id).currentHp < before;
    }
    expect(hurt, `the Militia's blow never landed on the boar in ${MAX_TICKS} ticks`).toBe(true);
    expect(before - animal(bridge, boar.id).currentHp).toBe(militia.attackDamage);
  }, 30_000);
});
