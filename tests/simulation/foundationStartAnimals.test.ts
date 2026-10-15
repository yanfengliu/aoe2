// What the start check does with what stands on a foundation's ground, kind by
// kind (work 126; spec §8.1, §12.1).
//
// The AoE wiki's "Building (Age of Empires II)" (sentence added 2024-01-16):
// "If there are Gaia animals or units of the player present at the location of
// a building foundation, they will move away automatically once the Villager
// reach the foundation". So a LIVING animal on the site, a sheep, a deer or a
// boar or wolf still alive, Gaia's, the owner's or an ally's, is moved off when
// the first builder starts, as the owner's and allies' units are, and does not
// cancel the start (the coordinator's decision of 2026-10-14). An enemy's sheep
// is an enemy's, as DE counts a sheep a unit of its owner's, and holds the start
// like an enemy's unit (the same wiki paragraph: "Buildings can be constructed
// if there is no enemy building or unit present at the location of building
// foundation"). An enemy's villager building a site of its own seat's from a
// cell beside it does not hold it: it is moved off like the owner's units, or
// two seats' builders standing on each other's sites would each wait forever
// (review round 0); one only passing through on its way to a site elsewhere
// holds it like any enemy's unit (review round 1). A carcass is a lifeless
// resource, like a tree or a mine, and cancels the start as before (update
// 46295), and so does a relic lying on the ground. A unit never cancels it, nor
// the relic a Monk carries, which stands on the Monk's cell and goes where the
// Monk goes (monkBehaviorSystem). If one of those to move has nowhere to go,
// nobody moves and the start waits: one villager that could leave through its
// owner's gate stays with a sheep that could not (review round 1).
//
// Another player's building on the ground: a site somebody has started, or a
// finished building of another player's, cancels the start, and the message
// says which; another seat's foundation nobody has started, an ally's or an
// enemy's, stands aside, so the first to start wins the ground (review round
// 0). A Farm stays walkable once started: nobody on it waits or is moved, no
// resource on it counts, and only a building cancels it.
//
// BOUND: one 2x2 House foundation, or a 1x1 Farm, of the human's on a
// hand-built 10x10 grass map, one thing on its ground per case (two in the
// all-or-none case), the real start check, footprint clearing and footprint
// rule. Owner 3 is the human's ally and
// owner 2 its enemy. Which cell the moved one lands on is checked as "outside
// the footprint and beside it"; the tie-break among equally near cells is the
// clearing's own (east, west, south, north). The carried relic's case sets the
// carry by hand: the relic following its Monk off the footprint is
// monkBehaviorSystem's, which runs after the builders' system in the same tick,
// and is not driven here (an idle Monk carrying a relic cannot be walked onto a
// site at all on this tree, the register's OPEN entry of 2026-10-14).

import { describe, expect, it } from 'vitest';

import { World, type Position } from 'civ-engine';
import { createWorldOccupancy } from '../../src/game/simulation/worldOccupancy';
import { createCellPassability } from '../../src/game/simulation/bridge/cellPassability';
import { BridgeStateAccessor } from '../../src/game/simulation/bridge/bridgeStateAccessor';
import {
  constructionStatesCodec,
  monkCarriedRelicCodec,
  playerResourcesCodec,
  playerTeamsCodec,
  unitCommandsCodec,
  wildlifeStatesCodec,
} from '../../src/game/simulation/bridge/bridgeStateSerialize';
import { createFootprintClearing } from '../../src/game/simulation/bridge/footprintClearing';
import { createFoundationStart } from '../../src/game/simulation/bridge/foundationStart';
import { createWildlifeState } from '../../src/game/simulation/prototypeUnitRules';
import type {
  GameCommands,
  GameComponents,
  GameEvents,
  GameWorld,
} from '../../src/game/simulation/bridge/pureHelpers';
import type { BuildingType, ResourceComponent } from '../../src/game/simulation/types';

const SIZE = 10;
const ANCHOR = { x: 4, y: 4 };
const ON_SITE = { x: 5, y: 5 };
/** The enemy's own House site beside the human's: ON_SITE is a cell its
 *  builder works it from, one step west of its footprint. */
