// The arithmetic and the tables of `scripts/selfplay-ab.mjs` (work 144), kept apart from its process pool so that
// tests/scripts/selfplayAb.test.ts can check them on hand-made records.
//
// A column is a number per owner per match, or null. In a TIME column (when something happened) null means "not
// within the horizon" and counts as later than any tick: a median over [9,000, 9,500, never] is 9,500, and a seed
// that reached Castle in arm A and not in arm B moves by "+never" (lost), the other way "-never" (gained). In a COUNT
// column null means "not measured" (a match that ended before 20:00 has no villagers at 20:00) and the seed is left
// out of that column. Each column is summarized by its median and its range over the seeds, the spread the brief
// asks for; with the same seeds in both arms, the per-seed difference B - A is summarized the same way, with how
// many seeds moved up, down or not at all. The median of an even count is the mean of its middle two, so a seed that
// reached a time and one that never did give "never", and a gain and a loss give "?": swapping the arms negates
// every median.

export const NEVER = Number.POSITIVE_INFINITY;
const TICKS_PER_MINUTE = 600;
// The army, and the complete farms and the wood (work 147 M2), every 5,000 ticks, to the longest horizon the A/B plays
// by default (60,000).
export const ARMY_SAMPLES = 12;
const field = (name) => (p) => p[name];
/** The series sampled every 5,000 ticks: [label, the record field holding them]. */
export const SERIES = [['army', 'armyByTick'], ['farms', 'farmsByTick'], ['wood', 'woodByTick']];
const seriesColumn = (label, key, i) => [`${label} ${(i + 1) * 5}k`, 'count', (p) => p[key]?.[i] ?? null, key];
const seriesColumns = (label, key, from, to) => Array.from({ length: to - from }, (_unused, k) => seriesColumn(label, key, from + k));

/** Per-owner columns: [label, kind, read(ownerRecord), the record field it reads]. Every field of an owner's record
 *  has one; tests/scripts/selfplayAb.test.ts holds that against a played record (review round 0, R0-3). */
export const COLUMNS = [
  ['Feudal click', 'time', field('feudalClick'), 'feudalClick'],
  ['Feudal', 'time', field('feudal'), 'feudal'],
  ['Castle click', 'time', field('castleClick'), 'castleClick'],
  ['Castle', 'time', field('castle'), 'castle'],
  ['Imperial click', 'time', field('imperialClick'), 'imperialClick'],
  ['Imperial', 'time', field('imperial'), 'imperial'],
  ['vills at Feudal click', 'count', field('villagersAtFeudalClick'), 'villagersAtFeudalClick'],
  ['vills at Castle click', 'count', field('villagersAtCastleClick'), 'villagersAtCastleClick'],
  ...[5, 10, 15, 20].map((minute) => [`vills ${minute}:00`, 'count', (p) => p.villagersAt[minute] ?? null, 'villagersAt']),
  ['first farm', 'time', field('firstFarm'), 'firstFarm'],
  ['qualified', 'time', field('qualified'), 'qualified'],
  ['Castle bldg', 'time', field('castleBuilding'), 'castleBuilding'],
  ['Monastery', 'time', field('monastery'), 'monastery'],
  ['Monk', 'time', field('monk'), 'monk'],
  ['peak army', 'count', field('peakArmy'), 'peakArmy'],
  ...SERIES.flatMap(([label, key]) => seriesColumns(label, key, 0, ARMY_SAMPLES)),
  ['Siege Workshop', 'time', field('siegeWorkshop'), 'siegeWorkshop'],
  ['farm floor breaches', 'count', field('farmFloorBreaches'), 'farmFloorBreaches'],
  ['farms run out', 'count', field('farmsRunOut'), 'farmsRunOut'],
  ['farms reseeded', 'count', field('farmsReseeded'), 'farmsReseeded'],
  ['vill lost', 'count', field('villagersLost'), 'villagersLost'],
  ['under def', 'count', field('underDefence'), 'underDefence'],
  ['first siege', 'time', field('siege'), 'siege'],
  ['peak siege', 'count', field('siegePeak'), 'siegePeak'],
  ['bldg types', 'count', (p) => p.buildings.length, 'buildings'],
  ['unit types', 'count', (p) => p.units.length, 'units'],
  ['relics', 'count', field('relics'), 'relics'],
];

/** The columns for a set of records: COLUMNS, with a row of each 5,000-tick series for every sample past the twelfth
 *  that any record holds, so a horizon past 60,000 keeps its last samples (review round 1, R1-4). */
export function columnsFor(records) {
  const samples = Math.max(0, ...records.flatMap((r) => Object.values(r.owners).flatMap((p) => SERIES.map(([, key]) => p[key]?.length ?? 0))));
  if (samples <= ARMY_SAMPLES) return COLUMNS;
  let columns = COLUMNS;
  for (const [label, key] of SERIES) {
    const after = columns.findLastIndex((c) => c[3] === key) + 1;
    columns = [...columns.slice(0, after), ...seriesColumns(label, key, ARMY_SAMPLES, samples), ...columns.slice(after)];
  }
  return columns;
}

