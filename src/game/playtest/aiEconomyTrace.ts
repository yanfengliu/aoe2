// How one seat's economy ran, read from world state alone (work 141): its
// villagers, its population against its cap, its stockpile, what its Town
// Center was doing, and its Houses, sampled tick by tick and folded into the
// numbers a DE comparison asks for — Town Center idle time by reason, housed
// stalls, the House timeline and the age timeline.
//
// It reads COMPONENTS and the flushed `aoe2.*` world-state slots, never the
// AI's own decisions, so a gate built on it measures what the AI did rather
// than what its code meant to do. One reader serves a live world (a gate) and
// a recorded snapshot from civ-engine's `snapshotAtTick` (a bundle replayed
// after the fact), because both expose the same components and slots.
//
// Bound: Houses are counted by type, so the Town Center and the default map's
// forward outpost House count toward the cap the way the game counts them, and
// "idle" means an empty production queue; a Town Center researching an age
// or Loom is busy, not idle.

import type { WorldSnapshot } from 'civ-engine';
import type { GameWorld } from '../simulation/bridge/pureHelpers';

/** What a seat's economy looked like at one tick. */
export interface AiEconomySample {
  tick: number;
  age: string;
  villagers: number;
  popCurrent: number;
  popCap: number;
  food: number;
  wood: number;
  gold: number;
  stone: number;
  /** What the seat's Town Center was doing: an empty queue is idle, a unit it
   *  cannot house is housed, a technology at the front is research. */
  townCenter: 'idle' | 'training' | 'housed' | 'researching' | 'none';
  /** Villagers in the Town Center's queue, which count toward a target. */
  villagersQueued: number;
  housesComplete: number;
  housesBuilding: number;
  /** Every House the seat owns at this tick, for the House timeline. */
  houses: ReadonlyArray<{ id: number; complete: boolean }>;
}

/** The two things the reader needs from a world: its entities and its slots. */
export interface EconomyStateSource {
  units(): Iterable<{ owner: number; unitType: string }>;
  buildings(): Iterable<{ id: number; owner: number; buildingType: string }>;
  slot(name: string): unknown;
}

export function liveWorldSource(world: GameWorld): EconomyStateSource {
  return {
    *units() {
      for (const id of world.query('unit')) {
        const unit = world.getComponent<{ owner: number; unitType: string }>(id, 'unit');
        if (unit) yield unit;
      }
    },
    *buildings() {
      for (const id of world.query('building')) {
        const building = world.getComponent<{ owner: number; buildingType: string }>(id, 'building');
        if (building) yield { id, owner: building.owner, buildingType: building.buildingType };
      }
    },
    slot: (name) => world.getState(name),
  };
}

export function snapshotSource(snapshot: WorldSnapshot): EconomyStateSource {
  const components = (snapshot as unknown as { components: Record<string, Array<[number, unknown]>> }).components;
  const state = (snapshot as unknown as { state: Record<string, unknown> }).state;
  return {
    *units() {
      for (const [, unit] of components.unit ?? []) yield unit as { owner: number; unitType: string };
    },
    *buildings() {
      for (const [id, building] of components.building ?? []) {
        const b = building as { owner: number; buildingType: string };
        yield { id, owner: b.owner, buildingType: b.buildingType };
      }
    },
    slot: (name) => state[name],
  };
}

const entries = <K, V>(value: unknown): Map<K, V> => new Map((value as Array<[K, V]> | undefined) ?? []);

export function sampleAiEconomy(source: EconomyStateSource, owner: number, tick: number): AiEconomySample {
  let villagers = 0;
  for (const unit of source.units()) {
    if (unit.owner === owner && unit.unitType === 'villager') villagers += 1;
  }
  const construction = entries<number, { isComplete: boolean }>(source.slot('aoe2.constructionStates'));
  const houses: Array<{ id: number; complete: boolean }> = [];
  for (const building of source.buildings()) {
    if (building.owner !== owner || building.buildingType !== 'house') continue;
    const site = construction.get(building.id);
    houses.push({ id: building.id, complete: !site || site.isComplete });
  }
  const population = entries<number, { current: number; cap: number }>(source.slot('aoe2.population')).get(owner);
  const stock = entries<number, { food: number; wood: number; gold: number; stone: number }>(
    source.slot('aoe2.playerResources'),
  ).get(owner);
  const townCenterId = entries<number, { id: number }>(source.slot('aoe2.townCenterRefs')).get(owner)?.id;
  const queue = townCenterId === undefined
    ? undefined
    : entries<number, Array<{ kind: string; unitType?: string; isBlocked?: boolean }>>(
      source.slot('aoe2.productionQueues'),
    ).get(townCenterId) ?? [];
  const townCenterSite = townCenterId === undefined ? undefined : construction.get(townCenterId);
  let townCenter: AiEconomySample['townCenter'] = 'none';
  if (queue !== undefined && (!townCenterSite || townCenterSite.isComplete)) {
    const front = queue[0];
    townCenter = !front ? 'idle'
      : front.kind === 'technology' ? 'researching'
      : front.isBlocked ? 'housed'
      : 'training';
  }
  return {
    tick,
    age: entries<number, string>(source.slot('aoe2.playerAges')).get(owner) ?? 'dark-age',
    villagers,
    popCurrent: population?.current ?? 0,
    popCap: population?.cap ?? 0,
    food: stock?.food ?? 0,
    wood: stock?.wood ?? 0,
    gold: stock?.gold ?? 0,
    stone: stock?.stone ?? 0,
    townCenter,
    villagersQueued: (queue ?? []).filter((entry) => entry.kind === 'unit' && entry.unitType === 'villager').length,
    housesComplete: houses.filter((house) => house.complete).length,
    housesBuilding: houses.filter((house) => !house.complete).length,
    houses,
  };
}

