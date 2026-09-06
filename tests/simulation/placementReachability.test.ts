// A placement the game ACCEPTS must be one a builder can walk to, and every
// anchor the game SUGGESTS must satisfy the same test (defect register
// 2026-09-06).
//
// Before the fix, `isPlacementBlocked` asked only whether the footprint's cells
// were free. A site inside a forest pocket previewed GREEN, the click was
// accepted, the wood was spent, and `playerCommandsSystem` then got null from
// `findBuildingApproachPlan` and cleared the build command in the same tick:
// idle villager, foundation at 0/200 forever, no message, no refund. The
// stranded foundations are solid obstacles, so a player who keeps placing seals
// their own base in — measured in one match at eight sites and 440 wood, with
// the reachable area falling from 1,353 cells to 106.
//
// WHAT A GREEN RUN HERE DOES NOT PROVE — the bounds, every one of them load-
// bearing:
//
//  * ONE map at ONE tick. `aoe2-prototype`, 60x36 = 2,160 cells, tick 600, two
//    players, the human's three starting villagers. Nothing here speaks for
//    another seed, for the §4 ladder's larger maps, or for a late-game world.
//  * LAND builders only. The water domain (a Fishing Ship putting up a Fish
//    Trap) runs the same code and is not exercised.
//  * The sweep's instrument is `staticGridOf` from the playtest walk probe —
//    an INDEPENDENT rebuild of land passability from world components, chosen
//    because a check built from the same symbol as the thing it checks proves
//    only that the code agrees with itself. Its one documented difference is
//    that a finished GATE is a wall to it and a door to its owner, so the
//    sweep asserts the human owns no complete gate at tick 600; if that ever
//    stops being true the sweep is measuring something else and says so.
//  * The A*/labelling equivalence this fix rests on is exact for a
//    4-connected uniform-cost grid, but `findGridPath` also gives up after
//    `maxIterations` (10,000 by default). At 2,160 cells a failing search
//    pushes at most ~8,641 entries, so it cannot bail here. On the ladder's
//    8-player map (116x72 = 8,352 cells) it can, and then A* may report
//    unreachable where this check says reachable. Untested, and the reason the
//    map size is asserted rather than assumed.
//  * Footprints 1x1 (palisade gate) and 2x2 (house) only, and only the 1x1
//    sweep actually detects anything: every unreachable pocket on this fixture
//    is a single cell, so the 2x2 arm is a control against over-refusal.
//    Bigger footprints share the ring helper but are not swept.

import { describe, expect, it } from 'vitest';

import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import { staticGridOf } from '../../src/game/playtest/walkDistanceProbe';

type Bridge = ReturnType<typeof createSimulationBridge>;
type Cell = { x: number; y: number };

const HUMAN = 1;
const TICK = 600;

function bootedBridge(): Bridge {
  const bridge = createSimulationBridge('aoe2-prototype');
  for (let i = 0; i < TICK; i += 1) bridge.step(100);
  return bridge;
}

function humanVillagers(bridge: Bridge) {
  return bridge.getEconomyState().units
    .filter((unit) => unit.owner === HUMAN && unit.unitType === 'villager');
}

function selectFirstVillager(bridge: Bridge): Cell {
  const villager = humanVillagers(bridge)[0];
  expect(villager, 'fixture moved: the human has no villager at tick 600').toBeDefined();
  expect(bridge.selectUnitsByIds([villager!.id])).toBe(true);
  return { x: villager!.x, y: villager!.y };
}

/** Cells a human villager can stand on, flood-filled with the INDEPENDENT
 *  probe rather than with the code under test. */
function reachableCells(bridge: Bridge): Uint8Array {
  const { width, height } = bridge.world.grid;
  const grid = staticGridOf(bridge.world);
  const seen = new Uint8Array(width * height);
  const queue: number[] = [];
  for (const villager of humanVillagers(bridge)) {
    const index = villager.y * width + villager.x;
    if (!seen[index]) { seen[index] = 1; queue.push(index); }
  }
  for (let head = 0; head < queue.length; head += 1) {
    const index = queue[head]!;
    const x = index % width;
    const y = (index - x) / width;
    for (const [nx, ny] of [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]] as const) {
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
      const next = ny * width + nx;
      if (seen[next] || grid.blocked[next]) continue;
      seen[next] = 1;
      queue.push(next);
    }
  }
  return seen;
}

/** Whether a builder could stand beside a footprint at `anchor`, per the
 *  independent flood. */
