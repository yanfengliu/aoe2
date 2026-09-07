// A building's health bar is its construction progress bar, and full means
// finished. Found by the standing loop playing the game: a Mill read
// `currentHp: 1000, maxHp: 1000` while it was still drawn as a foundation,
// still refused to work, and still counted 0 toward the Feudal advance — for
// more than 11,600 ticks with no way out and nothing saying why.
//
// The mechanism is that health and completion were two INDEPENDENT
// accumulators. `builderWorkStep` credited each builder a full
// `(maxHp - startHp) / totalBuildTicks` of health per tick while crediting
// progress on AoE2's crew curve — a full share for the first builder that
// tick and a third for each of the rest. So an n-builder crew filled health
// `3n / (n + 2)` times faster than it filled progress: 1.8x at three
// builders, 2.7x at eighteen. Health saturated first and then, being clamped
// at `maxHp`, said nothing at all for the rest of the build.
//
// These cases are about the CLASS, not the Mill: every case here is driven
// through the player's own commands (place, order, walk away) and reads the
// numbers the player reads — the renderer's `currentHp`/`maxHp` and the Town
// Centre's own age-up refusal text.
//
// BOUND — what a green run here does NOT prove:
//   * One map: the flat all-grass `multi-villager-construction-fixture`,
//     owner 1, AI disabled, Dark Age, Britons, no build-rate technology and
//     no Incas/Spanish/Treadmill multiplier. A civilization or technology
//     multiplier changes the progress rate and is NOT exercised here.
//   * Four building types spanning two footprints (house/mill/lumber-camp
//     2x2, barracks 3x3) and crew sizes 1 and 5. Eighteen builders — the size
//     the reported match used — is not reachable on this fixture, so the
//     ratio is measured at its SMALLEST, not its worst.
//   * Health is read from `getRenderState()`, which is what the renderer and
//     the selection panel draw from. It does not prove any pixel was drawn.
//   * The invariant is sampled once per tick. A state that exists only
//     between two systems inside one tick is invisible to it.
//   * Nothing here covers a foundation that takes DAMAGE while being built,
//     nor a save/load round trip, nor an age or technology that raises
//     `maxHp` mid-construction.
//   * It says nothing about WHY a crew might stop working a site — only that
//     while a site is unfinished, its health bar says so.

import { describe, expect, it } from 'vitest';

import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import { selectOwnedBuildingDirect } from './createSimulationBridge.helpers';
import type { BuildableBuildingType } from '../../src/game/simulation/types';

type Bridge = ReturnType<typeof createSimulationBridge>;

const FIXTURE = 'multi-villager-construction-fixture';
const OWNER = 1;
/** Far corner of the all-grass fixture, clear of every anchor below. */
const AWAY = { x: 30, y: 30 };

function villagerIds(bridge: Bridge): number[] {
  return bridge
    .getEconomyState()
    .units.filter((unit) => unit.owner === OWNER && unit.unitType === 'villager')
    .map((unit) => unit.id);
}

function siteState(bridge: Bridge, id: number) {
  const building = bridge.getEconomyState().buildings.find((entry) => entry.id === id);
  const view = bridge.getRenderState().entities.find((entry) => entry.id === id);
  expect(building, `building ${id} vanished`).toBeDefined();
  expect(view, `building ${id} has no render entity`).toBeDefined();
  // A building the renderer cannot give a health reading for is the same
  // failure as a wrong reading, so it fails here rather than being skipped.
  expect(view!.currentHp, `building ${id} has no currentHp to draw`).not.toBeNull();
  expect(view!.maxHp, `building ${id} has no maxHp to draw`).not.toBeNull();
  return {
    isComplete: building!.isComplete,
    progress: building!.buildProgressTicks,
    total: building!.totalBuildTicks,
    currentHp: view!.currentHp as number,
    maxHp: view!.maxHp as number,
    variant: view!.visualVariant,
  };
}

/** Places `buildingType` at `anchor` with `crew` villagers selected, which is
 *  also the order that sets them building. Returns the foundation's id. */
