#!/usr/bin/env node
// How far the AI's wood villagers actually WALK for each load, and what that
// costs — the instrument for register entry 2026-09-01 ("The gather
// comparator measures a distance the units cannot walk").
//
// Every SAMPLE ticks, for each AI owner, each wood villager with a target tree
// is scored two ways: the MANHATTAN distance from its tree to the nearest wood
// drop-off (what the comparator ranked by until 2026-09-05) and the TRUE
// 4-connected walk from beside the tree to beside the nearest drop-off,
// measured by `walkDistanceProbe.ts` from components alone so it shares no
// code with the ranking under test. Two "best available" hauls are reported
// beside it. `gap` is against the best unsaturated standing tree the
// comparator would have ranked at least as high — the same ownership tier or
// a better one — so it is how far the ranking missed by its OWN rules;
// `tier` is against the best tree of ANY tier, so it is what the spec's
// own-base-first preference costs on top. The register's symptom was a gap
// of 30; a tier cost of a few cells is the preference working as specified.
//
// Every TICK, the wood force's time is split into chopping, walking and idle,
// and a deposit ledger counts every wood load a villager carries home. Those
// are the two halves of the revised done-condition in
// `docs/threads/current/lumber-camp-routing/2026-09-01/DESIGN.md`: wood
// throughput rises AND the gathering share of wood villagers' time rises.
// "Walking" is any task that is not chopping or idle, so a villager FROZEN in
// a traffic jam counts as walking; the `frozen` column separates those out —
// wood villagers in a walking task that have made no PROGRESS for
// FROZEN_TICKS (the traffic starvation threshold), per sample. Progress is a
// bounding box: the clock restarts only when the villager has left a
// FROZEN_BOX-cell square around where the clock started, because a jam is
// not a villager standing still — a critic found fourteen loaded villagers on
// Nomad SHUFFLING between two adjacent cells for 21,000 ticks, 127 cell
// changes each per 400 ticks, that a "no cell change" clock read as walking.
//
// Wall time is measured around `bridge.step` only, so the sampling above does
// not count against the ticks/second it reports. A fix that doubles gather
// throughput and halves simulation speed is not a fix. But ticks/second over
// a whole match also tracks how BIG the world got — more wood means more
// buildings and more army, and every unit costs tick time — so the cost is
// also reported per unit-tick (`ms/1k unit-ticks`), and the walk field's own
// rebuild count and wall time come from the bridge's debug snapshot on a
// build that has it. Read those two before reading ticks/second.
//
//   npm run ai:gather-walk
//   SEEDS=aoe2-prototype,arena TICKS=45000 SAMPLE=1500 npm run ai:gather-walk
import { createSimulationBridge } from '../src/game/simulation/createSimulationBridge.ts';
import { HUMAN_PLAYER_ID } from '../src/game/simulation/prototypeScenario.ts';
import { IDLE_ASSIGN_SPREAD_CAP } from '../src/game/simulation/bridge/systems/villagerEconomySystem.ts';
import {
  bestAvailableHauls,
  dropOffRingsOf,
  haulProbeFor,
  manhattanHaulAt,
  staticGridOf,
} from '../src/game/playtest/walkDistanceProbe.ts';

const SEEDS = (process.env.SEEDS ?? 'aoe2-prototype,arena,fortress,gold-rush,coastal,arabia').split(',');
const TICKS = Number(process.env.TICKS ?? 45000);
const SAMPLE = Number(process.env.SAMPLE ?? 1500);
/** A target further than this beyond the best available haul is reported as
 *  a MISRANK — the register's symptom was 35 against 0. */
const MISRANK_GAP = 6;
/** A walking villager that has not left its box for this long is frozen —
 *  the traffic election's own starvation threshold (movementTrafficElection). */
const FROZEN_TICKS = 750;
/** The side of the square a villager must leave to count as making progress:
 *  two cells, so a head-on shuffle between neighbours never counts. */
const FROZEN_BOX = 2;

const pad = (value, width) => String(value).padStart(width);
const fixed = (value, digits = 1) => (Number.isFinite(value) ? value.toFixed(digits) : 'inf');

