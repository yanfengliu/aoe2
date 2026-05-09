# Playtest Loop — Plan Iteration 3 Review

Date: 2026-05-08

Reviewers: Codex (`gpt-5.5` xhigh, read-only) and Claude (`opus-4-7[1m]` max). Both verified iter-2 fixes against the live codebase.

## Disposition

**Convergence reached.** Claude reports "iter-3 is implementation-ready" with three NITs. Codex reports one HIGH (duplicate `bundleHotspots` import — the iter-3 fix to Task 16 added the import alongside Task 15's existing import) plus one wording NIT. The HIGH is a doc-correction issue, not a runtime bug; both fixed inline. Plan is ready for implementation.

## Findings

### HIGH (Codex; doc-only)

Task 16's import block re-introduced `import { bundleHotspots } from 'civ-engine'` that Task 15 had already added. Following the plan literally would produce a duplicate import in `oracles.ts` and break parsing.

**Resolution.** Task 16's "place these imports at the top" block now lists only the NEW imports (`Position`, `EntityId`, `reconstructPositions`, `netManhattanProgress`) with an explicit note that `bundleHotspots` was already imported in Task 15.

### NIT (Codex)

Phase 2 commit-message text and self-review section still referred to "economy-progression (skeleton)" while the plan now intentionally ships no economy oracle. Updated to "Economy-progression deferred to Phase 6" in both spots.

### Iter-2 fix verification (clean)

| ID | Status | Evidence |
|---|---|---|
| **N1 (HIGH)** — `shell: true` removed | ✅ FIXED | Zero `shell: true` invocations remain. Both reviewers confirm: propose-fix.mjs uses `claudeBin` / `codexBin` resolution + `input: prompt` (stdin); playtest-corpus.mjs uses `npmBin = process.platform === 'win32' ? 'npm.cmd' : 'npm'`. JSON thresholds via `--thresholds-file` tempfile (run-oracles.mjs gained the flag). |
| **H-NEW-1** — economyProgression deregistered | ✅ FIXED | `ORACLES` array contains 4 oracles; `economyProgression` removed from registration; Phase-6 follow-up entry documents the reason. |
| **H-NEW-2** — corpus runner exits on HIGH | ✅ FIXED | `oracleR = spawnSync(...)`, `totalHigh += oracleR.status ?? 0`, `process.exit(totalHigh > 0 ? 1 : 0)`. |
| **NIT** — unused `dirname` imports | ✅ FIXED | `propose-fix.mjs` and `run-oracles.mjs` import only `basename`. |
| **NIT** — CI `.sort()` | ✅ FIXED | `(fs.existsSync(corpusDir) ? fs.readdirSync(corpusDir) : []).sort()`. |
| **NIT** — "append" → top-of-file | ✅ FIXED | Task 15/16 import instructions corrected. |

### Remaining NITs (non-blocking)

- **N1 (Claude).** Phase 3 / Phase 4 review tasks reference Task 9's prompt without an explicit "no shell:true" verification bullet. Mitigated by inline warning comments in the script bodies; future implementer reviewing the diffs sees the rationale.
- **N2 (Claude).** `oracleR.status ?? 0` semantics: variable named `totalHigh` actually sums exit codes. Practically equivalent (run-oracles exits with `high.length`); 8-bit POSIX exit-code wrap at ≥256 violations is theoretically possible but implausible. No fix needed.
- **N3 (Claude).** CI workflow's "Post SUMMARY.md to PR check" step lacks `if: always()`. On runs that exit 1, the corpus step fails and the comment step is skipped — SUMMARY.md is preserved as artifact but lost from PR-inline visibility. Consider adding `if: always() && github.event_name == 'pull_request'`. Future hardening.

## Verified clean

Both reviewers verify all 11 iter-1 + 3 iter-2 fixes remain in place. SessionRecorder API, MemorySink/SinkWriteError exports, WorldSnapshotV5/TickDiff/TickFailure shapes, oracle source-file paths, npm engine block, bundleHotspots filter logic, position diff path — all correct against the live codebase.

## Disposition

**Plan is implementation-ready.** Ship Phase 1.
