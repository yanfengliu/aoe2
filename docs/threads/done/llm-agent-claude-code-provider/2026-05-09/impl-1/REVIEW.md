# ClaudeCodeProvider impl-1 review — synthesis

Date: 2026-05-09. Iteration 1. Reviewers: Codex (gpt-5.5 xhigh), Claude (Opus 4.7 1M, max effort).

## Overall

Three reviewers-overlapping HIGH defects in tool-surface lockdown + process lifecycle, plus two Claude-only HIGHs uncovered by live smoke-testing the real CLI. All findings have concrete fixes; addressing them roughly halves per-call cost (31707 → 15158 cache_creation tokens, verified by Claude).

## HIGH

### H1 — `--disallowedTools` is too narrow; many tools remain reachable

**Surfaced by:** Codex finding 1, Claude finding H1 (Claude verified live: `AskUserQuestion`, `ShareOnboardingGuide`, `Skill`, `CronCreate`, `ScheduleWakeup`, `RemoteTrigger`, `EnterWorktree`, MCP tools all still exposed in the system/init event).

**Concrete failure modes:** `AskUserQuestion` deadlocks (stdin already `.end()`-ed); `ShareOnboardingGuide` uploads files; `Skill` injects more prompt; `CronCreate`/`ScheduleWakeup` schedule background work; `EnterWorktree` mutates git.

**Fix applied:** Replace `--disallowedTools <list>` with `--permission-mode plan` (read-only mode, overrides settings.json). Belt-and-braces: drop `--allowedTools` entirely (default empty allowlist) and add `--strict-mcp-config` to skip globally-configured MCP servers.

### H2 — Spawned claude inherits cwd, leaking CLAUDE.md/hooks/skills

**Surfaced by:** Claude finding H2 (Codex didn't catch this — Claude only got it because it ran live smoke against the actual CLI from the repo cwd).

**Evidence:** Smoke output showed `superpowers:using-superpowers` skill text injected via `SessionStart:startup` hook, plus AoE2 `AGENTS.md`, plus loaded plugins — total ~31K cache_creation tokens for a one-token reply. The leaked skill instructs the model that "if you think there is even a 1% chance a skill might apply ... you ABSOLUTELY MUST invoke the skill," which can pull the agent off-task into invoking superpowers skills instead of emitting game commands.

**Fix applied:** Pass `cwd: tmpDir` (the same dir we already create for the system-prompt file) to `spawn`. This is outside the AoE2 repo so no CLAUDE.md/AGENTS.md auto-discovery. Add `--exclude-dynamic-system-prompt-sections` to drop the per-machine cwd/env/git-status block.

### H3 — Timeout race orphans the spawned claude process

**Surfaced by:** Codex finding 2, Claude finding H3 (overlap).

**Concrete cost:** the orphaned claude.exe continues its in-flight Anthropic API call (which IS billed); after the parent's `finally` runs `rmSync(tmpDir)`, on Windows the orphan may error reading `--append-system-prompt-file`; SIGINT to the runner doesn't cascade.

**Fix applied:** Move the timer into `defaultClaudeRun`. On expiry, `proc.kill('SIGTERM')` immediately + escalate to `SIGKILL` after a 1s grace. The runFn signature gains an `options.timeoutMs` param; callers pass it explicitly. `runWithTimeout` wrapper deleted.

## MEDIUM

### M1 — Cost-budget default is mismatched to claude-code provider's per-call cost

**Surfaced by:** Claude finding M1.

**Fix applied:** Runner logs an upfront notice when `--provider=claude-code` is selected, explaining the per-call cost shape and the implication of the `--cost-budget` setting. Default budget unchanged (still $5) — operator-tunable via `--cost-budget`.

### M2 — No real-CLI integration test

**Surfaced by:** Claude finding M2.

**Fix applied:** Added `tests/playtest/claudeCodeProvider.integration.test.ts` gated by `CC_INTEGRATION_TEST=1`. Sends one real call against `claude` with `--json-schema`, asserts `structured_output` is populated. Skipped by default to avoid burning $0.05+ per CI run; opt-in for local dev.

### M3 — Image stream-json shape unverified against real CLI

**Surfaced by:** Claude finding M3.

**Disposition:** Deferred. The text-only smoke verified the basic protocol; image input is on the critical path for the full playtest run but each verification call costs $0.06+ and we don't want to hammer the user's subscription. Will surface during the first real `npm run playtest:llm` run; if image input fails the user will see it immediately. Filed as a follow-up note in the devlog. M2's integration-test scaffolding makes adding image coverage cheap when the time comes.

### M4 — Schema doesn't enum-constrain `toolCalls[].name`

**Surfaced by:** Codex finding 4, Claude finding L1 (overlap; Claude rated lower since the dispatcher rejects unknown kinds anyway, but it's still a wasted paid call).

**Fix applied:** `buildClaudeCodeResponseSchema(tools)` builds the enum from `tools.map(t => t.name)`. Empty-tools case falls back to free string (avoids invalid empty-enum schema).

### M5 — Windows .cmd-only auto-detection mismatch

**Surfaced by:** Codex finding 3.

**Fix applied:** `resolveClaudeBinary` now returns `null` on Windows when no .exe is found (was raw path). Runner's `canSpawnClaude` (and corpus runner equivalent) calls `resolveClaudeBinary` directly so the .cmd-only edge case is rejected before the provider is constructed.

## LOW

### L1 — Tool-name enum (covered by M4 above).

### L2 — `tokensIn` aggregation loses cache breakdown

**Surfaced by:** Claude finding L2.

**Disposition:** Deferred. `costUsd` is authoritative for budget gating, and trace JSON can be re-derived from per-call envelope retention if needed. Not worth adding fields to `LlmCallResult` for an edge use case.

### L3 — `parseEnvelope` keeps last result event when multiple

**Surfaced by:** Claude finding L3.

**Fix applied:** Added `break` after first `result` event. Documents the single-result-per-stream assumption.

### L4 — `--max-budget-usd` not passed (defense-in-depth)

**Surfaced by:** Claude finding L4.

**Disposition:** Deferred. The agent's rolling cost gate is the source of truth; CLI-level `--max-budget-usd` is per-call, not cumulative — wrong granularity. If an in-flight call somehow exceeded its share of the budget, the agent's next call would catch it. Adding the flag would create a confusing dual-budget surface.

## Disposition

**HIGH x3 + MEDIUM x4** addressed inline. **MEDIUM M3, LOW L2 + L4** deferred with rationale. **LOW L3** addressed inline. Re-review next iteration.
