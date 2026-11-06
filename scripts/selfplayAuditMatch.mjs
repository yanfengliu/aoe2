// One all-AI self-play match, measured per owner: the match `scripts/selfplay-audit.mjs` prints a table of, and
// the unit of `scripts/selfplay-ab.mjs`, which plays several seeds per map in two trees (work 144).
//
// WHY A MODULE. The audit played one seed a map and printed as it went, so a second instrument that needed the same
// numbers would have had to copy its loop, and two copies of one measurement drift. Here the loop returns a plain
// record and both instruments read it. `loadGame(root)` imports the game from any checkout of this repo, so an A/B
// measures two trees with ONE copy of the measurement: the instrument is the runner's, the game is each arm's.
//
// SEEDS PER MAP (work 144). A seed is a map seed: the simulation draws no random number (no system reads the world's
// rng and none calls Math.random), so a match is a function of its map and options alone, and the same seed played
// twice is the same match. Several games of one map are therefore several seeds of that map's generator. A seed
// `<map>#<k>` plays `<map>`'s generator with that seed: the default map (`aoe2-prototype`, DEFAULT_SEED, and any seed
// the scenario table does not name) already generates every seed, and a named map's factory (`fortress`, `coastal`,
// ...) is entered in the scenario table under the variant seed, in this process only, before the bridge is built.
// `scenarioDigest` fingerprints the generated scenario, so a factory that ignores its seed shows as two seeds with
// one digest instead of as a match with no spread.
//
// The columns, per owner. Ages are the first 250-tick sample holding the age (as the audit always read them); a
// click is the first 25-tick sample with that age's research in one of the owner's queues, with the villagers held
// then. `villagersAt` is the villagers held at 5, 10, 15 and 20 minutes. Villagers are counted from the unit
// components, the garrisoned ones included; the economy state's unit list holds only units with a position, and on
// `aoe2-prototype#1` owner 1's Town Center bell left 2 of its 10 villagers in that list at 5:00. The rest are the
// audit's own, read from that list as the audit always read them: the Feudal qualifying buildings, building and unit
// types seen, the army (every unit not a villager, garrisoned ones not counted) at its peak and every 5,000 ticks,
// villager deaths (with those inside an enemy defence's fully upgraded reach), the first Monastery, Monk, complete
// Castle and siege unit, the most siege held, relics stored, and the first complete farm.
//
// The farms and the wood (work 147 M2, schema 2), which the spending study measured with scratch probes that went
// with their worktree: the first complete Siege Workshop; the complete farms and the wood held every 5,000 ticks,
// beside the army; the 250-tick samples at which an owner that has held two complete farms holds fewer (a breach
// of spec §13.2's two-farm floor, `MINIMUM_FARMS`); and, from the 25-tick sample, each farm that left play with at
// most 10 food at its last sighting (run out and not reseeded, which its owner could not pay for) and each farm whose
// food rose by more than 50 between sightings (reseeded in place). A farm is named by its entity id and generation,
// since the engine recycles ids (plan 147, review R0-1). Bound: a farm built and gone between two 25-tick samples is
// not seen, and one killed with at most 10 food left reads as run out.

import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export const RECORD_SCHEMA = 2;
export const VARIANT_SEPARATOR = '#';

// `castle` plays the match `tests/simulation/aiReachesCastleAge.test.ts` plays (the shipped configuration with the
// Wonder and Relic victories off, work 128); `standard` the shipped Standard rules, every victory on, as
// `aiRelicsSelfPlay.test.ts` does; `lab` the no-attack coverage lab of `selfPlayContentCoverage.test.ts`; `idle`
// the boot match at the lobby's defaults with the human seat not played, as a player who never touches the mouse
// meets it, which only owner 2's columns describe.
export const CONFIGS = {
  castle: { options: { victory: 'conquest-only' }, owners: [1, 2], humanIdle: false },
  standard: { options: {}, owners: [1, 2], humanIdle: false },
  lab: {
    options: { disableAiAttacks: true, victory: 'conquest-only', resourcePreset: 'high', difficulty: 'hard' },
    owners: [1, 2],
    humanIdle: false,
  },
  idle: { options: {}, owners: [2], humanIdle: true },
};

