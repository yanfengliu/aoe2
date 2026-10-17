# Review 3: integration — IR3 repair and census disposition

## Target

2026-10-17 focused follow-up to review 2, independently authored by collaboration worker `integration_review`, gpt-6-astra at xhigh under the fleet review pin. The broad review remains bound to frozen tree `229cc4bf210cddccf1badf683087388e580cfbf0`; this round reviews only its two-file executable increment and the retained pre-repair census evidence. Workspace: `C:/Users/38909/Documents/github/aoe2-worktrees/branch-completion-1017`.

Reviewed repair bytes, checked before and after reading: `src/game/simulation/bridge/footprintClearing.ts`, SHA-256 `CF96ACD46EF734C971723C4FE67D4C5F74C032141BD960832760B14A6066EFF4`; `tests/simulation/foundationStartAnimals.test.ts`, SHA-256 `87F441191E6743607EA2C1C71466DAC87CF4657F289CF642D5A0E7C1C75D4A01`. Read-only staged comparison against the frozen target shows only these two paths under `src` and `tests` at review time (+66/-8 and +33/-7). This is not a new whole-tree acceptance claim.

Census diagnosis: `docs/work/133_branch-completion/census-diagnosis-2026-10-17.md`, SHA-256 `7405C3EBA77AE92D2F2F9C3DEFE99E996C0FAFEE6C94DCE98B7D99B78C41E1D2`. Retained run root: `C:/Users/38909/Documents/github/aoe2-worktrees/ai-relics/tmp/probes/work133-census`. Reviewed raw census `run/census.json`, SHA-256 `269A2E5B064905D7AE9EF2C438E2CD57F170EF4AECE69ECC413699767B267DC2`; folded full-horizon history `run/history-summary.jsonl`, SHA-256 `D6B3CC5A520733D3082F15A694664DE0DD1A8BEF94ADC220950D352429DA2693`. These hashes were independently read from the files.

## Reviewers and coverage

Read-only implementation and artifact inspection; no test, benchmark, build, browser, server, source change, expected-snapshot edit or Git mutation by this reviewer. Only this report is authored. I read the new clearing implementation and test bodies, adjacent passability/capacity rules, the census instrumentation/preparation/analysis source, retained raw decisions and commands, old and new coverage rows, current unchanged producer assertions and expected JSON, and the production/spending logic implicated by the diagnosis. Claude remains unavailable for the reason recorded in review 2; this round adds no external approval.

## Reports

### Independent Astra reviewer: IR3

**Accept the bounded IR3 repair. No new material defect found in this increment.** It preserves the earlier nearest-first assignment when that assignment succeeds. If it fails, `footprintClearing.ts:211–215` discards the provisional plan and constructs a complete alternative; no world relocation occurs until `:224`. Failure therefore still moves nobody, and a successful fallback never mixes old reservations with new ones.

`exitsFrom` at `:96–115` enumerates the same four-connected perimeter in the old east/west/south/north BFS order. The fallback at `:120–142` reserves exclusive animal cells first and then assigns units. This is sufficient for the current animal/terrain relationship: living animals share the same empty land-cell eligibility, and those cells are also available to every land unit; unit water/land domains are complementary (`src/game/simulation/unitDomain.ts:46–55`, unchanged outside the increment), while gate permission introduces additional owner/team-specific unit alternatives (`bridge/cellPassability.ts:249–286`; `gates.ts:51–62`). Animals have no competing gate-specific exception. This reasoning is bounded to these existing predicates, not a promise for a future domain whose animal and unit exit sets overlap differently.

The unit assignment at `footprintClearing.ts:143–163` is a capacity-aware augmenting search. It uses actual free subcell slots, tries to move an earlier reservation when a candidate is full, removes that unit's old reservation only after an alternative succeeds, and uses visited cells to terminate cycles. An unsuccessful recursive search does not mutate a completed assignment. This addresses the owner-gate counterexample rather than relying solely on animal-first order. The maps and candidate order are deterministic. Exclusive animal cells are excluded from every unit search. Actual world occupancy stays untouched throughout both planning attempts, retaining IR1's protection against animal/unit overlap and partial moves.

