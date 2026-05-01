# Phase 1B market.action Implementation Review (impl-11)

**Date:** 2026-05-01
**Iteration:** impl-11 → addressed inline (4 review fixes folded into the same commit)
**Reviewers:** Codex `gpt-5.5` xhigh + Claude `claude-opus-4-7[1m]` max
**Disposition:** ACCEPT after inline fixes

## Both reviewers reachable

Codex hit Windows constrained-language-mode block once but recovered via direct file reads. Both produced detailed verdicts.

## Codex F1 (real, fixed inline) — Missing B2 same-frame regression test

> "Medium: tests/commands/marketAction.test.ts lacks the required B2 same-frame market regression. The plan explicitly calls out market.action as needing a batched same-frame over-budget test, especially because handler cost must be re-derived from current marketExchangeRates."

The plan (and queue.train impl-9 precedent) requires a same-frame over-budget integration test for every resource-spending command. queue.train and queue.research had this; market.action's was missing.

**Fix:** added `tests/simulation/commandRejection.test.ts` "B2 invariant: same-frame market.action batch over budget" test. Setup: `feudal-market-fixture`; place market; wait 280 steps; food=200 after market construction. Submit `affordableSells + 3` sell-food commands without intervening step. All accept at validator (validator sees pre-spend food=200). After one bridge.step: exactly `affordableSells = floor(food / 100)` succeed; the surplus 3 silently no-op via re-check. Asserts post-step food = `foodBefore - affordableSells * 100`, gold strictly increased.

## Claude F1 (real, fixed inline) — `executeMarketAction` is dead code after this commit

After humanInputOps no longer calls `executeMarketAction`, the function's only remaining references were the `TrainingMarketOps` interface declaration, the function body, and the return-object entry. No live caller.

**Fix:** dropped `executeMarketAction` entirely from `trainingMarketOps.ts` (interface, body, return). The selection-aware logic that used to live there now lives at the bridge facade in `humanInputOps.issueMarketAction` (the HUD selection guard). `executeMarketActionDirect` is the only remaining trade-application path.

## Claude F2 (real, fixed inline) — Stale module-header comment in `humanInputOps.ts`

The header still listed `executeMarketAction` as one of the wrapped helpers; that's stale post-impl-11.

**Fix:** rewrote the header to reflect the post-Phase-1B state (some facades wrap legacy helpers, others submit through `world.submitWithResult`).

## Claude F3 (real, fixed inline) — Validator and handler read market constants from different sources

The validator imported `MARKET_FEE_RATE` / `MARKET_TRANSACTION_AMOUNT` from `bridgeConstants.ts` directly. The handler reads `marketFeeRate` / `marketTransactionAmount` off `TrainingMarketOpsDeps` (which `wirePostSeedOps` populates from the same `bridgeConstants.ts`). They match in production only because both ultimately reference the same module-level constants — but a future divergence (test rates, scenario tuning) would silently desync the validator's affordability check from the handler's authoritative deduction. Class of bug B2 explicitly tolerates for stale state, NOT for static config.

**Fix:** added `marketFeeRate` + `marketTransactionAmount` to `MarketActionValidatorDeps`. The validator now reads them off deps instead of importing. `wireBridgeOps` threads the same `MARKET_FEE_RATE` / `MARKET_TRANSACTION_AMOUNT` constants into both `executeMarketActionDirect`'s deps (via `trainingMarketOps`) and the validator's deps. Test fixtures pass plausible defaults (`0.3` / `100`).

## Other findings cross-checked clean (Claude verified all 8 anti-regression items)

- ✓ `executeMarketActionDirect` body matches pre-1B `executeMarketAction` body modulo selection→playerId substitution. Trade math, fee math, rate-step updates byte-identical.
- ✓ Validator returns `true | { code, message }`, never `null`.
- ✓ Bridge facade preserves the pre-1B `'Market trade rejected. Check resources and selection.'` toast for both no-selection/non-market-selection AND validator-rejection cases. The `commandRejection.test.ts` "drains FIFO" test exercises the no-selection path.
- ✓ `wireBridgeOps` + `registerCommandHandlers` wiring complete. `executeMarketAction` dropped from `createHumanInputOps` args.
- ✓ Test coverage: 5 rejection codes (`invalid_player_id`, `no_market`, `cannot_trade`, `no_stockpile`, `insufficient_resources` × 2 buy/sell) + 2 accept paths (buy, sell) + 1 handler delegation + 1 B2-invariant integration = 11 net new tests.
- ✓ Utility integration test correctly steps `bridge.step(100)` after each `issueMarketAction` so the per-step `processCommands` applies the trade before reads.
- ✓ `playerOwnsCompletedMarket` correctly preserves the pre-1B "must own a completed market" gate; the HUD-time selection check separately preserves the "selected entity must be a completed market" UX. Two-tier behavior is correct.
- ✓ B2 silent stale-state-miss preserved: handler discards `executeMarketActionDirect`'s boolean return.

## Test count + gates

- 621 passed + 1 skipped (was 611 + 10 net new tests this commit: 9 in `marketAction.test.ts` + 1 B2-invariant in `commandRejection.test.ts`).
- typecheck, lint, build, full test suite all green.
- Codex review: ~5 min. Claude review: ~5 min. Both run in parallel.

## Phase 1B → next steps

10 of 15 commands complete (`unit.move`, `unit.attack`, `unit.gather`, `unit.context`, `unit.contextAtEntity`, `sheep.move`, `monk.contextAtEntity`, `queue.train`, `queue.research`, `market.action`). Next per PLAN v4: `building.placeConfirm` — fourth resource-spending command (the cost is the buildable-building cost), but unlike queue/market it also creates a new entity (foundation). Then `building.setRallyPoint`, `building.action`, `trebuchet.pack`, `trebuchet.unpack`.
