# Review and simplify AoE2

Status: active
Owner: Codex integration owner
Created: 2026-09-30
Updated: 2026-09-30

## Problem and outcome

The owner requested a full repository review after preserving scattered progress on main, followed by cleanup of demonstrated code bloat and outdated or redundant documentation. Reduce unnecessary maintenance and verification work while preserving game behavior and authored progress.

## Scope

Survey all tracked source, scripts, tests, configuration, design inputs and documentation on main 79c11dab981208f03dbbd7cb21debdcfd2d5cdda. Deep inspection follows reference evidence and risky boundaries. Historical reviews/imports retain provenance; ignored dependencies, original recovery backups and active evidence are excluded. No feature expansion, dependency change or engine write. Main is the single serialized writing checkout, honoring the owner's request that all work land there and the sibling worktree folder stay absent.

## Approach

Three independent read-only Astra/xhigh domains cover simulation/contracts, app/render/input/playtest, and tooling/docs/tests. Combine complete inventories and import/reference scans with focused manual inspection; record actual coverage rather than imply every line was read. Accept evidence-backed simplifications, assign one writer at a time, obtain independent review of final changes and run appropriate gates once per coherent code increment. Preserve all earlier assertions and timeouts. Work records have one status plan and concise chronological review rounds; current guidance belongs in canonical docs.

## Acceptance criteria

- [x] Every tracked area receives a recorded survey; concrete findings and skipped manual areas are explicit.
- [ ] Remove supported dead/duplicate code or redundant setup and correct stale/redundant current docs, with source and consumer evidence and no lost historical progress.
- [ ] Relevant focused checks and the required final code gate pass, independent integrated review resolves material findings, and executable pushes receive remote verification.
- [ ] Changes are committed and pushed on main; only main and the primary checkout remain, no sibling worktree folder or owned browser/server process remains.

## Implementation steps

- [x] Inspect remote status and repository instructions; inventory the complete tracked population. Consolidation's corpus, Linux CI and four browser shards passed; Windows CI exposed two temporary-root alias controls. The minimal repair has focused red/green evidence and independent acceptance in assignment 104 review 7.
- [x] Reviewers survey their domains and return supported findings, contracts and coverage limits; authored reports are retained in reviews 0 and 1.
- [x] Integration owner accepts a bounded cleanup; serialized worker implements it on main and updates affected canonical records. Reviews 3 through 5 accept the actual ownership repairs, notification order and strengthened atomic-replacement protocol test. Corrected document/index preparation passes its complete companion. Full acceptance still requires the complete combined gate and fresh remote run.
- [ ] Review the final change, verify appropriate contracts, merge/push and close this plan with measured changes and limitations.

## Outcome

Prepared v0.3.241 remains uncommitted. Reviews 0 through 5 preserve the survey, rejected targets and bounded final acceptance. All material findings and the three failed-gate causes are resolved. The protocol adaptation passes the full replay/audio/cap set, 173/173, and its committed-controller control fails all three replacement cases while preserving the original passing case. Root's corrected document/index companion passes 9/9. The prior full gate's 4263 passes, three failures and three skips, and the earlier intentional abort remain recorded with zero owned leftovers. The final complete primary gate and hosted verification are pending; no full gate is quoted as green.

Consolidation revision 79c11dab is already on main with only main locally/remotely and no aoe2-worktrees folder. Original archives, source copies and branch ancestry are preserved. This assignment remains separate from consolidation's final remote acceptance and closure.

## Fixed failure checks and disqualifiers

Independent review exposed the real app boundary omitted by controller-only rollback doubles. For APP-F4, a failed incoming presentation through the actual app/view replacement must leave the app and view on the committed outgoing bridge, preserve its presentation and controls, and keep replay tick, playback, perspective, callbacks and saved live pause usable. A successful swap must commit once and release only superseded resources. Compare validation-before-publication and checkpoint/rollback mechanisms against those same checks; investigate them independently before combining conclusions.

For APP-F5, begin a lazy prior-session read while stopped, delay database-open completion, request stop, then complete opening. Reads must settle according to their contract, stop must release the resulting connection/timer, and a later restart must remain usable.

Disqualifiers: a replacement double throwing before any real view mutation; swallowing the original error; losing outgoing presentation or controls while only the controller survives; a timed-out or still-running resource reported as closed; dropping the lazy read or periodic snapshot assertions; weaker case/population/history checks; source fixes outside the repository or a new persistent branch/worktree. The scope is these actual ownership boundaries, not a renderer or persistence rewrite.

## Mechanism comparison

Two fresh read-only investigations compared unpublished preparation with checkpoint rollback. Merely delaying the app assignment or prevalidating a bridge misses mutations in presentation, adapter histories and Natural ground. Full preparation would require unpublished presentation/adapter state and ground allocations before actual runtime admission; its success behavior and callback exclusions remain unmeasured. Checkpoint rollback can instead keep outgoing presentation state and ground resources through the synchronous swap, restoring bytes and re-admitting the retained outgoing snapshot after a later error. Actual dependency code permits an older revision after an epoch change; that permission needs a real RenderWorld control, not a permissive fake runtime.

The writer's bounded checkpoint candidate now reports six passing actual-app contracts: admission rejection after partial preparation, same-size ground-byte rollback, resized-ground resource rollback, preserved drag controls, successful retry and exit. The two post-admission controls first failed as intended; an earlier resize probe changed the wrong width field and is not valid red evidence. These reports await independent acceptance. Playback failure cases, final source freeze, integrated review and the combined gate remain pending. Terminal failed/disposed runtime or device recovery is outside this ownership contract.