const ENEMY_OWN_SITE = { x: 6, y: 4 };
/** An enemy's House site far from the human's, which a builder on ON_SITE is
 *  only walking towards. */
const ENEMY_FAR_SITE = { x: 0, y: 8 };
/** The second thing on the site, in the all-or-none case. */
const SECOND_ON_SITE = { x: 4, y: 4 };
/** The human's finished gate in the ring of water: the human's units leave the
 *  site through it, and no animal can. */
const GATE = { x: 3, y: 4 };
const HUMAN = 1;
const ENEMY = 2;
const ALLY = 3;

/** Who owns what stands on the site: null for Gaia. */
const OCCUPANTS = {
  'sheep': { kind: 'sheep', owner: null },
  'own sheep': { kind: 'sheep', owner: HUMAN },
  'ally\'s sheep': { kind: 'sheep', owner: ALLY },
  'enemy\'s sheep': { kind: 'sheep', owner: ENEMY },
  'living boar': { kind: 'living boar', owner: null },
  'dead boar': { kind: 'dead boar', owner: null },
  'tree': { kind: 'tree', owner: null },
  'own villager': { kind: 'villager', owner: HUMAN },
  'ally\'s villager': { kind: 'villager', owner: ALLY },
  'enemy\'s villager': { kind: 'villager', owner: ENEMY },
  'enemy\'s villager building its own site': { kind: 'enemy builder', owner: ENEMY },
  'enemy\'s villager on its way to its own site': { kind: 'enemy passer', owner: ENEMY },
  'own Monk carrying a relic': { kind: 'monk with relic', owner: HUMAN },
  'relic lying on the ground': { kind: 'relic', owner: null },
  'enemy\'s started House': { kind: 'started house', owner: ENEMY },
  'enemy\'s finished House': { kind: 'finished house', owner: ENEMY },
  'enemy\'s unstarted House': { kind: 'unstarted house', owner: ENEMY },
  'ally\'s unstarted House': { kind: 'unstarted house', owner: ALLY },
} as const;
type Occupant = keyof typeof OCCUPANTS;

interface SiteOptions {
  /** The human's foundation: a 2x2 House at ANCHOR, or a 1x1 Farm on ON_SITE. */
  site?: 'house' | 'farm';
  /** Water on every cell around the House's footprint, so nobody can be moved off. */
  boxedIn?: boolean;
  /** The water ring, with the human's finished gate on GATE. */
  gate?: boolean;
  /** A second thing on the site, on SECOND_ON_SITE. */
  alsoOn?: Occupant;
}

