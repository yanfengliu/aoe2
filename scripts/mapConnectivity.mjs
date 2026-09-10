#!/usr/bin/env node
// Does a normal match seal its own map? The map-scale instrument for register
// entry 2026-09-06, "A normal match seals its own map, so the armies can never
// meet" — found by the standing loop, playing a 93-minute Black Forest match in
// which the whole army was ordered across the map and nothing happened; the
// owner reported none of it. The flood that measured it was a scratch probe
// under an ignored path; this is that probe promoted, so the evidence the fix
// cites is re-runnable by anyone (the same reason `aiArmyBlock.mjs` exists).
//
// harness: staticGridOf on a live bridge — no bundle exists for this
// configuration (the before arm injects the pre-2026-09-08 search through
// `placementSearchInstrument`, which a replay world cannot carry), and the
// question is about the ground the buildings leave, which the flood reads from
// world components without touching the pathfinder or the guard under test.
//
// For each seed, each ARM and each VARIANT, one bridge is stepped to TICKS and
// sampled every SAMPLE ticks (tick 0 included):
//
//   terrainOpen   cells whose terrain a land unit may stand on (grass, not
//                 water or forest) — the ground the map generator handed out.
//   openAfter     cells still open once building footprints and resource
//                 nodes are subtracted: `staticGridOf`, the independent
//                 rebuild of land passability from components.
//   human comps   how many separate pockets the human's units stand in, and
//                 the largest pocket's size in cells. One pocket is a
//                 connected map as far as those units are concerned.
//   enemy reach   enemy units standing in a pocket the human's units share,
//                 over all enemy units on the map. 0/26 is the register's
//                 symptom; a battle needs this above zero.
//   on farm       units of each side standing on a farm cell. A farm is
//                 walkable ground in the game (passableStructures.ts,
//                 2026-09-08) and a building footprint to this flood, so a
//                 farmer at work reads as standing on a wall: it is in no
//                 pocket and counts as unreachable above. The `farms open`
//                 pair beside it re-runs the flood with every farm cell
//                 cleared — the game's own view — as human pockets and
//                 enemy reach.
//   ages          each owner's age, and each owner's building count — so a
//                 rule that keeps the map open only by stopping the AI shows
//                 up here rather than hiding behind a connected map.
//
// ARMS:     idle     — the human seat idle, only owner 2's AI building.
//           both-ai  — `forceAiForOwners` on the human seat, an AI-vs-AI match.
// VARIANTS: shipped  — the search as built.
//           legacy   — the pre-2026-09-08 search: guarded rings 2..12, then the
//                      SAME rings unguarded, then 13..24 guarded, then 13..24
//                      unguarded, and no pending-footprint mask. Injected
//                      through the instrument seam, so both arms of the
//                      before/after run in ONE process on ONE tree.
//
// Both variants run in this one job on purpose: an A/B whose arms come from
// two checkouts differs by more than the variable under test.
//
//   npx tsx scripts/mapConnectivity.mjs
//   SEEDS=black-forest TICKS=20000 SAMPLE=10000 ARMS=both-ai VARIANTS=shipped npx tsx scripts/mapConnectivity.mjs
/* global process, console, performance */
import { createSimulationBridge } from '../src/game/simulation/createSimulationBridge.ts';
import { HUMAN_PLAYER_ID } from '../src/game/simulation/prototypeScenario.ts';
import { staticGridOf } from '../src/game/playtest/walkDistanceProbe.ts';
import { terrainPassableForDomain } from '../src/game/simulation/unitDomain.ts';
import { findPlacementAnchorNear } from '../src/game/simulation/bridge/placementSearch.ts';
import { placementSearchInstrument } from '../src/game/simulation/bridge/aiSitePlacement.ts';

const SEEDS = (process.env.SEEDS ?? 'black-forest,aoe2-prototype').split(',');
const TICKS = Number(process.env.TICKS ?? 20000);
const SAMPLE = Number(process.env.SAMPLE ?? 10000);
const ARMS = (process.env.ARMS ?? 'idle,both-ai').split(',');
const VARIANTS = (process.env.VARIANTS ?? 'shipped,legacy').split(',');

