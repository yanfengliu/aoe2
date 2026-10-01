# Review 5: integration — committed candidate acceptance

## Target

Exact code candidate `1b22e90bf150f2499a97c677976806693faa11da`, sole parent `99749eb12004cabf7d049abeddc2f84a0177d3db`, prepared game version0.3.242. The independent committed-review target is 40 product paths, 54 canonical paths and the separate dependency lock. Root binding `tmp/parity-106/committed-source-binding.json`, SHA-256 `d14711fef1870ec2a45e14d525120d234105f8960b1ada277291f7f068c3792c`, reports all95 manifest rows equal committed blob bytes. The reviewer separately checked package.json for96 blob checks, not necessarily96 distinct files. Product manifest `d16d241ac23f1be72fd8b00e7cca3bfe49d420f755781aa1406e5dcae7904a66`; canonical manifest `ce6866794f029c83b04ecef0a83236c7e9bf4b760cbf7fbaae5a6e0bf9fee81e`; dependency lock `d0ab92d91f3210f904da14fdf3f0aa7be62a990947e1b9d3b3d55ef6f1d42581`.

Every reviewed input is recoverable directly from the immutable candidate with `git show 1b22e90bf150f2499a97c677976806693faa11da:<path>`, including this publication's previous plan bytes. No duplicate prose snapshots are required for that committed target. The nine older4546… reviewed preimages remain in snapshots/04_reviewed, earlier authored report bodies remain exact, and both source patches retain their immutable recovery base. This status-only publication does not change product/dependency bytes and requires its own later docs-only commit and focused publication acceptance; main/push/remote/worktree acceptance remains pending.

The complete original8,305-byte report is retained exactly in [05_committed-acceptance-report.md](../snapshots/05_committed-acceptance-report.md), SHA-256 `d2f4995614e14de23302896846a271c5710f97d895859d7ba7d4293eee43d625`. The historical original contains worktree navigation. The complete live substantive body below changes only2 Markdown citation destinations to the primary-checkout prefix, with no redaction, omitted finding, changed claim or summarized replacement. Normalized-body SHA-256 `5ef315ed81c45164503dac2565d2a34c5fa12ad53a5dcf9bb328fbfe60e9dcf9`; this is path-only equivalence, not byte identity. Primary links are intended navigation, not a claim that main already contains the unmerged candidate.

## Reviewers and coverage

Independent read-only reviewer `/root/milestone_acceptance_review` accepted the committed product and completed local verification within existing milestone bounds. It independently read96 Git blobs and current files, checked all ten served-dist file identities, retained prior source/dependency/native-image judgments on unchanged bytes, verified original reports/preimages, and read actual gate3 stage boundaries/summaries plus fresh inherited replay evidence. No test, npm script, audit, build, browser, server, external reviewer CLI, network query, sibling operation or subagent ran in this review. The docs worker performs only static reads/publication and does not claim reviewer execution or runtime verification of its own.

## Reports

### Independent committed-candidate reviewer: complete report

The full substantive report follows with only the stated citation-destination normalization.

# Work 106 committed-candidate acceptance follow-up

Author: `/root/milestone_acceptance_review`, 2026-10-01 UTC. Exact reviewed revision: `1b22e90bf150f2499a97c677976806693faa11da`, whose sole parent is `99749eb12004cabf7d049abeddc2f84a0177d3db`. Prepared version: 0.3.242. Integration owner: `/root`.

**Verdict: accept the committed product and completed local verification within the existing milestone bounds. No new material product or evidence defect was found. One low-severity current-status sentence needs correction before shipping. Main integration, push, hosted acceptance and worktree retirement remain pending. This does not complete the full DE parity goal.**

## Committed identity and retained review

I independently read 96 Git blobs from the named commit: all 40 product rows, all 54 final canonical rows, package-lock.json and package.json. Every blob's SHA-256 equals its expected value and its current working-file bytes. The integration checkout reported the named HEAD and clean tracked status. This establishes the previously missing committed-source binding for this candidate; it is not an inference from a worker summary.

| Bound input | Verified SHA-256 |
|---|---|
| 40-row product manifest | `d16d241ac23f1be72fd8b00e7cca3bfe49d420f755781aa1406e5dcae7904a66` |
| 54-row canonical manifest | `ce6866794f029c83b04ecef0a83236c7e9bf4b760cbf7fbaae5a6e0bf9fee81e` |
| Committed-source binding | `d14711fef1870ec2a45e14d525120d234105f8960b1ada277291f7f068c3792c` |
| Dependency lock | `d0ab92d91f3210f904da14fdf3f0aa7be62a990947e1b9d3b3d55ef6f1d42581` |
| Package metadata | `54a99d265626f4b61dad8bdb84958631c44b581a3a2bf14b9e064b8f5cf8b701` |
| Precommit root acceptance | `5ca56bbcfaf9daa742c2495a56121f0bd8b7834aa60f478a76e9cb1090183d5f` |