function makeSite(occupant: Occupant, options: SiteOptions = {}) {
  const farm = options.site === 'farm';
  const world = new World<GameEvents, GameCommands, GameComponents>({
    gridWidth: SIZE,
    gridHeight: SIZE,
    seed: 'foundation-start-animals',
    tps: 10,
  });
  for (const component of ['terrain', 'building', 'resource', 'unit', 'position'] as const) {
    world.registerComponent(component);
  }
  const occupancy = createWorldOccupancy(SIZE, SIZE);
  occupancy.attachWorld(world);
  const ring = (x: number, y: number): boolean => x >= ANCHOR.x - 1 && x <= ANCHOR.x + 2
    && y >= ANCHOR.y - 1 && y <= ANCHOR.y + 2
    && !(x >= ANCHOR.x && x < ANCHOR.x + 2 && y >= ANCHOR.y && y < ANCHOR.y + 2);
  const tiles: number[][] = [];
  const water: Position[] = [];
  for (let y = 0; y < SIZE; y += 1) {
    const row: number[] = [];
    for (let x = 0; x < SIZE; x += 1) {
      const id = world.createEntity();
      const wet = (options.boxedIn === true || options.gate === true) && ring(x, y)
        && !(options.gate === true && x === GATE.x && y === GATE.y);
      world.addComponent(id, 'terrain', { kind: wet ? 'water' : 'grass', buildable: !wet, elevation: 0 });
      if (wet) water.push({ x, y });
      row.push(id);
    }
    tiles.push(row);
  }
  occupancy.blockTerrain(water);
  const accessor = new BridgeStateAccessor(() => world as unknown as GameWorld);
  accessor.mutate(playerTeamsCodec, (teams) => {
    teams.set(HUMAN, 1);
    teams.set(ALLY, 1);
    teams.set(ENEMY, 2);
  });
  const building = (
    buildingType: BuildingType,
    buildingOwner: number,
    anchor: Position,
    size: number,
    state: 'unstarted' | 'started' | 'finished',
  ): number => {
    const id = world.createEntity();
    world.addComponent(id, 'building', { buildingType, owner: buildingOwner });
    world.addComponent(id, 'position', { ...anchor });
    const claim = buildingType === 'farm' ? 'farm' : state === 'unstarted' ? 'foundation' : 'building';
    occupancy.syncBuilding(id, anchor, { width: size, height: size }, claim);
    accessor.mutate(constructionStatesCodec, (states) => {
      states.set(id, {
        isComplete: state === 'finished',
        buildProgressTicks: state === 'unstarted' ? 0 : state === 'started' ? 40 : 250,
        totalBuildTicks: 250,
        populationProvided: 5,
        width: size,
        height: size,
      });
    });
    return id;
  };
  const site = farm ? building('farm', HUMAN, ON_SITE, 1, 'unstarted') : building('house', HUMAN, ANCHOR, 2, 'unstarted');
  if (options.gate === true) building('palisade-gate', HUMAN, GATE, 1, 'finished');
  accessor.mutate(playerResourcesCodec, (stockpiles) => {
    stockpiles.set(HUMAN, { food: 0, wood: 0, gold: 0, stone: 0 });
  });

  const place = (what: Occupant, cell: Position): number => {
    const { kind, owner } = OCCUPANTS[what];
    if (kind === 'started house' || kind === 'finished house' || kind === 'unstarted house') {
      return building('house', owner!, cell, 2, kind === 'unstarted house' ? 'unstarted' : kind === 'started house' ? 'started' : 'finished');
    }
    const thing = world.createEntity();
    world.addComponent(thing, 'position', { ...cell });
    if (kind === 'villager' || kind === 'monk with relic' || kind === 'enemy builder' || kind === 'enemy passer') {
      world.addComponent(thing, 'unit', { unitType: kind === 'monk with relic' ? 'monk' : 'villager', owner: owner! });
      occupancy.syncUnit(thing, cell);
      if (kind === 'monk with relic') {
        // A carried relic stands on its Monk's cell (monkBehaviorSystem).
        const relic = world.createEntity();
        world.addComponent(relic, 'position', { ...cell });
        world.addComponent(relic, 'resource', {
          resourceType: 'relic', amount: 0, maxAmount: 0, owner: null, baseOwner: null,
        });
        occupancy.syncResource(relic, cell);
        accessor.mutate(monkCarriedRelicCodec, (carried) => carried.set(thing, relic));
      }
      if (kind === 'enemy builder' || kind === 'enemy passer') {
        // Its order is a House site of the enemy's own: beside the human's, the
        // builder working it from the human's ground; or far off, the builder
        // only crossing the human's ground on its way.
        const target = kind === 'enemy builder' ? ENEMY_OWN_SITE : ENEMY_FAR_SITE;
        const own = building('house', ENEMY, target, 2, 'unstarted');
        accessor.mutate(unitCommandsCodec, (commands) => commands.set(thing, {
          type: 'build', target: { ...target }, buildingRef: world.getEntityRef(own)!,
        }));
      }
      return thing;
    }
    const resourceType: ResourceComponent['resourceType'] = kind === 'sheep' ? 'sheep'
      : kind === 'tree' ? 'tree' : kind === 'relic' ? 'relic' : 'boar';
    world.addComponent(thing, 'resource', {
      resourceType, amount: 100, maxAmount: 100, owner, baseOwner: owner,
    });
    if (resourceType === 'boar') {
      accessor.mutate(wildlifeStatesCodec, (states) => {
        states.set(thing, { ...createWildlifeState('boar'), isAlive: kind === 'living boar' });
      });
    }
    occupancy.syncResource(thing, cell);
    return thing;
  };
  const thing = place(occupant, ON_SITE);
  const second = options.alsoOn === undefined ? undefined : place(options.alsoOn, SECOND_ON_SITE);

  const passability = createCellPassability({
    world: world as unknown as GameWorld,
    humanPlayerId: HUMAN,
    mapWidth: SIZE,
    mapHeight: SIZE,
    worldOccupancy: occupancy,
    tiles,
    accessor,
  });
  const messages: string[] = [];
  const destroyed: number[] = [];
  const start = createFoundationStart({
    world: world as unknown as GameWorld,
    accessor,
    humanPlayerId: HUMAN,
    isPlacementBlocked: passability.isPlacementBlocked,
    describePlacementBlockers: passability.describePlacementBlockers,
    getCellStatus: (x, y) => occupancy.getCellStatus(x, y),
    isCellSeen: () => true,
    isEntityDrawn: () => true,
    clearing: createFootprintClearing({
      world: world as unknown as GameWorld,
      accessor,
      mapWidth: SIZE,
      mapHeight: SIZE,
      getCellStatus: (x, y) => occupancy.getCellStatus(x, y),
      isCellPassableForUnit: (id, x, y) => passability.isCellPassableForUnit(id, x, y),
      isCellPassableForWildlife: (id, x, y) => passability.isCellPassableForWildlife(id, x, y),
      relocate: (id, cell) => {
        world.setPosition(id, cell);
        if (world.getComponent(id, 'unit')) occupancy.syncUnit(id, cell);
        else occupancy.syncResource(id, cell);
      },
    }),
    syncBuildingClaim: () => {},
    enqueueRejection: (message) => messages.push(message),
  });
  const verdict = start.tryBegin(site, (id) => destroyed.push(id));
  const at = world.getComponent<Position>(thing, 'position');
  const secondAt = second === undefined ? undefined : world.getComponent<Position>(second, 'position');
  return {
    verdict, destroyed, site, at, secondAt, messages: messages.join(' | '), wood: accessor.get(playerResourcesCodec).get(HUMAN)?.wood,
  };
}