/** A column's value for one owner of one record: a number, NEVER for a time not reached, or null for unmeasured. */
export function columnValue(column, record, owner) {
  const [, kind, read] = column;
  const raw = read(record.owners[owner]);
  if (raw === null || raw === undefined) return kind === 'time' ? NEVER : null;
  return raw;
}

/** The match's end, as a time column: the tick it resolved, or NEVER for a match still running at its horizon. */
export function endValue(record) {
  return record.outcome.state === 'running' ? NEVER : record.outcome.endedAt;
}

/** Median of numbers (NEVER sorts last), null for none. For an even count it is the mean of the middle two, in IEEE
 *  arithmetic: a time and "never" give "never", and -never and +never give NaN, shown as "?" (review round 0, R0-4:
 *  taking the lower of the two read a gain and a loss as a gain whichever arm was A). */
export function median(values) {
  const sorted = values.filter((v) => v !== null).sort((x, y) => x - y);
  if (sorted.length === 0) return null;
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[mid];
  return (sorted[mid - 1] + sorted[mid]) / 2;
}

/** Median and range of one column over a set of values. */
export function spread(values) {
  const present = values.filter((v) => v !== null);
  if (present.length === 0) return null;
  return {
    median: median(present),
    min: Math.min(...present),
    max: Math.max(...present),
    n: present.length,
    never: present.filter((v) => v === NEVER).length,
  };
}

/** B - A for one seed. Two times never reached are the same; one reached and one not is a move of +/-NEVER. */
export function difference(a, b) {
  if (a === null || b === null) return null;
  if (a === NEVER && b === NEVER) return 0;
  if (b === NEVER) return NEVER;
  if (a === NEVER) return -NEVER;
  return b - a;
}

/** The per-seed differences of paired values, with how many moved up, down or not at all. */
export function pairedSummary(aValues, bValues) {
  if (aValues.length !== bValues.length) throw new Error(`paired arms need one value per seed; got ${aValues.length} and ${bValues.length}`);
  const diffs = aValues.map((a, i) => difference(a, bValues[i])).filter((d) => d !== null);
  if (diffs.length === 0) return null;
  return {
    ...spread(diffs),
    up: diffs.filter((d) => d > 0).length,
    down: diffs.filter((d) => d < 0).length,
    same: diffs.filter((d) => d === 0).length,
  };
}

