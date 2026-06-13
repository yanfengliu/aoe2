// provider-error-retry (campaign-2 backlog #1): the LLM-corpus CI gate's
// regression predicate, extracted from the inline condition in
// `scripts/playtest-corpus-llm.mjs` so it is unit-testable. Reads a run
// envelope (untyped JSON from disk) and decides whether the row is a HIGH
// regression that should fail the corpus gate (`process.exit(1)`).
//
// `engineHalt` is the genuine engine/sim/page-crash signal. Two stop
// reasons carry an `errorMessage` yet are NOT regressions and are exempted:
//   - `cost-budget-exceeded` (stopReason `stopWhen`): an operator-set spend
//     cap — expected operational behavior, not a fault.
//   - `providerError`: a transient LLM-call failure that survived
//     retry-with-backoff. On a provider failure the game/page stayed
//     healthy and was still scored (winner oracle + final screenshot +
//     bundle export all ran), so flagging it as a code/gameplay regression
//     would merely re-create — under a new name — the false-positive this
//     whole feature exists to eliminate (a one-off `claude exit 1`
//     masquerading as a fatal engine halt). The row stays VISIBLE in
//     SUMMARY-LLM.md and the dashboard; it just doesn't redden the gate.
// Any OTHER unexpected `errorMessage` is treated as a regression (defensive
// catch-all, preserved from Codex impl-345 M6).

export interface CorpusRunEnvelopeLike {
  stopReason?: string;
  errorMessage?: string;
}

export function isLlmCorpusRegression(envelope: CorpusRunEnvelopeLike): boolean {
  if (envelope.stopReason === 'engineHalt') return true;
  // Known non-regression stops that nonetheless carry an errorMessage.
  if (envelope.stopReason === 'providerError') return false;
  if (envelope.errorMessage && envelope.errorMessage !== 'cost-budget-exceeded') return true;
  return false;
}
