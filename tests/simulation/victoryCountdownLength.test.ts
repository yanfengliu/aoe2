import { describe, expect, it } from 'vitest';

import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import {
  relicCountdownsCodec,
  researchedTechnologiesCodec,
  wonderCountdownsCodec,
} from '../../src/game/simulation/bridge/bridgeStateSerialize';
import { standardMapSize } from '../../src/game/simulation/mapGeneration/constants';
import { TPS } from '../../src/game/simulation/prototypeScenario';
import {
  ATHEISM_COUNTDOWN_EXTENSION_YEARS,
  GAME_SECONDS_PER_YEAR,
  TICKS_PER_YEAR,
  countdownYearsLeft,
  victoryCountdownTicks,
  victoryCountdownYears,
} from '../../src/game/simulation/victoryCountdown';
import { asSchema2Blob, legacySchema1FromBridge, worldStateOf } from './saveBlobTestUtils';

// Wonder and Relic victory countdowns last as long as Definitive Edition's
// (work 132). Until then a "year" was one second of game time and every
// countdown 2,000 ticks (200 seconds), five times shorter than DE's 200 years,
// which are 16:40 of game time.
//
// WHERE THE NUMBERS COME FROM. Every figure below is copied from a source, not
// derived from this repo's own constants, so a wrong constant cannot agree
// with itself:
//  - The years per map size, and the 16:40 / 9:48 durations for them, are the
//    table on the Age of Empires Series Wiki's "Wonder (Age of Empires II)"
//    page (the "Relic (Age of Empires II)" page repeats it: a Relic victory
//    runs on the same timer). It is a community table, read on 2026-10-14; no
//    official text states it (see BOUND).
//  - The map sizes, their tile dimensions and the number of players each is
//    labelled for are DE's own strings, key-value-strings-utf8.txt of the
//    installed game (ids 23120-23220): "Tiny (2 player) [120]", "Small (3
//    player) [144]", "Medium (4 player) [168]", "Normal (6 player) [200]",
//    "Large (8 player) [220]".
//  - DE's Normal game speed is 1.7x (the wiki's third row: 200 years in 9:48).
//
// BOUND. What a green run proves: the length of a countdown that opens on a
// 2-8 player map of this game's player-count ladder, the Atheism amount, a
// year's length, what a save and a replay make of a countdown, and the years
// the HUD states. What it does not: the years for map sizes this game does not
// offer (Huge and up), whether DE's table is right (one community source), and
// the game-speed presets (a separate card; the time here is game time at 1.0x).

/** The wiki's table, row by row: [map size, years, in-game time, Normal speed]. */
const WIKI_ROWS: ReadonlyArray<readonly [string, number, string, string]> = [
  ['Miniature', 100, '8:20', '4:54'],
  ['Tiny, Small, Medium', 200, '16:40', '9:48'],
  ['Normal', 300, '25:00', '14:42'],
  ['Large', 350, '29:10', '17:09'],
  ['Huge, Giant, Massive', 400, '33:20', '19:36'],
  ['Enormous, Colossal, Incredible', 450, '37:30', '22:04'],
  ['Monstrous, Ludicrous', 500, '41:40', '24:31'],
];

/** DE's lobby sizes this game's ladder reaches, with the players each is labelled for. */
const DE_SIZES: ReadonlyArray<{ name: string; side: number; players: number; years: number }> = [
  { name: 'Tiny', side: 120, players: 2, years: 200 },
  { name: 'Small', side: 144, players: 3, years: 200 },
  { name: 'Medium', side: 168, players: 4, years: 200 },
  { name: 'Normal', side: 200, players: 6, years: 300 },
  { name: 'Large', side: 220, players: 8, years: 350 },
];

const NORMAL_SPEED = 1.7;

/** The ticks a countdown opens with, by players seated, written out from the
 *  table above (years x 50) rather than computed from the rule under test. */
const OPENING_TICKS: Readonly<Record<number, number>> = {
  2: 10_000,
  3: 10_000,
  4: 10_000,
  5: 15_000,
  6: 15_000,
  7: 17_500,
  8: 17_500,
};

function clock(seconds: number): string {
  return `${String(Math.floor(seconds / 60))}:${String(seconds % 60).padStart(2, '0')}`;
}

type Bridge = ReturnType<typeof createSimulationBridge>;

interface CountdownEntry {
  remainingTicks: number;
  totalTicks: number;
  lastCompletedTick: number | null;
}

function boot(seed: string): Bridge {
  return createSimulationBridge(seed, { renderProjection: 'on-read' });
}

