# impl-25 multi-CLI review — Phase 2A iter-2 (alias decoupling + flush throw correctness)

**Date:** 2026-05-02
**Iterations:** 3
**Reviewers:** Codex `gpt-5.5` xhigh (now reachable — extraction bug fixed), Claude `claude-opus-4-7[1m]` max, Gemini `gemini-3.1-pro-preview` plan-mode

## Summary

Retroactive fix for two Codex impl-17 findings missed at the original review (the awk extraction matched the prompt-echo, not the review — see `docs/debugging/2026-05-02-missed-codex-findings.md`).

1. **Codex impl-17 HIGH (alias-mutation in shallow codecs):** `flatMapCodec.serialize` returned `Array.from(map)` whose tuples shared value-references with the cached Map; `world.setState` stored that array; subsequent property mutations on cached Map values would propagate to `world.state` without dirty-tracking. Fix: `structuredClone` at BOTH boundaries — when `flush()` writes to `world.state` AND when `get()` reads from `world.state` after a `reset()`. Without read-side decoupling too, the post-applySnapshot path would re-introduce the alias.

2. **Codex impl-17 MEDIUM (silent flush drop on unknown slot):** dirty slot whose key is not in `SLOT_CODECS_BY_KEY` was silently `continue`d at flush + dirty-cleared, losing the write. Fix: throw with descriptive error.

## Iteration log

**iter-1** — initial fix: clone in flush only, throw on unknown slot.

| Reviewer | Finding |
|---|---|
| Codex HIGH | Read-boundary alias still present; deserialize wraps world.state's tuples shallowly. |
| Gemini PERF/CORRECTNESS | `JSON.parse(JSON.stringify(...))` is slow + drops `undefined`. Use `structuredClone`. |
| Claude STALE DOCSTRING | `markDirty` docstring claimed "silently skips" — now contradicts the throw + the Tier-3 example would itself throw. |
| Claude/Gemini TEST CLEANUP | Throw-test had unnecessary cache priming + a misleading comment. |

**iter-2** — addressed all four:
- Added `structuredClone` at the read boundary (`get()`).
- Swapped `JSON.parse(JSON.stringify(...))` to `structuredClone` in `flush()`.
- Updated `markDirty` docstring to state the throw and warn off Tier-3.
- Cleaned the test, added a reset-path regression test.

| Reviewer | Finding |
|---|---|
| Codex | No real issues found. |
| Gemini | Performance trajectory note + meta-comment scrub. |
| Claude MEDIUM | **Real bug:** in-loop throw wedges valid pending writes — Set iteration is insertion-order, partial-flush before throw, `_dirty` not cleared, future flushes re-throw and stay wedged. |
| Claude LOW | Stale "JSON-clone" wording; structuredClone perf claim is shaky. |

**iter-3** — addressed all three:
- Split flush into pre-validation pass + flush pass. Atomic: throw fires before any setState, dirty set survives for caller recovery.
- Scrubbed meta-references from src/ + test docstrings.
- Trimmed structuredClone perf claim to correctness rationale only.
- Added regression test "pre-pass: throwing on an unknown slot does NOT strand later valid writes" — verifies world.getState is undefined after throw + dirty set has both slots.

| Reviewer | Finding |
|---|---|
| Codex | No real issues found in this diff. |
| Gemini | One leftover meta-comment in test file + perf claim wording. |
| Claude | Same leftover meta-comment + perf claim wording. |

**iter-3 final** — addressed both nits:
- Replaced "iter-2 fix" comment in test with technical wording.
- Trimmed perf claim from flush docstring (kept correctness rationale).

## Final verification

- `npm run typecheck` ✓
- `npm run lint` ✓
- `npx vitest run tests/replay/` (39 tests passed)
- `npm test` (706 passed + 1 skipped)
- `npm run build` ✓

## Disposition

Reviewers converged to nits. Single real bug introduced in iter-1 (in-loop throw wedge — Claude iter-2 MEDIUM) caught and fixed atomically before any commit lands. All four original Codex impl-17 findings now addressed at the source AND through the post-reset recovery path.

This commit is the first to use the corrected Codex extraction — Codex actually reachable for the first time in 8 reviews.
