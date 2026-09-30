# Full-codebase review — iteration 5 (re-review of the iteration-4 fix batch)

Objective: `full` · Date: 2026-07-11 · Iteration: 5

## Scope

Independent re-review of the iteration-4 fix batch (`git d692ce5..HEAD` at launch = the four iter-4 commits: H9 bypass, fileSizeBudget saveLoad, loop-honesty A/B/C/H6, docs). The job of this iteration is to CONFIRM those fixes are correct + complete + regression-free, per the /full-review iterate-until-nitpick contract.

## Reviewer setup

| CLI | Model | Effort | Outcome |
|---|---|---|---|
| Codex | `gpt-5.6-sol` | ultra | **BLOCKED** — Codex's cybersecurity-risk filter refused the review ("This content was flagged for possible cybersecurity risk… Trusted Access for Cyber"). The prompt's "construct a patch that git apply writes to a sensitive file… give the exact header bytes" tripped it. Treated as unreachable (like a quota failure); compensated with the driver's own adversarial git testing + Claude. LESSON: for a security-guard re-review, phrase the ask as "identify remaining bypass CLASSES" without requesting exact exploit bytes. |
| Claude | `opus[1m]` | max | Completed. Fable 5 quota still exhausted (fallback, retry next session). |

## Findings

### HIGH (fixed) — H9 sensitive-path guard was STILL bypassable via c-quoted headers

Both the driver's own adversarial git testing AND Claude independently proved a THIRD parser-drift bypass that the iter-4 fix (CRLF + case) did not close: `git apply` calls `unquote_c_style` on any header beginning with `"`, so a MANUALLY c-quoted header — `--- "a/package.json"` — is unquoted by git and writes the real file, while all three iter-4 regexes (which require an unquoted `a/`/`b/` prefix) return `[]`. Confirmed end-to-end with live `git apply` in three variants: (1) modify `package.json` via quoted `diff --git` + `---/+++`; (2) quoted `---/+++` only, no `diff --git` line; (3) ADD a new `.npmrc` / `.github/workflows/*.yml` via a quoted `+++`. The iter-4 code comment's dismissal ("git only c-quotes special-char paths") reasoned about what `git diff` EMITS, which is irrelevant to what `git apply` ACCEPTS from a hand-authored patch.

FIX (commit 77eda1f, the "fuller hardening" the iter-4 comment itself named, and Claude's iter-4 recommendation): detect the touched set from git's OWN parser via `git apply --numstat -z -` — it reports exactly what a real apply will write (without touching the tree), unquoting c-quoted paths, normalizing CRLF, and resolving case as git does. New exported `parseNumstatPaths` (NUL-record parser, rename-aware). The regex classifier is kept as defense-in-depth; rejection is on the UNION. Verified: all three variants now reject; the regex-only fallback (when `--numstat` exits non-zero) is ZERO-risk because `--numstat` and `apply` share one parser — a malformed patch fails BOTH with exit 128, so a patch `--numstat` can't parse is one `git apply` would also reject (no gates run). New test proves the quoted header is rejected while `patchTouchesSensitivePaths` alone still misses it. H9 tests split to `applyAndGate.sensitivePaths.test.ts` + `applyAndGateTestKit.ts` (the suite crossed 500 LOC).

### Confirmed correct (Claude re-verified against live code + re-ran green)

- **A — `qualifyInitialRun`**: correct whitelist `verified && (maxTicks|stopWhen)`; reads the right ledger fields; `'initial-run-unqualified'` accepted by `assertImprovementRunManifest` (stopReason is an optional free string, not an enum); can't fire on a legit healthy run (shares the prove-fixed replay signal). 15/15 green.
- **B — `verificationStatus === 'verified'`**: doesn't starve selection (the only `kind:'fix'` findings are oracle findings, which default `'verified'`); `=== 'verified'` correctly excludes `falsePositive`/`regressed`/`fixed` that `!== 'unverified'` would wrongly admit. 7/7 green.
- **C — observed-delta + terminal-match ordering**: match-outcome check precedes the halt check, so a completed match is never mislabeled `engineHalt` while a genuinely frozen page still is; host read is live-fresh in all impls (`getHudState().matchState` IS `getMatchState()`); no infinite loop, no undercount. 17/17 green.
- **H6 — `withinRunUnionKey`**: same defect from markers+envelope still collapses (shared id); two distinct same-`[category,area]` findings both kept (distinct id suffix); oracle findings still dedup by tuple. 11/11 green.
- **File splits**: `saveBlobTestUtils`/`saveLoad`, `selfImprovementLoopTestKit`/`selfImprovementLoop`, `applyAndGateTestKit`/`applyAndGate.sensitivePaths` — all < 500, behavior-preserving, no dangling imports.

### Acknowledged deferrals — reasonable (Claude concurs)

- **MEDIUM-9 (corpusSchema key-permissiveness)**: pre-existing, bounded LOW footgun (oracles read a fixed field set; unknown JSON keys are silently ignored, not mis-enforced). Not a correctness bug in this diff.
- **MEDIUM-4/5 (fog memory raw-id aliasing)**: entirely outside `d692ce5..HEAD`; dual-reviewer-assessed as visual-only / migration-only / ≤ old behavior. Defer to a focused generation-keyed rework.

## Disposition — CONVERGED

The single substantive finding (H9 quoted-header bypass) was found by BOTH the driver's adversarial testing and Claude, fixed in 77eda1f, and the fix approach was pre-validated by Claude (`--numstat -z` unquoting + rename parsing) and empirically confirmed by the driver (all three variants + the fallback-safety watch-item). Every other iter-4 fix is confirmed correct and re-run green; the deferrals are reasonable. A further iteration would only re-confirm the committed git-numstat fix. Iterations 4–5 close here; the thread moves to `docs/threads/done/full/2026-07-11/`.

Process (per Claude + the batch's own new lesson): the H9 fix was committed in isolation on a clean tree so the intended state is unambiguous; Codex's cyber-filter block is noted for prompt-phrasing next session.