function ringReachable(
  bridge: Bridge,
  seen: Uint8Array,
  anchor: Cell,
  width: number,
  height: number,
): boolean {
  const { width: mapWidth, height: mapHeight } = bridge.world.grid;
  for (let x = anchor.x; x < anchor.x + width; x += 1) {
    for (const y of [anchor.y - 1, anchor.y + height]) {
      if (x >= 0 && y >= 0 && x < mapWidth && y < mapHeight && seen[y * mapWidth + x] === 1) return true;
    }
  }
  for (let y = anchor.y; y < anchor.y + height; y += 1) {
    for (const x of [anchor.x - 1, anchor.x + width]) {
      if (x >= 0 && y >= 0 && x < mapWidth && y < mapHeight && seen[y * mapWidth + x] === 1) return true;
    }
  }
  return false;
}

describe('placement reachability — a builder has to be able to get there', () => {
  it('the fixture is the one these bounds describe', () => {
    const bridge = bootedBridge();
    expect(bridge.getMapSize()).toEqual({ width: 60, height: 36 });
    expect(bridge.getHudState().tick).toBe(TICK);
    expect(humanVillagers(bridge).length).toBeGreaterThan(0);
    // The independent probe calls a finished gate a wall; if the human owned
    // one, the sweep below would be measuring a different question.
    const gates = bridge.getEconomyState().buildings.filter(
      (building) => building.owner === HUMAN && building.buildingType.includes('gate'),
    );
    expect(gates, 'human owns a gate: the independent flood no longer matches').toEqual([]);
  });

  // The named regression case. The report's own cell, (12,9), is REACHABLE on a
  // fresh boot — the stranding it produced in that match needed the earlier
  // foundations of the same run to have sealed the base first, which is the
  // chain case below. Kept as the control half: the fix must not refuse it.
  it('regression (12,9): the reported palisade gate is reachable, and still builds', () => {
    const bridge = bootedBridge();
    selectFirstVillager(bridge);
    expect(bridge.beginBuildingPlacement('palisade-gate')).toBe(true);
    expect(bridge.getPlacementPreview(12, 9)?.isValid).toBe(true);
    const woodBefore = bridge.getHudState().playerResources.wood;
    expect(bridge.confirmBuildingPlacement(12, 9)).toBe(true);
    for (let i = 0; i < 400; i += 1) bridge.step(100);
    expect(bridge.getHudState().playerResources.wood).toBeLessThan(woodBefore);
    const gate = bridge.getEconomyState().buildings.find(
      (building) => building.owner === HUMAN && building.x === 12 && building.y === 9,
    );
    expect(gate?.buildProgressTicks ?? 0).toBeGreaterThan(0);
  });

  // The defect itself, at a cell measured on this fixture: the footprint is
  // clear, and no villager can walk to it.
  it('refuses a site no builder can walk to, and says why', () => {
    const bridge = bootedBridge();
    selectFirstVillager(bridge);
    expect(bridge.beginBuildingPlacement('palisade-gate')).toBe(true);

    // The ghost goes red.
    expect(bridge.getPlacementPreview(6, 13)?.isValid).toBe(false);

    const woodBefore = bridge.getHudState().playerResources.wood;
    expect(bridge.confirmBuildingPlacement(6, 13)).toBe(false);
    bridge.step(100);

    // Nothing was charged and nothing was founded.
    expect(bridge.getHudState().playerResources.wood).toBe(woodBefore);
    expect(bridge.getEconomyState().buildings.some(
      (building) => building.x === 6 && building.y === 13,
    )).toBe(false);

    // Error messages are a product surface: the refusal names the building,
    // the cell, and the reason — not a bare "Cannot build here."
    const message = bridge.consumeCommandRejection();
    expect(message).toContain('palisade-gate (1x1) at (6,13)');
    expect(message).toContain('no builder can walk to a cell beside it');
    expect(message).toContain('Nearest open ground a builder can reach:');
    expect(message).not.toBe('Cannot build here.');
  });

  it('every cell the preview calls valid is one a villager can reach', () => {
    const bridge = bootedBridge();
    selectFirstVillager(bridge);
    const seen = reachableCells(bridge);
    const { width, height } = bridge.world.grid;

    for (const [type, footprint, floor] of [
      ['palisade-gate', { width: 1, height: 1 }, 1_200],
      ['house', { width: 2, height: 2 }, 550],
    ] as const) {
      expect(bridge.beginBuildingPlacement(type)).toBe(true);
      const stranded: Cell[] = [];
      let valid = 0;
      for (let y = 0; y < height; y += 1) {
        for (let x = 0; x < width; x += 1) {
          const preview = bridge.getPlacementPreview(x, y);
          if (preview?.isValid !== true) continue;
          valid += 1;
          if (!ringReachable(bridge, seen, { x, y }, footprint.width, footprint.height)) {
            stranded.push({ x, y });
          }
        }
      }
      expect(stranded, `${type}: previewed valid but no villager can reach`).toEqual([]);
      // The other direction of the same rule: a check that refuses everything
      // would also pass the line above. Measured on this fixture — palisade
      // gate 1,396 valid anchors before the fix and 1,386 after, exactly the 10
      // stranded 1x1 cells; house 660 both before and after, because none of
      // the pockets is two cells wide. So the HOUSE arm is a control that the
      // fix took nothing away, not a second instance of the defect.
      expect(valid, `${type}: the fix refused nearly everything`).toBeGreaterThan(floor);
    }
  });

  it('the nearest-open-ground suggestion is ground a villager can walk to', () => {
    const bridge = bootedBridge();
    selectFirstVillager(bridge);
    // Judged with the INDEPENDENT flood. Asking the game's own preview whether
    // it likes its own suggestion is a check that agrees with itself: before
    // the fix the preview said yes to every one of these, including the four
    // that named the unreachable pocket at (6,13) and (3,12).
    const seen = reachableCells(bridge);
    // Blocked cells around the forest pocket at (6,13) and (3,12): before the
    // fix, four of these twelve refusals named an unreachable cell.
    const probes: Cell[] = [
      { x: 6, y: 12 }, { x: 6, y: 14 }, { x: 5, y: 13 }, { x: 7, y: 13 },
      { x: 3, y: 11 }, { x: 3, y: 13 }, { x: 5, y: 14 }, { x: 5, y: 16 },
      { x: 0, y: 8 }, { x: 0, y: 10 }, { x: 17, y: 17 }, { x: 17, y: 19 },
    ];
    let suggestionsSeen = 0;
    for (const probe of probes) {
      expect(bridge.beginBuildingPlacement('palisade-gate')).toBe(true);
      expect(
        bridge.getPlacementPreview(probe.x, probe.y)?.isValid,
        `(${probe.x},${probe.y}) is no longer blocked: pick another probe`,
      ).toBe(false);
      bridge.confirmBuildingPlacement(probe.x, probe.y);
      const message = bridge.consumeCommandRejection() ?? '';
      const match = /\((\d+),(\d+)\)\.$/.exec(message);
      if (!match) continue;
      suggestionsSeen += 1;
      const anchor = { x: Number(match[1]), y: Number(match[2]) };
      expect(
        ringReachable(bridge, seen, anchor, 1, 1),
        `suggested (${anchor.x},${anchor.y}) for (${probe.x},${probe.y}): no villager can walk there`,
      ).toBe(true);
      expect(bridge.beginBuildingPlacement('palisade-gate')).toBe(true);
      expect(
        bridge.getPlacementPreview(anchor.x, anchor.y)?.isValid,
        `suggested (${anchor.x},${anchor.y}) for (${probe.x},${probe.y}), which the game itself refuses`,
      ).toBe(true);
    }
    expect(suggestionsSeen, 'no refusal offered a suggestion: the probes moved').toBeGreaterThan(8);
  });

  // The chain the reported match actually walked into: each accepted
  // foundation is a solid obstacle, so a shift-queued run of them can seal the
  // next site. Both placements validate against the world as it was BEFORE
  // either went down, so only the authoritative re-check in
  // `startConstructionWithBuildersDirect` can refuse the second.
  it('a queued chain cannot strand its own next site', () => {
    const bridge = bootedBridge();
    selectFirstVillager(bridge);
    // (10,0) and (11,0) sit in a one-cell corridor along the top edge: with
    // (10,0) built, (11,0) has no reachable approach.
    expect(bridge.beginBuildingPlacement('palisade-gate')).toBe(true);
    expect(bridge.getPlacementPreview(10, 0)?.isValid).toBe(true);
    expect(bridge.getPlacementPreview(11, 0)?.isValid).toBe(true);
    const woodBefore = bridge.getHudState().playerResources.wood;
    expect(bridge.confirmBuildingPlacement(10, 0, { queue: true })).toBe(true);
    bridge.confirmBuildingPlacement(11, 0, { queue: true });
    bridge.step(100);

    const built = (cell: Cell) => bridge.getEconomyState().buildings.find(
      (building) => building.owner === HUMAN && building.x === cell.x && building.y === cell.y,
    );
    expect(built({ x: 10, y: 0 }), 'the first site of the chain must still go down').toBeDefined();
    expect(built({ x: 11, y: 0 }), 'the sealed second site was founded anyway').toBeUndefined();
    // One gate's worth of wood, not two.
    const spent = woodBefore - bridge.getHudState().playerResources.wood;
    expect(spent).toBeGreaterThan(0);
    expect(bridge.getHudState().playerResources.wood).toBeGreaterThan(woodBefore - spent * 2);
  });
});
