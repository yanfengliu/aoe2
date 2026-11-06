// The multi-seed self-play A/B (scripts/selfplay-ab.mjs, work 144) reports what its seeds did: the gate for plan
// 106's card that every computer-opponent change of work 141 was judged on one seed per map.
//
// What can go wrong with such an instrument without anyone noticing: its seeds are not games of the map they name
// (a variant of a named map that falls back to the default map, or a factory that ignores its seed and plays one
// match five times), its arithmetic reads a lost age as no change, or it counts what the column does not mean (a
// Town Center that rang its bell read as a seat with two villagers, which the first run of this instrument did on
// `aoe2-prototype#1`). Each case below checks one of those, on hand-made records or on generated scenarios, which
// cost milliseconds; one short match checks that a seed played twice is one match.
//
// BOUND: this proves the seeds and the bookkeeping, not that five seeds a map are enough to see a given change. The
// noise floor of real runs (one tree against itself on other seeds) is in plan 144.

import { describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmdirSync, rmSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { DEFAULT_MAPS, defaultTicks, gameFingerprint, planJobs, readRecord, worker } from '../../scripts/selfplay-ab.mjs';
import {
  ARMY_SAMPLES,
  columnsFor,
  COLUMNS,
  NEVER,
  columnValue,
  difference,
  digestWarnings,
  formatReport,
  groupByMap,
  median,
  pairedSummary,
  spread,
} from '../../scripts/selfplayAbReport.mjs';
import {
  loadGame,
  mapOfSeed,
  playAuditMatch,
  readClicks,
  registerSeed,
  scenarioDigest,
  seedsForMap,
  stepOneTick,
  VILLAGER_MINUTES,
  villagerCounts,
} from '../../scripts/selfplayAuditMatch.mjs';
import { PLAYABLE_MAPS } from '../../src/game/simulation/mapGeneration/playableMaps';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

/* eslint-disable @typescript-eslint/no-explicit-any */
function owner(overrides: Record<string, unknown> = {}): any {
  return {
    feudalClick: 6000, feudal: 7500, villagersAtFeudalClick: 20, castleClick: 15000, castle: 17000,
    villagersAtCastleClick: 30, imperialClick: null, imperial: null, qualified: 12000, buildings: ['town-center'],
    units: ['villager'], peakArmy: 10, armyByTick: [1, 2, 3], villagersLost: 4, underDefence: 1, monastery: null,
    monk: null, relics: 0, siege: null, siegePeak: 0, castleBuilding: null, firstFarm: 5000,
    villagersAt: { 5: 10, 10: 20, 15: 25, 20: null },
    ...overrides,
  };
}

function record(seed: string, owners: Record<number, any> = {}, outcome: any = null): any {
  return {
    schema: 1, seed, map: mapOfSeed(seed), config: 'castle', ticks: 45000, scenarioDigest: `digest-${seed}`,
    outcome: outcome ?? { state: 'running', winner: null, by: null, endedAt: null },
    owners: { 1: owner(owners[1]), 2: owner(owners[2]) },
    ledger: [], relics: [], relicStores: [],
  };
}

describe('the seeds are games of the map they name', () => {
  it('starts each map at its own seed, the default map at the three the audits played, then numbers variants', () => {
    expect(seedsForMap('aoe2-prototype', 5)).toEqual(['aoe2-prototype', 'default-seed', 'corpus-seed-b', 'aoe2-prototype#3', 'aoe2-prototype#4']);
    expect(seedsForMap('fortress', 3)).toEqual(['fortress', 'fortress#1', 'fortress#2']);
    // The noise floor's other seeds: arm B from the fifth, none of arm A's.
    expect(seedsForMap('fortress', 2, 5)).toEqual(['fortress#5', 'fortress#6']);
    expect(seedsForMap('aoe2-prototype', 2, 5)).toEqual(['aoe2-prototype#5', 'aoe2-prototype#6']);
    for (const seed of [...seedsForMap('aoe2-prototype', 4), 'aoe2-prototype#9']) expect(mapOfSeed(seed)).toBe('aoe2-prototype');
    expect(mapOfSeed('fortress#2')).toBe('fortress');
    expect(() => seedsForMap('default-seed', 2)).toThrow(/a seed, not a map/);
    expect(() => seedsForMap('fortress#1', 2)).toThrow(/a seed, not a map/);
  });

  it('plays a named map from its variant seeds, and every playable map\'s seeds are different games', async () => {
    const game = await loadGame(REPO);
    const castles = (seed: string) => game.createPrototypeScenario(seed).spawns
      .filter((s: { kind: string }) => s.kind === 'castle').length;
    // Unregistered, a variant seed is an unknown name, which the dispatch gives the default map, with no Castle.
    expect(castles('fortress#7')).toBe(0);
    registerSeed(game, 'fortress#7');
    expect(castles('fortress#7')).toBe(castles('fortress'));
    expect(castles('fortress')).toBeGreaterThan(0);
    for (const { seed: map } of PLAYABLE_MAPS) {
      const digests = seedsForMap(map, 3).map((seed: string) => scenarioDigest(game, seed));
      expect(new Set(digests).size, `${map}: ${digests.join(', ')}`).toBe(3);
      // Generating a seed again is the same scenario, so a digest names one map.
      expect(scenarioDigest(game, seedsForMap(map, 3)[2])).toBe(digests[2]);
    }
  });

  it('plays a seed twice as one match, on the map the seed names', async () => {
    const game = await loadGame(REPO);
    const first = playAuditMatch(game, { seed: 'fortress#1', config: 'castle', ticks: 300 });
    const second = playAuditMatch(game, { seed: 'fortress#1', config: 'castle', ticks: 300 });
    expect(second).toEqual(first);
    expect(first.map).toBe('fortress');
    expect(first.owners[1].buildings).toContain('castle');
    // Every field the record measures is a column of the report (review round 0, R0-3): the report left out the
    // Monastery, the Monk and every other army sample, and a list checked against itself could not see it.
    const read = new Set(COLUMNS.map((c: any) => c[3]));
    for (const key of Object.keys(first.owners[1])) expect(read.has(key), `${key} has a column`).toBe(true);
    expect(COLUMNS.filter((c: any) => c[3] === 'armyByTick')).toHaveLength(ARMY_SAMPLES);
    expect(ARMY_SAMPLES * 5000).toBe(Math.max(...DEFAULT_MAPS.map((map: string) => defaultTicks('castle', map))));
    expect(COLUMNS.filter((c: any) => c[3] === 'villagersAt')).toHaveLength(VILLAGER_MINUTES.length);
  }, 20_000);

  it('fails a match whose world stops advancing, rather than measuring the frozen world', () => {
    // The whole loop, on a fake game whose world refuses its first step (review round 0, R0-2: a refusing world
    // came back as a 3,000-tick record with a five-minute villager sample).
    const worldTick = 0;
    const halted = {
      world: { get tick() { return worldTick; }, getState: () => undefined, query: () => [], getComponent: () => undefined },
      step: () => ({ ticks: 0, refusedBecause: 'halted' }),
      getEconomyState: () => ({ resources: [], buildings: [], units: [], ages: {} }),
      getRecentUnitDeaths: () => [],
      getMatchState: () => ({ outcome: 'running', winCondition: null }),
      isCellVisibleForOwner: () => false,
    };
    const fakeGame = {
      createSimulationBridge: () => halted, HUMAN_PLAYER_ID: 1, SCENARIO_FACTORIES: new Map(),
      createPrototypeScenario: () => ({ width: 1, height: 1, terrain: [], starts: [], spawns: [] }),
    };
    expect(() => playAuditMatch(fakeGame, { seed: 'arena', config: 'castle', ticks: 3000 })).toThrow(/refused because halted/);
    // Round 1, R1-2: a step refused as match-over while the match state says running is a frozen world too, and a
    // match over before its first step ran no tick.
    const frozen = { ...halted, step: () => ({ ticks: 0, refusedBecause: 'match-over' }) };
    expect(() => playAuditMatch({ ...fakeGame, createSimulationBridge: () => frozen }, { seed: 'arena', config: 'castle', ticks: 3000 }))
      .toThrow(/refused as match-over while the match state says it is running/);
    const over = { ...frozen, getMatchState: () => ({ outcome: 'defeat', winCondition: 'conquest' }) };
    expect(playAuditMatch({ ...fakeGame, createSimulationBridge: () => over }, { seed: 'arena', config: 'castle', ticks: 3000 }).outcome)
      .toEqual({ state: 'defeat', winner: 2, by: 'conquest', endedAt: 0 });

    let tick = 0;
    const bridge = (report: () => { ticks: number; refusedBecause: string | null }, moves = 1) => ({
      world: { get tick() { return tick; } },
      step: () => { const r = report(); tick += r.refusedBecause === null ? moves : 0; return r; },
    });
    expect(stepOneTick(bridge(() => ({ ticks: 1, refusedBecause: null })), 'arena', 1)).toBe(true);
    expect(() => stepOneTick(bridge(() => ({ ticks: 0, refusedBecause: 'halted' })), 'arena', 2)).toThrow(/refused because halted/);
    expect(() => stepOneTick(bridge(() => ({ ticks: 0, refusedBecause: null }), 0), 'arena', 3)).toThrow(/ran 0 ticks and moved the world 0/);
    expect(() => stepOneTick(bridge(() => ({ ticks: 1, refusedBecause: null }), 0), 'arena', 4)).toThrow(/moved the world 0/);
    // A finished match refuses with match-over, which the loop takes as the end only while the match state agrees.
    expect(stepOneTick(bridge(() => ({ ticks: 0, refusedBecause: 'match-over' })), 'arena', 5)).toBe(false);
    // Review round 2: a match-over refusal that still moved the world, or says it ran a tick, is no clean end.
    const moving = { world: { get tick() { return tick; } }, step: () => { tick += 1; return { ticks: 0, refusedBecause: 'match-over' }; } };
    expect(() => stepOneTick(moving, 'arena', 6)).toThrow(/refused because match-over/);
    expect(() => stepOneTick(bridge(() => ({ ticks: 1, refusedBecause: 'match-over' })), 'arena', 7)).toThrow(/refused because match-over/);
  });
});

describe('the columns mean what they say', () => {
  it('counts every villager an owner holds, the garrisoned ones too', () => {
    // Three villagers of owner 1, one of them garrisoned (a unit with no position, as the game keeps it), and a
    // soldier. The fake world answers a query with the entities holding every component it names.
    const units = new Map<number, any>([
      [1, { owner: 1, unitType: 'villager' }], [2, { owner: 1, unitType: 'villager' }],
      [3, { owner: 1, unitType: 'villager', garrisoned: true }], [4, { owner: 1, unitType: 'militia' }],
      [5, { owner: 2, unitType: 'villager' }],
    ]);
    const has = (id: number, component: string) => component === 'unit' || (component === 'position' && !units.get(id).garrisoned);
    const bridge = {
      world: {
        query: (...components: string[]) => [...units.keys()].filter((id) => components.every((c) => has(id, c))),
        getComponent: (id: number, component: string) => (has(id, component) ? units.get(id) : undefined),
      },
    };
    expect(villagerCounts(bridge)).toEqual(new Map([[1, 3], [2, 1]]));
  });

  it('takes an age click at the first sample its research is queued, with the villagers held then', () => {
    const per: any = { 1: { click: {}, villagersAtClick: {} }, 2: { click: {}, villagersAtClick: {} } };
    const queued = (owner: number, technologyType: string) => ({ owner, queue: [{ kind: 'unit', unitType: 'villager' }, { kind: 'technology', technologyType }] });
    readClicks({ buildings: [queued(2, 'feudal-age'), queued(1, 'loom')] }, per, 75, () => new Map([[1, 9], [2, 21]]));
    readClicks({ buildings: [queued(2, 'feudal-age')] }, per, 100, () => new Map([[2, 22]]));
    expect(per[2].click).toEqual({ 'feudal-age': 75 });
    expect(per[2].villagersAtClick).toEqual({ 'feudal-age': 21 });
    expect(per[1].click).toEqual({});
  });

  it('reads an age not reached as later than any tick, and an unmeasured count as missing', () => {
    const column = (label: string) => COLUMNS.find((c: any) => c[0] === label)!;
    const r = record('fortress', { 1: { imperial: null, villagersAt: { 5: 10, 10: 20, 15: 25, 20: null } } });
    expect(columnValue(column('Imperial'), r, 1)).toBe(NEVER);
    expect(columnValue(column('vills 20:00'), r, 1)).toBeNull();
    expect(columnValue(column('vills 15:00'), r, 1)).toBe(25);
    expect(columnValue(column('army 10k'), r, 1)).toBe(2);
    expect(columnValue(column('army 20k'), r, 1)).toBeNull();
  });
});

describe('the arithmetic of a spread', () => {
  it('takes medians and ranges over seeds with "never" as the latest time', () => {
    expect(median([9000, NEVER, 9500])).toBe(9500);
    expect(median([NEVER, NEVER, 9500])).toBe(NEVER);
    expect(median([10, 12, 14, 16])).toBe(13);
    // An even count's middle two with "never" in them (review round 0, R0-4): one seed that reached a time and one
    // that never did give "never"; a gain and a loss give "?" (NaN); swapping the arms negates the median.
    expect(median([10, 12, NEVER, NEVER])).toBe(NEVER);
    expect(median([0, NEVER])).toBe(NEVER);
    expect(median([-NEVER, 0])).toBe(-NEVER);
    expect(median([-NEVER, NEVER])).toBeNaN();
    expect(pairedSummary([NEVER, 5000], [5000, NEVER])!.median).toBeNaN();
    expect(pairedSummary([5000, 5000], [5000, NEVER])!.median).toBe(NEVER);
    expect(pairedSummary([5000, NEVER], [5000, 5000])!.median).toBe(-NEVER);
    expect(median([])).toBeNull();
    expect(spread([9000, NEVER, null, 9500])).toEqual({ median: 9500, min: 9000, max: NEVER, n: 3, never: 1 });
  });

  it('reads a lost age as a move, and two ages never reached as none', () => {
    expect(difference(9000, 9500)).toBe(500);
    expect(difference(NEVER, NEVER)).toBe(0);
    expect(difference(9000, NEVER)).toBe(NEVER);
    expect(difference(NEVER, 9000)).toBe(-NEVER);
    expect(difference(null, 3)).toBeNull();
    expect(pairedSummary([1, 5, NEVER, 4], [2, 5, 7000, NEVER])).toEqual({
      median: 0.5, min: -NEVER, max: NEVER, n: 4, never: 1, up: 2, down: 1, same: 1,
    });
    expect(() => pairedSummary([1, 2], [1])).toThrow(/one value per seed/);
  });

  it('reports a tree against itself on the same seeds as no move on any column', () => {
    const seeds = seedsForMap('arena', 3);
    const recordsA = seeds.map((seed: string, i: number) => record(seed, { 1: { feudal: 7000 + i * 500, villagersLost: i * 9 } }));
    const recordsB = structuredClone(recordsA);
    const report = formatReport({ arms: [{ label: 'A', root: 'a', commit: 'c', dirty: false }, { label: 'B', root: 'b', commit: 'c', dirty: false }], config: 'castle', recordsA, recordsB, owners: [1, 2] });
    const rows = report.split('\n').filter((line: string) => /^\| [a-zA-Z]/.test(line) && line.includes('same)'));
    expect(rows.length).toBeGreaterThan(COLUMNS.length);
    for (const row of rows) expect(row).toMatch(/\(0 up, 0 down, \d+ same\) \|$/);
    expect(report).toContain('| Feudal | 1 | 12:30 [11:40-13:20] | 12:30 [11:40-13:20] | 0:00 (0 up, 0 down, 3 same) |');
    expect(report).toContain('| vill lost | 1 | 9 [0-18] | 9 [0-18] | 0 (0 up, 0 down, 3 same) |');
  });

  it('shows a gain on one seed and a loss on another as no median at all', () => {
    const recordsA = seedsForMap('arena', 2).map((seed: string, i: number) => record(seed, { 1: { castle: i === 0 ? 17000 : null } }));
    const recordsB = seedsForMap('arena', 2).map((seed: string, i: number) => record(seed, { 1: { castle: i === 0 ? null : 17000 } }));
    const report = formatReport({ arms: [{ label: 'A', root: 'a', commit: 'c', dirty: false }, { label: 'B', root: 'a', commit: 'c', dirty: false }], config: 'castle', recordsA, recordsB, owners: [1] });
    expect(report).toContain('| Castle | 1 | never [28:20-never] | never [28:20-never] | ? [-never to +never] (1 up, 1 down, 0 same) |');
  });

  it('compares medians, not seeds, when the arms played different seeds', () => {
    const recordsA = seedsForMap('arena', 2).map((seed: string) => record(seed, { 1: { feudal: 9000 } }));
    const recordsB = seedsForMap('arena', 2, 5).map((seed: string) => record(seed, { 1: { feudal: 9600 } }));
    const report = formatReport({ arms: [{ label: 'A', root: 'a', commit: 'c', dirty: false }, { label: 'B', root: 'a', commit: 'c', dirty: false }], config: 'castle', recordsA, recordsB, owners: [1] });
    expect(report).toContain('B - A of medians');
    expect(report).toContain('| Feudal | 1 | 15:00 | 16:00 | +1:00 |');
  });

  it('warns when two seeds are one scenario, or one seed is two maps', () => {
    const a = [record('arena'), record('arena#1')];
    const b = structuredClone(a);
    expect(digestWarnings(groupByMap(a), groupByMap(b))).toEqual([]);
    a[1].scenarioDigest = a[0].scenarioDigest;
    b[1].scenarioDigest = 'another';
    expect(digestWarnings(groupByMap(a), groupByMap(b))).toEqual([
      'arena: seeds arena, arena#1 generate one scenario, so they are one match',
      'arena: seed arena#1 generates a different map in each arm',
    ]);
  });
});

describe('the plan', () => {
  it('plays every seed of every map in both arms, to work 141\'s horizons', () => {
    const arms = [{ label: 'A', root: '/a' }, { label: 'B', root: '/b' }];
    const jobs = (planJobs as unknown as (options: Record<string, unknown>) => any[])({ arms: arms.map((a) => ({ ...a, fingerprint: `game-${a.label}` })), maps: DEFAULT_MAPS, seeds: 2, bSeedOffset: 0, config: 'castle', ticks: undefined, out: '/out', measurement: 'm' });
    expect(jobs).toHaveLength(2 * DEFAULT_MAPS.length * 2);
    expect(jobs.filter((j: any) => j.arm === 'B').every((j: any) => j.fingerprints.game === 'game-B' && j.fingerprints.measurement === 'm')).toBe(true);
    expect(jobs.filter((j: any) => j.arm === 'B').map((j: any) => j.seed)).toEqual(jobs.filter((j: any) => j.arm === 'A').map((j: any) => j.seed));
    expect(defaultTicks('castle', 'aoe2-prototype')).toBe(45000);
    expect(defaultTicks('castle', 'fortress')).toBe(60000);
    expect(defaultTicks('idle', 'fortress')).toBe(45000);
    const offset = planJobs({ arms, maps: ['coastal'], seeds: 2, bSeedOffset: 5, config: 'castle', ticks: 1000, out: '/out' });
    expect(offset.map((j: any) => `${j.arm} ${j.seed} ${j.ticks}`)).toEqual(['A coastal 1000', 'A coastal#1 1000', 'B coastal#5 1000', 'B coastal#6 1000']);
  });

  it('fingerprints the game a match loads, and nothing else in the checkout', () => {
    // Round 1, R1-1 and R1-3: what the record names is what the worker loaded, and an untracked --out folder inside
    // the arm is no part of it.
    const root = mkdtempSync(join(tmpdir(), 'selfplay-ab-fp-'));
    const git = (...args: string[]) => {
      const r = spawnSync('git', ['-C', root, ...args], { encoding: 'utf8' });
      if (r.status !== 0) throw new Error(r.stderr);
    };
    try {
      git('init', '-q');
      mkdirSync(join(root, 'src'));
      writeFileSync(join(root, 'src', 'game.ts'), 'export const a = 1;\n');
      git('add', '.');
      git('-c', 'user.email=t@example.com', '-c', 'user.name=t', 'commit', '-qm', 'init');
      const committed = gameFingerprint(root);
      expect(gameFingerprint(root)).toBe(committed);
      mkdirSync(join(root, 'results'));
      writeFileSync(join(root, 'results', 'fortress.json'), '{}\n');
      expect(gameFingerprint(root), 'an untracked file outside src and design').toBe(committed);
      writeFileSync(join(root, 'src', 'extra.ts'), 'export const b = 2;\n');
      const untracked = gameFingerprint(root);
      expect(untracked, 'an untracked file under src').not.toBe(committed);
      writeFileSync(join(root, 'src', 'game.ts'), 'export const a = 3;\n');
      const changed = gameFingerprint(root);
      expect(changed, 'an uncommitted change').not.toBe(untracked);
      mkdirSync(join(root, 'node_modules', 'civ-engine', 'dist'), { recursive: true });
      writeFileSync(join(root, 'node_modules', 'civ-engine', 'dist', 'index.js'), 'export {};\n');
      expect(gameFingerprint(root), 'the engine build').not.toBe(changed);
    } finally {
      rmSync(root, { recursive: true, force: true, maxRetries: 3 });
    }
  });

  it('stamps a record with the fingerprints of what its match loaded, and refuses a checkout that moved', async () => {
    const folder = mkdtempSync(join(tmpdir(), 'selfplay-ab-worker-'));
    const file = join(folder, 'fortress.json');
    const argv = ['--worker', '--root', REPO, '--seed', 'fortress', '--config', 'castle', '--ticks', '30', '--file', file];
    try {
      await worker(argv, () => ({ game: 'g', measurement: 'm' }));
      expect(JSON.parse(readFileSync(file, 'utf8')).fingerprints).toEqual({ game: 'g', measurement: 'm' });
      let calls = 0;
      await expect(worker(argv, () => ({ game: `g${calls++}`, measurement: 'm' }))).rejects.toThrow(/changed while fortress was played/);
      // Review round 2: the measurement changing under the match is refused as the game changing is.
      let measured = 0;
      await expect(worker(argv, () => ({ game: 'g', measurement: `m${measured++}` }))).rejects.toThrow(/changed while fortress was played/);
    } finally {
      unlinkSync(file);
      rmdirSync(folder);
    }
  }, 20_000);

  it('keeps every army sample of a horizon past 60,000', () => {
    // Round 1, R1-4: the report stopped at the twelfth sample whatever --ticks played.
    const long = record('arena', { 1: { armyByTick: Array.from({ length: 13 }, (_unused, i) => i) } });
    expect(columnsFor([record('arena')])).toBe(COLUMNS);
    expect(columnsFor([long]).filter((c: any) => c[3] === 'armyByTick')).toHaveLength(13);
    const report = formatReport({ arms: [{ label: 'A', root: 'a', commit: 'c', dirty: false }, { label: 'B', root: 'a', commit: 'c', dirty: false }], config: 'castle', recordsA: [long], recordsB: [structuredClone(long)], owners: [1] });
    expect(report).toContain('| army 65k | 1 | 12 | 12 | 0 (0 up, 0 down, 1 same) |');
    // Review round 2: the pooled table keeps the sample too.
    expect(report.slice(report.indexOf('### All maps'))).toContain('| army 65k | 1 | 0 (0 up, 0 down, 1 same) |');
  });

  it('refuses a reused record of another match, another game or another measurement', () => {
    const folder = mkdtempSync(join(tmpdir(), 'selfplay-ab-'));
    const file = join(folder, 'coastal.json');
    const fingerprints = { game: 'g1', measurement: 'm1' };
    writeFileSync(file, JSON.stringify({ ...record('coastal'), fingerprints }));
    try {
      const job = { arm: 'A', root: '/a', map: 'coastal', seed: 'coastal', config: 'castle', ticks: 45000, file, fingerprints };
      expect(readRecord(job).seed).toBe('coastal');
      // Review round 0, R0-1: a record of the same seed played on a changed checkout, or by a changed measurement.
      expect(() => readRecord({ ...job, fingerprints: { ...fingerprints, game: 'g2' } })).toThrow(/played on game g1, not this run's g2/);
      expect(() => readRecord({ ...job, fingerprints: { ...fingerprints, measurement: 'm2' } })).toThrow(/played on measurement m1, not this run's m2/);
      expect(() => readRecord({ ...job, ticks: 60000 })).toThrow(/ticks 45000, not the 60000/);
      expect(() => readRecord({ ...job, seed: 'coastal#1' })).toThrow(/seed coastal, not the coastal#1/);
      expect(() => readRecord({ ...job, config: 'lab' })).toThrow(/config castle, not the lab/);
    } finally {
      unlinkSync(file);
      rmdirSync(folder);
    }
  });
});
