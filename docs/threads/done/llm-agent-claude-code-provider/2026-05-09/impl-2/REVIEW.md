# ClaudeCodeProvider impl-2 review — synthesis

Date: 2026-05-09. Iteration 2. Reviewers: Codex (gpt-5.5 xhigh), Claude (Opus 4.7 1M, max effort).

## Verdict

**Converged. Claude APPROVE.** All iter-1 HIGH/MEDIUM verified fixed via grep + claude --help cross-check. Codex's 4 MEDIUM findings are addressed inline; Claude's 5 LOW findings are mostly nits that don't gate landing.

## Codex iter-2 findings (4 MEDIUM)

### M1 — `LlmCallOptions.maxOutputTokens` ignored

**Issue:** `AnthropicProvider` forwards `maxOutputTokens` as `max_tokens`; `ClaudeCodeProvider` had no equivalent.

**Disposition:** Fixed via prompt-embedded soft instruction. The `claude` CLI has no `--max-output-tokens` flag, so we append "Constrain your response to roughly N output tokens or fewer" to the augmented system prompt. Models usually respect the hint; not enforced by the CLI runtime, documented as such in code comments.

### M2 — Cost-budget log message has internally inconsistent ranges

**Issue:** Inline text said "$0.06–$0.30 per call" but the math computed decisions using only the $0.06–$0.10 bound, ignoring Opus strategy refresh cost. Default $5 budget reported "50–83 decisions" but Opus refreshes every Kth call would actually halt around decision 38.

**Disposition:** Fixed. Log now computes `blendedCost = tacticalCost + strategyCost / args.strategyEvery` and prints exactly one expected-decision count using that blended rate. With defaults (K=10), $5 budget → 38 decisions.

### M3 — Explicit `--provider=claude-code` bypasses `canSpawnClaude`

**Issue:** `selectProvider` only ran `canSpawnClaude` on the auto-detect path. Explicit `--provider=claude-code` constructed the provider unconditionally, deferring the failure to first call (after `npm run build` + browser launch — costs ~5min).

**Disposition:** Fixed by moving the `canSpawnClaude` check inside `makeClaudeCodeProvider`, so it fires for both auto-detect and explicit paths. Symmetric with the Codex finding's recommendation.

### LOW — Integration test doesn't assert the `structured_output` path

**Issue:** Provider preferred `structured_output` over `result`-fallback, but the integration test only verified the synthesized tool_use block — it would still pass if claude stopped populating `structured_output`.

**Disposition:** Fixed. Integration test now wraps a custom runFn that captures raw stdout, finds the `result` event line, asserts `structured_output` is populated and contains a non-empty `toolCalls` array. The fallback path (`result` JSON-parse) is still tested by the unit-test suite at line 53-97.

## Claude iter-2 findings (5 LOW, APPROVE)

### LOW-1 — User-level SessionStart hooks still fire post cwd-fix

**Issue:** The H2 fix prevents project-level CLAUDE.md auto-discovery via `cwd:tmpDir`, but user-level `~/.claude/settings.json` SessionStart hooks fire regardless of cwd. On this machine that injects ~6 KB of `superpowers:using-superpowers` skill text, contributing the residual ~15K cache_creation tokens after the fix.

**Disposition:** Documented as a future improvement. Eliminating this fully needs `--bare` (incompatible with subscription auth — forces `ANTHROPIC_API_KEY`) or `--setting-sources project,local` to exclude user settings. Worth revisiting in a follow-up iteration; not a regression.

### LOW-2 — Cost-budget log inconsistent ranges (also flagged in Codex M2)

**Disposition:** Resolved by Codex M2 fix.

### LOW-3 — Explicit `--provider=claude-code` bypass (also flagged in Codex M3)

**Disposition:** Resolved by Codex M3 fix.

### LOW-4 — `resolveClaudeBinary` re-runs `where claude` per call

**Issue:** On Windows, every `defaultClaudeRun` invocation runs `where claude`, adding a `spawnSync` per LLM call (50+ for a typical playtest). Trivially cacheable on the provider instance.

**Disposition:** Deferred. The `where` call is fast (<10ms) and the LLM call dominates (>2s). Cosmetic perf nit; not worth coupling state into the otherwise stateless `defaultClaudeRun`.

### LOW-5 — `--no-session-persistence` not asserted in unit test

**Disposition:** Fixed. Added one-liner to the lockdown test: `expect(args).toContain('--no-session-persistence')`.

## Disposition

**MEDIUM x4 + LOW x1** addressed inline. **LOW x2 (Claude LOW-1, LOW-4)** deferred with rationale. Reviewers approve. Convergence reached — landing this iteration.
