// Every unit with a blast radius blasts wherever its attack lands (defect
// register, "The Siege Onager fired direct hits with no splash", 2026-09-24).
//
// THE DEFECT: the Siege Onager fired direct hits with no splash. Its shot was
// not an area shot, because `isAreaProjectile` read a hand list of its own
// that named the Mangonel and the Onager and not the Siege Onager, so the 1.5
// radius that is the Imperial upgrade's whole identity was reached only by a
// pure function in a unit test. And an attack-ground order was accepted from
// any unit with a radius: a Siege Onager's ground shot landed and hurt
// nobody, and a Demolition Ship, which DE does not let attack the ground,
// lobbed shots that did nothing and was never spent.
//
// THE CLASS: a unit's blast radius and the path its attack takes in live play
// disagreeing. So the census reads its roster from the blast table, not from a
// list, and plays each unit on its own fixture (`fixtures/blastCensus.ts`). It
// gives the attack orders a player can give, at a unit, at a building, at the
// ground and, on land, at an animal. On the tick the attack lands it takes the
// landing point from the attack itself: from the shot, which must land on the
// very cell it was aimed at, or on the building for a shot at one; and for a
// detonation, which fires no shot, from the cell the detonating unit stood on.
// Every unit within the table's radius of the landing point must be hurt and
// every other one spared, save the attacker's own side for a blast DE says
// spares it, and the witness the fixture stands on the farthest cell inside
// the radius must be among the hurt, so a blast that reached nobody cannot
// pass. The ground order and the friendly fire are judged against DE's own
// rosters below, not against the code: a blast unit DE lets attack the ground
// must blast there, and every other unit, blast or not, is refused.
//
// Where DE lands each attack (defect register, "A blast landed where DE's does
// not", 2026-09-26, and spec §10.7) is the layout's business: a change to it
// moves the witnesses in `fixtures/blastCensusLayout.ts`, and this file's
// checks stay as they are.
//
// BOUNDS, so a green run is not read for more than it holds:
//  - One shot or one detonation per case, on the tick it lands, with no
//    technology and no civilization bonus. What happens after it is not read.
//  - The orders a player gives. Auto-attack, attack-move and patrol deliver
//    through the same two functions as an ordered attack
//    (`deliverUnitAttackOnUnit`, `deliverUnitAttackOnBuilding`), and a unit
//    turning on an animal that bit it through the same step as an order at
//    one, but no case drives them. A ship is not ordered at an animal: the sea
//    fixture has none.
//  - A shot at a building lands on its centre. The land fixture's building is
//    a one-cell Outpost, whose centre is its own cell, so this census holds a
//    larger building's centre only through the footprint check;
//    `buildingShotLanding.test.ts` holds it on every footprint size.
//  - Where a Demolition Ship's charge at the Dock goes off: its four witnesses
//    would give the same verdict for a blast on the Dock's centre, (22, 19),
//    as on the ship's cell. The Heavy Demolition Ship's witnesses and both
//    ships' charges at a unit tell the two apart.
//  - A still field: the fixture's units must not move before the attack lands,
//    because each is judged at the cell it began on. The census checks this.
//  - Blast on units and animals only. The blast does not damage buildings here
//    at all, and no case asks it to.
import type { EntityRef, Position } from 'civ-engine';
import { describe, expect, it } from 'vitest';

import { getBuildingFootprint } from '../../src/game/content/buildingFootprints';
import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import {
  BLAST_CENSUS_ALLY_OWNER,
  BLAST_CENSUS_ATTACKER,
  blastCensusFriendCell,
  blastCensusImpactCell,
  blastCensusImpacts,
  blastCensusSeed,
  blastCensusWitnessCell,
  blastCensusWitnessOffset,
  type BlastCensusImpact,
} from '../../src/game/simulation/fixtures/blastCensusLayout';
import { unitAttackGroundValidator } from '../../src/game/simulation/handlers/unit/unitAttackGroundHandler';
import { firesProjectile } from '../../src/game/simulation/projectileRules';
import { unitBlastRadius, unitTypesWithBlast } from '../../src/game/simulation/prototypeUnitRules';
import { UNIT_MAX_HP } from '../../src/game/simulation/prototypeUnitRules/statTables';
import type { UnitType } from '../../src/game/simulation/types';

