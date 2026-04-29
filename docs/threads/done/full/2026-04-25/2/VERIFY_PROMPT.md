You are verifying a small batch of fixes that address findings from
`docs/reviews/full/2026-04-25/2/REVIEW.md` (iteration 2 of a multi-AI
full-codebase review).

Five fixes shipped on branch `agent/review-findings-2026-04-25-iter2-batch1`,
each as a separate commit:

1. **[V2-1]** `getHudState()` returns saved-game seed, not outer constructor seed (commit 7d63e00). Fix is one line in `src/game/simulation/createSimulationBridge.ts:7314` (`seed,` → `seed: effectiveSeed,`). Two new regression tests in `tests/simulation/saveLoad.test.ts`.

2. **[H2-1]** Tech research is idempotent across multiple producer buildings (commit f54c55d). Adds `if (researchedTechnologies.get(owner)?.has(...)) return;` guard at the top of `applyTechnology` in `src/game/simulation/bridge/technologyOps.ts`. New `double-blacksmith-race-fixture` + regression test that race-queues Forging at two Blacksmiths and asserts attackDamage gains +1 not +2.

3. **[H2-2]** Gather: preserve carried load when no drop-off path (commit af4c559). Splits the `to-dropoff` branch in `src/game/simulation/createSimulationBridge.ts:5694-5710` so an empty carry still resets to idle, but a non-empty carry stays in `to-dropoff` instead of being zeroed. New `villager-no-wood-dropoff-fixture` + regression test.

4. **[H2-3]** Black Forest: widen base-pocket radius (commit 7687b82). Bumps `POCKET_RADIUS` from 6 to 7 in `src/game/simulation/mapGeneration/blackForestMap.ts`. Existing Black Forest test extended to assert per-owner stone / gold / boar counts of 4 / 4 / 2.

5. **[M2-1]** Building target finding uses footprint visibility (commit 0dc7cd7). Replaces anchor-cell visibility check with `isFootprintVisible` parity to `createProjector`. Widens the parameter type of `isFootprintVisible` in `src/game/simulation/bridge/pureHelpers.ts` from `VisibilityMap` to a structural `IsVisibleQuery` interface. New unit tests on the helper directly.

# What we want from you

For each fix:

1. Did the fix actually land on the right file and line?
2. Is the fix complete? Are there other call-sites or related code paths that should have been updated?
3. Does the fix introduce a new defect (off-by-one, infinite loop, scope leak, type narrowing failure, etc.)?
4. Is the regression test strong enough (catches the specific bug, not a tangential symptom)?

End with a tight verdict per fix: `OK` / `OK with caveats: <one-liner>` / `NEEDS CHANGE: <what to fix>`.

# Aspects we still want flagged

If you happen to spot anything UNRELATED to these five fixes that you think is high or critical severity, mention it briefly under "Out-of-scope follow-ups" — but stay terse; the goal of this pass is verification, not full re-review.

# Validation already done

- `npx tsc --noEmit` clean
- `npm run lint` clean
- `npx vitest run` 50/50 files, 400 passed + 1 skipped, no test failures
- `npx vite build` clean

So you can focus on logic / completeness rather than build/test mechanics.

# Output format

Plain text or markdown. Do NOT modify files.
