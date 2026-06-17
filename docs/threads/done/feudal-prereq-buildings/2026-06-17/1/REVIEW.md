# REVIEW — feudal-prereq-buildings, iteration 1 (2026-06-17)

Diff: a proposed v0.1.48 change adding house/palisade-wall/farm to the Feudal age-up prerequisite set (278-line `git diff --cached`). Three CLIs, codebase-grounded + AoE2-fidelity-checked.

- **Codex** gpt-5.5 xhigh, read-only sandbox.
- **Claude** opus[1m] `--effort max` (Read/Glob/Grep + WebFetch — it fetched the AoE2 wikis).
- **Gemini** gemini-3.1-pro-preview plan — 429 capacity-exhausted, retried, emitted NO structured review by the time the verdict was settled. Not load-bearing here (the authoritative wiki decided it).
- **Contamination audit: CLEAN** — the change was reverted before any commit; the working tree is back at HEAD's rule.

## Verdict: REVERT — the proposed change is a gameplay REGRESSION, not a fix.

## Findings + disposition

1. **[HIGH — Claude H1] The core rule the change implements is factually WRONG per AoE2.** The change added house/palisade-wall/farm to `DARK_AGE_PREREQUISITE_BUILDINGS` on the premise "any non-Town-Center Dark-Age building counts toward Feudal; two Houses suffice." Claude fetched Liquipedia + Fandom: advancing Dark→Feudal needs 2 of {Barracks, Dock, Lumber Camp, Mill, Mining Camp}; **Houses, Farms, and Walls do NOT count.** VERIFIED INDEPENDENTLY by the lead against the authoritative wikis (Fandom: *"Two of the following buildings: Barracks, Dock, Lumber Camp, Mill, Mining Camp"*; *"Houses, Farms, and Walls … do not count"*; a cross-check web search agreed: *"any two Dark Age buildings except Houses, Farms, walls, and Outposts"*). So the original `{mill, lumber-camp, mining-camp, barracks}` was already AoE2-correct (the qualifying five minus Dock, which this land-only slice lacks). The campaign-11 conformance-probe "finding (a)" was a MISDIAGNOSIS. **DISPOSITION: the entire change REVERTED — no code change; finding (a) reclassified not-a-bug.**

2. **[MEDIUM — Codex] Doc nits in the (now-reverted) spec edits** — a stale Dark-Age menu list in spec §7.3 (omitted Farm), and my §7.2 generalization to Feudal/Castle over-broadened (the Feudal/Castle prerequisite sets exclude watch-tower/stone-wall; "Castle→Imperial … or 1 Castle" is not a one-Castle shortcut — a Castle is one counted building in the Castle-age set). Codex did NOT challenge the core Dark→Feudal rule. **DISPOSITION: moot — the spec edits were reverted with the change.** Codex's separately-flagged PRE-EXISTING §7.3 staleness (the Dark-Age build list omits Farm, which has been Dark-Age-buildable since v0.1.34) is a real, independent doc nit on the UNCHANGED spec — fixed in this docs commit.

3. **Codex verification notes (all confirmed):** the Dark→Feudal change was internally CONSISTENT — the new set matched the Dark-Age build menu, both consumers (`countCompletedAgePrerequisites` via `isDarkAgePrerequisiteBuilding`; the lock reason via `agePrerequisiteBuildingTypes`) derive from the one Set, owner 2's forward House is real (`defaultMap.ts:50-56`), no save field added, 438 LOC. So the change was well-ENGINEERED; it was just pointed at the wrong RULE.

## Outcome

The 3-CLI review did exactly its job: a conformance-probe-driven would-be gameplay regression was caught (Claude, with sources), verified against the authoritative AoE2 wiki by the lead, and reverted before commit. No iter-2 needed — the verdict is "revert + reclassify the finding" (a docs-only outcome). Lesson recorded in `docs/learning/lessons.md`: verify game-RULE claims against the wiki, not the probe or code-reading (code-reading confirms what the code DOES, not whether the rule is RIGHT). The pre-existing §7.3 Farm-omission nit Codex found is fixed in this commit.
