# Playtest Loop — Implementation Review iter-3 (combined Phases 3+4+5 + iter-2 follow-up)

Date: 2026-05-08

Reviewers: Codex (`gpt-5.5` xhigh, read-only sandbox, ~/.codex/rules/default.rules active for Windows-native file ops), Claude (`opus-4-7[1m]` max effort, `Read,Glob,Grep,Bash(git diff *),Bash(git log *)` enabled). Both reviewers inspected the live codebase (verified file paths, function signatures, and CVE behavior) rather than relying on prompt text.

## Disposition

**Iter-3 fixes applied inline** for 2 HIGH + 4 MEDIUM + 2 LOW + 1 PROCESS findings. Reviewers converged on substantive issues; nothing flagged was hallucinated.

## Findings

### HIGH

**H1. `.cmd` spawn fails with EINVAL on Windows + Node 22** (Claude H1, verified empirically on this host).

CVE-2024-27980's mitigation (Node 18.20.2 / 20.12.2 / 22.0.0+) refuses to spawn `.bat`/`.cmd` files unless `shell: true` is set. The plan-iter-2 review's recommendation to drop `shell: true` (which I followed) makes both `scripts/playtest-corpus.mjs` and `scripts/propose-fix.mjs` unusable on Windows: spawnSync returns `status: null, error: EINVAL`. CI on `ubuntu-latest` masks the bug because Linux `npm` is a real executable.

**Fix.** Conditional `shell: useShell` with `useShell = process.platform === 'win32'` in both scripts. On Linux/macOS shell is still `false` so bash glob-expansion of `[1m]` cannot bite us; on Windows cmd.exe handles `[]` literally so the bracketed model name is safe. Risky data (per-row thresholds JSON) continues to flow via tempfile + `--thresholds-file` rather than inline args, so cmd.exe quoting concerns are avoided. The prompt body in `propose-fix.mjs` flows via stdin (`{ input: prompt }`) so cmd.exe never sees it.

**H2. Removal handling drops timeline OR generates false positives, depending on which fix you applied** (Claude H2 + Codex H1, both correct).

The iter-2 fix preserved the position timeline past `position.removed` (correctly catching the moved-then-destroyed pinning case) but did not record when the entity stopped existing in-world. Result: the new tail-pinned branch fires for any garrisoned unit (`position.removed` but `unit` retained) or destroyed unit (`unit.removed`) that wasn't moving at the moment of removal. Walk-through: villager seeded at tick 0, garrisoned at tick 5, never moved → events = [(0, P)], endTick = 30000, `30000 - 0 ≥ 50` fires.

Codex independently flagged the symmetrical issue: `unitEntities.delete(id)` on `unit.removed` in the previous iter-2 implementation discarded entities that legitimately pinned for a window before being destroyed. The two findings together describe the complete picture: we need to preserve history AND clamp the evaluation horizon.

**Fix.** `reconstructPositions` now returns `activeUntil: Map<EntityId, number>` recording the tick of `position.removed`. `noPinnedOrOscillating` builds a `wasEverUnit: Set<number>` (anything that ever held the `unit` component, whether or not it currently does) and `unitRemovedAt: Map<EntityId, number>` (when the entity stopped being a unit). Effective horizon is `min(positionUntil, unitUntil, endTick)`. All three branches (single-event, sliding-window, tail-pinned) use the effective horizon. Three regression tests pin: garrison-before-window-no-violation; destroy-before-window-no-violation; destroy-after-pinned-window-still-fires.

### MEDIUM

**M1. `--bundle` vs `--in` flag drift in `propose-fix.mjs`** (Codex M).

DESIGN.md documents `npm run propose-fix -- --bundle output/playtests/foo`; the script accepted only `--in` and silently ignored unknown flags. Following the design doc would silently fall through to the default and fail against the wrong bundle.

**Fix.** Added `--bundle` as an alias of `--in`; reject unknown `--*` arguments so typos fail fast.

**M2. Corpus runner exits before SUMMARY.md is written on early failure** (Codex M).

`scripts/playtest-corpus.mjs` `mkdir`'d `output/corpus/<date>` before the run loop; on a row failure it `process.exit(1)` before the final `writeFileSync(SUMMARY.md, ...)`. CI's "post SUMMARY.md" step then `readFileSync` threw on a missing file even though the directory existed.

**Fix.** Corpus runner now writes a partial SUMMARY.md (with a `spawn-failed` row) before the early exit. CI workflow additionally guards `existsSync(summaryPath)` and emits a `core.warning` when missing.

**M3. CI workflow has no `permissions:` block** (Claude M1).