function wonderEntries(bridge: Bridge): Array<[number, CountdownEntry]> {
  return (worldStateOf(asSchema2Blob(bridge.saveGame()))[wonderCountdownsCodec.slot] ?? []) as Array<[number, CountdownEntry]>;
}

function relicEntries(bridge: Bridge): Array<[number, CountdownEntry]> {
  return (worldStateOf(asSchema2Blob(bridge.saveGame()))[relicCountdownsCodec.slot] ?? []) as Array<[number, CountdownEntry]>;
}

function stepTicks(bridge: Bridge, ticks: number): void {
  // Exactly `ticks`: a refused step (an ended match) fails here by name.
  expect(bridge.step((ticks * 1000) / TPS)).toEqual({ ticks, refusedBecause: null });
}

/** Steps until the match resolves; returns the world tick it did on. */
function tickTheMatchResolves(bridge: Bridge, notBefore: number, giveUpAt: number): number {
  stepTicks(bridge, notBefore - bridge.world.tick);
  expect(bridge.getMatchState().outcome, `the match was over before tick ${String(notBefore)}`).toBe('running');
  while (bridge.getMatchState().outcome === 'running' && bridge.world.tick < giveUpAt) stepTicks(bridge, 1);
  return bridge.world.tick;
}

const wonderFixture = (players: number): string => `wonder-default-clock-${String(players)}p-fixture`;
const relicFixture = (players: number): string => `relic-default-clock-${String(players)}p-fixture`;

describe('a year of a victory countdown (work 132)', () => {
  it('is 5 seconds of game time, so 200 years are 16:40, and every row of the wiki table follows', () => {
    expect(GAME_SECONDS_PER_YEAR).toBe(5);
    expect(TICKS_PER_YEAR).toBe(GAME_SECONDS_PER_YEAR * TPS);
    expect(TICKS_PER_YEAR).toBe(50);
    for (const [sizes, years, inGame, atNormal] of WIKI_ROWS) {
      const seconds = (years * TICKS_PER_YEAR) / TPS;
      expect(clock(seconds), `${sizes}: ${String(years)} years of game time`).toBe(inGame);
      expect(clock(Math.round(seconds / NORMAL_SPEED)), `${sizes}: ${String(years)} years at DE's Normal speed`).toBe(atNormal);
    }
  });

  it('is what the HUD counts in: the years left always agree with the ticks left', () => {
    expect(countdownYearsLeft(10_000)).toBe(200);
    expect(countdownYearsLeft(9_999)).toBe(200);
    expect(countdownYearsLeft(9_951)).toBe(200);
    expect(countdownYearsLeft(9_950)).toBe(199);
    expect(countdownYearsLeft(1)).toBe(1);
    expect(countdownYearsLeft(0)).toBe(0);
    for (let ticks = 0; ticks <= 20_000; ticks += 7) {
      const years = countdownYearsLeft(ticks);
      expect(years * TICKS_PER_YEAR, `${String(ticks)} ticks left`).toBeGreaterThanOrEqual(ticks);
      expect((years - 1) * TICKS_PER_YEAR, `${String(ticks)} ticks left`).toBeLessThan(Math.max(ticks, 1));
    }
  });
});