export const QUALIFYING = ['blacksmith', 'archery-range', 'stable', 'market'];
export const AGES = ['feudal-age', 'castle-age', 'imperial-age'];
export const VILLAGER_MINUTES = [5, 10, 15, 20];
export const ARMY_SAMPLE_TICKS = 5000;
const TICKS_PER_MINUTE = 600;

// The most the Blacksmith's arrow technologies (Fletching, Bodkin Arrow, Bracer) add to a building's range, and the
// one-cell margin the assignment rule keeps clear. A Keep or a Korean tower reaches one or two further; the ledger
// prints the distance so those show.
const ARROW_TECH_RANGE_MAX = 3;
const DEFENCE_MARGIN = 1;
// The feed keeps a death for ten ticks and prunes only when the next one lands, so reading it every tick and
// de-duplicating by unit id sees them all; the task is sampled less often because a gather trip lasts hundreds of
// ticks. The age clicks are read on the same sample.
const TASK_SAMPLE_INTERVAL = 25;
const ECONOMY_SAMPLE_INTERVAL = 250;
// The farm columns' thresholds: spec §13.2's floor, a farm's food at its last sighting at or under which leaving play
// is running out, and the rise between sightings that only a reseed gives (nothing else gives a farm food).
const FARM_FLOOR = 2;
const FARM_RUN_OUT_FOOD = 10;
const FARM_RESEED_RISE = 50;

/** The modules a match needs, imported from the checkout at `root`. */
export async function loadGame(root) {
  const at = (path) => import(pathToFileURL(resolve(root, path)).href);
  // One at a time: the game's modules import one another in cycles, and vitest's module runner deadlocked on these
  // five started together (a test of this file waited 120 s on them).
  const bridge = await at('src/game/simulation/createSimulationBridge.ts');
  const scenario = await at('src/game/simulation/prototypeScenario.ts');
  const buildings = await at('src/game/simulation/prototypeBuildingRules.ts');
  const units = await at('src/game/simulation/prototypeUnitRules.ts');
  const registry = await at('src/game/simulation/prototypeScenario/scenarioRegistry.ts');
  return {
    createSimulationBridge: bridge.createSimulationBridge,
    createPrototypeScenario: scenario.createPrototypeScenario,
    HUMAN_PLAYER_ID: scenario.HUMAN_PLAYER_ID,
    createBuildingCombatState: buildings.createBuildingCombatState,
    isSiegeUnit: units.isSiegeUnit,
    SCENARIO_FACTORIES: registry.SCENARIO_FACTORIES,
  };
}

// The default map's first seeds are the three every audit since 2026-08-29 played (`selfplay-audit.mjs`'s and
// `ai-dark-age-sweep.mjs`'s defaults), so the castle configuration's seven matches of work 141 are each map's first
// seeds here: `default-seed` and `corpus-seed-b` are names the scenario table does not hold, so they generate the
// default map, as `aoe2-prototype#3` does.
export const DEFAULT_MAP = 'aoe2-prototype';
const DEFAULT_MAP_SEEDS = [DEFAULT_MAP, 'default-seed', 'corpus-seed-b'];

/** The map a seed plays: everything before the variant separator, and the default map for its named seeds. */
export function mapOfSeed(seed) {
  if (DEFAULT_MAP_SEEDS.includes(seed)) return DEFAULT_MAP;
  const at = seed.indexOf(VARIANT_SEPARATOR);
  return at === -1 ? seed : seed.slice(0, at);
}

/** `count` seeds of `map`, from the `offset`-th: the map's own seed (the default map's three) first, then `<map>#k`. */
export function seedsForMap(map, count, offset = 0) {
  if (!Number.isSafeInteger(count) || count < 1) throw new Error(`seeds per map must be a positive integer; got ${count}`);
  if (!Number.isSafeInteger(offset) || offset < 0) throw new Error(`seed offset must be a non-negative integer; got ${offset}`);
  if (map.includes(VARIANT_SEPARATOR) || mapOfSeed(map) !== map) throw new Error(`"${map}" is a seed, not a map`);
  const named = map === DEFAULT_MAP ? DEFAULT_MAP_SEEDS : [map];
  return Array.from({ length: count }, (_unused, i) => named[i + offset] ?? `${map}${VARIANT_SEPARATOR}${i + offset}`);
}