PRs from forks always get read-only `GITHUB_TOKEN`; many orgs default to read-only. `createComment` returns 403 silently because of `if: always()`.

**Fix.** Added `permissions: { contents: read, pull-requests: write }` at workflow root.

**M4. CI workflow comments accumulate per push** (Claude M2).

`createComment` creates a new comment every run. A PR with 10 push events ends up with 10 stacked SUMMARY.md comments.

**Fix.** Marker-tagged `<!-- playtest-corpus -->` body; workflow paginates `listComments`, updates the prior marker comment if found, otherwise creates.

**M5. DESIGN-vs-impl gating drift on `no-pinned-or-oscillating-units`** (Codex M).

DESIGN.md said the oracle gates on entities with an active `unit.move` command over the window. The implementation gates on unit-component presence + position-event windowing. The implementation's broader rule is the more useful one — it catches the regression the oracle was added to catch (a unit that *should* have moved but couldn't because pathfinding never issued the command, e.g. redirect oscillation).

**Fix.** Updated DESIGN.md `no-pinned-or-oscillating-units` paragraph to describe the broader implemented rule (single-event branch + sliding window + tail-pinned branch + effective-horizon clamp), with rationale for not gating on active `unit.move`.

### LOW

**L1. `buildFixPrompt` `.filter(Boolean)` strips intentional blank-line separators** (Claude L2).

The original array had `''` entries deliberately placed between sections; `.filter(Boolean)` was treating them as falsy and dropping them. Result: section headers stacked directly on prior content with no blank line between.

**Fix.** Replaced the array+filter pattern with explicit `lines.push(...)` and a conditional push for the optional `details` line. Tests pin per-oracle file lists and don't depend on the array's `''` separators.

**L2. Tick-neighborhood JSON byte-slice corrupts JSON** (Claude L3).

`scripts/propose-fix.mjs` did `JSON.stringify(tickNeighborhood, null, 2).slice(0, 8192)` and embedded the truncated text inside a fenced ```json block. A mid-token slice produces invalid JSON that LLMs can sometimes salvage but always notice.

**Fix.** Truncate at structural boundary by dropping ticks from the tail until the resulting JSON fits under the 8KB budget.

### PROCESS

**P1. Detailed devlog entries missing for Phase 3/4/5** (Codex LOW/PROCESS).

`docs/devlog/summary.md` had Phase 3+4+5 lines but `docs/devlog/detailed/2026-05-08_2026-05-08.md` only had entries through Phase 2. AGENTS.md requires a per-task detailed entry.

**Fix.** Added Phase 3, Phase 4, Phase 5, and impl-final entries to the detailed devlog.

### Verified clean

- No `executable` `shell: true` calls without conditional `useShell` gating (just the conditional Windows-only path now).
- No `require()` in any `.mjs` file.
- No `bridge/createSimulationBridge.ts` paths in heuristic source files (correct path is `src/game/simulation/createSimulationBridge.ts`).
- Per-row thresholds go through `--thresholds-file` (tempfile), not inline JSON.
- CI post-summary step is `if: always() && github.event_name == 'pull_request'`.
- All five `SOURCE_FILES_BY_ORACLE` paths exist on disk.
- `npm run-oracles` exits with `process.exit(high.length)`; corpus runner's `totalHigh += oracleR.status` is the actual high-violation count, not a 0/1 flag.

## Action plan

Iter-3 fixes applied inline (this iteration):

1. **H1.** `shell: useShell` (Windows-only) in both scripts.
2. **H2.** `activeUntil` map in `reconstructPositions`; `wasEverUnit` + `unitRemovedAt` + effective-horizon clamp in `noPinnedOrOscillating`. Three regression tests added.
3. **M1.** `--bundle` alias + unknown-flag rejection in `propose-fix.mjs`.
4. **M2.** Partial SUMMARY.md written before early exit in `playtest-corpus.mjs`; missing-file guard in CI workflow.
5. **M3.** `permissions:` block in CI workflow.
6. **M4.** Marker-tagged update-or-create comment pattern.
7. **M5.** DESIGN.md updated to match the broader implemented rule.
8. **L1.** Blank-line filter rewrite in `buildFixPrompt`.
9. **L2.** Structural-boundary tick-neighborhood truncation.
10. **P1.** Detailed devlog entries for Phases 3/4/5 and this iter.

After iter-3 commit lands, gates re-verified, push, then move thread folder from `current/` to `done/`.

## Next iteration

Reviewer agreement was tight on iter-3 (no outstanding items). The thread closes on this iter; any future bug found in the playtest loop spawns a new dated thread.