const blankOwner = () => ({
  samples: 0, onWood: 0, villagers: 0, targets: 0, haulSum: 0, haulMax: 0, manhattanSum: 0,
  gapSum: 0, gapMax: 0, tierSum: 0, misranked: 0, unreachable: 0,
  choppingTicks: 0, walkingTicks: 0, idleTicks: 0, woodTicks: 0,
  loads: 0, woodDelivered: 0, frozen: 0, frozenMax: 0,
});

for (const seed of SEEDS) {
  // Both owners AI, exactly as `scripts/selfplay-audit.mjs` drives it.
  const bridge = createSimulationBridge(seed, { forceAiForOwners: new Set([HUMAN_PLAYER_ID]) });
  const world = bridge.world;
  const owners = new Map();
  const ownerRow = (owner) => {
    const row = owners.get(owner) ?? blankOwner();
    owners.set(owner, row);
    return row;
  };
  const lastCarry = new Map();
  /** Per gatherer: the cell its progress clock started on and the tick. */
  const lastCell = new Map();
  let stepMs = 0;
  let unitTicks = 0;
  let outcome = 'running';
  let endedAt = TICKS;

  for (let tick = 1; tick <= TICKS; tick += 1) {
    const started = performance.now();
    bridge.step(100);
    stepMs += performance.now() - started;
    if (bridge.getMatchState().outcome !== 'running') {
      outcome = bridge.getMatchState().outcome;
      endedAt = tick;
      break;
    }
    // Every unit on the map costs tick time; this is the denominator that
    // makes the two arms' costs comparable when their worlds differ in size.
    for (const _id of world.query('position', 'unit')) unitTicks += 1;

    // Per tick: the wood force's time, and the deposit ledger.
    const seen = new Set();
    for (const id of world.query('unit', 'gatherer')) {
      const unit = world.getComponent(id, 'unit');
      const gatherer = world.getComponent(id, 'gatherer');
      if (!unit || !gatherer) continue;
      seen.add(id);
      const previous = lastCarry.get(id);
      if (
        previous
        && previous.owner === unit.owner
        && previous.carriedResource === 'wood'
        && previous.carriedAmount > 0
        && previous.task === 'to-dropoff'
        && gatherer.carriedAmount === 0
      ) {
        const row = ownerRow(unit.owner);
        row.loads += 1;
        row.woodDelivered += previous.carriedAmount;
      }
      lastCarry.set(id, {
        owner: unit.owner,
        task: gatherer.task,
        carriedResource: gatherer.carriedResource,
        carriedAmount: gatherer.carriedAmount,
      });
      const cell = world.getComponent(id, 'position');
      const known = lastCell.get(id);
      if (cell && (!known || Math.abs(known.x - cell.x) >= FROZEN_BOX || Math.abs(known.y - cell.y) >= FROZEN_BOX)) {
        lastCell.set(id, { x: cell.x, y: cell.y, since: tick });
      }
      if (gatherer.desiredResource !== 'wood') continue;
      const row = ownerRow(unit.owner);
      row.woodTicks += 1;
      if (gatherer.task === 'gathering') row.choppingTicks += 1;
      else if (gatherer.task === 'idle') row.idleTicks += 1;
      else row.walkingTicks += 1;
    }
    for (const id of [...lastCarry.keys()]) {
      if (!seen.has(id)) { lastCarry.delete(id); lastCell.delete(id); }
    }

    if (tick % SAMPLE !== 0) continue;

    // Per sample: where each wood villager's target sits, in both metrics.
    const economy = bridge.getEconomyState();
    const complete = new Set(economy.buildings.filter((b) => b.isComplete).map((b) => b.id));
    const grid = staticGridOf(world);
    const targetCounts = new Map();
    for (const id of world.query('unit', 'gatherer')) {
      const gatherer = world.getComponent(id, 'gatherer');
      if (gatherer?.targetResourceId != null) {
        targetCounts.set(gatherer.targetResourceId, (targetCounts.get(gatherer.targetResourceId) ?? 0) + 1);
      }
    }
    for (const owner of new Set(Object.keys(economy.ages).map(Number))) {
      const row = ownerRow(owner);
      row.samples += 1;
      row.villagers += economy.villagers.filter((v) => v.owner === owner).length;
      const rings = dropOffRingsOf(world, owner, 'wood', (id) => complete.has(id));
      const probe = haulProbeFor(grid, rings);
      const best = bestAvailableHauls(world, probe, owner, targetCounts, IDLE_ASSIGN_SPREAD_CAP);
      for (const id of world.query('unit', 'gatherer')) {
        const unit = world.getComponent(id, 'unit');
        const gatherer = world.getComponent(id, 'gatherer');
        if (!unit || !gatherer || unit.owner !== owner || gatherer.desiredResource !== 'wood') continue;
        row.onWood += 1;
        const stood = lastCell.get(id);
        if (stood && gatherer.task !== 'gathering' && gatherer.task !== 'idle' && tick - stood.since >= FROZEN_TICKS) {
          row.frozen += 1;
          row.frozenMax = Math.max(row.frozenMax, tick - stood.since);
        }
        if (gatherer.targetResourceId == null) continue;
        const target = world.getComponent(gatherer.targetResourceId, 'position');
        const targetResource = world.getComponent(gatherer.targetResourceId, 'resource');
        if (!target || !targetResource || rings.length === 0) continue;
        const haul = probe.haulAt(target);
        row.targets += 1;
        if (!Number.isFinite(haul)) {
          row.unreachable += 1;
          continue;
        }
        row.haulSum += haul;
        row.haulMax = Math.max(row.haulMax, haul);
        row.manhattanSum += manhattanHaulAt(target, rings);
        const gap = best.gapFor(targetResource, haul);
        row.gapSum += gap;
        row.gapMax = Math.max(row.gapMax, gap);
        row.tierSum += Math.max(0, haul - best.anyTier);
        if (gap > MISRANK_GAP) row.misranked += 1;
      }
    }
  }

  const halted = bridge.getHudState().engineHalted;
  const ticksPerSecond = endedAt / (stepMs / 1000);
  const walkFields = bridge.getDebugSnapshot().walkFields;
  const fieldCost = walkFields
    ? `field rebuilt ${walkFields.computed} served ${walkFields.served} in ${walkFields.computeMs.toFixed(0)}ms`
      + ` (${((walkFields.computeMs / stepMs) * 100).toFixed(2)}% of step)`
    : 'field: not on this build';
  console.log(
    `${seed} — outcome ${outcome} at tick ${String(endedAt)}, ${ticksPerSecond.toFixed(0)} ticks/s`
    + ` (${(stepMs / 1000).toFixed(1)}s in step, ${(stepMs / Math.max(1, unitTicks) * 1000).toFixed(2)} ms/1k unit-ticks,`
    + ` ${(unitTicks / endedAt).toFixed(1)} units mean), ${fieldCost}`
    + `${halted ? ' [ENGINE HALTED — these numbers are not a measurement]' : ''}`,
  );
  for (const [owner, row] of [...owners].sort((a, b) => a[0] - b[0])) {
    const reachable = row.targets - row.unreachable;
    const share = (n) => `${pad(Math.round((n / Math.max(1, row.woodTicks)) * 100), 3)}%`;
    console.log(
      `${seed.padEnd(15)} o${owner}`
      + ` | vil ${pad(fixed(row.villagers / Math.max(1, row.samples)), 5)}`
      + ` onWood ${pad(fixed(row.onWood / Math.max(1, row.samples)), 5)}`
      + ` | chop ${share(row.choppingTicks)} walk ${share(row.walkingTicks)} idle ${share(row.idleTicks)}`
      + ` | loads ${pad(row.loads, 5)} wood ${pad(row.woodDelivered, 6)}`
      + ` | frozen ${pad(fixed(row.frozen / Math.max(1, row.samples)), 4)}/sample longest ${pad(row.frozenMax, 5)}`
      + ` | haul mean ${pad(fixed(row.haulSum / Math.max(1, reachable)), 5)} max ${pad(row.haulMax, 3)}`
      + ` manhattan ${pad(fixed(row.manhattanSum / Math.max(1, reachable)), 5)}`
      + ` | gap mean ${pad(fixed(row.gapSum / Math.max(1, reachable)), 5)} max ${pad(row.gapMax, 3)}`
      + ` tier ${pad(fixed(row.tierSum / Math.max(1, reachable)), 5)}`
      + ` misranked ${pad(row.misranked, 3)}/${pad(row.targets, 3)}`
      + ` unreachable ${pad(row.unreachable, 3)}`,
    );
  }
}