/** Enters a variant seed of a named map in the scenario table, so the bridge builds that map from it. */
export function registerSeed(game, seed) {
  const map = mapOfSeed(seed);
  if (map === seed || map === DEFAULT_MAP || game.SCENARIO_FACTORIES.has(seed)) return;
  const factory = game.SCENARIO_FACTORIES.get(map);
  if (factory) game.SCENARIO_FACTORIES.set(seed, factory);
}

/** A fingerprint of the scenario a seed generates: its size, terrain and spawns. */
export function scenarioDigest(game, seed) {
  registerSeed(game, seed);
  const scenario = game.createPrototypeScenario(seed);
  const { width, height, terrain, starts, spawns } = scenario;
  return createHash('sha256').update(JSON.stringify({ width, height, terrain, starts, spawns })).digest('hex').slice(0, 16);
}

function footprintDistance(b, x, y) {
  const nx = Math.min(Math.max(x, b.x), b.x + b.footprintWidth - 1);
  const ny = Math.min(Math.max(y, b.y), b.y + b.footprintHeight - 1);
  return Math.abs(x - nx) + Math.abs(y - ny);
}

// Returns the NEAREST enemy defence (for the ledger line) and, separately, whether ANY of them covers the cell. Those
// are different questions: a Castle two cells further off reaches two cells further than a Town Centre, so asking
// only the nearest one under-counts.
function nearestEnemyDefence(game, buildings, owner, x, y) {
  let best = null;
  let covered = false;
  for (const b of buildings) {
    if (b.owner === owner || !b.isComplete) continue;
    const combat = game.createBuildingCombatState(b.buildingType);
    if (combat === null) continue;
    const reach = combat.attackRange + ARROW_TECH_RANGE_MAX + DEFENCE_MARGIN;
    const distance = footprintDistance(b, x, y);
    if (distance <= reach) covered = true;
    if (best === null || distance < best.distance) {
      best = { defence: b.buildingType, defenceOwner: b.owner, distance, reach };
    }
  }
  return best === null ? null : { ...best, covered };
}

// The relic ledger: `onTick` runs after every step; `onSample` runs on the 250-tick economy sample, and once before
// the first step so a relic picked up early is already known by its starting cell. Pickups and stores are read every
// tick from the two world-state slots the relic rules write, `aoe2.monkCarriedRelic` (Monk -> relic) and
// `aoe2.relicsInMonastery` (Monastery -> count), and only when the slot's object changes, which is once per write.
function createRelicLedger(bridge, owners) {
  const relics = new Map();
  const stores = [];
  const storedBy = new Map(owners.map((o) => [o, 0]));
  let carriedSlot;
  let storedSlot;
  let carriedPairs = new Set();
  const ownerOf = (id, component) => bridge.world.getComponent(id, component)?.owner ?? null;
  const entryFor = (id, x = null, y = null) => {
    if (!relics.has(id)) relics.set(id, { id, x, y, seen: {}, picked: [] });
    return relics.get(id);
  };
  return {
    stores,
    storedBy,
    relics,
    onTick(tick) {
      const carried = bridge.world.getState('aoe2.monkCarriedRelic');
      if (carried !== carriedSlot) {
        carriedSlot = carried;
        const next = new Set();
        for (const [monkId, relicId] of carried ?? []) {
          const key = `${monkId}:${relicId}`;
          next.add(key);
          if (!carriedPairs.has(key)) entryFor(relicId).picked.push({ tick, owner: ownerOf(monkId, 'unit') });
        }
        carriedPairs = next;
      }
      const stored = bridge.world.getState('aoe2.relicsInMonastery');
      if (stored !== storedSlot) {
        storedSlot = stored;
        const totals = new Map(owners.map((o) => [o, 0]));
        for (const [monasteryId, count] of stored ?? []) {
          const owner = ownerOf(monasteryId, 'building');
          if (totals.has(owner)) totals.set(owner, totals.get(owner) + count);
        }
        for (const [owner, total] of totals) {
          if (total > storedBy.get(owner)) stores.push({ tick, owner, total });
          storedBy.set(owner, total);
        }
      }
    },
    onSample(tick, economy) {
      for (const r of economy.resources) {
        if (r.resourceType !== 'relic') continue;
        const entry = entryFor(r.id, r.x, r.y);
        for (const o of owners) {
          if (entry.seen[o] === undefined && bridge.isCellVisibleForOwner(o, Math.floor(r.x), Math.floor(r.y))) {
            entry.seen[o] = tick;
          }
        }
      }
    },
  };
}