The product and dependency bytes are unchanged from my completed prior acceptance, so its grounded source, dependency and native-image judgments carry forward without a new census or image sweep. All ten final served-dist files also still match the prior visual source/dist binding.

I verified the preserved prior canonical manifest's exact `4546e2768e5e766ba4f4d92793da903e2e94793ef0e571079b40631d65dd258e` hash. Of its 43 paths, 34 are unchanged in the candidate and all nine changed paths have exact committed preimages under `snapshots/04_reviewed/`. The nine are the debugging record, detailed and summary devlogs, defect register, gate proofs, de-look plan, work plan, review 2 wrapper and current HUD handoff. The eleven added canonical paths are those nine preimages, review 4 and the exact original acceptance report. Earlier reports, patches and historical snapshots remain unchanged.

The committed `04_milestone-acceptance-report.md` equals my complete original 14,412-byte report, SHA-256 `507c5b41e4b6c887fdbaef36013c21ede2f2acb665ac6db3955c11cd8e2a82bb`. Changing only its two Markdown citation destinations to the primary-checkout prefix produces `76e3677f8a51144870c8ebc0d9134d9dea5bab01107974e416447d0175af82ea`; that entire normalized body is present in review 4. No finding, claim or limit was removed. The review wrapper's seven-input recovery table is explicitly extended by its later two-input table, accounting for all nine preimages.

## New execution and publication claims

I read the actual gate-attempt-3 result and inspected the stdout entry, chained stage boundaries, unit/browser summaries, the six resource-worker cases and final build completion, plus retained stderr warnings. The result has exit 0, root PID 42744, 1,049.731 seconds, successful job assignment/query/close, cleanupProof true and zero recorded leftovers. The log contains the full `content:validate && test && typecheck && test:browser && lint && build` chain, 562 unit files/4,338 tests passed with one skipped file/three skipped tests, 236 browser passes/two skips, and completed typecheck, lint and final build. This supports the new full-gate success claim; I did not run the gate.

The result SHA-256 is `abbbab480270a95993dc91625d77877761d08ec6562020a89a68cfd681e3e558`; stdout is `f39e0e124256ca38931278f7293f1fd9edc94b2c6e29edff1ca3136f48d09fa9`; stderr is `9b9e3e4c90f6d7fdd22b124216d0cf5c9b2266921cd91bb2f04c7f5008ce853c`. Existing skips and ordinary color/chunk warnings are not erased by that result.

The six completed resource-worker cases are recorded at all three widths. I re-read the real-control flow at [resource-workers.spec.ts:32](C:/Users/38909/Documents/github/aoe2/tests/browser/resource-workers.spec.ts:32): lobby startup, drawn villager selection, sheep right-click, ordinary walk and House controls use the app's inputs, while the large-number fixture is separately labeled. Root's representative affected-play acceptance is supported within that scope and the existing suite's progression/input/skirmish/replay controls. It does not establish a full start-to-finish DE match or acquired large stockpiles.

I read and hashed the fresh legacy-long-walk execution record, stdout and exact probe. Command exit 0 records completion of the instrument. Both base and final self-checks are false on segment 70→140 at `components.position[2205][1].x`, with five checked and zero skipped segments. Probe SHA-256 `52564fa57bf1aeda2e383358e50dbd805a20be99eb319d8590dbe905f23e01c8`, stdout `45d6c78d24ea3f6a4ab6e888ad5ba7ce9757b7cdd98d8b3228dd4d6aa7ad4c71` and execution record `e47fe7dbb5582529c5f0173071e2cb317782205c65c8b241adbb88c43e7a92be` match the published claims. The 8.802-second duration remains explicitly root-reported. M7 is correctly retained OPEN and inherited within this comparison.

I read all nine canonical text deltas and the new review wrapper. They correctly promote M1a/b/c to implemented, independently reviewed and combined-gate verified, close FINAL-R1/R2 within their recorded bounds, preserve failed/incomplete attempts 1/2 and avoid claiming the successful retry diagnosed or fixed the native crash. Precommit checkpoints retain their historical pending-commit wording; this follow-up now establishes the named committed target. Broader parity, M7/CL-4, moderate advisories, installation/runtime-version limits and source/population/performance bounds remain explicit. The reported documentation static checks remain attributed to the documentation lane; I did not rerun them.

