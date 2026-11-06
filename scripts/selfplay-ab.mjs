#!/usr/bin/env node
// Did a change to the computer move its matches, or did they move by themselves? Plays SEVERAL SEEDS PER MAP in two
// checkouts of this repo, the A arm and the B arm, and reports every column of `scripts/selfplay-audit.mjs` (and the
// economy columns work 144 added) as its median and range over the seeds, per arm and per owner, and the per-seed
// difference B - A with how many seeds moved each way (work 144).
//
// WHY (plan 106's card, work 141). Every computer-opponent change of work 141 was judged on the castle
// configuration's seven matches, one seed each. The game draws no random number, so each of those is exact on its
// tree, and silent about how far a match moves for reasons other than the change: a match is chaotic, and one lost
// battle (fortress's owner 2 under work 141's ram goal, 4 villagers lost against 47) moves every later column. Here a
// column moves with a change when its seeds move together, and a column whose seeds spread over the move is noise.
//
// SEEDS. A seed is a map seed (`scripts/selfplayAuditMatch.mjs` says why that is the only thing that varies): map M's
// seeds are M itself, then `M#1`, `M#2`, ..., M's generator run with each. `--b-seed-offset K` gives arm B the seeds
// from the K-th instead, so one tree against itself on other seeds measures how far a map's medians differ by chance:
// the noise floor of a median of N seeds. With the same seeds in both arms (the default) the two arms are paired, seed
// by seed, and one tree against itself must report no difference on any column: that run checks the instrument.
//
// THE ARMS. Each match runs in its own process with this checkout's measurement and the arm's game, imported from the
// arm's checkout (`loadGame`), so a difference is the game's, not the instrument's. A tree is any checkout of this
// repo, e.g. a control worktree on main made with `node scripts/controlWorktree.mjs create <name>`.
//
// Usage:
//   npx tsx scripts/selfplay-ab.mjs [--a <tree>] [--b <tree>] [--maps aoe2-prototype,coastal,gold-rush,arena,fortress]
//     [--seeds 5] [--b-seed-offset 0] [--config castle|standard|lab|idle] [--ticks N] [--jobs 6] [--out <dir>] [--reuse]
//
// Both trees default to this checkout. `--ticks` defaults to the horizons work 141 judged on: 45,000 for the default
// map and 60,000 for coastal, gold-rush, arena and fortress in the castle configuration, 45,000 in the others.
// `--out` (default `tmp/selfplay-ab/<time>`) keeps each match's record, `<arm>/<seed>.json`, and the report,
// `report.md`; `--reuse` plays only the matches whose record is missing there, and refuses a record that is not the job's seed,
// configuration and horizon, or was played on another game or measurement (`gameFingerprint`, `measurementFingerprint`).
//
// BOUND. It reports what the seeds it played did; five seeds a map cannot show a rare outcome, and a median moves by
// a seed's value when one seed's match flips. It reads the same samples as the audit (ages every 250 ticks, clicks
// every 25, armies every 5,000), so a shorter event between samples does not show.

import { spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { runDirectly } from './run-directly.mjs';
import { formatReport } from './selfplayAbReport.mjs';
import { CONFIGS, loadGame, playAuditMatch, RECORD_SCHEMA, seedsForMap } from './selfplayAuditMatch.mjs';

const SELF = fileURLToPath(import.meta.url);
const REPO = resolve(dirname(SELF), '..');
export const DEFAULT_MAPS = ['aoe2-prototype', 'coastal', 'gold-rush', 'arena', 'fortress'];
const LONG_CASTLE_MAPS = new Set(['coastal', 'gold-rush', 'arena', 'fortress']);

/** The horizon a map's matches are played to when `--ticks` is not given. */
export function defaultTicks(config, map) {
  return config === 'castle' && LONG_CASTLE_MAPS.has(map) ? 60000 : 45000;
}

/** Every match both arms play, arm by arm, map by map, seed by seed: the order the report reads them in. */
export function planJobs({ arms, maps, seeds, bSeedOffset, config, ticks, out, measurement = null }) {
  const jobs = [];
  for (const arm of arms) {
    const offset = arm.label === 'B' ? bSeedOffset : 0;
    for (const map of maps) {
      const horizon = ticks ?? defaultTicks(config, map);
      for (const seed of seedsForMap(map, seeds, offset)) {
        jobs.push({
          arm: arm.label, root: arm.root, map, seed, config, ticks: horizon, file: join(out, arm.label, `${encodeURIComponent(seed)}.json`),
          fingerprints: { game: arm.fingerprint ?? null, measurement },
        });
      }
    }
  }
  return jobs;
}

function parseArgs(argv) {
  const value = (name, fallback) => {
    const i = argv.indexOf(`--${name}`);
    return i === -1 ? fallback : argv[i + 1];
  };
  const integer = (name, fallback) => {
    const raw = value(name, undefined);
    if (raw === undefined) return fallback;
    const n = Number(raw);
    if (!Number.isSafeInteger(n)) throw new Error(`--${name} must be an integer; got "${raw}"`);
    return n;
  };
  const config = String(value('config', 'castle'));
  if (!(config in CONFIGS)) throw new Error(`--config must be one of ${Object.keys(CONFIGS).join(', ')}; got "${config}"`);
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\..*$/, '');
  return {
    a: resolve(String(value('a', REPO))),
    b: resolve(String(value('b', REPO))),
    maps: String(value('maps', DEFAULT_MAPS.join(','))).split(','),
    seeds: integer('seeds', 5),
    bSeedOffset: integer('b-seed-offset', 0),
    config,
    ticks: integer('ticks', undefined),
    jobs: integer('jobs', Math.max(1, Math.min(6, Math.floor(os.cpus().length / 4)))),
    out: resolve(String(value('out', join(REPO, 'tmp', 'selfplay-ab', stamp)))),
    reuse: argv.includes('--reuse'),
  };
}

function describeTree(label, root) {
  const git = (...args) => spawnSync('git', ['-C', root, ...args], { encoding: 'utf8' });
  const head = git('rev-parse', '--short=12', 'HEAD');
  if (head.status !== 0) throw new Error(`arm ${label}: ${root} is not a checkout of this repo (${head.stderr.trim()})`);
  const status = git('status', '--porcelain', '--untracked-files=no');
  return { label, root, commit: head.stdout.trim(), dirty: status.stdout.trim() !== '', fingerprint: gameFingerprint(root) };
}

// What a record was played on (review round 0, R0-1): the arm's game, as its committed tree, its uncommitted changes,
// its untracked files under src/ and design/ (where the game's code and data live; an untracked `--out` folder inside
// the arm is no input of a match, round 1's R1-3) and the civ-engine build it loads, and this checkout's measurement,
// as the two files a worker runs. Each worker fingerprints what it loads, before and after its match (round 1's
// R1-1), and a record whose fingerprints are not the run's is refused, fresh or reused.
export function gameFingerprint(root) {
  const git = (...args) => spawnSync('git', ['-C', root, ...args], { maxBuffer: 1 << 30 });
  const hash = createHash('sha256');
  hash.update(git('rev-parse', 'HEAD^{tree}').stdout);
  hash.update(git('diff', 'HEAD', '--binary').stdout);
  const untracked = git('ls-files', '--others', '--exclude-standard', '-z', '--', 'src', 'design').stdout.toString('utf8').split('\0').filter(Boolean).sort();
  for (const path of untracked) hash.update(path).update(readFileSync(join(root, path)));
  const engine = join(root, 'node_modules', 'civ-engine');
  if (existsSync(join(engine, 'package.json'))) hash.update(readFileSync(join(engine, 'package.json')));
  const dist = join(engine, 'dist');
  if (existsSync(dist)) for (const name of readdirSync(dist).filter((n) => n.endsWith('.js')).sort()) hash.update(name).update(readFileSync(join(dist, name)));
  return hash.digest('hex').slice(0, 16);
}

export function measurementFingerprint() {
  const hash = createHash('sha256');
  for (const name of ['selfplayAuditMatch.mjs', 'selfplay-ab.mjs']) hash.update(readFileSync(join(REPO, 'scripts', name)));
  return hash.digest('hex').slice(0, 16);
}

export const fingerprintsOf = (root) => ({ game: gameFingerprint(root), measurement: measurementFingerprint() });

