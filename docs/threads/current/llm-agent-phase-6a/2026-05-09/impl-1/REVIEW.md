# Phase-6.A quick wins — impl-1 review synthesis

Date: 2026-05-09. Iteration 1. Reviewers: Codex (gpt-5.5 xhigh), Claude (Opus 4.7 1M, max effort).

## Verdict

Both reviewers converged. **2 MEDIUM (overlap)** + **2 MEDIUM (Codex-only)** = 4 substantive findings. All addressed inline. The remaining "no-issue" verifications confirmed the empty-state guard is correct, CI manual-vs-corpus paths are mutually exclusive, and the test coverage table is representative for the assertions as written.

## HIGH

None.

## MEDIUM

### M1 — ESLint rule `paths` config bypassed by subpath imports

**Surfaced by:** Codex finding 1, Claude finding 1 (overlap).

**Issue:** `paths: [{name: '@anthropic-ai/sdk'}]` is exact-match only. The SDK exposes ~14 subpaths (`@anthropic-ai/sdk/error`, `/client`, `/resources/*`, `/core/*`, etc.) that cross-import the SDK internals. Static `import { APIError } from '@anthropic-ai/sdk/error'` from a non-allowlisted file would pass the current rule but still pull SDK code into Vite's graph.

**Fix applied:** switched to `patterns: [{group: ['@anthropic-ai/sdk', '@anthropic-ai/sdk/*']}]`, which catches both the bare module and any subpath. Negative-tested by introducing a transient `import { APIError } from '@anthropic-ai/sdk/error'` in a non-allowlisted file — lint correctly fired with the augmented message; file deleted.

### M2 — `assertEconomyShape` misses `economy.villagers`

**Surfaced by:** Codex finding 2, Claude finding 2 (overlap).

**Issue:** `perPlayerStates` reads `economy.villagers` to populate `villagerCountByTask`, which is part of `AgentPlayerState` and embedded in the LLM prompt. If `villagers` becomes `undefined` (engine rename/removal), the snapshot crashes with a generic `TypeError`, not the targeted "schema drift detected" message.

**Fix applied:** added `{ key: 'villagers', isType: Array.isArray }` to the `required` list. Test cases table gained a row covering `villagers: undefined`.

### M3 — Record-type checks too permissive (would accept Map / array)

**Surfaced by:** Codex finding 3 (Codex-only).

**Issue:** `ages`, `playerResources`, `population` were checked with `typeof v === 'object' && v !== null`, which accepts arrays and `Map` instances. The underlying engine codecs are Map-backed (`bridgeStateSerialize.ts`); a future change returning Map instead of plain object would silently bypass the guard while `economy.ages[ownerId]`, `Object.keys(economy.playerResources)`, etc. degrade.

**Fix applied:** extracted `isPlainRecord(v)` predicate that excludes null, arrays, `Map`, and `Set`. Tests gained 3 new cases: `Map` for `ages`, array for `playerResources`, `Set` for `population` — each must throw the schema-drift error.

### M4 — Per-row `--out` path still clobbers same-day double-runs

**Surfaced by:** Codex finding 4 (Codex marked MEDIUM; Claude flagged the same gap as LOW under finding 4).

**Issue:** `corpusDir` is timestamped (`<date>-<HHMMSS>/`) but each row's `--out=output/playtests-llm/${date}-${run.name}` is still date-only. A same-day re-run overwrites the bundle / envelope / trace files in `output/playtests-llm/`, breaking the corpus retention story (the surviving SUMMARY-LLM.md tables in distinct corpus dirs would all reference the LATEST run's envelope).

**Fix applied:** `--out` path also includes the `${hhmmss}` stamp: `output/playtests-llm/${date}-${hhmmss}-${run.name}`. Retention pruning's stem-grouping logic in `pruneOldRuns()` is unaffected (still groups by basename).

## No-issue verifications

- **Empty-state safety** (Claude finding 3): `economyStateOps` legitimately produces `{}` for fresh-game state; the guard's `isPlainRecord` accepts empty objects. Positive test passes.
- **CI cross-process timestamp drift** (Claude finding 5): manual-dispatch and corpus paths are mutually exclusive via `if:` conditionals. ✓
- **Test coverage** (Claude finding 6): the 5 negative cases hit realistic JS-engine drift modes; new Map/array cases extend coverage post-M3 fix.
- **Three-fix batching** (Claude finding 7): defensible per AGENTS.md "coherent self-contained unit of change" reading the unit at the Phase-6.A-quick-wins granularity.

## Disposition

All 4 MEDIUM findings addressed inline. Re-review next iteration.
