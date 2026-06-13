// provider-error-retry iter-2: RetryingProvider mechanics — exponential
// backoff, off-by-one, and the non-retryable passthrough.

import { describe, expect, it, vi } from 'vitest';

import { ProviderCallError, RetryingProvider } from '../../src/game/playtest/llmProviders';
import type {
  LlmCallOptions,
  LlmCallResult,
  LlmProvider,
} from '../../src/game/playtest/types';

const OK: LlmCallResult = { content: [], tokensIn: 1, tokensOut: 1, costUsd: 0.001 };
const OPTS = {} as LlmCallOptions;

class Flaky implements LlmProvider {
  calls = 0;
  constructor(
    private readonly failCount: number,
    private readonly error: Error,
  ) {}
  async call(): Promise<LlmCallResult> {
    this.calls += 1;
    if (this.calls <= this.failCount) throw this.error;
    return OK;
  }
}

describe('RetryingProvider', () => {
  it('retries a ProviderCallError with exponential backoff, then succeeds', async () => {
    const inner = new Flaky(2, new ProviderCallError('blip'));
    const sleep = vi.fn<(ms: number) => Promise<void>>(async () => {});
    const provider = new RetryingProvider(inner, { maxRetries: 3, backoffMs: 100 }, sleep);

    const result = await provider.call(OPTS);

    expect(result).toBe(OK);
    expect(inner.calls).toBe(3); // 2 failures + 1 success
    // backoffMs * 2^attempt for the two failed attempts before success.
    expect(sleep.mock.calls.map((c) => c[0])).toEqual([100, 200]);
  });

  it('throws the last ProviderCallError after exhausting retries, with no trailing sleep', async () => {
    const inner = new Flaky(99, new ProviderCallError('persistent'));
    const sleep = vi.fn<(ms: number) => Promise<void>>(async () => {});
    const provider = new RetryingProvider(inner, { maxRetries: 2, backoffMs: 50 }, sleep);

    await expect(provider.call(OPTS)).rejects.toBeInstanceOf(ProviderCallError);
    expect(inner.calls).toBe(3); // 1 + maxRetries
    // Sleeps between the 3 attempts only: after attempt 0 and 1, NOT after the
    // final failed attempt.
    expect(sleep.mock.calls.map((c) => c[0])).toEqual([50, 100]);
  });

  it('maxRetries=0 makes exactly one attempt and never sleeps', async () => {
    const inner = new Flaky(99, new ProviderCallError('once'));
    const sleep = vi.fn<(ms: number) => Promise<void>>(async () => {});
    const provider = new RetryingProvider(inner, { maxRetries: 0, backoffMs: 100 }, sleep);

    await expect(provider.call(OPTS)).rejects.toBeInstanceOf(ProviderCallError);
    expect(inner.calls).toBe(1);
    expect(sleep).not.toHaveBeenCalled();
  });

  it('does NOT retry a non-ProviderCallError — it propagates immediately', async () => {
    const inner = new Flaky(99, new Error('deterministic bug'));
    const sleep = vi.fn<(ms: number) => Promise<void>>(async () => {});
    const provider = new RetryingProvider(inner, { maxRetries: 2, backoffMs: 100 }, sleep);

    await expect(provider.call(OPTS)).rejects.toThrow('deterministic bug');
    expect(inner.calls).toBe(1); // no retry
    expect(sleep).not.toHaveBeenCalled();
  });
});
