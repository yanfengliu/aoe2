// provider-error-retry (campaign-2 backlog #1): a transient LLM-subprocess
// failure must retry-with-backoff (at the provider layer) and, if exhausted,
// surface as a distinct `providerError` stopReason that still scores the
// (healthy) game — NOT an engineHalt that suppresses the winner oracle.
//
// iter-2: retry lives in RetryingProvider (wraps the real provider), so
// agent.decide() runs exactly once per decision. These tests cover the
// runner-side classification; the wrapper's retry/backoff mechanics live in
// retryingProvider.test.ts.

import { describe, expect, it } from 'vitest';

import { runLlmPlaytest } from '../../src/game/playtest/llmRunner';
import { LlmAgent } from '../../src/game/playtest/llmAgent';
import { ProviderCallError, RetryingProvider } from '../../src/game/playtest/llmProviders';
import type {
  LlmCallOptions,
  LlmCallResult,
  LlmProvider,
} from '../../src/game/playtest/types';
import { StubHost, MIN_BUNDLE, TACTICAL_OK_NO_COMMANDS } from './llmRunnerTestKit';

// Throws on the first `failCount` calls, then returns a no-op tactical
// response forever.
class FlakyProvider implements LlmProvider {
  calls = 0;
  constructor(
    private readonly failCount: number,
    private readonly error: Error,
  ) {}
  async call(_options: LlmCallOptions): Promise<LlmCallResult> {
    void _options;
    this.calls += 1;
    if (this.calls <= this.failCount) throw this.error;
    return { content: TACTICAL_OK_NO_COMMANDS, tokensIn: 10, tokensOut: 5, costUsd: 0.01 };
  }
}

const noSleep: (ms: number) => Promise<void> = async () => {};

function makeAgentWith(provider: LlmProvider): LlmAgent {
  return new LlmAgent({
    provider,
    ownerId: 2,
    strategyModel: 'claude-opus-4-8',
    tacticalModel: 'claude-opus-4-8',
    strategyEveryNDecisions: 100,
    maxOutputTokensTactical: 1024,
    maxOutputTokensStrategy: 2048,
    costBudgetUsd: 5.0,
    maxImageBytes: 1_048_576,
    historyWindow: 5,
  });
}

const CONFIG = {
  ownerId: 2,
  maxTicks: 500,
  decisionIntervalTicks: 250,
  screenshotEnabled: false,
} as never;

describe('runLlmPlaytest — provider-error classification', () => {
  it('a transient ProviderCallError recovered by the RetryingProvider does not stop the run', async () => {
    const provider = new RetryingProvider(
      new FlakyProvider(1, new ProviderCallError('claude exit 1: ')),
      { maxRetries: 2, backoffMs: 100 },
      noSleep,
    );
    const { envelope } = await runLlmPlaytest({
      host: new StubHost(MIN_BUNDLE),
      agent: makeAgentWith(provider),
      config: CONFIG,
    });

    expect(envelope.stopReason).toBe('maxTicks');
    expect(envelope.ticksRun).toBe(500);
    expect(envelope.decisionsRun).toBe(2);
  });

  it('surfaces providerError (not engineHalt) when retries are exhausted, and still scores the game', async () => {
    const provider = new RetryingProvider(
      new FlakyProvider(99, new ProviderCallError('claude exit 1: ')),
      { maxRetries: 2, backoffMs: 100 },
      noSleep,
    );
    const host = new StubHost(MIN_BUNDLE);
    // Healthy game: the winner oracle must still run on a provider failure.
    host.getEntityCountsByOwner = async () => ({ 2: { units: 5, buildings: 4 } });

    const { envelope, bundle } = await runLlmPlaytest({
      host,
      agent: makeAgentWith(provider),
      config: CONFIG,
    });

    expect(envelope.stopReason).toBe('providerError');
    expect(envelope.errorMessage).toContain('claude exit 1');
    // The game was healthy — winner oracle ran (NOT suppressed like engineHalt).
    expect(envelope.winner).toEqual({ kind: 'winner', ownerId: 2 });
    expect(bundle).toBe(MIN_BUNDLE);
  });

  it('a providerError on the very first decision still yields a sane envelope', async () => {
    const provider = new RetryingProvider(
      new FlakyProvider(99, new ProviderCallError('boom')),
      { maxRetries: 0, backoffMs: 100 }, // no retry → fails on decision 0
      noSleep,
    );
    const host = new StubHost(MIN_BUNDLE);
    host.getEntityCountsByOwner = async () => ({ 2: { units: 1, buildings: 1 } });

    const { envelope } = await runLlmPlaytest({
      host,
      agent: makeAgentWith(provider),
      config: CONFIG,
    });

    expect(envelope.stopReason).toBe('providerError');
    expect(envelope.ticksRun).toBe(0);
    expect(envelope.decisionsRun).toBe(0);
    expect(envelope.winner).toEqual({ kind: 'winner', ownerId: 2 });
  });

  it('does NOT classify a non-provider error from decide() as providerError; it stays engineHalt', async () => {
    // A plain Error is NOT retried by RetryingProvider and is NOT a
    // ProviderCallError, so the runner keeps it as engineHalt.
    const provider = new RetryingProvider(
      new FlakyProvider(99, new Error('plain bug, not a provider error')),
      { maxRetries: 2, backoffMs: 100 },
      noSleep,
    );
    const host = new StubHost(MIN_BUNDLE);
    host.getEntityCountsByOwner = async () => ({ 2: { units: 5, buildings: 4 } });

    const { envelope } = await runLlmPlaytest({
      host,
      agent: makeAgentWith(provider),
      config: CONFIG,
    });

    expect(envelope.stopReason).toBe('engineHalt');
    expect(envelope.winner).toBeUndefined(); // engineHalt suppresses scoring
  });

  it('keeps a host (engine) error classified as engineHalt, not providerError', async () => {
    const provider = new RetryingProvider(
      new FlakyProvider(0, new Error('unused')),
      { maxRetries: 2, backoffMs: 100 },
      noSleep,
    );
    const host = new StubHost(MIN_BUNDLE);
    host.failOn = 'snapshotForAgent'; // fires before decide every loop

    const { envelope } = await runLlmPlaytest({
      host,
      agent: makeAgentWith(provider),
      config: CONFIG,
    });

    expect(envelope.stopReason).toBe('engineHalt');
  });
});
