// A bridge opened with `renderProjection: 'on-read'` plays the same match as
// the game's bridge and projects nothing while it steps
// (createSimulationBridgeOptions.ts).
//
// Why it exists. The render projection turns the world into what the screen
// draws, after every tick: a render diff each tick, and the whole world again
// after any change the diff cannot see. The self-play gates step 45,000 ticks
// and never draw, and on the castle match that projection was 27% of the CPU
// (scripts/profile-selfplay.mjs, 2026-09-25; register entry of that date).
// 'on-read' lets them skip it — which is only safe if the projection never
// writes to the world, so that skipping it cannot change the match.
//
// What is checked.
// (1) The same match: a fight — the garrisoned-defender fixture, where the
//     attackers swing at buildings and the Town Centre shoots from tick 1 —
//     stepped in both modes, is the same world every 250 ticks (civ-engine
//     `stateDigest` over `world.serialize()`, which covers every component
//     and every state slot, the replay slot of attack cues included). Every
//     250 ticks, not only at the end: with the attack feed pruned only where
//     the projection reads it, the two worlds differ at tick 1,000 and agree
//     again by tick 4,500, so a check at the end alone passes that mutant.
// (2) The same picture when read: at the end, `getRenderState()` and the
//     HUD's counts agree between the modes, attack animations included.
// (3) The cost is gone: an 'on-read' bridge builds no render diff and no
//     snapshot while it steps, and exactly one snapshot per read.
//
// BOUND. One fixture, 2,000 ticks; the digests prove this fight, not every
// match. The archived performance work was unfinished, so this case is the
// current proof for the option. (2) compares at one tick.

import { stateDigest, RenderAdapter } from 'civ-engine';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import { HUMAN_PLAYER_ID } from '../../src/game/simulation/prototypeScenario';

const TICKS = 2000;
const CHECK_EVERY = 250;
// TypeScript hides these methods, but the runtime methods are the actual
// expensive work that the option promises to avoid, so count those calls.
const adapterPrototype = RenderAdapter.prototype as unknown as {
  buildDiff(...args: unknown[]): unknown;
  buildSnapshot(): unknown;
};

function open(renderProjection: 'every-tick' | 'on-read') {
  return createSimulationBridge('ai-garrisoned-defender-fixture', {
    forceAiForOwners: new Set([HUMAN_PLAYER_ID]),
    renderProjection,
  });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("renderProjection: 'on-read'", () => {
  it('plays the same match as the game\'s every-tick projection, and draws the same picture when read', () => {
    const game = open('every-tick');
    const headless = open('on-read');
    const differing: number[] = [];
    let blows = 0;
    for (let tick = 1; tick <= TICKS; tick += 1) {
      game.step(100);
      headless.step(100);
      // Both read, so the probe itself treats the two alike; the hit feed is
      // transient and never written to the world.
      if (game.getRecentPlayerHits().length > 0) blows += 1;
      headless.getRecentPlayerHits();
      if (tick % CHECK_EVERY === 0
        && stateDigest(headless.world.serialize()) !== stateDigest(game.world.serialize())) {
        differing.push(tick);
      }
    }
    expect(blows, 'no blow landed, so the fight this case needs never happened').toBeGreaterThan(500);
    expect(headless.world.tick).toBe(game.world.tick);
    expect(differing, 'the two modes played different matches at these ticks').toEqual([]);

    const drawn = game.getRenderState();
    const read = headless.getRenderState();
    expect(read.entities.length, 'the read drew nothing, so nothing was compared').toBeGreaterThan(20);
    expect(read).toEqual(drawn);
    const { tickDurationMs: gameTickMs, ...gameHud } = game.getHudState();
    const { tickDurationMs: headlessTickMs, ...headlessHud } = headless.getHudState();
    void gameTickMs;
    void headlessTickMs;
    expect(headlessHud).toEqual(gameHud);
  }, 120_000);

  it('builds no render diff and no snapshot while it steps, and one snapshot per read', () => {
    const diffs = vi.spyOn(adapterPrototype, 'buildDiff');
    const snapshots = vi.spyOn(adapterPrototype, 'buildSnapshot');
    const headless = open('on-read');
    for (let tick = 0; tick < 200; tick += 1) headless.step(100);
    expect(diffs, 'an on-read bridge projected a tick').not.toHaveBeenCalled();
    expect(snapshots, 'an on-read bridge projected the world before anyone read it').not.toHaveBeenCalled();
    headless.getRenderState();
    headless.getHudState();
    expect(snapshots).toHaveBeenCalledTimes(2);
    expect(diffs).not.toHaveBeenCalled();

    // The control: the game's bridge does project every tick, so the spies
    // are wired to the adapter the bridge really uses.
    diffs.mockClear();
    const game = open('every-tick');
    for (let tick = 0; tick < 200; tick += 1) game.step(100);
    expect(diffs).toHaveBeenCalledTimes(200);
  }, 60_000);

  it('can project the next read after a projection error, and still steps without projecting', () => {
    const snapshots = vi.spyOn(adapterPrototype, 'buildSnapshot');
    const headless = open('on-read');
    snapshots.mockImplementationOnce(() => { throw new Error('broken projection'); });
    expect(() => headless.getRenderState()).toThrow('broken projection');
    headless.step(100);
    expect(snapshots).toHaveBeenCalledTimes(1);
    const recovered = headless.getRenderState();
    expect(recovered.tick).toBe(headless.world.tick);
    expect(recovered.entities.length).toBeGreaterThan(20);
    expect(snapshots).toHaveBeenCalledTimes(2);
  });
});