function placeWithCrew(
  bridge: Bridge,
  buildingType: BuildableBuildingType,
  anchor: { x: number; y: number },
  crew: number,
): number {
  const ids = villagerIds(bridge).slice(0, crew);
  expect(ids, `fixture must have ${crew} villagers`).toHaveLength(crew);
  expect(bridge.selectUnitsByIds(ids)).toBe(true);
  expect(bridge.beginBuildingPlacement(buildingType)).toBe(true);
  expect(
    bridge.confirmBuildingPlacement(anchor.x, anchor.y),
    `${buildingType} must be placeable at (${anchor.x},${anchor.y}) on this fixture`,
  ).toBe(true);
  bridge.step(100);
  const site = bridge
    .getEconomyState()
    .buildings.find(
      (building) =>
        building.owner === OWNER
        && building.buildingType === buildingType
        && building.x === anchor.x
        && building.y === anchor.y,
    );
  expect(site, `${buildingType} foundation missing at (${anchor.x},${anchor.y})`).toBeDefined();
  return site!.id;
}

/** `have` as the Town Centre's own Feudal refusal reports it to the player. */
function feudalRefusalCount(bridge: Bridge): number {
  expect(selectOwnedBuildingDirect(bridge, OWNER, 'town-center')).toBe(true);
  const blocked = bridge
    .getSelectionState()
    .unavailableCommands.find((entry) => entry.kind === 'research' && entry.id === 'feudal-age');
  expect(blocked, 'the Town Centre must say why Feudal is refused').toBeDefined();
  const match = /You have (\d+)\./.exec(blocked!.reason);
  expect(match, `unrecognised refusal text: ${blocked!.reason}`).not.toBeNull();
  return Number(match![1]);
}

const CASES: Array<{
  buildingType: BuildableBuildingType;
  anchor: { x: number; y: number };
}> = [
  { buildingType: 'house', anchor: { x: 14, y: 14 } },
  { buildingType: 'mill', anchor: { x: 14, y: 18 } },
  { buildingType: 'lumber-camp', anchor: { x: 18, y: 14 } },
  { buildingType: 'barracks', anchor: { x: 5, y: 20 } },
];

