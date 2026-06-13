// provider-error-retry (campaign-2 backlog #1): the LLM-corpus CI gate
// must treat a transient `providerError` (retries exhausted, game still
// healthy + scored) as a NON-regression — exactly like the operator's
// `cost-budget-exceeded` cap — so Anthropic API flakiness can't turn the
// nightly corpus red. `engineHalt` and genuinely-unexpected error messages
// remain the only corpus regression signals. This pins the predicate the
// gate in scripts/playtest-corpus-llm.mjs delegates to.

import { describe, expect, it } from 'vitest';

import { isLlmCorpusRegression } from '../../src/game/playtest/corpusRegression';

describe('isLlmCorpusRegression', () => {
  it('flags engineHalt as a regression', () => {
    expect(isLlmCorpusRegression({ stopReason: 'engineHalt', errorMessage: 'boom' })).toBe(true);
    // engineHalt with no message is still a regression.
    expect(isLlmCorpusRegression({ stopReason: 'engineHalt' })).toBe(true);
  });

  it('does NOT flag a clean maxTicks exit', () => {
    expect(isLlmCorpusRegression({ stopReason: 'maxTicks' })).toBe(false);
  });

  it('does NOT flag a cost-budget-exceeded stop (operator-set spend cap)', () => {
    expect(
      isLlmCorpusRegression({ stopReason: 'stopWhen', errorMessage: 'cost-budget-exceeded' }),
    ).toBe(false);
  });

  it('does NOT flag providerError — a transient infra stop, not an engine regression', () => {
    // This is the behavior the change exists to guarantee: a provider
    // blip that survived retry must not re-appear as a red corpus gate.
    expect(
      isLlmCorpusRegression({
        stopReason: 'providerError',
        errorMessage:
          'provider call failed (retries exhausted): [claude-code-provider] claude exit 1: ',
      }),
    ).toBe(false);
  });

  it('flags an unexpected errorMessage on an otherwise-clean stop (defensive catch-all preserved)', () => {
    expect(isLlmCorpusRegression({ stopReason: 'maxTicks', errorMessage: 'something weird' })).toBe(
      true,
    );
    expect(isLlmCorpusRegression({ stopReason: 'stopWhen', errorMessage: 'unexpected' })).toBe(true);
  });

  it('does not flag an empty/degenerate envelope (missing-envelope is handled separately upstream)', () => {
    expect(isLlmCorpusRegression({})).toBe(false);
  });
});