const onFootprint = (cell: Position | undefined): boolean => cell !== undefined
  && cell.x >= ANCHOR.x && cell.x < ANCHOR.x + 2 && cell.y >= ANCHOR.y && cell.y < ANCHOR.y + 2;
const besideFootprint = (cell: Position | undefined): boolean => cell !== undefined && !onFootprint(cell)
  && cell.x >= ANCHOR.x - 1 && cell.x <= ANCHOR.x + 2 && cell.y >= ANCHOR.y - 1 && cell.y <= ANCHOR.y + 2;

describe('what stands on a foundation when its first builder starts it (work 126)', () => {
  const moved: Occupant[] = [
    'sheep', 'own sheep', 'ally\'s sheep', 'living boar', 'own villager', 'ally\'s villager',
    'enemy\'s villager building its own site', 'own Monk carrying a relic',
  ];
  for (const occupant of moved) {
    it(`a ${occupant} is moved off beside it, and the start goes on`, () => {
      const result = makeSite(occupant);
      expect(result.verdict).toBe('begin');
      expect(result.destroyed).toEqual([]);
      expect(onFootprint(result.at), `the ${occupant} still stands on the site`).toBe(false);
      expect(besideFootprint(result.at), `the ${occupant} was moved further than beside the site`).toBe(true);
    });
  }

  for (const occupant of ['enemy\'s villager', 'enemy\'s sheep', 'enemy\'s villager on its way to its own site'] as const) {
    it(`an ${occupant} holds the start, unmoved, and nothing is cancelled`, () => {
      const result = makeSite(occupant);
      expect(result.verdict).toBe('wait');
      expect(result.destroyed).toEqual([]);
      expect(result.at).toEqual(ON_SITE);
    });
  }

  it('an own villager with nowhere to go holds the start, unmoved: all or none', () => {
    const result = makeSite('own villager', { boxedIn: true });
    expect(result.verdict).toBe('wait');
    expect(result.destroyed).toEqual([]);
    expect(result.at, 'the villager was put on water').toEqual(ON_SITE);
  });

  it('the gate\'s premise: alone, an own villager leaves through its owner\'s gate, and a sheep alone cannot', () => {
    const villager = makeSite('own villager', { gate: true });
    expect(villager.verdict).toBe('begin');
    expect(villager.at, 'the villager did not leave through the gate').toEqual(GATE);
    const sheep = makeSite('sheep', { gate: true });
    expect(sheep.verdict).toBe('wait');
    expect(sheep.at).toEqual(ON_SITE);
  });

  it('a villager that could leave stays with a sheep that cannot, and the start waits: all or none', () => {
    const result = makeSite('own villager', { gate: true, alsoOn: 'sheep' });
    expect(result.verdict).toBe('wait');
    expect(result.destroyed).toEqual([]);
    expect(result.at, 'the villager was moved off while the sheep had to stay').toEqual(ON_SITE);
    expect(result.secondAt).toEqual(SECOND_ON_SITE);
  });

  for (const occupant of ['dead boar', 'tree', 'relic lying on the ground'] as const) {
    it(`a ${occupant} cancels it and its cost comes back`, () => {
      const result = makeSite(occupant);
      expect(result.verdict).toBe('cancelled');
      expect(result.destroyed).toEqual([result.site]);
      expect(result.wood, 'the House was not refunded').toBe(25);
      expect(result.messages).toContain('Your house at (4,4) was cancelled');
      expect(result.at, `the ${occupant} was moved`).toEqual(ON_SITE);
    });
  }

  it('the message blames the fog for a tree, which was there when the House was placed', () => {
    expect(makeSite('tree').messages).toContain('a tree (resource) at (5,5), hidden under the fog of war when it was placed');
  });

  it('the message names a carcass without blaming the fog, since the animal may have died there since', () => {
    const { messages } = makeSite('dead boar');
    expect(messages).toContain('its builders found a boar (resource) at (5,5). Its cost');
    expect(messages).not.toContain('fog of war');
  });
});

