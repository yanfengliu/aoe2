# Review — iteration 1

## Providers

- OpenAI Codex `gpt-5.6-sol` at ultra effort completed an external staged-diff review.
- Three in-process reviewers inspected the live code, tests, and active documentation.
- Anthropic Claude Code was explicitly authorized, but tenant private-source export policy blocked the run before execution; no Claude review was produced and no diff was sent through that path.

## Findings and disposition

- [MEDIUM][Codex] Foreground exit sorting was unconditional, changing trained-unit production ordering even though the design limited the new behavior to ungarrison. **Resolved:** `findBuildingSpawnPosition` retains its default ordering and accepts a foreground preference used only by ungarrison.
- [MEDIUM][Codex] Fresh-placement fallback inspected only cardinal neighbors, so a full center and four cardinals could stack even with diagonal capacity available. **Resolved:** fresh placement now uses the deterministic eight-direction spiral capped at radius 16, with a diagonal regression.
- [MEDIUM][In-process] The Castle regression did not yet prove that all 20 villagers were actually contained before release, the linked lockfile included unrelated sibling metadata churn, and active wording overclaimed training changes. **Resolved:** the test asserts economy/render absence plus `20 / 20 garrisoned`, the lockfile contains only AoE's version bump, and behavior wording is scoped to ungarrison.

## Result

Iteration 1 was not approved until the trained-unit scope and cardinal-fallback defects were corrected. Those corrections were carried into iteration 2.