export function emptyOwner() {
  return {
    buildings: new Set(), units: new Set(), age: {}, click: {}, villagersAtClick: {}, qualified: null, peakArmy: 0,
    villagersLost: 0, underDefence: 0, monastery: null, monk: null, siege: null, siegePeak: 0, armyByTick: [],
    castleBuilding: null, firstFarm: null, villagersAt: {},
    siegeWorkshop: null, farmsByTick: [], woodByTick: [], heldFarmFloor: false, farmFloorBreaches: 0, farmsRunOut: 0,
    farmsReseeded: 0,
  };
}

/** Each farm's food at its last sighting, by entity id and generation, so a farm that leaves play or is reseeded in
 *  place between two 25-tick samples is counted for its owner (see the header). */
export function trackFarms(bridge, st, per, seen) {
  const now = new Map();
  for (const b of st.buildings) {
    if (b.buildingType !== 'farm' || !per[b.owner]) continue;
    const ref = bridge.world.getEntityRef(b.id);
    const food = bridge.world.getComponent(b.id, 'resource')?.amount;
    if (!ref || food === undefined) continue;
    const key = `${ref.id}:${ref.generation}`;
    const was = seen.get(key);
    if (was && food > was.food + FARM_RESEED_RISE) per[b.owner].farmsReseeded += 1;
    now.set(key, { owner: b.owner, food });
  }
  for (const [key, was] of seen) {
    if (!now.has(key) && was.food <= FARM_RUN_OUT_FOOD) per[was.owner].farmsRunOut += 1;
  }
  seen.clear();
  for (const [key, farm] of now) seen.set(key, farm);
}