The new test at `foundationStartAnimals.test.ts:384–394` supplies an empty exit and an alternative containing a unit, then asserts the sheep takes the empty exit, the villager shares the alternative, the resource claim is exclusive and the villager can leave. The second at `:396–405` combines an owner-only gate with a normal exit containing fifteen units and an eligible foreign builder. Row-major footprint enumeration visits the owner's unit first even though the fixture creates the foreign builder first, so it really exercises reassignment of the contested last normal slot. Assertions require the foreign builder in that sixteenth slot and the owner unit through its gate. The fixture calls the actual start, clearing, passability and occupancy synchronization at `:248–285`; it does not stub the decision to success. Earlier impossible, mixed-animal and capacity cases remain present.

The owner reports tests-first evidence: both new cases red while 33 old cases passed; all 35 passed after the repair; disabling reassignment left the gate case red. I did not execute or independently recover that mutation sequence. I did read the integrated `tmp/work133/ir3.log` and `ir3-exit.json`: normal exit 0, no timeout, 35 foundation cases plus one relic-spill case and eleven Delete-refund cases, all 47 passed in three complete files. This is attributed execution evidence, not a reviewer-run gate. The fixture remains a mechanism test on one small map, not browser controls or a general save/replay exercise of every fallback assignment.

### Independent Astra reviewer: census

**Accept an exact measured census refresh with the recorded direction and unchanged test contract. Do not retune AI purchasing to restore the old snapshot.** The maintained test explicitly permits a legitimate loss with its reason (`tests/simulation/selfPlayContentCoverage.test.ts:47–62`); producer and two-way comparison assertions at `:245–291` still execute. The expectation and maintained test were unchanged during this review: SHA-256 `8E387A9ECC5F29E661E3F2B1DC9AF104A6A0CC0F1ED55CFC1233CC6691280455` and `C7C37D55657C7E1A17C6E88E89FAB3DB1AA3F00FC750492D4E2E9ACF8C9A5363`, respectively. This is an acceptance of the documented match change, including a producer loss, not permission to remove assertions, shorten the horizon, change the seed/configuration, or call the red run green.

I inspected the scratch preparation code: it retains the maintained test simulation and assertions, changes imports/expectation to absolute paths, and inserts recorder attachment, sampling and finish calls. `censusHistory.mjs` uses `WorldHistoryRecorder` with a passive pre-update observer, captures public economy state and actual spending submissions, then folds 250-tick chunks. Its positive-control source compares complete saves after 60 ticks with and without observation and requires an observed affordable siege opportunity and actual Onager command; the owner reports that control passed. The retained input-variance record says the 735-input digest stayed `f2f9faf24f237ce933304ab1b607d2ec1c64bf0c2c08a26d2dafc9236b0bea52`. I did not independently rerun that control or rehash every source input.

Directly parsing the retained history, I verified 180 chunks, no truncated chunk, terminal checkpoint 45,000, and 1,222 owner-2 Imperial decisions from pre-step tick 26,670 through 44,985. I independently compared the six `COVERAGE` rows in the original failed run and instrumented run: six in each, zero differences. The instrument therefore reproduced the observed census rather than a different instrumented trajectory at that level. The exit artifact is 1, without timeout; the failing producer assertion is preserved. The history summaries cover the horizon but do not constitute a full replayable session recording.

The cause is supported by both artifact and unchanged code. Owner 2's first Imperial decision has 812 food, 602 wood, 1,280 gold, an empty complete Workshop 2200, and affordable Onager/Capped Ram offers. Retained submissions at tick 26,671, sequences 1973–1977, are Blast Furnace, Halberdier, Cavalier, Onager, then Conscription; all are accepted submissions. The live purchasing rule, outside the increment, explicitly allows shared-purse best-effort over-acceptance (`bridge/systems/aiSystem.ts:142–147`). The producer loop checks the raw purse without reserving earlier intention costs (`aiSystemProductionPhase.ts:175–207`); authoritative execution rechecks and spends the live stockpile (`trainingMarketOps.ts:278–287`). Blast Furnace and Halberdier alone leave too little food for Onager. At the next recorded decision, 26,685, owner 2 has two food, its Workshop contains a Battering Ram, and no siege research is affordable. A 750-tick Onager research cannot have completed in those fifteen ticks.