## Finding and remaining conditions

**COMMITTED-R1 — P3, current status:** [plan.md:60](C:/Users/38909/Documents/github/aoe2/docs/work/106_de-parity-orchestration/plan.md:60), the current M0 table row, still ends its evidence with “final verify incomplete.” The neighboring M1 rows and actual gate-3 evidence correctly record completion. Replace that stale phrase with full verify attempt 3 passed and main/remote acceptance pending. This is a documentation correction; it does not invalidate the verified product, require a runtime gate rerun or establish a new runtime defect. I notified the integration owner while reviewing.

The final status publication should retain this complete report, correct COMMITTED-R1 and record the candidate revision without prematurely claiming main/remote completion. Remaining shipping conditions are merging the verified result to main, pushing, following hosted CI/corpus to completion, recording the final revision and safely retiring owned resources/worktrees. A subsequent status-only commit can retain this report and its source binding; substantive product changes would require affected checks and review.

The previous report's bounds remain: 93 local damage identities, 44 scoped projectile rows, bounded old-save/replay and 600-state/1,500-tick measurements, inherited M7 and mounted-unique garrison eligibility, three moderate development advisories, whole-locktree sibling warnings, Node20/22/default-lifecycle limits and broader CSS/DE-parity work. Local gate success and this candidate approval do not close those queues.

Only this ignored authored report was written. I ran filesystem/Git reads, comparisons and hashes; no test, npm script, audit, build, browser, server, external reviewer CLI, network query, sibling operation or subagent ran. No source, dependency, index, canonical document or primary checkout was changed. No persistent reviewer-owned process was created.

## Findings and disposition

| Finding / condition | Observed disposition | Remaining acceptance |
|---|---|---|
| COMMITTED-R1 P3 | Corrected current M0 table wording to three moderate development advisories remain; full verify3 passed; main/remote acceptance pending. Every other fact in that row stays unchanged. | Focused status/report-publication re-review and docs-only commit are root-owned. No runtime rerun required for this wording correction. |
| Committed-source binding | ACCEPTED at `1b22e90bf150f2499a97c677976806693faa11da`; all95 manifest rows match, reviewer96 checks include separately rechecked package metadata. | Main/merge/push, hosted CI/corpus and retirement still pending; candidate approval is not main acceptance. |
| Local gate/play | Root fullgate3 actualexit0/all chained stages and representative affected play are independently supported by inspected actual logs. | Existing skips, input/acquisition/population/save/performance bounds retain their limits. |
| Inherited limits | M7 fresh BOTH-arm70→140 replay failure, CL-4 mounted garrison gap, moderate development advisories and broader DE/CSS queue remain OPEN. | No whole-game recording or full DE parity closure; native attempt2 cause remains unexplained history. |

No new material product or evidence defect was found. Root accepts the bounded verdict. This round establishes the previously missing exact committed target while keeping subsequent shipping steps separate. Previous failed/incomplete gate histories and full substantive report bodies remain unchanged.

## Verification

This docs lane verifies original8,305-byte length/hash, exact historical report snapshot equality, complete live body under citation-only normalization, the binding's95 matching rows/current bytes and candidate's sole-parent identity. Existing small static work structure, pointer, attribute, version, original-input retention and content checks run separately. No source/package/test/dependency/engine/index changes, runtime gate, build, browser or reviewer CLI occurs in this lane. Final candidate inputs remain recoverable by committed blobs even as current status moves.

The actual fullgate3 record remains exit0/rootPID42744/1,049.731s; unit4,338 passes/three skips, browser236 passes/two skips, all chained stages and owned cleanup passed. Reviewer read the real summaries/timeline; it did not execute them. Root's fresh legacy-long-walk commandexit0 is probe completion only: both base/final self-checks remainfalse with5checked/0skipped at70→140 position[2205][1].x. Neither successful gate nor candidate approval closes that inherited bound.

## Round outcome

Committed candidate `1b22e90bf150f2499a97c677976806693faa11da` is independently accepted within the bounded milestone; COMMITTED-R1 is corrected in live status. Root will create the docs-only publication commit, obtain focused report/status acceptance, merge/push both commits and follow hosted gates. Those steps and worktree cleanup remain PENDING. No main/remote success or completed full-parity goal is claimed.
