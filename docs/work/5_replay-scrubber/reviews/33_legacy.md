# impl-17 multi-CLI review — Phase 2A bridge-state migration scaffolding

**Date:** 2026-05-01
**Branch:** main (uncommitted)
**Reviewers:** Codex `gpt-5.5` xhigh, Claude `claude-opus-4-7[1m]` max, Gemini `gemini-3.1-pro-preview` plan-mode
**Diff scope:** ~697 LOC across 5 new files (3 source + 2 test): `bridgeStateSerialize.ts`, `bridgeStateAccessor.ts`, `visibilityCell.ts`, plus tests.

## Summary

Phase 2A lands the additive scaffolding for the bridge-state migration described in DESIGN v17 §5.1: 35 Tier-1 codec definitions, the `BridgeStateAccessor` per-tick cache layer, and a `VisibilityCell` dirty-flag wrapper. **No existing code is migrated yet** — that is Phase 2D's slot-by-slot work. This commit gives the rest of Phase 2 something to integrate against.

## Reviewer findings (synthesized)

### Real issues addressed inline

| Finding | Source | Severity | Fix |
|---|---|---|---|
| Cache-mutate-without-markDirty footgun (callers can mutate through `accessor.get(codec)` without ever calling `markDirty`; mutation is visible to same-tick reads but lost at flush time — exactly the snapshot/replay failure mode Phase 2 exists to prevent) | Claude F1 (MEDIUM) | MEDIUM | Tightened JSDoc on `get()` to warn explicitly about the mutation pairing requirement; recommended `mutate(codec, fn)` as the safe path. |
| Missing `mapOfMap` round-trip test (`lastSeenStaticCodec` is the only nested-Map slot and the most non-trivial codec; helper-factory typo would slip through) | Claude F2 (MEDIUM, coverage) | MEDIUM | Added `lastSeenStaticCodec` round-trip test with two players × multiple memory entries, JSON-string round-trip, and identity verification. |
| `inFlightTechByOwnerCodec` inline comment contradicts registry placement | Gemini F1 + Claude F3 (LOW) | LOW | Rewrote the inline comment to match the registry placement (Tier-2 per DESIGN, codec exported for non-flush callers). |
| `markDirty(slot: string)` accepts arbitrary strings — typo or no-prior-read silently no-ops at flush | Claude F4 (LOW, robustness) | LOW | Added a codec-typed overload (`markDirty(codec)`) so call sites using a SlotCodec instance get type-checking; kept the string overload for tests / Tier-3 leak-protection scenarios. |
| `CivWorld` type alias duplicates `GameWorld` at narrower arity (trivia) | Claude (informational) | NIT | Removed the alias; uses `GameWorld` directly. |

### Codex unreachable

Codex's exec sandbox produced 1903 lines of output (prompt + diff + source-file reads via PowerShell `Get-Content`) but emitted no structured findings. Same failure mode as impl-16. Per AGENTS.md fallback, proceeded with the two reachable reviewers; Gemini + Claude converged on the doc-comment contradiction independently, which is high-confidence signal.

### Anti-regression checklist verdict

- **Correctness** — Codec round-trip is mechanically correct (`Array.from(map)` ↔ `new Map(j ?? [])`). Runtime `assertJsonCompatible` enforcement happens in Phase 2D when ops modules actually flow real values; flagged for that phase.
- **Completeness** — TIER_1_CODECS contains exactly 35 codecs, matching DESIGN §3 inventory by category (5+2+4+3+4+1+5+3+1+1+4+2 = 35).
- **Cache coherence** — `get` returns the same reference; `mutate` guarantees the markDirty pairing. `get` direct-mutation footgun documented after F1.
- **Type safety** — `as Array<SlotCodec<unknown, unknown>>` at the registry edge is unsafe-but-bounded (closed-registry, lookups only by slot key, no caller iterates to call `serialize(arbitraryValue)`). Acceptable.
- **World-not-bound error** — Clear and actionable.
- **Tier-2 decision** — `inFlightTechByOwnerCodec` excluded from `TIER_1_CODECS` per DESIGN §3 classification; comment fixed for consistency.
- **VisibilityCell starts dirty** — Correct contract; first sync needs to capture the initial visibility computation, and starting clean would force every callsite to remember a first-tick mark-dirty.

## Verification

- `npm run typecheck` ✓
- `npm run lint` ✓
- `npx vitest run tests/replay/` (22 tests, 22 passed)
- Full suite: 688 passed + 1 skipped (matches Phase 1C baseline + 22 new tests).

## Disposition

All real findings addressed inline. Single iteration sufficed — both reachable reviewers converged on substantive issues that were fixable without restructuring. Re-review unnecessary; commit folds these fixes in.