type Bridge = ReturnType<typeof createSimulationBridge>;

// Age of Empires II: Definitive Edition's attack-ground roster, of the units
// this game has (ageofempires.fandom.com/wiki/Attack_ground, read
// 2026-09-24). The Demolition Ship line and the Petard are not on it. Kept
// here, apart from the validator, so the census does not check the code
// against itself.
const DE_ATTACKS_GROUND = new Set<UnitType>([
  'mangonel', 'onager', 'siege-onager',
  'bombard-cannon', 'trebuchet',
  'cannon-galleon', 'elite-cannon-galleon',
  'turtle-ship', 'elite-turtle-ship',
]);

// The units whose blast spares their own side in DE, of the units this game
// has: the demolition line, whose charge "does not harm friendly units" (the
// AoE2 wiki's Demolition Ship page) and damages "all enemy units" within its
// radius (Forgotten Empires, "Powergaming 101 – Utilizing Demolition Rafts").
// openage's reverse-engineering notes say the same of petards and demolition
// ships, and that the Onager's blast "hits all units regardless of their
// owner" (doc/reverse_engineering/game_mechanics/accuracy.md). DE's data reads
// the other way (blast level 2, "Damage nearby and allied units", with neither
// flag that spares a side), so this roster is a reversible default; spec §10.7
// has the whole argument. Kept here, apart from the code, for the same reason
// as the roster above.
const DE_BLAST_SPARES_FRIENDS = new Set<UnitType>(['demolition-ship', 'heavy-demolition-ship']);

/** Long enough for the slowest attacker to reach its farthest target. */
const MAX_TICKS = 600;

interface Tracked {
  what: string;
  id: number;
  owner: number | null;
  ref: EntityRef | null;
  hp: number;
  /** Its cell when the census began. The field must stand still until the
   *  attack lands, and the census checks that it did. */
  cell: Position;
}

function hitPoints(bridge: Bridge, id: number): number | undefined {
  for (const slot of ['aoe2.combatStates', 'aoe2.buildingHealthStates', 'aoe2.wildlifeStates']) {
    const rows = (bridge.world.getState(slot) ?? []) as Array<[number, { currentHp: number }]>;
    const row = rows.find(([rowId]) => rowId === id);
    if (row) return row[1].currentHp;
  }
  return undefined;
}

function unitAt(bridge: Bridge, owner: number, cell: Position) {
  return bridge.getEconomyState().units.find((u) => u.owner === owner && u.x === cell.x && u.y === cell.y);
}

function track(
  bridge: Bridge,
  what: string,
  entity: { id: number; owner: number | null } | undefined,
  cell: Position,
): Tracked {
  if (!entity) throw new Error(`the census fixture has no ${what} at (${cell.x}, ${cell.y})`);
  const hp = hitPoints(bridge, entity.id);
  if (hp === undefined) throw new Error(`the ${what} at (${cell.x}, ${cell.y}) has no hit points`);
  return { what, id: entity.id, owner: entity.owner, ref: bridge.world.getEntityRef(entity.id), hp, cell: { ...cell } };
}

/** Every living thing a blast can hurt, but the attacker: the units, and the
 *  animals, which are resources with hit points. */
function creatures(bridge: Bridge): Array<{ id: number; owner: number | null; kind: string; x: number; y: number }> {
  const economy = bridge.getEconomyState();
  const animals = new Set(((bridge.world.getState('aoe2.wildlifeStates') ?? []) as Array<[number, unknown]>).map(([id]) => id));
  return [
    ...economy.units.map((u) => ({ id: u.id, owner: u.owner, kind: u.unitType as string, x: u.x, y: u.y })),
    ...economy.resources.filter((r) => animals.has(r.id)).map((r) => ({ id: r.id, owner: null, kind: r.resourceType as string, x: r.x, y: r.y })),
  ];
}

/** Lost hit points, or gone from the world. */
function hurt(bridge: Bridge, tracked: Tracked): boolean {
  if (tracked.ref === null || !bridge.world.isCurrent(tracked.ref)) return true;
  return (hitPoints(bridge, tracked.id) ?? 0) < tracked.hp;
}

