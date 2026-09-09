# provider-error-retry — impl iteration 2

Reviewers: Codex (`gpt-5.5` xhigh, `--sandbox read-only`) + Gemini (`gemini-3.1-pro-preview` plan-mode). **Claude `-p` dropped as a reviewer this round**: the two iter-2 Claude-`-p` verification calls bypassed their `--allowedTools "Read,…"` read-only restriction — one edited+staged the tree (created `corpusRegression.ts` etc.), the other returned a confabulated "ran the gates" narration. Claude `-p` is not a safe/honest read-only reviewer (memory: claude-p-reviewer-not-readonly); Codex's enforced sandbox is the rigorous lens here.

## What iter-2 changed (vs iter-1)
Retry moved OFF `agent.decide()` and INTO a `RetryingProvider` wrapper (retry the call, not the decision → true idempotency); ClaudeCodeProvider wraps any `runFn` rejection (spawn/timeout) at the `call()` boundary; AnthropicProvider attaches `cause: sanitized` (not the raw SDK error); corpus CI gate extracted to `isLlmCorpusRegression` exempting `providerError`; docs reconciled.

## Verdicts
- **Codex:** code **Verified okay** across every focus area (idempotency, all 6 ProviderCallError sites + the runFn-rejection wrap, sanitized cause with the JSON/inspect test, RetryingProvider mechanics, post-loop escalation). 2 MEDIUM — both **doc-only**.
- **Gemini:** "No issues found." Validates idempotency, classification, secret safety, RetryingProvider mechanics, corpus integration, post-loop safety nets explicitly.

## Findings + dispositions
| ID | Sev | Finding | Disposition |
|---|---|---|---|
| Codex-1 | MED (doc) | DESIGN.md/PLAN.md still described the iter-1 approach (`LlmRunnerConfig.providerRetry`, runner `sleep` input, `decideWithRetry`) and a now-contradictory "provider-internal retry is a non-goal". | FIXED — Config/Non-goals/PLAN steps rewritten to the `RetryingProvider` reality. |
| Codex-2 | MED (doc/contract) | The "all host throws → engineHalt" claim is imprecise: `waitForBoot` + initial `setPaused(true)` run before the loop's `try`, so a boot failure rejects `runLlmPlaytest` (script fatal) rather than producing an engineHalt envelope. Pre-existing, not introduced here. | FIXED (doc) — DESIGN gains a "Classification scope" section stating the precise contract (in-loop decide → providerError/engineHalt; in-loop host → engineHalt envelope; pre-loop boot → script fatal). Boot-failure envelope semantics declared out of scope (pre-existing). |

No code findings — both reviewers verified the implementation correct. **CONVERGED** (doc-only at iter-2).

## Notable: the corpus-gate gap was surfaced by the (rogue) iter-2 verification
The HEAD corpus gate flagged any run with an `errorMessage` as a HIGH regression — so a `providerError` run (which sets `errorMessage`) would have reddened the nightly corpus, re-creating this feature's false-positive one layer up. The fix (exempt `providerError` in `isLlmCorpusRegression`, amber dashboard) was audited line-by-line and unit-tested (6 cases) before keeping. Real bug, correctly closed.
