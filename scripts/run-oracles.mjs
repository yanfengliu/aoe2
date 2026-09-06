#!/usr/bin/env node
// Reads a playtest bundle + envelope, runs oracles, writes REPORT.md.
// Run via `tsx scripts/run-oracles.mjs` (set up by `npm run run-oracles`).

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { basename } from 'node:path';
import { readBundleFile } from '../src/game/playtest/bundleIo.ts';
import { runOracles } from '../src/game/playtest/oracles.ts';

function parseArgs(argv) {
  const args = { in: 'output/playtests/run', thresholds: {} };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--in') args.in = argv[++i];
    else if (a === '--thresholds') args.thresholds = JSON.parse(argv[++i]);
    else if (a === '--thresholds-file') args.thresholds = JSON.parse(readFileSync(argv[++i], 'utf8'));
  }
  return args;
}

const args = parseArgs(process.argv);
// Streamed read: a full-length run's bundle is past V8's max string length, so
// `JSON.parse(readFileSync(...))` would throw on the very runs the oracles matter for.
const bundle = readBundleFile(`${args.in}.json`);
const envelope = JSON.parse(readFileSync(`${args.in}.envelope.json`, 'utf8'));
const violations = runOracles(bundle, envelope, args.thresholds);

const reportDir = `${args.in}-report`;
mkdirSync(reportDir, { recursive: true });
const lines = [
  `# Oracle report — ${basename(args.in)}`,
  '',
  `**stopReason:** ${envelope.stopReason}    **ticksRun:** ${envelope.ticksRun}    **seed:** ${envelope.seed}`,
  '',
];
const high = violations.filter((v) => v.severity === 'high');
const medium = violations.filter((v) => v.severity === 'medium');
const low = violations.filter((v) => v.severity === 'low');
lines.push(`**Violations:** high=${high.length} medium=${medium.length} low=${low.length}`);
lines.push('');
if (violations.length === 0) {
  lines.push('No violations.');
} else {
  lines.push('| Oracle | Severity | Tick | Message |');
  lines.push('|---|---|---|---|');
  for (const v of violations) {
    lines.push(`| ${v.oracle} | ${v.severity} | ${v.tick ?? '—'} | ${v.message.replace(/\|/g, '\\|')} |`);
  }
}

writeFileSync(`${reportDir}/REPORT.md`, lines.join('\n'));
console.log(`report: ${reportDir}/REPORT.md`);
process.exit(high.length);