/** Plays one match and returns its record (see the header for the columns). */
export function playAuditMatch(game, { seed, config = 'castle', ticks }) {
  const conf = CONFIGS[config];
  if (!conf) throw new Error(`config must be one of ${Object.keys(CONFIGS).join(', ')}; got "${config}"`);
  if (!Number.isSafeInteger(ticks) || ticks < 1) throw new Error(`ticks must be a positive integer; got ${ticks}`);
  registerSeed(game, seed);
  const owners = [1, 2];
  // 'on-read' skips the per-tick render projection, which never writes the world, so the match is the same
  // (renderProjectionOnRead.test.ts) and it runs about a quarter faster.
  const bridge = game.createSimulationBridge(seed, {
    ...conf.options,
    ...(conf.humanIdle ? {} : { forceAiForOwners: new Set([game.HUMAN_PLAYER_ID]) }),
    renderProjection: 'on-read',
  });
  const per = Object.fromEntries(owners.map((o) => [o, emptyOwner()]));
  const lastTask = new Map();
  const deathsSeen = new Set();
  const farmsSeen = new Map();
  const ledger = [];
  const relicLedger = createRelicLedger(bridge, owners);
  relicLedger.onSample(0, bridge.getEconomyState());
  let outcome = { state: 'running', winner: null, by: null, endedAt: null };
  const startTick = bridge.world.tick;
  for (let tick = 1; tick <= ticks; tick += 1) {
    const ran = stepOneTick(bridge, seed, tick);
    relicLedger.onTick(tick);
    for (const death of bridge.getRecentUnitDeaths()) {
      const key = `${death.id}:${death.tick}`;
      if (deathsSeen.has(key)) continue;
      deathsSeen.add(key);
      if (death.unitType !== 'villager') continue;
      const x = Math.floor(death.x);
      const y = Math.floor(death.y);
      const nearest = nearestEnemyDefence(game, bridge.getEconomyState().buildings, death.owner, x, y);
      const underDefence = nearest !== null && nearest.covered;
      ledger.push({ tick: death.tick, owner: death.owner, x, y, task: lastTask.get(death.id) ?? '?', nearest, underDefence });
      const p = per[death.owner];
      if (p) {
        p.villagersLost += 1;
        if (underDefence) p.underDefence += 1;
      }
    }
    const match = bridge.getMatchState();
    if (match.outcome !== 'running') {
      const winner = match.outcome === 'victory' ? game.HUMAN_PLAYER_ID : match.outcome === 'defeat' ? 2 : null;
      // The ticks the world ran, which is the loop's count while every step runs one; a match over before the first
      // step ran none.
      outcome = { state: match.outcome, winner, by: match.winCondition ?? null, endedAt: bridge.world.tick - startTick };
      break;
    }
    if (!ran) throw new Error(`${seed}: the step to tick ${tick} was refused as match-over while the match state says it is running`);
    if (tick % TASK_SAMPLE_INTERVAL === 0) {
      const st = bridge.getEconomyState();
      for (const u of st.units) {
        if (u.unitType === 'villager') lastTask.set(u.id, u.task);
      }
      readClicks(st, per, tick, () => villagerCounts(bridge));
      trackFarms(bridge, st, per, farmsSeen);
    }
    if (tick % ECONOMY_SAMPLE_INTERVAL) continue;
    const st = bridge.getEconomyState();
    relicLedger.onSample(tick, st);
    const villagers = villagerCounts(bridge);
    for (const o of owners) sampleOwner(game, per[o], o, st, tick, villagers.get(o) ?? 0);
  }
  return {
    schema: RECORD_SCHEMA,
    seed,
    map: mapOfSeed(seed),
    config,
    ticks,
    // Generated again after the match, so the bridge's own generation is the first in this process, as in the game.
    scenarioDigest: scenarioDigest(game, seed),
    outcome,
    owners: Object.fromEntries(owners.map((o) => [o, finishOwner(per[o], relicLedger.storedBy.get(o))])),
    ledger,
    relics: [...relicLedger.relics.values()],
    relicStores: relicLedger.stores,
  };
}

// One tick (true), a finished match (false), or a thrown error naming why not: a halted, paused or stalled world
// advances no tick, and a loop that counted its own ticks would record the frozen world as a match that ran (review
// round 0, R0-2). A step refused as `match-over` advances nothing either, so the loop takes it only while the match
// state says the match is over (round 1, R1-2).
export function stepOneTick(bridge, seed, tick) {
  const before = bridge.world.tick;
  const report = bridge.step(100);
  const advanced = bridge.world.tick - before;
  if (report.refusedBecause === 'match-over' && report.ticks === 0 && advanced === 0) return false;
  if (report.refusedBecause !== null) {
    throw new Error(`${seed}: the step to tick ${tick} was refused because ${report.refusedBecause} (world tick ${bridge.world.tick})`);
  }
  if (report.ticks !== 1 || advanced !== 1) {
    throw new Error(`${seed}: the step to tick ${tick} ran ${report.ticks} ticks and moved the world ${advanced}; a measurement needs one`);
  }
  return true;
}

// Every villager an owner holds, the garrisoned ones included: the economy state's unit list has only units with a
// position, so a Town Center that rang its bell would read as a seat that lost its villagers.
export function villagerCounts(bridge) {
  const counts = new Map();
  for (const id of bridge.world.query('unit')) {
    const unit = bridge.world.getComponent(id, 'unit');
    if (unit?.unitType === 'villager') counts.set(unit.owner, (counts.get(unit.owner) ?? 0) + 1);
  }
  return counts;
}

