# `unitCommandOps` file-size split review

Iteration 2.

## Reviewers

- Codex (`gpt-5.5`, xhigh, read-only): found two substantive process/config issues.
- Claude (`claude-opus-4-7[1m]`, max): unreachable. CLI returned quota limit: "resets May 5, 7pm (America/Los_Angeles)".

## Findings

- **Codex C2-1 - package lock version drift.** `package.json` had the pre-existing `0.1.6-rc1` version bump, but `package-lock.json` still recorded `0.1.5` for the root package. This was initially addressed with `npm.cmd install --package-lock-only`, then superseded by iteration 3's broader release-metadata finding: the package/changelog version markers are excluded from this committed unit, and the lockfile metadata churn was reverted.
- **Codex C2-2 - runner stabilization lived only in `npm test`.** The first fix put `--pool=threads --testTimeout=30000` in `package.json`, while `vitest.config.ts` still configured and documented the flaky forks pool. Fixed by moving the stable runner contract into `vitest.config.ts` (`pool: 'threads'`, `testTimeout: 30_000`) and returning `npm test` to plain `vitest run`.

## Verification Evidence

- `npm.cmd test -- tests/simulation/createSimulationBridge.production.test.ts`: pass after config-based runner update.
- `npm.cmd test`: pass, 99 files, 727 tests passed, 1 skipped, no worker RPC timeout errors.
- `npm.cmd run typecheck`: pass.
- `npm.cmd run lint`: pass.
- `npm.cmd run build`: pass.

## Final Disposition

Findings addressed. Run iteration 3 to verify the corrected diff and close the thread if reviewers find no substantive issues.