function runJob(job) {
  return new Promise((done) => {
    const started = Date.now();
    const child = spawn(process.execPath, ['--import', 'tsx', SELF, '--worker', '--root', job.root, '--seed', job.seed,
      '--config', job.config, '--ticks', String(job.ticks), '--file', job.file], { cwd: REPO, stdio: ['ignore', 'ignore', 'pipe'] });
    let stderr = '';
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('close', (code) => done({ job, code, stderr, seconds: (Date.now() - started) / 1000 }));
  });
}

async function runPool(jobs, width) {
  const failures = [];
  let next = 0;
  let finished = 0;
  const worker = async () => {
    while (next < jobs.length) {
      const job = jobs[next++];
      const result = await runJob(job);
      finished += 1;
      const tag = `[${finished}/${jobs.length}] ${job.arm} ${job.seed} (${job.ticks} ticks)`;
      if (result.code === 0 && existsSync(job.file)) console.error(`${tag}: ${result.seconds.toFixed(0)} s`);
      else {
        failures.push(result);
        console.error(`${tag}: FAILED with exit ${result.code}\n${result.stderr.trim()}`);
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(width, jobs.length) }, worker));
  return failures;
}

/** One match in this process: the record, stamped with the fingerprints of what it loaded, or an error when the
 *  arm's checkout or this measurement changed while the match was played, since the record would name neither. */
export async function worker(argv, fingerprint = fingerprintsOf) {
  const value = (name) => argv[argv.indexOf(`--${name}`) + 1];
  const before = fingerprint(value('root'));
  const game = await loadGame(value('root'));
  const started = Date.now();
  const record = playAuditMatch(game, { seed: value('seed'), config: value('config'), ticks: Number(value('ticks')) });
  record.wallSeconds = (Date.now() - started) / 1000;
  const after = fingerprint(value('root'));
  if (after.game !== before.game || after.measurement !== before.measurement) {
    throw new Error(`${value('root')} or this measurement changed while ${value('seed')} was played; play it again on a checkout that holds still`);
  }
  record.fingerprints = before;
  mkdirSync(dirname(value('file')), { recursive: true });
  writeFileSync(value('file'), `${JSON.stringify(record)}\n`);
}

export async function main(argv = process.argv) {
  if (argv.includes('--worker')) return worker(argv);
  const options = parseArgs(argv);
  const arms = [describeTree('A', options.a), describeTree('B', options.b)];
  const jobs = planJobs({ ...options, arms, measurement: measurementFingerprint() });
  // Longest first, so the pool's last matches are its shortest.
  const todo = (options.reuse ? jobs.filter((job) => !existsSync(job.file)) : jobs).slice().sort((x, y) => y.ticks - x.ticks);
  for (const job of jobs) if (!todo.includes(job)) readRecord(job);
  console.error(`selfplay-ab: ${jobs.length} matches (${todo.length} to play) on ${options.jobs} processes; records in ${options.out}`);
  const failures = await runPool(todo, options.jobs);
  if (failures.length > 0) throw new Error(`${failures.length} of ${todo.length} matches failed; their records are missing from ${options.out}`);
  const read = (arm) => jobs.filter((job) => job.arm === arm).map(readRecord);
  const report = formatReport({ arms, config: options.config, recordsA: read('A'), recordsB: read('B'), owners: CONFIGS[options.config].owners });
  writeFileSync(join(options.out, 'report.md'), `${report}\n`);
  console.log(report);
}

/** A match's record, refused unless it is the match the job names: a reused folder may hold another run's. */
export function readRecord(job) {
  const record = JSON.parse(readFileSync(job.file, 'utf8'));
  for (const key of ['seed', 'config', 'ticks']) {
    if (record[key] !== job[key]) throw new Error(`${job.file} records ${key} ${record[key]}, not the ${job[key]} this run plays`);
  }
  if (record.schema !== RECORD_SCHEMA) throw new Error(`${job.file} has record schema ${record.schema}, not ${RECORD_SCHEMA}`);
  for (const key of ['game', 'measurement']) {
    if (record.fingerprints?.[key] !== job.fingerprints[key]) {
      throw new Error(`${job.file} was played on ${key} ${record.fingerprints?.[key] ?? 'unknown'}, not this run's ${job.fingerprints[key]}; play it again`);
    }
  }
  return record;
}

if (runDirectly(import.meta.url)) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