export interface AiEconomySummaryOptions {
  /** Ticks between consecutive samples. */
  step: number;
  /** The seat's hard population limit: above it a House buys nothing. */
  hardPopCap: number;
  villagerFood: number;
  houseWood: number;
  /** The villager count the seat is aiming for in an age. */
  villagerTarget: (age: string) => number;
}

/** A run of consecutive samples, in ticks, with what it held at worst. */
export interface TickRun { from: number; to: number; ticks: number }

function runs(samples: readonly AiEconomySample[], step: number, test: (s: AiEconomySample) => boolean): TickRun[] {
  const out: TickRun[] = [];
  let open: TickRun | null = null;
  for (const sample of samples) {
    if (test(sample)) {
      if (open) { open.to = sample.tick; open.ticks += step; } else open = { from: sample.tick, to: sample.tick, ticks: step };
    } else if (open) { out.push(open); open = null; }
  }
  if (open) out.push(open);
  return out;
}

export interface AiEconomySummary {
  /** Housed: population at its cap while the cap is below the hard limit, so
   *  a House would have bought room. Each run, longest first. */
  housed: TickRun[];
  /** The housed ticks during which it also held a House's wood. */
  housedWithWood: TickRun[];
  /** Town Center idle while the seat could pay for a villager, had room for
   *  one and was below its villager target. */
  idleWhileAble: TickRun[];
  idleWhileAbleTicks: number;
  /** Town Center idle while it could pay for a villager, whatever the target. */
  idleWhileAffordableTicks: number;
  /** Villagers born in the window: each rise in the villagers held from one
   *  sample to the next (a birth and a death on one tick hide each other). */
  villagersTrained: number;
  houses: Array<{ id: number; placed: number; complete: number | null }>;
  /** The first tick each age was held. */
  ageReached: Record<string, number>;
  villagersAt: (tick: number) => number | undefined;
  /** The most villagers held at any sample up to `tick`: what the Town Center
   *  produced, unmoved by a villager lost to a raid afterwards. */
  peakVillagersBy: (tick: number) => number;
}

export function summarizeAiEconomy(
  samples: readonly AiEconomySample[],
  options: AiEconomySummaryOptions,
): AiEconomySummary {
  const { step, hardPopCap, villagerFood, houseWood, villagerTarget } = options;
  const housed = (s: AiEconomySample) => s.popCap > 0 && s.popCurrent >= s.popCap && s.popCap < hardPopCap;
  const able = (s: AiEconomySample) => s.townCenter === 'idle' && s.food >= villagerFood
    && s.popCurrent < s.popCap && s.villagers + s.villagersQueued < villagerTarget(s.age);
  const idleWhileAble = runs(samples, step, able).sort((a, b) => b.ticks - a.ticks);
  const placed = new Map<number, number>();
  const complete = new Map<number, number>();
  const ageReached: Record<string, number> = {};
  let villagersTrained = 0;
  let previous: AiEconomySample | undefined;
  for (const s of samples) {
    if (previous !== undefined && s.villagers > previous.villagers) villagersTrained += s.villagers - previous.villagers;
    previous = s;
    if (ageReached[s.age] === undefined) ageReached[s.age] = s.tick;
    for (const house of s.houses) {
      if (!placed.has(house.id)) placed.set(house.id, s.tick);
      if (house.complete && !complete.has(house.id)) complete.set(house.id, s.tick);
    }
  }
  return {
    housed: runs(samples, step, housed).sort((a, b) => b.ticks - a.ticks),
    housedWithWood: runs(samples, step, (s) => housed(s) && s.wood >= houseWood).sort((a, b) => b.ticks - a.ticks),
    idleWhileAble,
    idleWhileAbleTicks: idleWhileAble.reduce((sum, run) => sum + run.ticks, 0),
    idleWhileAffordableTicks: samples.filter((s) => s.townCenter === 'idle' && s.food >= villagerFood).length * step,
    villagersTrained,
    houses: [...placed].map(([id, at]) => ({ id, placed: at, complete: complete.get(id) ?? null })),
    ageReached,
    villagersAt: (tick) => samples.find((s) => s.tick >= tick)?.villagers,
    peakVillagersBy: (tick) => samples.reduce((peak, s) => (s.tick <= tick ? Math.max(peak, s.villagers) : peak), 0),
  };
}