function describeAt(tracked: Tracked, from: Position): string {
  const distance = Math.hypot(tracked.cell.x - from.x, tracked.cell.y - from.y).toFixed(2);
  return `${tracked.what} at (${tracked.cell.x}, ${tracked.cell.y}), ${distance} cells out`;
}

function census(unitType: UnitType, impact: BlastCensusImpact): void {
  const bridge = createSimulationBridge(blastCensusSeed(unitType));
  const attacker = unitAt(bridge, 1, BLAST_CENSUS_ATTACKER);
  // An unknown seed boots the standard map rather than failing, so a census
  // fixture that is not registered shows up here, by name.
  expect(attacker?.unitType, `${blastCensusSeed(unitType)} has no ${unitType} of owner 1 at `
    + `(${BLAST_CENSUS_ATTACKER.x}, ${BLAST_CENSUS_ATTACKER.y}); is the seed registered?`).toBe(unitType);
  const at = blastCensusImpactCell(impact);
  const radius = unitBlastRadius(unitType);
  // Everything the blast could reach: every unit but the attacker, and every
  // animal.
  const units = creatures(bridge)
    .filter((u) => u.id !== attacker!.id)
    .map((u) => track(bridge, `${u.kind} #${u.id} of ${u.owner === null ? 'nobody' : `owner ${u.owner}`}`, u, { x: u.x, y: u.y }));
  const witnessAt = (cell: Position, what: string): Tracked => {
    const witness = units.find((t) => t.cell.x === cell.x && t.cell.y === cell.y);
    if (!witness) throw new Error(`the census fixture has no ${what} at (${cell.x}, ${cell.y})`);
    return witness;
  };
  const insideCell = blastCensusWitnessCell(unitType, impact, true);
  const inside = witnessAt(insideCell, 'witness inside the radius');
  // The attacker's own side, inside the radius: DE's rule decides whether the
  // blast may hurt them (DE_BLAST_SPARES_FRIENDS).
  const friends = [
    witnessAt(blastCensusFriendCell(unitType, impact, 'own'), 'witness of the attacker\'s own'),
    witnessAt(blastCensusFriendCell(unitType, impact, 'ally'), 'witness of the attacker\'s ally'),
  ];
  const friendly = (tracked: Tracked) => tracked.owner === 1 || tracked.owner === BLAST_CENSUS_ALLY_OWNER;
  const watched = [...units];

  expect(bridge.selectUnitsByIds([attacker!.id]), `the ${unitType} could not be selected`).toBe(true);
  if (impact === 'ground') {
    const accepted = bridge.issueAttackGroundCommand(at.x, at.y);
    if (!DE_ATTACKS_GROUND.has(unitType)) {
      expect(accepted, `a ${unitType} cannot attack the ground in DE, and the order was accepted`).toBe(false);
      const refusal = bridge.world.submitWithResult('unit.attackGround', { unitId: attacker!.id, target: at });
      expect(refusal.accepted).toBe(false);
      expect(refusal.message, 'the refusal names the unit it refused').toContain(unitType);
      return;
    }
    expect(accepted, `a ${unitType} can attack the ground in DE, and the order was refused`).toBe(true);
  } else {
    const economy = bridge.getEconomyState();
    const target = impact === 'unit'
      ? unitAt(bridge, 2, at)
      : impact === 'wildlife'
        ? economy.resources.find((r) => r.resourceType === 'boar' && r.x === at.x && r.y === at.y)
        : economy.buildings.find((b) => b.owner === 2 && b.x === at.x && b.y === at.y);
    if (impact === 'building') watched.push(track(bridge, 'target building', target, at));
    expect(target, `the census fixture has no ${impact} target at (${at.x}, ${at.y})`).toBeDefined();
    expect(bridge.issueContextCommandAtEntity(target!.id), `the ${unitType} was refused the attack on the ${impact}`).toBe(true);
  }

  // Step until anything watched is hurt, remembering every shot the attacker
  // has in the air and where it will land, the cell the attacker stood on, and
  // anything that leaves its cell.
  const shots = new Map<number, { x: number; y: number; impactTick: number }>();
  const moved = new Set<string>();
  let attackerCell: Position = { ...BLAST_CENSUS_ATTACKER };
  let landed = false;
  for (let step = 0; step < MAX_TICKS && !landed; step += 1) {
    bridge.step(100);
    for (const shot of bridge.getInFlightProjectiles()) {
      if (shot.attackerId === attacker!.id) shots.set(shot.id, { x: shot.aimX, y: shot.aimY, impactTick: shot.impactTick });
    }
    const cells = new Map(creatures(bridge).map((u) => [u.id, u]));
    for (const tracked of units) {
      const now = cells.get(tracked.id);
      if (now && (now.x !== tracked.cell.x || now.y !== tracked.cell.y)) {
        moved.add(`${tracked.what} from (${tracked.cell.x}, ${tracked.cell.y}) to (${now.x}, ${now.y})`);
      }
    }
    landed = watched.some((tracked) => hurt(bridge, tracked));
    // Read after the landing check: a detonation removes the attacker on the
    // tick it goes off, so the cell it last stood on is where it went off.
    const attackerNow = cells.get(attacker!.id);
    if (!landed && attackerNow) attackerCell = { x: attackerNow.x, y: attackerNow.y };
  }
  const order = impact === 'ground' ? 'on the ground' : `on the ${impact}`;
  expect(landed, `the ${unitType}'s attack ${order} hurt nothing in ${MAX_TICKS} ticks: accepted and inert`).toBe(true);
  // The engine advances its tick after the systems run, so the step that
  // landed the attack ran tick `world.tick - 1`.
  const tick = bridge.world.tick - 1;
  // The census judges everything at the cell it began on, which holds only if
  // nothing walked before the attack landed.
  expect([...moved], `the census needs a still field, and these moved before the ${unitType}'s attack landed`).toEqual([]);

  // Where it landed: the shot's own aim point, or for a detonation, which
  // fires no shot, the cell the detonating unit stood on when it went off.
  const shot = [...shots.values()].filter((s) => s.impactTick <= tick).sort((a, b) => b.impactTick - a.impactTick)[0];
  if (firesProjectile(unitType)) {
    expect(shot, `the ${unitType}'s attack ${order} landed on tick ${tick} with no shot of its own seen in the air`).toBeDefined();
  }
  const landing: Position = shot ? { x: shot.x, y: shot.y } : attackerCell;
  if (shot && impact === 'building') {
    // A shot at a building lands on the building: on its centre in DE and here
    // (spec §10.7). The census asks only that it land on the footprint, which
    // on this fixture's one-cell Outpost is the centre; a shot that drifts off
    // fails here.
    const building = bridge.getEconomyState().buildings.find((b) => b.x === at.x && b.y === at.y);
    const size = building ? getBuildingFootprint(building.buildingType) : { width: 1, height: 1 };
    const onIt = landing.x >= at.x && landing.x < at.x + size.width && landing.y >= at.y && landing.y < at.y + size.height;
    expect(onIt, `the ${unitType}'s shot ${order} landed at (${landing.x}, ${landing.y}), off the building's `
      + `${size.width}x${size.height} footprint at (${at.x}, ${at.y})`).toBe(true);
  } else if (shot) {
    // A shot at a unit or an animal that stood still, or at the ground, lands
    // on the very cell it was aimed at, in this game and in DE.
    expect(landing, `the ${unitType}'s shot ${order} landed somewhere other than the cell it was aimed at`).toEqual(at);
  }
  const within = (tracked: Tracked) => Math.hypot(tracked.cell.x - landing.x, tracked.cell.y - landing.y) <= radius;
  const sparesFriends = DE_BLAST_SPARES_FRIENDS.has(unitType);
  const reached = (tracked: Tracked) => within(tracked) && !(sparesFriends && friendly(tracked));
  const where = `landed at (${landing.x}, ${landing.y}) on tick ${tick}`;
  const moveThem = 'if the landing rule changed on purpose, move the witnesses (fixtures/blastCensusLayout.ts)';

  expect(reached(inside) && hurt(bridge, inside), `the ${unitType}'s attack ${order} ${where} and did not reach `
    + `the witness at (${insideCell.x}, ${insideCell.y}), which stands inside its ${radius} radius; ${moveThem}`).toBe(true);
  // The friendly witnesses must stand inside the radius, or the rule on them
  // is not being asked.
  expect(friends.filter((t) => !within(t)).map((t) => describeAt(t, landing)),
    `the ${unitType}'s attack ${order} ${where}, and these friendly witnesses stand outside its ${radius} radius; ${moveThem}`).toEqual([]);
  expect(units.filter((t) => reached(t) && !hurt(bridge, t)).map((t) => describeAt(t, landing)),
    `the ${unitType}'s attack ${order} ${where} and spared these, inside its ${radius} radius`).toEqual([]);
  expect(units.filter((t) => !reached(t) && hurt(bridge, t)).map((t) => describeAt(t, landing)),
    sparesFriends
      ? `the ${unitType}'s attack ${order} ${where} and hurt these, which are its own side or outside its ${radius} radius; DE's spares its own side`
      : `the ${unitType}'s attack ${order} ${where} and hurt these, outside its ${radius} radius`).toEqual([]);
}

