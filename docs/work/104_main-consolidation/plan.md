# Consolidate preserved AoE2 progress onto main

Status: complete
Owner: Codex integration owner
Created: 2026-09-30
Updated: 2026-09-30

## Problem and outcome

Unfinished branches and archived working changes must reach main without losing progress, then their temporary checkouts and branch refs must be retired.

## Scope

Recover building sight including save/replay repairs, Natural default, replay exit audio, simulation performance and its instruments, and the previously checkpointed work-document migration. Preserve current main's v0.3.239 fixes. Engine, dependencies and unrelated product behavior are excluded.

## Approach

Workers recover scoped changes in isolated temporary checkouts from verified archives; the integration owner resolves overlaps, runs the complete gate and obtains independent review. Superseded alternatives and throwaway CI probes receive explicit dispositions. Original archives remain until every useful change is recoverable from main.

## Acceptance criteria

- [x] Every archived product change and preserved branch has an explicit, evidence-backed disposition; useful changes are locally verified and merged to main.
- [x] Full npm run verify and affected human browser flows pass, visual evidence is inspected, independent integrated review has no unresolved material finding, and remote gates finish green after push.
- [x] Only main remains locally, primary checkout is clean, aoe2-worktrees is absent, and retained recovery history cannot be lost during cleanup.

## Implementation steps

- [x] Building sight recovered and integrated, including the archived legacy replay repairs and the 500-line lifecycle split; final local gate, source census and browser acceptance passed.
- [x] UI/audio recovered and integrated; 48 focused tests and six headless browser contracts pass. Both explicit styles remain pixel-identical in three views; fresh default matches the existing Natural renderer.
- [x] Performance recovered and integrated; 139 focused checks pass and current-main castle/lab comparisons agree at every chunk and final save over 10000 ticks each. This measures the recovered performance tree, not the combined building-sight tree.
- [x] Historical migration integrated; 429 byte-verified imports, 426 same-blob completed-source removals and three retained active-owner files. Independent combined checker accepts 105 units and all 105 focused hygiene tests pass.
- [x] Repair F0/F1 successful-tick accounting and measurement bounds, and F2 map-bounded imported sight work. Focused red controls reproduce the defects; repaired contracts and final independent review pass. Interim and subsequent review rounds are retained.
- [x] Integration owner: reconcile canonical records and versions, retain the newly synced fleet canon, obtain independent review of the complete integrated bytes and run npm run verify. The local gate passed on the recovered integration checkout before the main merge.
- [x] Merge main, record all branch dispositions and ancestry, push and follow CI, then remove all task-owned checkouts and branches and verify recoverability. Merge, push, ancestry and retirement are complete; final hosted acceptance after the Windows repair is GREEN.

## Outcome

Recovered product revision 2db3dbe5a7ab3d85f50c715262bc32654eb4a2bc and ancestry-preservation revision 79c11dab981208f03dbbd7cb21debdcfd2d5cdda are pushed on main. Only main remains locally and remotely, the primary checkout is the sole worktree, and aoe2-worktrees is absent. Twelve verified original archives, the progress bundle and byte-verified source copies retain recoverability.

The recovered integration gate passed 4224 unit and 230 browser checks, with three and two bounded skips respectively. Hosted corpus 36678433977, Linux checks and all four browser shards passed, while CI 36678434022 failed two Windows traversal fixtures. Review 7 accepts the bounded root-alias repair with red/green controls; the hosted alias spelling remains unobserved. Assignment 105 shipped that repair on main 71a7b393579989f0f175bae4b0cfc83c1d7d4ea2. Its exact staged tree 4b326fe51c3f4a710fccdd3045f2ef5a0d4a308d passed the complete primary npm run verify: content validation, 4268 unit passes with three skips, typecheck, 230 browser passes with two skips, lint and build. The run took 13 minutes 45 seconds and released all 84 owned descendants. Hosted corpus 36697741027 and all four browser shards are green; Linux/Windows unit acceptance in CI 36697741103 is GREEN. Earlier aborted and failed local runs remain distinct from this corrected pass.

Independent integrated review resolved the material findings, with rejected targets and original authored verdicts retained. Useful progress and preserved ancestry are on main; completed temporary branches and checkouts are retired and the sibling folder is absent. Original recovery archives retain their verified contents. Docs-only closure receives focused review and affected content/hygiene checks before its commit; the full code gate binds 71a7b393. The owner-worktree, self-play instrument-integration and replay-exit warning records close at hosted acceptance GREEN, retaining their measured bounds and historical bodies; other OPEN product records remain active.

2026-09-30 documentation acceptance: content validation, version consistency and the complete 150-case architecture suite passed. Runtime acceptance remains the locally and remotely verified code revision 71a7b393; the closing documentation commit adds no runtime change.

## Queued owner request

2026-09-29: after this consolidation, review the full repository and clean demonstrated code bloat and outdated or redundant documentation. Keep that next assignment separate from the remaining merge and retirement work.

Assignment 105 fulfills the queued repository-review request; its own plan records the survey, accepted cleanup, measured checks and bounds.