Across all later owner-2 decisions I independently recomputed a maximum of 101 food, below the cheapest siege research's 300-food price. The inspected analysis reports exactly one decision with both affordable siege research and capacity, with an actual intention there, and none with such an opportunity but no intention. Owner 1 obtains Workshop production and Capped Ram. Together with the unchanged research-choice and authoritative-spend code, this supports the diagnosed inherited spending-order trajectory; it does not establish a new missing-menu or dispatch bug. It also does not prove the overall AI improved, or isolate which recovered branch caused the different purse history. The report must retain that attribution limit and the newly silent owner-2 producer.

I independently recomputed every one of the following thirteen rows from the retained raw census and untouched expectation; they agree with the diagnosis. An em dash means no names in that direction.

| Scope | Set | Gained | Lost |
| --- | --- | --- | --- |
| Union | buildings | — | — |
| Union | units | arbalest | champion, elite-skirmisher, skirmisher |
| Union | technologies | arbalest-upgrade, bracer, ring-archer-armor | champion-upgrade, hoardings, plate-barding |
| Owner 1 | buildings | siege-workshop | watch-tower |
| Owner 1 | units | arbalest, capped-ram, monk | halberdier, skirmisher |
| Owner 1 | technologies | arbalest-upgrade, bracer, capped-ram-upgrade, ring-archer-armor | halberdier-upgrade, plate-barding |
| Owner 1 | researchProducers | siege-workshop | — |
| Owner 1 | trainProducers | monastery, siege-workshop | — |
| Owner 2 | buildings | watch-tower | — |
| Owner 2 | units | — | capped-ram, champion, elite-skirmisher, two-handed-swordsman |
| Owner 2 | technologies | — | capped-ram-upgrade, champion-upgrade, hoardings, plate-barding, plate-mail-armor, sappers, two-handed-swordsman-upgrade |
| Owner 2 | researchProducers | — | siege-workshop |
| Owner 2 | trainProducers | — | — |

The refresh may use the retained measured `run/census.json` as the candidate expectation and state this full direction in the permanent diagnosis/landing rationale. The run predates IR3. Therefore the final integrated execution must still establish that the post-repair tree matches the proposed expectation; if IR3 changes the trajectory again, inspect and record that new measured difference rather than forcing this earlier result. The current red census cannot supply a passing verification receipt.

## Findings and disposition

| ID | Disposition | Evidence and bound |
| --- | --- | --- |
| IR1 | Closed for the reviewed relocation mechanism. | Exclusive animal reservations, capacity checks and all-or-none movement survive the IR3 fallback; prior negative and positive cases remain. |
| IR2 | Closed as reviewed in round 2; untouched by this increment. | Exact-target rally eligibility and production/delivery coverage remain the frozen implementation reviewed there. |
| IR3 | Repair accepted on the two pinned file hashes. | Fallback assignment handles exclusive animal exits and owner-specific unit alternatives; two concrete counterexamples inspected and 47-test integrated result read. |
| Census direction | Exact measured refresh accepted, final integrated match still pending. | Retained raw sets, six repeated coverage rows, full-horizon decisions and unchanged advisory/authoritative spending contract support the documented changed match. No AI retune or assertion change authorized by this verdict. |

## Verification and round outcome

No new material finding in the focused repair or census diagnosis. This round closes the code-review findings IR1–IR3 within their stated mechanisms and accepts the measured census direction. It does not approve final integration before the final gates, controls, visuals, performance measurements, certified receipt, hosted checks and merge/push evidence. Review 2's broader coverage and compatibility limits remain in force, and review 1's Normal-speed benchmark validity requirements and unchanged thresholds remain in force. No performance result is created by this review.