/** The world the validator reads, holding one live unit of this type. */
function worldWithOne(unitType: UnitType): Parameters<typeof unitAttackGroundValidator>[1] {
  return {
    isAlive: () => true,
    getComponent: (_id: number, key: string) => (key === 'unit' ? { unitType, owner: 1 } : undefined),
  } as unknown as Parameters<typeof unitAttackGroundValidator>[1];
}

describe('every unit with a blast radius blasts wherever its attack lands', () => {
  it('reads its roster from the blast table', () => {
    // The floor: the five blast units the game had when the census landed. A
    // census of nothing would pass everything below.
    expect(unitTypesWithBlast()).toEqual(expect.arrayContaining([
      'mangonel', 'onager', 'siege-onager', 'demolition-ship', 'heavy-demolition-ship',
    ]));
  });

  it('refuses the ground order to every unit with no blast, which would take it and fire at nothing', () => {
    // An archer's or a trebuchet's shot at the ground has no target to hit and
    // no blast to land, so an accepted order would be the same accepted-and-
    // inert order as the Demolition Ship's. DE lets the Trebuchet, the Bombard
    // Cannon and the Cannon Galleon and Turtle Ship lines attack the ground;
    // their shots do nothing at the ground here, and §10.7 records that.
    const unitTypes = (Object.keys(UNIT_MAX_HP) as UnitType[]).filter((unitType) => unitBlastRadius(unitType) <= 0);
    expect(unitTypes.length, 'the sweep found almost no units to ask about').toBeGreaterThan(50);
    // The stub world holds what the validator reads today: a live entity and
    // its unit component. A verdict other than the expected refusal is listed
    // with its code, so a validator that starts reading something the stub
    // lacks shows up as that, not as a unit wrongly accepted.
    const notRefused = unitTypes.flatMap((unitType) => {
      const verdict = unitAttackGroundValidator({ unitId: 7, target: { x: 3, y: 4 } }, worldWithOne(unitType));
      if (verdict === true) return [`${unitType}: accepted`];
      if (verdict.code !== 'cannot_attack_ground') return [`${unitType}: ${verdict.code}`];
      return verdict.message.includes(unitType) ? [] : [`${unitType}: the refusal does not name it`];
    });
    expect(notRefused, 'units with no blast that were not refused as cannot_attack_ground').toEqual([]);
  });

  it('names the problem when a radius is too small to stand a witness inside', () => {
    // The Bombard Cannon's and the Petard's units.csv radius is 0.5, which
    // reaches no whole cell but the impact's own. The first such unit added to
    // the blast table gets a census fixture at once, and must fail by name.
    expect(() => blastCensusWitnessOffset(0.5, true)).toThrow(/reaches no whole cell but the impact's own/);
    expect(blastCensusWitnessOffset(1.5, true)).toEqual({ x: 1, y: 1 });
    expect(blastCensusWitnessOffset(1.5, false)).toEqual({ x: 2, y: 0 });
    expect(blastCensusWitnessOffset(9.5, false).x ** 2 + blastCensusWitnessOffset(9.5, false).y ** 2).toBeGreaterThan(9.5 ** 2);
  });
  for (const unitType of unitTypesWithBlast()) {
    for (const impact of blastCensusImpacts(unitType)) {
      const what = impact === 'ground' ? 'the ground' : impact === 'wildlife' ? 'a boar' : `a ${impact}`;
      it(`a ${unitType}'s attack at ${what}`, () => {
        census(unitType, impact);
      }, 60_000);
    }
  }
});
