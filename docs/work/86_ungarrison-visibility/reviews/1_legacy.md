# Review — iteration 2

## Providers

- OpenAI Codex `gpt-5.6-sol` at ultra effort completed an external staged-diff review.
- In-process reviewers verified each finding against the live code.
- Anthropic Claude Code remained blocked before execution by tenant private-source export policy; no Claude review was produced and no diff was sent through that path.

## Findings and disposition

- [HIGH][Codex] Bounded-search exhaustion still counted as successful ungarrison: fresh placement returned an overflow result and the caller removed containment, releasing the villager into visual stacking. **Resolved:** `placeUnitForSpawn` clears its provisional claim and returns `null`; `placeFreshSpawnUnit` writes no position or transform on `null`; and `ungarrisonBuilding` retains the unit, reverse map, and stored vision.

## Verification note

The external reviewer read the live implementation and passed TypeScript checking. Its focused runtime probe was blocked by its read-only environment's linked-package resolution and was not counted as test evidence; project-side tests were run separately.

## Result

Iteration 2 was not approved until exhaustion became an explicit non-placement result with containment preserved.