const pad = (value, width) => String(value).padStart(width);

/** The search as it stood from 2026-08-23 to 2026-09-08. */
function legacySearch(origin, footprint, mapWidth, mapHeight, isBlocked, options = {}) {
  const { isFree, stats } = options;
  const near = (guarded) => findPlacementAnchorNear(origin, footprint, mapWidth, mapHeight, isBlocked, {
    radius: 12, widerRadius: null, isFree: guarded ? isFree : undefined, stats,
  });
  // Rings 13..24 only: a second scan of 2..12 finds nothing the first did not.
  const wide = (guarded) => findPlacementAnchorNear(origin, footprint, mapWidth, mapHeight, isBlocked, {
    radius: 12, widerRadius: 24, isFree: guarded ? isFree : undefined, stats,
  });
  return near(true) ?? near(false) ?? wide(true) ?? wide(false);
}

function setVariant(variant) {
  if (variant === 'legacy') {
    placementSearchInstrument.search = legacySearch;
    placementSearchInstrument.maskPending = false;
  } else {
    placementSearchInstrument.search = null;
    placementSearchInstrument.maskPending = true;
  }
}

/** Cells a land unit may stand on by terrain alone. */
function terrainOpenCount(world) {
  let open = 0;
  for (const id of world.query('position', 'terrain')) {
    const terrain = world.getComponent(id, 'terrain');
    if (terrain && terrainPassableForDomain(terrain.kind, 'land')) open += 1;
  }
  return open;
}

/** Label every open cell with its 4-connected component; return the labels and
 *  each component's size. */
function labelComponents(grid) {
  const { width, height, blocked } = grid;
  const labels = new Int32Array(width * height).fill(-1);
  const sizes = [];
  const queue = new Int32Array(width * height);
  for (let seed = 0; seed < width * height; seed += 1) {
    if (blocked[seed] || labels[seed] !== -1) continue;
    const component = sizes.length;
    let head = 0;
    let tail = 0;
    labels[seed] = component;
    queue[tail++] = seed;
    let size = 0;
    while (head < tail) {
      const index = queue[head++];
      size += 1;
      const x = index % width;
      const y = (index - x) / width;
      for (const [nx, ny] of [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]]) {
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
        const next = ny * width + nx;
        if (blocked[next] || labels[next] !== -1) continue;
        labels[next] = component;
        queue[tail++] = next;
      }
    }
    sizes.push(size);
  }
  return { labels, sizes };
}

/** Pockets and reach over one grid: how many pockets the human's units stand
 *  in, the largest, and how many enemy units share one of them. */
function pocketsOf(grid, units) {
  const { width } = grid;
  const { labels, sizes } = labelComponents(grid);
  const humanComponents = new Set();
  for (const unit of units) {
    if (unit.owner !== HUMAN_PLAYER_ID) continue;
    const label = labels[unit.y * width + unit.x];
    if (label !== -1 && label !== undefined) humanComponents.add(label);
  }
  let enemies = 0;
  let enemiesReachable = 0;
  for (const unit of units) {
    if (unit.owner === HUMAN_PLAYER_ID) continue;
    enemies += 1;
    if (humanComponents.has(labels[unit.y * width + unit.x])) enemiesReachable += 1;
  }
  const largest = [...humanComponents].reduce((best, label) => Math.max(best, sizes[label] ?? 0), 0);
  return { components: humanComponents.size, largest, enemies, enemiesReachable };
}