export function formatValue(kind, value) {
  if (value === null || value === undefined) return 'n/a';
  if (Number.isNaN(value)) return '?';
  if (value === NEVER) return 'never';
  if (value === -NEVER) return '-never';
  if (kind === 'time') {
    const sign = value < 0 ? '-' : '';
    const seconds = Math.round(Math.abs(value) / 10);
    return `${sign}${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
  }
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function formatDelta(kind, value) {
  if (value === NEVER) return '+never';
  const text = formatValue(kind, value);
  return value > 0 ? `+${text}` : text;
}

function formatSpread(kind, s) {
  if (s === null) return 'n/a';
  const range = s.min === s.max ? '' : ` [${formatValue(kind, s.min)}-${formatValue(kind, s.max)}]`;
  return `${formatValue(kind, s.median)}${range}`;
}

function formatPaired(kind, s) {
  if (s === null) return 'n/a';
  const range = s.min === s.max ? '' : ` [${formatDelta(kind, s.min)} to ${formatDelta(kind, s.max)}]`;
  return `${formatDelta(kind, s.median)}${range} (${s.up} up, ${s.down} down, ${s.same} same)`;
}

/** Groups records by map, in the order maps first appear, each group's records in seed order. */
export function groupByMap(records) {
  const groups = new Map();
  for (const record of records) {
    if (!groups.has(record.map)) groups.set(record.map, []);
    groups.get(record.map).push(record);
  }
  return groups;
}

/** Whether two arms played the same seeds of a map, so their differences can be taken seed by seed. */
export function isPaired(aRecords, bRecords) {
  return aRecords.length === bRecords.length && aRecords.every((r, i) => r.seed === bRecords[i].seed);
}

function endLabel(record) {
  const { outcome } = record;
  if (outcome.state === 'running') return 'running';
  const who = outcome.winner === null ? outcome.state : `o${outcome.winner} wins`;
  return `${who} at ${formatValue('time', outcome.endedAt)}`;
}

/** The markdown block for one map: the matches' ends seed by seed, then every column per owner. */
export function mapTable(map, aRecords, bRecords, owners, columns = COLUMNS) {
  const paired = isPaired(aRecords, bRecords);
  const lines = [];
  lines.push(`### ${map}`, '');
  lines.push(`Seeds A: ${aRecords.map((r) => r.seed).join(', ')}.${paired ? ' B: the same.' : ` B: ${bRecords.map((r) => r.seed).join(', ')} (unpaired).`}`, '');
  const length = Math.max(aRecords.length, bRecords.length);
  lines.push('| seed | A ends | B ends |', '|---|---|---|');
  for (let i = 0; i < length; i += 1) {
    const a = aRecords[i];
    const b = bRecords[i];
    const seed = paired ? a.seed : `${a?.seed ?? '-'} / ${b?.seed ?? '-'}`;
    lines.push(`| ${seed} | ${a ? endLabel(a) : '-'} | ${b ? endLabel(b) : '-'} |`);
  }
  lines.push('');
  lines.push(`| column | own | A: median [range] | B: median [range] | ${paired ? 'B - A per seed: median [range]' : 'B - A of medians'} |`);
  lines.push('|---|---|---|---|---|');
  const endA = spread(aRecords.map(endValue));
  const endB = spread(bRecords.map(endValue));
  let endDelta;
  if (paired) endDelta = formatPaired('time', pairedSummary(aRecords.map(endValue), bRecords.map(endValue)));
  else endDelta = endA === null || endB === null ? 'n/a' : formatDelta('time', difference(endA.median, endB.median));
  lines.push(`| match end | - | ${formatSpread('time', endA)} | ${formatSpread('time', endB)} | ${endDelta} |`);
  for (const column of columns) {
    const [label, kind] = column;
    for (const owner of owners) {
      const a = aRecords.map((r) => columnValue(column, r, owner));
      const b = bRecords.map((r) => columnValue(column, r, owner));
      const sa = spread(a);
      const sb = spread(b);
      if (sa === null && sb === null) continue;
      let delta;
      if (paired) delta = formatPaired(kind, pairedSummary(a, b));
      else delta = sa === null || sb === null ? 'n/a' : formatDelta(kind, difference(sa.median, sb.median));
      lines.push(`| ${label} | ${owner} | ${formatSpread(kind, sa)} | ${formatSpread(kind, sb)} | ${delta} |`);
    }
  }
  lines.push('');
  return lines;
}

/** Every paired seed of every map at once: per column and owner, how the seeds moved. */
export function pooledTable(groupsA, groupsB, owners, columns = COLUMNS) {
  const lines = ['### All maps, seed by seed', '', '| column | own | B - A per seed: median [range] |', '|---|---|---|'];
  const pairs = [...groupsA.keys()].filter((map) => groupsB.has(map) && isPaired(groupsA.get(map), groupsB.get(map)));
  if (pairs.length === 0) return [];
  for (const column of columns) {
    const [label, kind] = column;
    for (const owner of owners) {
      const a = pairs.flatMap((map) => groupsA.get(map).map((r) => columnValue(column, r, owner)));
      const b = pairs.flatMap((map) => groupsB.get(map).map((r) => columnValue(column, r, owner)));
      const s = pairedSummary(a, b);
      if (s !== null) lines.push(`| ${label} | ${owner} | ${formatPaired(kind, s)} |`);
    }
  }
  lines.push('');
  return lines;
}

/** Seeds of one map whose scenarios are one scenario, and seeds whose arms generated different scenarios. */
export function digestWarnings(groupsA, groupsB) {
  const warnings = [];
  for (const [map, records] of groupsA) {
    const digests = new Map();
    for (const r of [...records, ...(groupsB.get(map) ?? [])]) {
      if (!digests.has(r.scenarioDigest)) digests.set(r.scenarioDigest, new Set());
      digests.get(r.scenarioDigest).add(r.seed);
    }
    for (const seeds of digests.values()) {
      if (seeds.size > 1) warnings.push(`${map}: seeds ${[...seeds].join(', ')} generate one scenario, so they are one match`);
    }
    for (const b of groupsB.get(map) ?? []) {
      const a = records.find((r) => r.seed === b.seed);
      if (a && a.scenarioDigest !== b.scenarioDigest) warnings.push(`${map}: seed ${b.seed} generates a different map in each arm`);
    }
  }
  return warnings;
}

/** The whole report: a header naming both arms, any warnings, one block per map and the pooled table. */
export function formatReport({ arms, config, recordsA, recordsB, owners }) {
  const groupsA = groupByMap(recordsA);
  const groupsB = groupByMap(recordsB);
  const columns = columnsFor([...recordsA, ...recordsB]);
  const lines = [`# Self-play A/B — ${config} configuration`, ''];
  for (const arm of arms) {
    lines.push(`- ${arm.label}: ${arm.root} at ${arm.commit}${arm.dirty ? ' with uncommitted changes' : ''}.`);
  }
  lines.push('', `Times are game time (m:ss, ${TICKS_PER_MINUTE} ticks a minute); "never" is not within the match's horizon or before its end; "?" is a median between -never and +never.`, '');
  const warnings = digestWarnings(groupsA, groupsB);
  for (const warning of warnings) lines.push(`WARNING: ${warning}.`);
  if (warnings.length > 0) lines.push('');
  for (const [map, aRecords] of groupsA) {
    lines.push(...mapTable(map, aRecords, groupsB.get(map) ?? [], owners, columns));
  }
  lines.push(...pooledTable(groupsA, groupsB, owners, columns));
  return lines.join('\n');
}
