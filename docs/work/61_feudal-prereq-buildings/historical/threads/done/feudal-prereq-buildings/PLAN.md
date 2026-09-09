# PLAN — feudal-prereq-buildings (investigation, 2026-06-17)

Outcome: campaign-11 finding (a) is NOT A BUG (see DESIGN.md + REVIEW.md). The attempted fix was caught by the review + reverted.

1. Verify the probe's finding vs code (done): `DARK_AGE_PREREQUISITE_BUILDINGS` omits house/palisade-wall/farm — matches the probe's observation.
2. Attempt a fix on the probe's premise (done, then REVERTED): added house/palisade-wall/farm + TDD red-green + docs + a 0.1.48 bump.
3. Mandatory 3-CLI review (done): Claude HIGH [H1] — the rule is wrong per AoE2 (Houses/Farms/Walls don't count); Codex did not challenge the rule (only doc nits); Gemini 429-throttled.
4. VERIFY the rule against the authoritative wiki (done — the deciding step): Fandom + a web search confirm 2 of {Barracks, Dock, Lumber Camp, Mill, Mining Camp}; Houses/Farms/Walls excluded. Claude is right; the probe + my assumption were wrong.
5. REVERT the attempted fix (done): `git checkout HEAD --` on the code/tests/spec/changelog/package/summary. No code change; the rule stays the AoE2-correct {mill, lumber-camp, mining-camp, barracks}.
6. Document not-a-bug (done): roadmap reclassification, devlog entry, this thread + REVIEW.md, a lessons.md entry, and fix Codex's pre-existing §7.3 Farm-omission doc nit. Commit DOCS-ONLY + push. Move thread → done.

## Remaining campaign-11 findings (next)
- (b) accepted-vs-executed UX gap (no "cannot reach target" signal).
- (c) AI never ages up at 510 food (its own age-up-prioritization gap).