export function readClicks(st, per, tick, villagers) {
  let counts = null;
  for (const b of st.buildings) {
    const p = per[b.owner];
    if (!p) continue;
    for (const entry of b.queue) {
      if (entry.kind !== 'technology' || !AGES.includes(entry.technologyType) || p.click[entry.technologyType] !== undefined) continue;
      counts ??= villagers();
      p.click[entry.technologyType] = tick;
      p.villagersAtClick[entry.technologyType] = counts.get(b.owner) ?? 0;
    }
  }
}

export function sampleOwner(game, p, o, st, tick, villagers) {
  let qualifying = 0;
  let farms = 0;
  for (const b of st.buildings) {
    if (b.owner !== o || !b.isComplete) continue;
    p.buildings.add(b.buildingType);
    if (QUALIFYING.includes(b.buildingType)) qualifying += 1;
    if (b.buildingType === 'monastery' && p.monastery === null) p.monastery = tick;
    if (b.buildingType === 'castle' && p.castleBuilding === null) p.castleBuilding = tick;
    if (b.buildingType === 'siege-workshop' && p.siegeWorkshop === null) p.siegeWorkshop = tick;
    if (b.buildingType === 'farm') {
      farms += 1;
      if (p.firstFarm === null) p.firstFarm = tick;
    }
  }
  if (qualifying >= 2 && p.qualified === null) p.qualified = tick;
  if (farms >= FARM_FLOOR) p.heldFarmFloor = true;
  else if (p.heldFarmFloor) p.farmFloorBreaches += 1;
  if (tick % ARMY_SAMPLE_TICKS === 0) {
    p.farmsByTick.push(farms);
    p.woodByTick.push(Math.floor(st.playerResources[o]?.wood ?? 0));
  }
  let army = 0;
  let siege = 0;
  for (const u of st.units) {
    if (u.owner !== o) continue;
    p.units.add(u.unitType);
    if (u.unitType !== 'villager') army += 1;
    if (u.unitType === 'monk' && p.monk === null) p.monk = tick;
    if (game.isSiegeUnit(u.unitType)) siege += 1;
  }
  p.peakArmy = Math.max(p.peakArmy, army);
  if (tick % ARMY_SAMPLE_TICKS === 0) p.armyByTick.push(army);
  if (siege > 0 && p.siege === null) p.siege = tick;
  p.siegePeak = Math.max(p.siegePeak, siege);
  for (const minute of VILLAGER_MINUTES) {
    if (tick === minute * TICKS_PER_MINUTE) p.villagersAt[minute] = villagers;
  }
  const age = st.ages[o];
  if (age && p.age[age] === undefined) p.age[age] = tick;
}

function finishOwner(p, relics) {
  const age = (a) => p.age[a] ?? null;
  const click = (a) => p.click[a] ?? null;
  const atClick = (a) => p.villagersAtClick[a] ?? null;
  return {
    feudalClick: click('feudal-age'), feudal: age('feudal-age'), villagersAtFeudalClick: atClick('feudal-age'),
    castleClick: click('castle-age'), castle: age('castle-age'), villagersAtCastleClick: atClick('castle-age'),
    imperialClick: click('imperial-age'), imperial: age('imperial-age'),
    qualified: p.qualified,
    buildings: [...p.buildings], units: [...p.units],
    peakArmy: p.peakArmy, armyByTick: p.armyByTick,
    villagersLost: p.villagersLost, underDefence: p.underDefence,
    monastery: p.monastery, monk: p.monk, relics,
    siege: p.siege, siegePeak: p.siegePeak, castleBuilding: p.castleBuilding, firstFarm: p.firstFarm,
    villagersAt: Object.fromEntries(VILLAGER_MINUTES.map((m) => [m, p.villagersAt[m] ?? null])),
    siegeWorkshop: p.siegeWorkshop, farmsByTick: p.farmsByTick, woodByTick: p.woodByTick,
    farmFloorBreaches: p.farmFloorBreaches, farmsRunOut: p.farmsRunOut, farmsReseeded: p.farmsReseeded,
  };
}
