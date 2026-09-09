# REVIEW — ai-age-up-priority, iteration 1 (2026-06-17)

Diff: the v0.1.48 AI age-up-priority change (544-line `git diff HEAD`: the reserve fix in `aiSystem.ts` + the extracted `ageUpReserveCost`/`canAffordWithReserve` helpers in `ai.ts`, the `ai-age-up-priority-fixture` + `aiAgeUpPriority.test.ts` + the `aiPlayer.test.ts` difficulty-test update, and the spec/changelog/devlog/roadmap/summary docs). Three CLIs, codebase-grounded + AoE2-fidelity-checked.

- **Codex** gpt-5.5 xhigh, read-only sandbox — substantive, codebase-grounded.
- **Claude** opus[1m] `--effort max` (Read/Glob/Grep + git) — _see below_.
- **Gemini** gemini-3.1-pro-preview plan — first run returned an empty/malformed response (the documented intermittent failure); retried once.
- **Contamination audit: a Gemini-orphan re-contamination was CAUGHT by Codex and fixed** (see finding 1). All three reviewers were run as their OWN background tasks (not `&`-children), so none orphaned this round; the contamination Codex flagged predated this review (an orphan from the earlier feudal-prereq review). Post-review `git diff HEAD -- src tests` audited clean.

## Verdict: SHIP after addressing the two Codex findings (both fixed; no implementation blocker).

## Findings + disposition

1. **[HIGH — Codex] `design/spec-final.md` carried the REVERTED broken Feudal-prerequisite rule** ("House, Mill, …, Palisade Wall, or Farm … two Houses, or two Farms … alone satisfy it"). This was **contamination**: an orphaned `gemini --approval-mode plan` reviewer from the EARLIER feudal-prereq review (killed via TaskStop, but its `&`-child survived) re-applied the broken diff to the spec AFTER the clean finding-(a) commit (394aa25). My finding-(c) contamination audits checked only `src/`+`tests/`, so this `design/` write slipped through — **Codex (read-only, genuinely read the live spec) caught what the audits missed. This is the multi-CLI review earning its keep.** **DISPOSITION: FIXED** — `git checkout HEAD -- design/spec-final.md` (removed the contamination), then re-added §13.2 and EXTENDED the qualifying-building line with the *correct* AoE2 rule (two of {Barracks, Dock, Lumber Camp, Mill, Mining Camp}; Houses/Farms/Walls never count; this land-only slice's implemented set is the four minus Dock). Verified: `grep "two Houses, or two Farms" = 0`.

2. **[MEDIUM — Codex] The "military is the ONLY discretionary spend before the age-up research" claim was overstated** in the code comment, spec §13.2, DESIGN.md, and the devlog. VERIFIED against the live code: build placements (watch-tower/wonder/nextBuild, `aiSystem.ts` ~403/474/491) ARE pushed before the age-up research (~557+), so the literal claim is wrong. Codex correctly notes this does NOT invalidate the fix — those builds spend wood/stone (the Dark→Feudal age-up needs FOOD), and Wonder is Imperial-only — so reserving the age-up's food from MILITARY remains the targeted fix for the confirmed bug path. **DISPOSITION: FIXED** — narrowed every occurrence to "military is the only pre-age-up spend that consumes the constrained food; build placements (also before it) spend wood/stone; villager/building-tech/monastery come after."

3. **[Codex — no blocker, all verified]** `canAffordWithReserve` correctly matches `canAfford`'s `Partial<PlayerResources>` (missing fields = 0); the reserve is recomputed per decision tick (no save/load state); the fixture is wired through the barrels + dispatch; the regression assertion is meaningful for the FIFO starvation; the TC queue frees (age-up is pushed before villager training once a slot opens); file sizes within budget (`aiSystem.ts` 787 ≤ 788). So the fix is well-engineered; only the docs needed correcting.

## Claude (opus[1m] max — substantive, deeply codebase-grounded)

Verdict: "the core fix is correct, well-targeted, deterministic, and the regression test/fixture genuinely reproduce the bug." Claude CONVERGED with Codex and verified all 7 review questions against the live code (decision-cycle ordering, no-permanent-starvation, `canAffordWithReserve` multi-resource correctness, save/determinism, the red-without-fix fixture, file sizes, doc accuracy). Findings:

4. **[HIGH — Claude F1, CONVERGES with Codex 1] spec §7.2 contamination** — independently flagged the same broken Feudal-prereq paragraph as a code↔spec contradiction + internal inconsistency (it claims "qualifying set equals the Dark-Age build menu" yet omits Dock while adding House/Wall/Farm), almost certainly orphan contamination. **DISPOSITION: already FIXED** (see finding 1).

5. **[MEDIUM — Claude F2] spec §13.2 + the fixture comment described the REVERTED full-suppression ("stops training military until the age-up is queued" / "suppresses Militia while a fundable age-up is pending"), not the shipped RESERVE** — contradicting the changelog. The §13.2 wording was already corrected to the reserve framing during the Codex pass; **the fixture comment (`scoutingAndRush.ts`) is now reworded** to "RESERVES the age-up cost so Militia trains only from the surplus above it." **DISPOSITION: FIXED.**

6. **[LOW — Claude F3] devlog "805 LOC … was 783; +22" was wrong** (actual 787, net ≈ +4). **DISPOSITION: already FIXED** (the Result line now reads 787) during the post-suite update.

7. **[LOW — Claude F4, CONVERGES with Codex 2, sharpened] the "only spend before age-up" invariant** — Claude's precise form: "military is the only food/gold-costing spend sequenced before the age-up research" (watch-tower=stone, builds=wood, Wonder=Imperial-only where `ageUpReserve` is `{}`). **DISPOSITION: FIXED** — the code comment now reads "the only pre-age-up spend that consumes the food/gold an age-up reserves."

8. **[behavioral note — Claude, not a defect] the reserve broadens military suppression** — a qualified AI banks ~560 food before training Militia again (not just near-threshold). Claude confirms this is intentional + AoE2-defensible and that the `preserves baseline barracks-rush` test still holds (first Militia pushed after Barracks, before Mill, while the reserve is empty). **DISPOSITION: recorded as known intentional behavior in the devlog** (incl. the Barracks-before-Mill maintenance caution).

## Gemini (gemini-3.1-pro-preview, plan)

UNAVAILABLE this iteration — the initial run returned an empty/malformed response and the retry was HTTP 429 capacity-exhausted (gaxios). Not load-bearing here: Codex + Claude independently CONVERGED (both substantive, both codebase-grounded). Retry on the next iteration per AGENTS.md.

## Outcome

CONVERGED — Codex and Claude both verified the fix is correct, deterministic, save-safe, and the fixture genuinely red-without-fix; **no code-behavior defect was found by either.** Every finding was doc/comment accuracy, and all are fixed (the one HIGH was orphan contamination in `design/spec-final.md` that the review caught after my src/tests-only audits missed it — the multi-CLI review's most valuable catch this round). All four gates green pre- and post-review (full suite 1481 passed / 2 skipped, 0 failed; typecheck/lint/build/fileSizeBudget clean; the post-review edits are comment/doc-only). No iter-2 needed — the remaining items are nitpick-level doc wording, all addressed. A `lessons.md` entry (orphan reviewer survives TaskStop; audit ALL diff paths; multi-CLI review is the backstop) was recorded.
