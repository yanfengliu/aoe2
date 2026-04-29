You are verifying iteration-3 batch fixes against findings catalogued in
`docs/reviews/full/2026-04-25/3/REVIEW.md`.

The user explicitly asked to "address all remaining concerns" — so 22+
findings landed across multiple commits on
`agent/review-findings-2026-04-25-iter3-batch1`:

- `[V3-1 + V3-2]` Footprint visibility for fog memory + click selection
- `[V3-3 + V3-9]` FU2 units in double-click whitelist + Wonder display name
- `[V3-12]` Mutual annihilation = draw outcome
- `[V3-13]` Default map: forest cluster cannot occupy forward-house anchor
- `[V3-14 + V3-15 + V3-16 + V3-22]` Surrogate pair hash + Watch Tower gate + dedupe shore fish + empty seed URL
- `[V3-7]` Monk conversion vision/LOS gate
- `[V3-20 + V3-21 + V3-23]` Build hardening (parseRange / parseCsv) + F2 input guard
- `[V3-11 + V3-17]` HUD destroy() + browserTestApi sync parity
- `[V3-5 + V3-6]` H2-2 retry throttle + H2-1 cost dedupe O(1) lookup
- `[V3-24]` AI findIdleProducer load-balanced
- `[V3-8]` Save-load: post-load entity-id key validation across all side maps
- `[V3-25]` browserTestApi: install once + dynamic bridge resolution
- `[V3-18 + V3-19]` renderFog memo + getRenderState per-tick cache

# What we want from you

For each commit's fix, briefly:

1. Did the fix actually land on the right file/line?
2. Is the fix complete?
3. Does it introduce a new defect (off-by-one, infinite loop, scope leak, type narrowing, …)?
4. Is the regression test (if any) strong enough?

End with a tight verdict per commit: `OK` / `OK with caveats: <one-liner>` / `NEEDS CHANGE: <what to fix>`.

# Validation already done

- `npx tsc --noEmit` clean
- `npm run lint` clean
- `npx vitest run` **51/51 files, 405 passed + 1 skipped, 0 failed**
- `npx vite build` clean (4.39 s)

So focus on logic / completeness / regressions, not on build mechanics.

# Output format

Plain text or markdown. Do NOT modify files.

Stay tight: the scope is verification, not a fresh review pass. If you spot
anything unrelated and high/critical, flag briefly under "Out-of-scope
follow-ups".
