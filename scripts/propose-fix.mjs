#!/usr/bin/env node
// Reads a self-improvement ledger or legacy REPORT.md, picks a fix target,
// asks Codex/Claude for a patch, validates with `git apply --check`, and
// writes proposal artifacts.
// Run via `tsx scripts/propose-fix.mjs` (set up by `npm run propose-fix`).

import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename } from 'node:path';

import { buildFixPrompt, sourceFilesForOracle } from '../src/game/playtest/fixBotPrompt.ts';
import { slugIdPart } from '../src/game/playtest/oracleImprovementFindings.ts';
import { selectLedgerFixCandidate } from '../src/game/playtest/fixProposalInput.ts';

function parseArgs(argv) {
  const args = {
    in: 'output/playtests/run',
    oracle: null,
    reviewer: 'claude',
    ledger: null,
    findingId: null,
    dryRun: false,
    proposalRoot: 'output/fix-proposals',
  };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    // --bundle is the documented form in DESIGN.md; --in is kept as an alias
    // because earlier scripting referenced it. Both point at the bundle base
    // path (the suffixes `.json`, `.envelope.json`, `-report/REPORT.md`, etc.
    // are appended downstream).
    if (a === '--in' || a === '--bundle') args.in = argv[++i];
    else if (a === '--oracle') args.oracle = argv[++i];
    else if (a === '--reviewer') args.reviewer = argv[++i];
    else if (a === '--ledger') args.ledger = argv[++i];
    else if (a === '--finding-id') args.findingId = argv[++i];
    else if (a === '--dry-run') args.dryRun = true;
    else if (a === '--proposal-root') args.proposalRoot = argv[++i];
    else if (a.startsWith('--')) {
      console.error(`fix-bot: unknown argument '${a}'`);
      process.exit(2);
    }
  }
  return args;
}

// On Windows we MUST set shell: true to spawn .cmd shims (CVE-2024-27980
// mitigation in Node >= 22.0.0 returns EINVAL otherwise). cmd.exe does not
// glob-expand `[1m]`, so the bracketed model name passed below is safe
// when shelled. The prompt itself is delivered via stdin so cmd.exe never
// sees its content.
const useShell = process.platform === 'win32';

function which(bin) {
  const cmd = process.platform === 'win32' ? 'where' : 'which';
  const r = spawnSync(cmd, [bin], { encoding: 'utf8' });
  return r.status === 0 && r.stdout.trim().length > 0;
}

function readSourceFile(path, maxLines = 500) {
  if (!existsSync(path)) return null;
  const content = readFileSync(path, 'utf8');
  const lines = content.split('\n');
  if (lines.length > maxLines) {
    return { path, content: lines.slice(0, maxLines).join('\n') + '\n[...truncated]\n' };
  }
  return { path, content };
}

function pickTickNeighborhood(bundle, tick, radius = 5) {
  if (tick == null) return [];
  return bundle.ticks.filter((t) => Math.abs(t.tick - tick) <= radius).slice(0, 11);
}

function extractDiff(modelOutput) {
  const m = modelOutput.match(/```diff\n([\s\S]*?)```/);
  return m ? m[1] : null;
}

function extractWhy(modelOutput) {
  const m = modelOutput.match(/```why\n([\s\S]*?)```/);
  return m ? m[1].trim() : '';
}

function parseReportViolations(report) {
  const violations = [];
  for (const line of report.split('\n')) {
    const m = line.match(/^\| (\S+) \| (low|medium|high) \| (\S+) \| (.+?) \|$/);
    if (m) {
      const tick = Number(m[3]);
      violations.push({
        oracle: m[1],
        severity: m[2],
        tick: Number.isFinite(tick) ? tick : null,
        message: m[4],
      });
    }
  }
  return violations;
}

function selectTarget(args) {
  if (args.ledger) {
    const ledger = JSON.parse(readFileSync(args.ledger, 'utf8'));
    const selected = selectLedgerFixCandidate(ledger, {
      findingId: args.findingId,
      oracle: args.oracle,
    });
    if (!selected) return null;
    return {
      prefix: selected.prefix,
      target: selected.violation,
      findingId: selected.findingId,
      ledgerPath: args.ledger,
    };
  }

  const reportPath = `${args.in}-report/REPORT.md`;
  const report = readFileSync(reportPath, 'utf8');
  const violations = parseReportViolations(report);
  const target = args.oracle
    ? violations.find((v) => v.oracle === args.oracle) ?? violations.find((v) => v.severity === 'high')
    : violations.find((v) => v.severity === 'high');
  if (!target) return null;
  return { prefix: args.in, target, findingId: null, ledgerPath: null };
}