describe('the years a countdown lasts follow the map size DE gives that many players (work 132)', () => {
  it('is the size DE labels for the players seated: 2-4 players 200 years, 5-6 300, 7-8 350', () => {
    const expected = [200, 200, 200, 300, 300, 350, 350];
    expect([2, 3, 4, 5, 6, 7, 8].map(victoryCountdownYears)).toEqual(expected);
    for (let players = 2; players <= 8; players += 1) {
      const size = DE_SIZES.find((candidate) => candidate.players >= players)!;
      expect(victoryCountdownYears(players), `${String(players)} players are DE's ${size.name}`).toBe(size.years);
      expect(victoryCountdownTicks(players)).toBe(OPENING_TICKS[players]);
    }
  });

  it('clamps a count outside the ladder to its ends, as the map ladder does', () => {
    expect(victoryCountdownYears(0)).toBe(200);
    expect(victoryCountdownYears(1)).toBe(200);
    expect(victoryCountdownYears(9)).toBe(350);
    expect(victoryCountdownYears(40)).toBe(350);
    // Never a countdown of NaN ticks, which would never end.
    expect(victoryCountdownYears(Number.NaN)).toBe(200);
    expect(victoryCountdownYears(Number.POSITIVE_INFINITY)).toBe(200);
  });

  it('keeps this game\'s ladder at half of DE\'s sizes, so a rung cannot drift off its DE size', () => {
    expect(standardMapSize(2).width * 2).toBe(120);
    expect(standardMapSize(3).width * 2).toBe(144);
    expect(standardMapSize(4).width * 2).toBe(168);
    expect(standardMapSize(6).width * 2).toBe(200);
    expect(standardMapSize(7).width * 2).toBe(220);
  });

  it('opens a Wonder countdown at the years for the players seated, on each rung', () => {
    for (let players = 2; players <= 8; players += 1) {
      const entries = wonderEntries(boot(wonderFixture(players)));
      expect(entries, `${String(players)} players: one Wonder, one countdown`).toHaveLength(1);
      expect(entries[0]![1].totalTicks, `${String(players)} players`).toBe(OPENING_TICKS[players]);
      expect(entries[0]![1].remainingTicks, `${String(players)} players`).toBe(entries[0]![1].totalTicks);
    }
  });

  it('opens a Relic countdown at the same years, on each rung', () => {
    for (let players = 2; players <= 8; players += 1) {
      const bridge = boot(relicFixture(players));
      stepTicks(bridge, 1);
      const entries = relicEntries(bridge);
      expect(entries, `${String(players)} players: one holder, one countdown`).toHaveLength(1);
      expect(entries[0]![1].totalTicks, `${String(players)} players`).toBe(OPENING_TICKS[players]);
    }
  });
});

describe('a Wonder or Relic victory takes DE\'s time to arrive (work 132)', () => {
  it('awards a Wonder victory 200 years — 16:40 of game time — after the Wonder stands, not before', () => {
    const bridge = boot(wonderFixture(2));
    expect(bridge.getMatchState().wonderCountdownTicks).toBe(10_000);
    // The countdown opens with the Wonder at tick 0 and loses a tick per tick; the
    // resolver reads the zero on the same tick (the 10-tick short fixture resolves
    // on tick 10).
    const resolvedAt = tickTheMatchResolves(bridge, 9_990, 10_100);
    expect(bridge.getMatchState()).toMatchObject({ outcome: 'victory', winCondition: 'wonder' });
    expect(resolvedAt).toBe(10_000);
  }, 30_000);

  it('awards a Relic victory 200 years after one side holds every relic', () => {
    const bridge = boot(relicFixture(2));
    const resolvedAt = tickTheMatchResolves(bridge, 9_990, 10_100);
    expect(bridge.getMatchState()).toMatchObject({ outcome: 'victory', winCondition: 'relic' });
    expect(resolvedAt).toBe(10_000);
  }, 30_000);

  it('shows the human the time and the years left, which agree', () => {
    const bridge = boot(wonderFixture(2));
    stepTicks(bridge, 4_500);
    const ticksLeft = bridge.getMatchState().wonderCountdownTicks!;
    expect(ticksLeft).toBe(10_000 - 4_500);
    expect(countdownYearsLeft(ticksLeft)).toBe(110);
    expect(clock(ticksLeft / TPS)).toBe('9:10');
  });
});

describe('Atheism adds 100 years to a countdown at DE\'s year length (work 132)', () => {
  it('is 5,000 ticks, 100 years of 50 ticks', () => {
    expect(ATHEISM_COUNTDOWN_EXTENSION_YEARS).toBe(100);
    expect(ATHEISM_COUNTDOWN_EXTENSION_YEARS * TICKS_PER_YEAR).toBe(5_000);
  });

  it('lengthens a Wonder countdown that opens while any owner has it: 300 years, 25:00', () => {
    // Owner 2 holds Atheism, the Wonder is owner 1's: the extension is the
    // match's, not the researcher's (spec section 9.2.2).
    const bridge = boot('wonder-default-clock-2p-atheism-fixture');
    const entry = wonderEntries(bridge)[0]![1];
    expect(entry.totalTicks).toBe(15_000);
    expect(clock(bridge.getMatchState().wonderCountdownTicks! / TPS)).toBe('25:00');
  });

  it('lengthens a Relic countdown that opens while any owner has it: 300 years, 25:00', () => {
    const bridge = boot('relic-default-clock-2p-atheism-fixture');
    stepTicks(bridge, 1);
    const entry = relicEntries(bridge)[0]![1];
    expect(entry.totalTicks).toBe(15_000);
    expect(clock((entry.remainingTicks + 1) / TPS)).toBe('25:00');
  });

  it('adds the same 5,000 ticks on a bigger map: 6 players, 300 + 100 years', () => {
    // Atheism through the blob, on the six-player fixture: the researched set is
    // read when the Relic countdown opens, on the first tick after the load.
    const blob = asSchema2Blob(boot(relicFixture(6)).saveGame());
    worldStateOf(blob)[researchedTechnologiesCodec.slot] = [[2, ['atheism']]];
    const bridge = createSimulationBridge(relicFixture(6), { savedGame: blob, renderProjection: 'on-read' });
    stepTicks(bridge, 1);
    expect(relicEntries(bridge)[0]![1].totalTicks).toBe(20_000);
  });
});