describe('a building at full health is a finished building', () => {
  // The defect's own shape, swept over every case and both crew sizes. One
  // builder never produced it (health and progress advanced in lockstep), so
  // the single-builder arm is the CONTROL that says the sweep is measuring
  // the crew and not the fixture.
  it.each(CASES)(
    'a $buildingType is never at full health while it is still a foundation',
    ({ buildingType, anchor }) => {
      for (const crew of [1, 5]) {
        const bridge = createSimulationBridge(FIXTURE);
        const siteId = placeWithCrew(bridge, buildingType, anchor, crew);
        const total = siteState(bridge, siteId).total;

        let completedAt = -1;
        for (let tick = 1; tick <= total * 3 + 400 && completedAt < 0; tick += 1) {
          bridge.step(100);
          const state = siteState(bridge, siteId);
          if (state.isComplete) {
            completedAt = tick;
            // Finishing means a full bar, in the same reading.
            expect(
              state.currentHp,
              `${buildingType} (crew ${crew}) completed at ${state.currentHp}/${state.maxHp}`,
            ).toBeGreaterThanOrEqual(state.maxHp);
            break;
          }
          expect(
            state.currentHp < state.maxHp,
            `${buildingType} (crew ${crew}) tick ${tick}: health bar reads full `
            + `(${state.currentHp}/${state.maxHp}, variant "${state.variant}") while the site is `
            + `only ${state.progress.toFixed(1)}/${state.total} built`,
          ).toBe(true);
        }
        expect(completedAt, `${buildingType} (crew ${crew}) never completed`).toBeGreaterThan(0);
      }
    },
  );

  // The second half of the same claim: the bar is not merely "not full", it
  // is the progress bar. A player who reads it half full is looking at a site
  // that is half built, whatever the crew size.
  it.each(CASES)(
    "a crew building a $buildingType keeps the health bar on the site's real progress",
    ({ buildingType, anchor }) => {
      const bridge = createSimulationBridge(FIXTURE);
      const siteId = placeWithCrew(bridge, buildingType, anchor, 5);
      const total = siteState(bridge, siteId).total;
      let sampled = 0;

      for (let tick = 1; tick <= total * 3 + 400; tick += 1) {
        bridge.step(100);
        const state = siteState(bridge, siteId);
        if (state.isComplete) break;
        if (state.progress <= 0) continue;
        sampled += 1;
        const startHp = Math.max(1, Math.floor(state.maxHp * 0.1));
        const healthFraction = (state.currentHp - startHp) / (state.maxHp - startHp);
        const builtFraction = state.progress / state.total;
        expect(
          Math.abs(healthFraction - builtFraction),
          `${buildingType} tick ${tick}: bar reads ${(healthFraction * 100).toFixed(1)}% `
          + `(${state.currentHp}/${state.maxHp}) on a site that is `
          + `${(builtFraction * 100).toFixed(1)}% built (${state.progress.toFixed(1)}/${state.total})`,
        ).toBeLessThan(0.02);
      }
      expect(sampled, 'no tick was ever sampled — the site never started').toBeGreaterThan(10);
    },
  );

  // The state the reported match sat in for an hour and a half: a site with
  // no builders left on it. It must not read as finished, and it must read as
  // what it is.
  it('a foundation everyone walked away from does not read as a finished building', () => {
    const bridge = createSimulationBridge(FIXTURE);
    const siteId = placeWithCrew(bridge, 'mill', { x: 14, y: 18 }, 5);

    // Build for a while, then send the whole crew to the far corner.
    for (let tick = 0; tick < 200; tick += 1) {
      bridge.step(100);
      if (siteState(bridge, siteId).isComplete) break;
    }
    const working = siteState(bridge, siteId);
    expect(working.isComplete, 'the crew finished too early to stall — shorten the window').toBe(false);
    expect(working.progress).toBeGreaterThan(0);

    expect(bridge.selectUnitsByIds(villagerIds(bridge))).toBe(true);
    expect(bridge.issueMoveCommand(AWAY.x, AWAY.y)).toBe(true);
    for (let tick = 0; tick < 400; tick += 1) bridge.step(100);

    const stalled = siteState(bridge, siteId);
    expect(stalled.isComplete, 'the abandoned site must not have completed itself').toBe(false);
    expect(
      stalled.currentHp < stalled.maxHp,
      `an abandoned foundation reads ${stalled.currentHp}/${stalled.maxHp} — a full bar on a site `
      + `that is ${stalled.progress.toFixed(1)}/${stalled.total} built and has nobody on it`,
    ).toBe(true);
    // And it is distinguishable from a finished one by the number, not just
    // by the scaffold: the bar stands where the work stopped.
    const startHp = Math.max(1, Math.floor(stalled.maxHp * 0.1));
    expect((stalled.currentHp - startHp) / (stalled.maxHp - startHp)).toBeCloseTo(
      stalled.progress / stalled.total,
      2,
    );
  });

  // The third face of the same defect, and the one that cost the match: the
  // age-up requirement counts `isComplete`, so a player reading full health
  // bars was told they owned none of the buildings they were looking at.
  it('the Feudal requirement counts every building whose health bar reads full', () => {
    const bridge = createSimulationBridge(FIXTURE);
    const millId = placeWithCrew(bridge, 'mill', { x: 14, y: 18 }, 5);
    const total = siteState(bridge, millId).total;

    let sawFullBar = false;
    for (let tick = 1; tick <= total * 3 + 400; tick += 1) {
      bridge.step(100);
      const state = siteState(bridge, millId);
      const barIsFull = state.currentHp >= state.maxHp;
      if (!barIsFull) continue;
      sawFullBar = true;
      expect(
        feudalRefusalCount(bridge),
        `tick ${tick}: the Mill's bar reads ${state.currentHp}/${state.maxHp} but the Town Centre `
        + `counts it as nothing — "${
          bridge
            .getSelectionState()
            .unavailableCommands.find((entry) => entry.id === 'feudal-age')?.reason ?? '(no reason)'
        }"`,
      ).toBeGreaterThanOrEqual(1);
      // Re-select the crew's site view for the next tick's reading.
      if (state.isComplete) break;
    }
    expect(sawFullBar, 'the Mill never reached a full bar — the run was too short').toBe(true);
  });
});