describe('another player\'s building on the ground when the first builder starts (work 126)', () => {
  it('an enemy\'s started House cancels it, and the message says another player has started building there', () => {
    const result = makeSite('enemy\'s started House');
    expect(result.verdict).toBe('cancelled');
    expect(result.destroyed).toEqual([result.site]);
    expect(result.wood, 'the House was not refunded').toBe(25);
    expect(result.messages).toContain('its builders found a house (building) at (5,5), which another player has started building');
  });

  it('an enemy\'s finished House cancels it, and the message says another player has built it, not the fog', () => {
    const result = makeSite('enemy\'s finished House');
    expect(result.verdict).toBe('cancelled');
    expect(result.messages).toContain('its builders found a house (building) at (5,5), which another player has built');
    expect(result.messages).not.toContain('fog of war');
  });

  for (const occupant of ['enemy\'s unstarted House', 'ally\'s unstarted House'] as const) {
    it(`an ${occupant} stands aside, and the start goes on: the first to start wins`, () => {
      const result = makeSite(occupant);
      expect(result.verdict).toBe('begin');
      expect(result.destroyed).toEqual([]);
    });
  }
});

describe('a Farm\'s start (work 126)', () => {
  it('an enemy\'s villager on it holds nothing: a Farm stays walkable', () => {
    const result = makeSite('enemy\'s villager', { site: 'farm' });
    expect(result.verdict).toBe('begin');
    expect(result.at, 'the villager was moved off a Farm').toEqual(ON_SITE);
  });

  it('a carcass on it counts for nothing', () => {
    const result = makeSite('dead boar', { site: 'farm' });
    expect(result.verdict).toBe('begin');
    expect(result.destroyed).toEqual([]);
  });

  it('an enemy\'s started House over it cancels it', () => {
    const result = makeSite('enemy\'s started House', { site: 'farm' });
    expect(result.verdict).toBe('cancelled');
    expect(result.destroyed).toEqual([result.site]);
    expect(result.messages).toContain('Your farm at (5,5) was cancelled');
  });
});