function sampleRow(bridge, tick) {
  const world = bridge.world;
  const grid = staticGridOf(world);
  const { width } = grid;
  const economy = bridge.getEconomyState();
  const raw = pocketsOf(grid, economy.units);
  // The game's own view: a farm is ground with crops on it.
  const farmCells = new Set();
  for (const building of economy.buildings) {
    if (building.buildingType !== 'farm') continue;
    for (let y = building.y; y < building.y + building.footprintHeight; y += 1) {
      for (let x = building.x; x < building.x + building.footprintWidth; x += 1) {
        farmCells.add(y * width + x);
      }
    }
  }
  const farmsOpen = { ...grid, blocked: grid.blocked.slice() };
  for (const index of farmCells) farmsOpen.blocked[index] = 0;
  const open = pocketsOf(farmsOpen, economy.units);
  let humanOnFarm = 0;
  let enemyOnFarm = 0;
  for (const unit of economy.units) {
    if (!farmCells.has(unit.y * width + unit.x)) continue;
    if (unit.owner === HUMAN_PLAYER_ID) humanOnFarm += 1;
    else enemyOnFarm += 1;
  }
  let openAfter = 0;
  for (const cell of grid.blocked) if (cell === 0) openAfter += 1;
  const owners = [...new Set(Object.keys(economy.ages).map(Number))].sort((a, b) => a - b);
  const perOwner = owners.map((owner) => {
    const buildings = economy.buildings.filter((building) => building.owner === owner).length;
    return `o${owner} ${(economy.ages[owner] ?? 'dark-age').replace('-age', '').padEnd(8)} b${pad(buildings, 3)}`;
  });
  return {
    tick,
    terrainOpen: terrainOpenCount(world),
    openAfter,
    raw,
    open,
    humanOnFarm,
    enemyOnFarm,
    perOwner: perOwner.join(' | '),
  };
}

function printRow(seed, arm, variant, row, note = '') {
  console.log(
    `${seed.padEnd(15)} ${arm.padEnd(8)} ${variant.padEnd(8)}`
    + ` | t${pad(row.tick, 6)} | terrainOpen ${pad(row.terrainOpen, 5)} openAfter ${pad(row.openAfter, 5)}`
    + ` | human comps ${pad(row.raw.components, 2)} largest ${pad(row.raw.largest, 5)}`
    + ` | enemy reach ${pad(row.raw.enemiesReachable, 3)}/${pad(row.raw.enemies, 3)}`
    + ` | on farm h${pad(row.humanOnFarm, 2)} e${pad(row.enemyOnFarm, 2)}`
    + ` | farms open: comps ${pad(row.open.components, 2)} reach ${pad(row.open.enemiesReachable, 3)}/${pad(row.open.enemies, 3)}`
    + ` | ${row.perOwner}${note}`,
  );
}

console.log(
  `map connectivity — seeds ${SEEDS.join(',')} · ticks ${String(TICKS)} · sample ${String(SAMPLE)}`
  + ` · arms ${ARMS.join(',')} · variants ${VARIANTS.join(',')}`,
);
for (const variant of VARIANTS) {
  setVariant(variant);
  for (const seed of SEEDS) {
    for (const arm of ARMS) {
      const options = arm === 'both-ai' ? { forceAiForOwners: new Set([HUMAN_PLAYER_ID]) } : {};
      const bridge = createSimulationBridge(seed, options);
      printRow(seed, arm, variant, sampleRow(bridge, 0));
      const startedAt = performance.now();
      for (let tick = 1; tick <= TICKS; tick += 1) {
        bridge.step(100);
        const outcome = bridge.getMatchState().outcome;
        if (outcome !== 'running') {
          printRow(seed, arm, variant, sampleRow(bridge, tick), ` [match ${outcome} at tick ${String(tick)}]`);
          break;
        }
        if (tick % SAMPLE === 0) printRow(seed, arm, variant, sampleRow(bridge, tick));
      }
      // A HALTED bridge looks exactly like an idle AI from out here — `tryTick`
      // catches the engine's tick failure and every later step returns at once.
      const halted = bridge.getHudState().engineHalted;
      const stats = bridge.getDebugSnapshot().aiSitePlacement;
      console.log(
        `${seed.padEnd(15)} ${arm.padEnd(8)} ${variant.padEnd(8)}`
        + ` | site search: floods ${String(stats?.floods ?? 0)} refusedByGuard ${String(stats?.refusedByGuard ?? 0)}`
        + ` nullSearches ${String(stats?.nullSearches ?? 0)} computeMs ${(stats?.computeMs ?? 0).toFixed(1)}`
        + ` | wall ${((performance.now() - startedAt) / 1000).toFixed(1)}s`
        + `${halted ? ' [ENGINE HALTED — these numbers are not a measurement]' : ''}`,
      );
    }
  }
}
setVariant('shipped');
