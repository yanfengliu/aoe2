// The AI's lumber camp has to REACH the woodline of every map that ships.
//
// BOUND: this reads the real generated spawns of every seed in `PLAYABLE_MAPS`
// at both player starts, and it checks the ANCHOR — where the AI aims the
// camp — not where the placement search finally puts it, which lands one to
// two cells further out. It says nothing about a map added outside that
// roster, and nothing about the camp the AI builds SECOND (there is none; see
// the register entry).
//
// NOMAD IS MEASURED AGAINST A TOWN CENTRE IT DOES NOT HAVE. A nomad start
// carries a `townCenter` field but the scenario spawns none, so in play
// `aiSystemBuildingPhase` anchors the bootstrap camp at the BUILDER'S FEET
// instead. That case therefore proves the map has a woodline in range of the
// nominal start, and nothing about where nomad's first camp actually goes.
// (Found by a critic.)
//
// What it caught, 2026-09-03: `DROP_OFF_ANCHOR_RADIUS` was 12, and
// `paintWoodlines` keeps every woodline at least 14 cells from every start so
// a patch cannot punch a hole in Arena's or Fortress's wall. Those two bounds
// are incompatible by construction, so on arena, fortress and gold-rush the
// anchor was null at BOTH starts, the camp went up beside the Town Centre, and
// the nearest tree to any wood drop-off stayed 15-16 cells away for the whole
// match. Measured on arena: 19.6 villagers assigned to wood, 3.0 of them
// actually chopping, and 24 of 346 trees eaten in 30,000 ticks.

import { describe, expect, it } from 'vitest';

import type { Position } from 'civ-engine';

import { MIN_START_GAP } from '../../src/game/simulation/mapGeneration/seedForestTrees';
import { PLAYABLE_MAPS } from '../../src/game/simulation/mapGeneration/playableMaps';
import { createPrototypeScenario } from '../../src/game/simulation/prototypeScenario';
import {
  DROP_OFF_ANCHOR_RADIUS,
  dropOffAnchorFor,
} from '../../src/game/simulation/bridge/systems/dropOffAnchor';
import type { ScenarioSpawnSpec } from '../../src/game/simulation/prototypeScenario';

const manhattan = (a: Position, b: Position): number =>
  Math.abs(a.x - b.x) + Math.abs(a.y - b.y);

/** A world shim over a scenario's resource spawns — the same three calls
 *  `dropOffAnchorFor` makes, answered from the map the game actually ships. */
function worldOverSpawns(spawns: readonly ScenarioSpawnSpec[]) {
  // Every spawn is offered; the anchor's own `amount <= 0` and kind filters
  // drop the units and buildings, which carry no amount.
  const byId = new Map(spawns.map((spawn, index) => [index + 1, spawn]));
  return {
    query: (...components: string[]) => (
      components.includes('resource') ? [...byId.keys()] : []
    ),
    getComponent: (id: number, kind: string) => {
      const spawn = byId.get(id);
      if (!spawn) return undefined;
      if (kind === 'position') return { x: spawn.x, y: spawn.y };
      if (kind === 'resource') {
        return { resourceType: spawn.kind, amount: (spawn as { amount?: number }).amount ?? 0 };
      }
      return undefined;
    },
  };
}

describe('the AI can anchor a lumber camp on every map it ships', () => {
  for (const { seed, label } of PLAYABLE_MAPS) {
    it(`finds ${label}'s woodline from every start`, () => {
      const scenario = createPrototypeScenario(seed);
      const world = worldOverSpawns(scenario.spawns);
      const treeCount = scenario.spawns.filter((s) => s.kind === 'tree').length;
      expect(treeCount, `${label} has no trees at all`).toBeGreaterThan(0);

      for (const start of scenario.starts) {
        const townCentre = start.townCenter;
        const anchor = dropOffAnchorFor(world as never, 'lumber-camp', townCentre);
        expect(
          anchor,
          `${label}: no woodline within ${String(DROP_OFF_ANCHOR_RADIUS)} of the start at `
          + `(${String(townCentre.x)},${String(townCentre.y)}) — the camp would go up beside `
          + 'the Town Centre and every load would be carried the whole way',
        ).not.toBeNull();
        // And it is the woodline, not some tree the search happened to reach:
        // the anchor must be the NEAREST tree to the start.
        const nearestTree = Math.min(...scenario.spawns
          .filter((s) => s.kind === 'tree')
          .map((s) => manhattan({ x: s.x, y: s.y }, townCentre)));
        expect(manhattan(anchor!, townCentre)).toBe(nearestTree);
      }
    });
  }

  it('reaches past the gap every walled map keeps between a start and its trees', () => {
    // The two constants are set in different files for different reasons and
    // were incompatible for as long as both existed. `paintWoodlines` holds
    // its patches MIN_START_GAP EUCLIDEAN cells clear of every start; the
    // anchor measures in manhattan, where the same gap is up to sqrt(2) times
    // larger. A radius under that cannot see those woodlines from any start,
    // whatever the maps happen to look like today — so this fails when EITHER
    // constant moves, not only when a shipped map changes.
    expect(DROP_OFF_ANCHOR_RADIUS)
      .toBeGreaterThanOrEqual(Math.ceil(MIN_START_GAP * Math.SQRT2));
  });
});
