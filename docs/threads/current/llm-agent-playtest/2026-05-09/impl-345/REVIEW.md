# LLM-Agent Playtest — Phase 3 + 4.A + 5 Implementation Review

Date: 2026-05-09

Reviewers:
- **Codex** (`gpt-5.5` xhigh, read-only sandbox). 7 MEDIUM, 0 HIGH.
- **Claude** (`claude-opus-4-7[1m]` max effort). 1 HIGH + 6 MEDIUM. The HIGH and 4 of the MEDIUMs overlap with Codex; 3 MEDIUMs are new.

## Disposition

**Iter-2 fixes applied inline.** Reviewers agreed on the `pixelmatch diffMask` bug (HIGH per Claude, MEDIUM per Codex), and substantially overlapped on the cost-budget-vs-regression separation, the engineHalt envelope-preservation gap, and the blob-revoke. All overlaps were addressed in the Codex-fix commit (`e151616`); this commit closes the 3 unique Claude findings (server lifecycle, waitForBoot agent-surface check, retention semantic).

## Findings

### HIGH (Claude only — Codex flagged the same defect at MEDIUM)

**H1. `pixelmatch` called without `diffMask: true`; `countDiffInRect` mis-counts unchanged pixels as diffs, silently swallowing legitimate violations OUTSIDE the ignored rect.** (Claude H1 + Codex M4 first concern.)

`pixelmatch`'s default output paints unchanged pixels as the original image alpha-blended over white (non-zero RGB). `countDiffInRect`'s "non-zero RGB" check then counted those as diffs, so `ignoredDiffPixels` ≈ `rect.area` regardless of where the actual diffs were. The subtraction `Math.max(0, diffPixels - ignoredDiffPixels)` zeroed out global diffs whenever the rect's area exceeded the actual diff count — concrete repro: 100 real diffs (50 in rect, 50 outside), 40×40 rect, ignored count returns 1600, adjustedDiff = 0, no violation fires.

The existing `'respects ignoreRects'` test accidentally passed because the rect (4×4 = 16) was exactly the size of the diff region (4×4 of red), masking the bug.

**Fix.** Pass `diffMask: true` to pixelmatch (paints unchanged transparent + changed opaque red); `countDiffInUnion` walks the alpha channel instead of RGB. New regression test pins both behaviors: diffs inside an oversized rect are masked, diffs outside survive.

### MEDIUM (overlap with Codex — already fixed in `e151616`)

- **M1 (Claude M1 + Codex M6)** — corpus runner conflated cost-budget-exceeded with regression. Fixed: gate exit on `stopReason === 'engineHalt'` OR errorMessage other than `cost-budget-exceeded`.
- **M3 (Claude M3 + Codex M1)** — engineHalt envelope lost when exportBundle also threw. Fixed: wrap exportBundle in try/catch, append export-failure message, synthesize empty bundle stub.
- **M4 (Claude M4 + Codex M4 second concern)** — overlapping ignoreRects double-subtracted. Fixed: `countDiffInUnion` walks union via seen-bitmask.
- **M5 (Claude M5 + Codex M3)** — blob URL never revoked. Fixed: `URL.revokeObjectURL` in `finally`; switched to `page.request.fetch` so bytes don't round-trip through JSON-RPC.

### MEDIUM (new — addressed in this commit)

**M2. Server lifecycle gaps: SIGINT registered too late, SIGTERM unhandled, Windows process tree leaks.** (Claude M2.)

Three composing issues: (1) `process.on('SIGINT', ...)` registered AFTER `await startServer(...)`, so a SIGINT during the 30-second startup poll left the spawned `npm run preview` orphaned holding port 5174. (2) Only SIGINT — a `kill <pid>` from a supervisor would leak. (3) `p.kill()` sends SIGTERM to `npm.cmd` but on Windows doesn't propagate to the grandchild `node.exe` running vite preview, which then squats port 5174 indefinitely.

**Fix.** Hoisted `let server`, `let browser`, `cleanup` BEFORE startServer. Registered both SIGINT and SIGTERM. New `killProcessTree(child)` uses `taskkill /F /T /PID` on Windows + `process.kill(-pid, 'SIGTERM')` on POSIX (with the spawn'd child in `detached: true` so it has its own process group).

**M6. `waitForBoot` doesn't assert `__AOE2_TEST__.agent` surface presence.** (Claude M6.)

Without this, a boot-vs-agent race (HMR window in `--use-dev-server` mode, late dynamic-import resolution) leaves `__AOE2_TEST__` defined but `agent` methods undefined. The next host call hits a bare `TypeError` that the operator can't decode from the envelope.

**Fix.** Strengthened `page.waitForFunction` to also assert `typeof window.__AOE2_TEST__?.agent?.snapshotForAgent === 'function'` (and dispatchAgentCommand, exportRecorderBundleToFile). Defends against the race; deterministic 60s timeout error on persistent failure.

**M7. Retention pruning semantic drifts as corpus grows.** (Claude M7.)

`RETENTION_KEEP=5` with a K-row corpus retains 5 stems total — for K=1 that's effectively 5 days, but for K=6 it's not even a full day's worth (yesterday's last 5 of 6 + today's first row evicts the oldest of yesterday). Operators expect "last N days of history" but get "last N rows of history".

**Fix.** Bumped `RETENTION_KEEP` to 25 + documented the operator-side semantic ("keep the most-recent N run-stems where one stem = `${date}-${row.name}`; the default is sized for the current 1-row corpus × 25 days; raise proportionally as you grow the corpus"). The cleaner long-term fix is a per-invocation timestamped dir but that's a larger refactor; deferred.

### MEDIUM (new from Codex — already addressed in `e151616`)

- **Codex M2** — server-port-collision pre-flight check. Fixed alongside Claude M2.
- **Codex M5** — retention pruning previously a no-op (only handled directories, not flat files). Fixed: stem-based grouping handles flat files + sibling -screenshots dirs.
- **Codex M7** — workflow_dispatch inputs not plumbed through. Fixed: split run step into corpus-default vs override paths.

## Verified clean

- pixelmatch threshold `0.1` + `includeAA: false`: standard preset, fine.
- Workflow PR gate `vars.ANTHROPIC_KEY_AVAILABLE == 'true'` fails closed when unset.
- Build runs before preview spawn → build failure doesn't leave a half-started preview.
- pruneOldRuns concurrent-race not a concern (GitHub Actions concurrency serialization).

## Action plan

Iter-2 fixes (this commit) closed the 3 Claude-unique findings:

1. **Claude M2.** killProcessTree + hoisted SIGINT+SIGTERM handlers + detached spawn group.
2. **Claude M6.** waitForBoot strengthened to assert agent-surface presence.
3. **Claude M7.** RETENTION_KEEP bumped to 25 + operator-side semantic documented.

108 cumulative LLM-thread tests pass; typecheck/lint/build clean.

## Next iteration

If this iter converges, Phase 3+4+5 implementation review closes. Thread close-out: `git mv docs/threads/current/llm-agent-playtest docs/threads/done/llm-agent-playtest` + final devlog summary entry.
