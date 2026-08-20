import { expect, test } from '@playwright/test';

import { unitBaseSpeedPercent } from '../../src/game/simulation/prototypeUnitRules/unitBaseSpeed';
import { UNIT_SUBGRID_RESOLUTION, UNIT_SUBGRID_STEP_PER_TICK } from '../../src/game/simulation/bridge/pureHelpers';
import * as game from './helpers/gameTestHelpers';

test.describe('voxel unit motion', () => {
  test('keeps a selected scout continuous and facing displayed travel through a corner', async ({
    page,
  }) => {
    await game.waitForPausedBootWithSeed(page, 'double-click-selection-fixture');
    expect(await game.selectOwnedUnitDirect(page, 1, 'scout')).toBe(true);

    const selected = await page.evaluate(() => {
      const api = window.__AOE2_TEST__!;
      const id = api.getSelectionState().selectedEntityIds[0]!;
      const entity = api.getRenderState().entities.find((candidate) => candidate.id === id)!;
      return { id, identity: `${String(id)}:${String(entity.generation ?? 0)}` };
    });

    const samples = await page.evaluate(({ id, identity }) => {
      const api = window.__AOE2_TEST__!;
      const read = () => {
        const root = api.getDisplayedEntities().find((entity) => entity.id === id);
        const motion = api.inspectVoxelUnitMotion(identity);
        if (!root || !motion) throw new Error('Missing selected scout motion sample.');
        if (Math.hypot(root.x - motion.x, root.y - motion.y) > 1e-7) {
          throw new Error('Motion history is not describing the displayed root.');
        }
        return {
          x: root.x,
          y: root.y,
          heading: Math.atan2(motion.directionZ, motion.directionX),
          directionX: motion.directionX,
          directionZ: motion.directionZ,
          speed: motion.speedWorldUnitsPerSecond,
        };
      };

      if (!api.issueMoveCommand(12, 10)) throw new Error('Scout move was rejected.');
      const result = [read()];
      for (let frame = 0; frame < 84; frame += 1) {
        api.advanceTicks(1, 1_000 / 60);
        result.push(read());
      }
      return result;
    }, selected);

    const deltas = samples.slice(1).map((sample, index) => {
      const previous = samples[index]!;
      const dx = sample.x - previous.x;
      const dy = sample.y - previous.y;
      const distance = Math.hypot(dx, dy);
      return {
        dx,
        dy,
        distance,
        speed: sample.speed,
        headingDelta: Math.abs(Math.atan2(
          Math.sin(sample.heading - previous.heading),
          Math.cos(sample.heading - previous.heading),
        )),
        facingDot: distance > 1e-6
          ? (dx * sample.directionX + dy * sample.directionZ) / distance
          : null,
      };
    });
    const moving = deltas.filter((sample) => sample.distance > 1e-6);
    const firstEast = moving.findIndex((sample) => (
      sample.dx > 0.01 && Math.abs(sample.dx) > Math.abs(sample.dy) * 4
    ));
    const firstNorth = moving.findIndex((sample, index) => (
      index > firstEast
      && sample.dy < -0.01
      && Math.abs(sample.dy) > Math.abs(sample.dx) * 4
    ));

    expect(firstEast).toBeGreaterThanOrEqual(0);
    expect(firstNorth).toBeGreaterThan(firstEast);
    expect(new Set(samples.map(({ x, y }) => `${x.toFixed(6)},${y.toFixed(6)}`)).size)
      .toBeGreaterThan(40);
    expect(samples.filter(({ x, y }) => (
      Math.abs(x * 4 - Math.round(x * 4)) > 1e-4
      || Math.abs(y * 4 - Math.round(y * 4)) > 1e-4
    )).length).toBeGreaterThan(20);
    // The smoothness bound has to track the unit's speed: a Scout covers 0.75
    // cells a tick (150% of a villager) where every unit used to cover 0.5, so
    // the flat 0.1 this asserted was really "a quarter of a tick's travel" —
    // i.e. at least four rendered frames per simulation tick. Stated that way
    // it stays a real interpolation claim instead of a number tied to one
    // speed.
    const scoutTickTravel = (UNIT_SUBGRID_STEP_PER_TICK
      * (unitBaseSpeedPercent('scout') / 100)) / UNIT_SUBGRID_RESOLUTION;
    expect(Math.max(...moving.map(({ distance }) => distance)))
      .toBeLessThanOrEqual(scoutTickTravel / 4);
    expect(Math.max(...deltas.map(({ headingDelta }) => headingDelta))).toBeLessThanOrEqual(0.25);
    expect(moving.every(({ speed }) => speed > 0)).toBe(true);
    const facingDots = moving.map(({ facingDot }) => facingDot!);
    expect(Math.min(...facingDots)).toBeGreaterThan(0);
    const sortedFacingDots = [...facingDots].sort((left, right) => left - right);
    expect(sortedFacingDots[Math.floor(sortedFacingDots.length / 2)]).toBeGreaterThan(0.8);
  });
});