const args = parseArgs(process.argv);
const claudeBin = process.platform === 'win32' ? 'claude.cmd' : 'claude';
const codexBin = process.platform === 'win32' ? 'codex.cmd' : 'codex';
const reviewerBin = args.reviewer === 'claude' ? claudeBin : codexBin;

const selected = selectTarget(args);
if (!selected) {
  console.error(
    args.ledger
      ? 'fix-bot: no eligible fix finding in ledger'
      : 'fix-bot: no high-severity violation in report and no --oracle override',
  );
  process.exit(0);
}

const bundle = JSON.parse(readFileSync(`${selected.prefix}.json`, 'utf8'));
const envelope = JSON.parse(readFileSync(`${selected.prefix}.envelope.json`, 'utf8'));
const sourceFiles = sourceFilesForOracle(selected.target.oracle)
  .map((p) => readSourceFile(p))
  .filter(Boolean);

const tickNeighborhood = pickTickNeighborhood(bundle, selected.target.tick);
// Truncate at a structural boundary (drop ticks from the tail) rather than
// byte-slicing. A mid-token slice produces invalid JSON and forces every
// downstream LLM to ignore the surrounding fenced block.
const TICK_JSON_BUDGET = 8192;
let tickJsonCandidate = JSON.stringify(tickNeighborhood, null, 2);
let tickJsonNeighborhood = tickNeighborhood;
while (tickJsonCandidate.length > TICK_JSON_BUDGET && tickJsonNeighborhood.length > 1) {
  tickJsonNeighborhood = tickJsonNeighborhood.slice(0, -1);
  tickJsonCandidate = JSON.stringify(tickJsonNeighborhood, null, 2);
}
const tickJson = tickJsonCandidate;

const prompt = buildFixPrompt({
  violation: selected.target,
  envelopeJson: JSON.stringify(envelope, null, 2),
  tickNeighborhoodJson: tickJson,
  sourceFiles,
});

const proposalDir = `${args.proposalRoot}/${basename(selected.prefix)}/${slugIdPart(selected.target.oracle)}`;
mkdirSync(proposalDir, { recursive: true });
writeFileSync(
  `${proposalDir}/TARGET.json`,
  JSON.stringify({
    prefix: selected.prefix,
    ...(selected.ledgerPath ? { ledger: selected.ledgerPath } : {}),
    ...(selected.findingId ? { findingId: selected.findingId } : {}),
    violation: selected.target,
  }, null, 2),
);

if (args.dryRun) {
  writeFileSync(`${proposalDir}/PROMPT.md`, prompt);
  console.log(`proposal: ${proposalDir}/`);
  console.log('status: dry-run');
  process.exit(0);
}

if (!which(reviewerBin)) {
  console.error(`fix-bot: '${reviewerBin}' not on PATH. Install or pick a different --reviewer.`);
  process.exit(2);
}

// Invoke the reviewer CLI. Resolve .cmd shim per platform; pass prompt via
// stdin so shell metacharacters in the prompt don't trip cmd.exe / sh.
let modelOutput;
if (args.reviewer === 'claude') {
  modelOutput = execFileSync(
    claudeBin,
    [
      '-p',
      '--model',
      'claude-opus-4-8[1m]',
      '--effort',
      'max',
      '--allowedTools',
      'Read,Glob,Grep',
    ],
    { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024, input: prompt, shell: useShell },
  );
} else if (args.reviewer === 'codex') {
  modelOutput = execFileSync(
    codexBin,
    [
      'exec',
      '--model',
      'gpt-5.5',
      '-c',
      'model_reasoning_effort=xhigh',
      '-c',
      'approval_policy=never',
      '--sandbox',
      'read-only',
      '--ephemeral',
    ],
    { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024, input: prompt, shell: useShell },
  );
} else {
  console.error(`fix-bot: unknown reviewer '${args.reviewer}'`);
  process.exit(2);
}

const diff = extractDiff(modelOutput);
const why = extractWhy(modelOutput);
let applyStatus = 'no diff returned';

if (diff) {
  const diffPath = `${proposalDir}/proposal.diff`;
  writeFileSync(diffPath, diff);
  // git apply --check (does not modify the working tree).
  const r = spawnSync('git', ['apply', '--check', diffPath], { encoding: 'utf8' });
  if (r.status === 0) {
    applyStatus = 'applies cleanly';
  } else {
    applyStatus = `git apply --check failed: ${r.stderr.trim()}`;
  }
}

writeFileSync(
  `${proposalDir}/WHY.md`,
  `# Fix proposal for ${selected.target.oracle}\n\n`
    + `**Apply status:** ${applyStatus}\n\n`
    + `## Why\n\n${why}\n\n`
    + `## Raw model output\n\n\`\`\`\n${modelOutput.slice(0, 8192)}\n\`\`\`\n`,
);

console.log(`proposal: ${proposalDir}/`);
console.log(`status: ${applyStatus}`);
