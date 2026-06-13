// provider-error-retry (campaign-2 backlog #1, iter-2): retry a transient
// LLM-call failure (`ProviderCallError`) IN PLACE — at the provider-call
// layer, not the decision layer. Wrapping the provider (rather than
// re-running agent.decide) keeps each decision idempotent: decide() makes
// up to two provider calls (strategy + tactical) and runs exactly once, so
// a tactical retry never re-charges a strategy refresh or drifts the
// cadence counter (Codex/Claude iter-1). A succeeding retry returns
// normally; on exhaustion the last ProviderCallError propagates so the
// runner can classify the run as `providerError` (not engineHalt).

import type { LlmCallOptions, LlmCallResult, LlmProvider } from '../types';
import { ProviderCallError } from './providerError';

export interface RetryConfig {
  maxRetries: number;
  backoffMs: number;
}

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class RetryingProvider implements LlmProvider {
  constructor(
    private readonly inner: LlmProvider,
    private readonly retry: RetryConfig,
    // Injectable for instant unit tests; real backoff in production.
    private readonly sleep: (ms: number) => Promise<void> = defaultSleep,
  ) {}

  async call(options: LlmCallOptions): Promise<LlmCallResult> {
    let lastError: ProviderCallError | undefined;
    for (let attempt = 0; attempt <= this.retry.maxRetries; attempt += 1) {
      try {
        return await this.inner.call(options);
      } catch (err) {
        // Only transient provider failures are retried. A non-provider
        // throw (a programmer bug, a deterministic config error) is fatal
        // and propagates immediately — the runner keeps it as engineHalt.
        if (!(err instanceof ProviderCallError)) throw err;
        lastError = err;
        if (attempt < this.retry.maxRetries) {
          // Exponential backoff: backoffMs, 2·backoffMs, 4·backoffMs, …
          // No sleep after the final failed attempt.
          await this.sleep(this.retry.backoffMs * 2 ** attempt);
        }
      }
    }
    throw lastError;
  }
}