describe('a countdown across a save (work 132)', () => {
  it('loads with the time it had left, and the original and the load count down together', () => {
    const original = boot(wonderFixture(2));
    stepTicks(original, 1_234);
    const loaded = createSimulationBridge(wonderFixture(2), {
      savedGame: asSchema2Blob(original.saveGame()),
      renderProjection: 'on-read',
    });
    expect(loaded.getMatchState().wonderCountdownTicks).toBe(original.getMatchState().wonderCountdownTicks);
    expect(wonderEntries(loaded)).toEqual(wonderEntries(original));
    stepTicks(original, 777);
    stepTicks(loaded, 777);
    expect(loaded.getMatchState().wonderCountdownTicks).toBe(10_000 - 1_234 - 777);
    expect(wonderEntries(loaded)).toEqual(wonderEntries(original));
  });

  it('keeps the deadline a save holds: a countdown saved before the change finishes on its own clock', () => {
    // A game saved by a version that counted a countdown as 2,000 ticks: 1,500
    // left of 2,000. Loading must not rescale it or restart it; it ends 1,500
    // ticks later, and the HUD states the years that is (30).
    const blob = asSchema2Blob(boot(wonderFixture(2)).saveGame());
    const slots = worldStateOf(blob);
    const [[buildingId]] = slots[wonderCountdownsCodec.slot] as Array<[number, CountdownEntry]>;
    slots[wonderCountdownsCodec.slot] = [[buildingId, { remainingTicks: 1_500, totalTicks: 2_000, lastCompletedTick: null }]];
    const bridge = createSimulationBridge(wonderFixture(2), { savedGame: blob, renderProjection: 'on-read' });
    expect(bridge.getMatchState().wonderCountdownTicks).toBe(1_500);
    expect(countdownYearsLeft(bridge.getMatchState().wonderCountdownTicks!)).toBe(30);
    const resolvedAt = tickTheMatchResolves(bridge, 1_490, 1_600);
    expect(bridge.getMatchState()).toMatchObject({ outcome: 'victory', winCondition: 'wonder' });
    expect(resolvedAt).toBe(1_500);
  });

  it('keeps a Relic deadline a save holds the same way', () => {
    const boot1 = boot(relicFixture(2));
    stepTicks(boot1, 1);
    const blob = asSchema2Blob(boot1.saveGame());
    const slots = worldStateOf(blob);
    const [[owner]] = slots[relicCountdownsCodec.slot] as Array<[number, CountdownEntry]>;
    slots[relicCountdownsCodec.slot] = [[owner, { remainingTicks: 1_500, totalTicks: 2_000, lastCompletedTick: null }]];
    const startTick = blob.worldSnapshot.tick;
    const bridge = createSimulationBridge(relicFixture(2), { savedGame: blob, renderProjection: 'on-read' });
    const resolvedAt = tickTheMatchResolves(bridge, startTick + 1_490, startTick + 1_600);
    expect(bridge.getMatchState()).toMatchObject({ outcome: 'victory', winCondition: 'relic' });
    expect(resolvedAt - startTick).toBe(1_500);
  });

  it('keeps the deadlines a schema-1 save holds, which load through their own path', () => {
    const v1 = legacySchema1FromBridge(boot(wonderFixture(2)));
    v1.sideMaps.wonderCountdowns = v1.sideMaps.wonderCountdowns.map(([id]) => [
      id,
      { remainingTicks: 1_500, totalTicks: 2_000, lastCompletedTick: null },
    ]);
    const bridge = createSimulationBridge(wonderFixture(2), { savedGame: v1, renderProjection: 'on-read' });
    expect(wonderEntries(bridge).map(([, entry]) => [entry.remainingTicks, entry.totalTicks])).toEqual([[1_500, 2_000]]);
    expect(tickTheMatchResolves(bridge, 1_490, 1_600)).toBe(1_500);
    expect(bridge.getMatchState()).toMatchObject({ outcome: 'victory', winCondition: 'wonder' });
  });
});
