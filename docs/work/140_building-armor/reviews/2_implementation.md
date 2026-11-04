# Review 2: implementation

## Target

Repository aoe2, branch `building-armor-1104`, commit `16f2ffa4` on main `a37deeee`: a focused re-review of round 1's repairs, the diff `fa374d9f..16f2ffa4` (commits `86ba7290`, Codex's F9 and F10, and `16f2ffa4`, Claude's F11 to F17 and notes N1 and N2 with the round 0 and 1 records). The prompt asked five questions: whether each round-1 finding is resolved and each disposition sound; whether the swapped hand checks are DE's figures and every remaining hand check uses DE's attack stat; whether the `technologies.csv` descriptions are DE's rules and still parse; whether any line still describes hits on buildings, building armor or the armor rows by the old rule; and whether the two review records retain each report faithfully. It told the reviewer to run no tests, builds or npm commands, since the full gate was running in the worktree. Run folder: fleet's ignored `tmp/review-runs/aoe2-work140-r2/`.

## Reviewers and coverage

One lane: Codex, model `gpt-6-astra` at `model_reasoning_effort=xhigh`, codex-cli 0.163.0, `--sandbox read-only --ephemeral`, run from the run folder with `--cd` on the worktree. The log check printed `keep` (no command failed to start). It cited `design/spec-final.md:1275`, outside the diff's hunks, and the citation holds: the tower-upgrade paragraph said the ladder is "SCOPED to attack + range". It hashed the cached pinned dataset against the pin and compared the four retained reports with the records; it ran no tests, as asked. Claude was not run this round: the repairs are comments, records, CSV descriptions and two hand-check cases, and Codex alone covers a focused re-review of that size. The tree's `git status --porcelain` and `git diff HEAD` were empty before the run and after it.

## Reports

Kept as written, except that each markdown link to an absolute path in the worktree is now plain `file:line` text.

### Codex (gpt-6-astra, xhigh)

> No critical or major findings. Two minor documentation inconsistencies remain:
>
> 1. **Minor — `design/stats/units.csv:22`: Siege Engineers’ scope is still understated.** The header says it “multiplies the buildings token only.” The Petard also gets ×1.4 on Wall & Gate and Castle attacks, as the fixture and `buildingAttack.ts:125` specify. Qualify that sentence to rams or name the exception; following it literally would give a Petard 809 against a Castle instead of 849.
>
> 2. **Minor — `design/spec-final.md:1275`, outside the diff’s hunks: tower upgrades remain described as “SCOPED to attack + range.”** Work 140 also gives Guard Tower and Keep their armor: 1/7 → 2/8 → 3/9, implemented at `buildingArmor.ts:124`. The authoritative spec should include that effect rather than retain a scope restriction contradicting §10.3.
>
> Otherwise, the focused repairs check out:
>
> - F9–F18 have the stated repairs or dispositions. F15 properly remains outside building combat; N3 preserves a pre-existing test weakness without weakening the assertion. N2 remains explicitly pending landing.
> - Heavy Scorpion’s **13** is `(14−8) + (0−−1) + 6`; Long Swordsman’s **6** is `9−3`, with no Standard Building term against a Wonder. All ten distinct hand-check attackers match DE’s base attacks. I verified the cached dataset’s SHA-256 against the pin.
> - The four technology-row edits match the pinned armor and attack rules and preserve CSV parsing. Existing documented Gate-HP and siege-range discrepancies remain outside scope.
> - Both review records preserve the original reports’ substantive findings, attribution and verification caveats. I compared all four retained reports; I found no material misrepresentation.
>
> Reviewed `16f2ffa4`. No files modified; no tests, builds, npm or npx commands run.

## Findings and disposition

| ID | Finding | Disposition and reason | Repair or follow-up |
|---|---|---|---|
| F19 | Codex 1: `units.csv`'s provenance header says Siege Engineers multiplies the buildings token only, where the Petard also takes x1.4 on its walls & gates and castle tokens; read literally it would give a Petard 809 against a Castle instead of 849. | Accepted. | The header names the x1.2 on the buildings token and the x1.4 on the Petard's three tokens and the Demolition Ships' buildings token. |
| F20 | Codex 2: the tower-upgrade paragraph (`spec-final.md:1275`) still scopes the Guard Tower and Keep to attack and range, though work 140 gives them DE's armor, 1/7 to 2/8 to 3/9. | Accepted: two rules may not coexist in the spec. | The paragraph says the ladder runs in attack, range, hit points and armor, and gives the armor with Masonry and Architecture on top (§10.3). |

## Verification

The repairs were checked on the repaired tree: `npm run content:validate` passed, and the tests that read the two files passed (the content, attack-bonus, content-library, spec-table and line-ending tests: 5 files, 24 tests).

## Round outcome

No critical or major finding; two minor documentation findings, both accepted and repaired. The repairs touch a CSV comment line and a spec paragraph, and the full gate ran again on the commit that holds them.
