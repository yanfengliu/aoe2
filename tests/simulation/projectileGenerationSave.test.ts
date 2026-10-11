// A shot in the air across a save (spec §10.4; defect register, "A stone aimed
// at a deleted House hit the foundation that took its id", 2026-10-11).
//
// A save written now carries each in-flight shot's shooter and target
// generation in the projectile slot (`projectilesCodec`), so the loaded shot
// still tells its target from an entity that takes the target's id. A save
// written before has shots with neither. The loader takes them as written, and
// such a shot resolves by bare id, as every shot did when it was saved. That is
// the bound, and the second describe pins it: for the rest of its flight the
// old shot can still land on an entity that took its target's id. Every shot
// loosed after the load carries both generations.
//
// BOUND: schema-2 saves. Schema 1 was last written on 2026-05-04 (e25e1454)
// and shots first flew on 2026-08-18 (7e3d206f), so no schema-1 save holds a
// shot in the air. One scene, a Mangonel's stone at a House; the class of
// entities a shot names is `projectileNamedEntities.test.ts`.

import { describe, expect, it } from 'vitest';

import { projectilesCodec } from '../../src/game/simulation/bridge/bridgeStateSerialize';
import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import type { SaveBlob } from '../../src/game/simulation/saveSchema';
import {
  buildingAtHouseSpot,
  buildingHp,
  holdFire,
  landShot,
  replaceHouse,
  STONE_SEED,
  stoneAtHouse,
} from './stoneAtDeletedHouse.helpers';

type WrittenShot = Record<string, unknown> & { id: number };

function writtenShots(save: SaveBlob): WrittenShot[] {
  const state = (save.worldSnapshot as unknown as { state: Record<string, { inFlight: WrittenShot[] }> }).state;
  return state[projectilesCodec.slot]!.inFlight;
}

/** The same save, as one written before shots carried generations. */
function withoutGenerations(save: SaveBlob): SaveBlob {
  const old = structuredClone(save);
  for (const shot of writtenShots(old)) {
    delete shot.attackerGeneration;
    delete shot.targetGeneration;
  }
  return old;
}

/** Saves with the Mangonel's stone in the air at the House. With
 *  `recycledTarget`, the House is first replaced by a foundation on its id,
 *  so the stone's target stands at generation 1: a shot that stored a wrong
 *  generation would be right by accident on the fixture's own generation 0. */
function saveMidFlight(options: { recycledTarget?: boolean } = {}) {
  const bridge = createSimulationBridge(STONE_SEED);
  if (options.recycledTarget) {
    holdFire(bridge);
    replaceHouse(bridge.world, () => bridge.step(100), buildingAtHouseSpot(bridge.world)!);
  }
  const scene = stoneAtHouse(bridge);
  if (options.recycledTarget) {
    expect(bridge.world.getEntityRef(scene.house)!.generation, 'the premise: the target stands on a recycled id').toBeGreaterThan(0);
  }
  const save = structuredClone(bridge.saveGame());
  expect(save.schema, 'the premise: a save written now is schema 2').toBe(2);
  return { bridge, ...scene, save };
}

describe('a shot in the air across a save', () => {
  it('is written with its shooter\'s and its target\'s generation, and loads with them', () => {
    const { bridge, house, mangonel, shot, save } = saveMidFlight({ recycledTarget: true });
    const written = writtenShots(save).find((s) => s.id === shot.id)!;
    expect(written.attackerGeneration).toBe(bridge.world.getEntityRef(mangonel)!.generation);
    expect(written.targetGeneration).toBe(bridge.world.getEntityRef(house)!.generation);
    const loaded = createSimulationBridge(STONE_SEED, { savedGame: save });
    expect(loaded.getInFlightProjectiles()).toEqual(bridge.getInFlightProjectiles());
  });

  it('still lands on the target it was aimed at after the load, here a foundation on a recycled id', () => {
    const { house, shot, save } = saveMidFlight({ recycledTarget: true });
    const loaded = createSimulationBridge(STONE_SEED, { savedGame: save });
    const hpBefore = buildingHp(loaded.world, house)!;
    landShot(loaded.world, () => loaded.step(100), shot);
    expect(buildingHp(loaded.world, house)!, 'the loaded stone missed the foundation it was aimed at').toBeLessThan(hpBefore);
    expect(loaded.getRecentPlayerHits().some((blow) => blow.targetId === house), 'no blow was recorded on the foundation').toBe(true);
  });

  it('still tells its target from a foundation that takes the target\'s id after the load', () => {
    const { house, shot, save } = saveMidFlight();
    const loaded = createSimulationBridge(STONE_SEED, { savedGame: save });
    const step = () => loaded.step(100);
    const foundation = replaceHouse(loaded.world, step, house, shot);
    const hpBefore = buildingHp(loaded.world, foundation)!;
    landShot(loaded.world, step, shot);
    expect(buildingHp(loaded.world, foundation), 'the loaded stone hit the foundation that took its target\'s id')
      .toBeGreaterThanOrEqual(hpBefore);
  });
});

describe('a save written before shots carried generations', () => {
  it('loads its shot in the air as written, and the stone lands on the House it was aimed at', () => {
    const { house, shot, save } = saveMidFlight();
    const loaded = createSimulationBridge(STONE_SEED, { savedGame: withoutGenerations(save) });
    const restored = loaded.getInFlightProjectiles().find((s) => s.id === shot.id);
    expect(restored, 'the shot did not survive the load').toBeDefined();
    expect(Object.keys(restored!).filter((key) => key.endsWith('Generation')), 'the loader gave the old shot a generation').toEqual([]);
    const hpBefore = buildingHp(loaded.world, house)!;
    landShot(loaded.world, () => loaded.step(100), shot);
    expect(buildingHp(loaded.world, house)!, 'the old stone missed the House it was aimed at').toBeLessThan(hpBefore);
  });

  it('BOUND: resolves the old shot by bare id, so it still lands on a foundation that takes its target\'s id', () => {
    const { house, shot, save } = saveMidFlight();
    const loaded = createSimulationBridge(STONE_SEED, { savedGame: withoutGenerations(save) });
    const step = () => loaded.step(100);
    const foundation = replaceHouse(loaded.world, step, house, shot);
    const hpBefore = buildingHp(loaded.world, foundation)!;
    landShot(loaded.world, step, shot);
    expect(buildingHp(loaded.world, foundation)!, 'the old stone no longer resolves by bare id: update the bound in spec §10.4')
      .toBeLessThan(hpBefore);
  });

  it('gives the next shot loosed after the load both generations', () => {
    const { house, mangonel, shot, save } = saveMidFlight();
    const loaded = createSimulationBridge(STONE_SEED, { savedGame: withoutGenerations(save) });
    let next = loaded.getInFlightProjectiles().find((s) => s.attackerId === mangonel && s.id !== shot.id);
    for (let n = 0; n < 300 && !next; n += 1) {
      loaded.step(100);
      next = loaded.getInFlightProjectiles().find((s) => s.attackerId === mangonel && s.id !== shot.id);
    }
    expect(next, 'the Mangonel loosed no second stone at the House in 300 ticks').toBeDefined();
    expect(next!.attackerGeneration).toBe(loaded.world.getEntityRef(mangonel)!.generation);
    expect(next!.targetGeneration).toBe(loaded.world.getEntityRef(house)!.generation);
  }, 30_000);
});
