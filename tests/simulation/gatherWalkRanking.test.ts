// The gather ranking sends a wood villager to a tree it can actually WALK to
// cheaply — register entry 2026-09-01, "The gather comparator measures a
// distance the units cannot walk".
//
// What it caught: the comparator ranked by Manhattan distance while movement
// is 4-connected, and a forest is a dense block of impassable cells. On the
// boot map at tick 6,000, owner 1's wood villagers were chopping a tree at a
// true walk of 34 cells from the Town Centre (Manhattan 5) while trees at a
// walk of 2 and 4 stood untouched; owner 1 delivered 110 wood by then against
// 340 with the walk metric.
//
// BOUND, and read it before trusting a green: `aoe2-prototype` only, both
// seats AI, three samples at ticks 3,000, 4,500 and 6,000, wood only. The
// haul is measured by `walkDistanceProbe.ts` from components alone, which
// shares no symbol with the ranking under test; it treats a finished gate as
// a wall, which does not matter here because this map has none. The gap is
// judged against trees the comparator would rank at least as high — same
// ownership tier or better, fewer than the idle spread cap on them — so the
// spec's own-base-first preference is not counted as a miss. GAP_CELLS of
// slack covers a target chosen up to one load earlier; the defect measured
// 29. The sample count is asserted so a run that observed no targets cannot
// pass as "no misrank".

import { describe, expect, it } from 'vitest';

import type { Position } from 'civ-engine';
import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import { HUMAN_PLAYER_ID } from '../../src/game/simulation/prototypeScenario';
import { IDLE_ASSIGN_SPREAD_CAP } from '../../src/game/simulation/bridge/systems/villagerEconomySystem';
import type {
  GathererComponent,
  ResourceComponent,
  UnitComponent,
} from '../../src/game/simulation/types';
import {
  bestAvailableHauls,
  dropOffRingsOf,
  haulProbeFor,
  staticGridOf,
} from '../../src/game/playtest/walkDistanceProbe';

const SAMPLE_TICKS = [3000, 4500, 6000];
/** Cells a target may exceed the best available tree by. */
const GAP_CELLS = 6;
/** Wood targets the three samples must have seen, so the check ran. */
const MIN_TARGETS_OBSERVED = 6;

interface Miss {
  tick: number;
  owner: number;
  villager: number;
  target: number;
  haul: number;
  gap: number;
}

describe('the gather ranking on the boot map', () => {
  it('never sends a wood villager to a tree far beyond the best one it could walk to', () => {
    const bridge = createSimulationBridge('aoe2-prototype', {
      forceAiForOwners: new Set([HUMAN_PLAYER_ID]),
    });
    const world = bridge.world;
    const misses: Miss[] = [];
    const unreachable: Miss[] = [];
    let targetsObserved = 0;

    let tick = 0;
    for (const sampleTick of SAMPLE_TICKS) {
      while (tick < sampleTick) {
        bridge.step(100);
        tick += 1;
      }
      expect(bridge.getHudState().engineHalted, 'the engine halted; nothing below is a measurement').toBeNull();
      const economy = bridge.getEconomyState();
      const complete = new Set(economy.buildings.filter((b) => b.isComplete).map((b) => b.id));
      const grid = staticGridOf(world);
      const targetCounts = new Map<number, number>();
      for (const id of world.query('unit', 'gatherer')) {
        const gatherer = world.getComponent<GathererComponent>(id, 'gatherer');
        if (gatherer?.targetResourceId != null) {
          targetCounts.set(gatherer.targetResourceId, (targetCounts.get(gatherer.targetResourceId) ?? 0) + 1);
        }
      }
      for (const owner of new Set(Object.keys(economy.ages).map(Number))) {
        const rings = dropOffRingsOf(world, owner, 'wood', (id) => complete.has(id));
        if (rings.length === 0) continue;
        const probe = haulProbeFor(grid, rings);
        const best = bestAvailableHauls(world, probe, owner, targetCounts, IDLE_ASSIGN_SPREAD_CAP);
        for (const id of world.query('unit', 'gatherer')) {
          const unit = world.getComponent<UnitComponent>(id, 'unit');
          const gatherer = world.getComponent<GathererComponent>(id, 'gatherer');
          if (!unit || !gatherer || unit.owner !== owner) continue;
          if (gatherer.desiredResource !== 'wood' || gatherer.targetResourceId === null) continue;
          const target = world.getComponent<Position>(gatherer.targetResourceId, 'position');
          const resource = world.getComponent<ResourceComponent>(gatherer.targetResourceId, 'resource');
          if (!target || !resource) continue;
          targetsObserved += 1;
          const haul = probe.haulAt(target);
          const miss = { tick, owner, villager: id, target: gatherer.targetResourceId, haul, gap: 0 };
          if (!Number.isFinite(haul)) {
            unreachable.push(miss);
            continue;
          }
          const gap = best.gapFor(resource, haul);
          if (gap > GAP_CELLS) misses.push({ ...miss, gap });
        }
      }
    }

    const describe = (list: Miss[]): string => list
      .map((m) => `t${String(m.tick)} o${String(m.owner)} villager ${String(m.villager)} -> tree ${String(m.target)} haul ${String(m.haul)} (${String(m.gap)} beyond the best available)`)
      .join('\n');
    expect(targetsObserved, 'too few wood targets were seen for this check to have run').toBeGreaterThanOrEqual(MIN_TARGETS_OBSERVED);
    expect(unreachable, `wood villagers were sent to trees no drop-off can reach:\n${describe(unreachable)}`).toEqual([]);
    expect(misses, `wood villagers walk further than the ranking's own rules allow:\n${describe(misses)}`).toEqual([]);
  }, 120_000);
});
