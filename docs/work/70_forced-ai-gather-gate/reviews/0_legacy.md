# Forced-AI auto-gather gate fix — adversarial review, iteration 1 (2026-07-02)

**Reviewer:** in-process Workflow (AGENTS.md default), 2 dimension finders (gate correctness + blast radius; test quality + the bundled monasteryTechs correction + docs), each grounding claims in the live tree. Model opus-4-8. Multi-CLI not run — a gate-predicate change with no persistence/security/concurrency surface, fully covered by TDD + full-suite-green + before/after replay.

**Result: ZERO code defects; 1 confirmed MEDIUM doc-drift finding, fixed.** The gate-correctness finder returned EMPTY after tracing every case (owner 2 AI / AI-disabled / human owner 1 / forced-AI owner 1) and confirming `aiStates` seeding, both call sites, determinism, and that the real game never sets `forceAiForOwners` — the shipped additive form is correct and byte-identical for real games. The one finding: this DESIGN.md's "Fix" section documented the REVERTED 2-arg form (`shouldMaintainGatheringOrder(gatherer, isAiControlled)` → `isAiControlled || hasExplicitGatherOrder`) — exactly the broken first attempt that regressed AI-disabled owners — instead of the shipped additive 3-arg form, and was internally self-contradictory with its own "byte-identical" argument. **Fixed:** the Fix section now shows the shipped `owner !== HUMAN_PLAYER_ID || isAiControlled || hasExplicitGatherOrder` and explains why additive (not replacement). Good catch — `pureHelpers.ts` points future readers here as the durable rationale, so a stale signature here would mislead.

## The change (for the record)

- `shouldMaintainGatheringOrder(owner, gatherer, isAiControlled)` → `owner !== HUMAN_PLAYER_ID || isAiControlled || gatherer.hasExplicitGatherOrder`. ADDITIVE: the owner-id clause is retained, so every non-human owner (including AI-disabled) is byte-identical; the only new case is a forced-AI owner 1. Call sites pass `isAiControlled = aiStates.has(unit.owner)` (persisted Tier-1 codec, deterministic + save/replay-safe).
- Bundled: `monasteryTechs.test.ts` corrected to include `herbal-medicine` in the Castle option set (a v0.1.70 test miss that had shipped RED, masked by a piped-`npm test` exit code — lesson recorded).

## Process note (self-caught, not a reviewer finding)

My FIRST attempt REPLACED the owner-id clause with `isAiControlled` alone, which broke 6 test files: AI-disabled owners have `aiStates.has(owner) = false`, so their villagers (which the reroute/economy fixtures rely on auto-gathering) stopped. The full suite caught it; the additive form restored byte-identical behavior. This is the 2026-06-14 "full suite is the gate for widely-coupled behavior" lesson in action — and the reason the masked-exit-code lesson matters (a masked exit would have hidden this too).

## Post-review state

All four gates GREEN, verified with real exit codes (typecheck/lint/build 0; **TEST EXIT 0**; 1629 passed / 2 skipped / 0 failed). Before/after replay confirms owner 1's economy unfreezes (frozen → Feudal by t4000). Test-infra only (real games byte-identical) → no version bump. This also returns `main` to green (it was red since v0.1.70's masked monasteryTechs failure).
