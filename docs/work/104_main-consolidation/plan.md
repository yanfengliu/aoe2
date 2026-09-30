# Consolidate preserved AoE2 progress onto main

Status: active
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
- [ ] Full npm run verify and affected human browser flows pass, visual evidence is inspected, independent integrated review has no unresolved material finding, and remote gates finish green after push.
- [ ] Only main remains locally, primary checkout is clean, aoe2-worktrees is absent, and retained recovery history cannot be lost during cleanup.

## Implementation steps

- [x] Building sight recovered and integrated, including the archived legacy replay repairs and the 500-line lifecycle split; final local gate, source census and browser acceptance passed.
- [x] UI/audio recovered and integrated; 48 focused tests and six headless browser contracts pass. Both explicit styles remain pixel-identical in three views; fresh default matches the existing Natural renderer.
- [x] Performance recovered and integrated; 139 focused checks pass and current-main castle/lab comparisons agree at every chunk and final save over 10000 ticks each. This measures the recovered performance tree, not the combined building-sight tree.
- [x] Historical migration integrated; 429 byte-verified imports, 426 same-blob completed-source removals and three retained active-owner files. Independent combined checker accepts 105 units and all 105 focused hygiene tests pass.
- [x] Repair F0/F1 successful-tick accounting and measurement bounds, and F2 map-bounded imported sight work. Focused red controls reproduce the defects; repaired contracts and final independent review pass. Interim and subsequent review rounds are retained.
- [x] Integration owner: reconcile canonical records and versions, retain the newly synced fleet canon, obtain independent review of the complete integrated bytes and run npm run verify. The local gate passed on the recovered integration checkout before the main merge.
- [ ] Merge main, record all branch dispositions and ancestry, push and follow CI, then remove all task-owned checkouts and branches and verify recoverability. Merge, push, ancestry and retirement are complete; fresh remote acceptance after the Windows repair remains pending.

## Outcome

Recovered product revision 2db3dbe5a7ab3d85f50c715262bc32654eb4a2bc and ancestry-preservation revision 79c11dab981208f03dbbd7cb21debdcfd2d5cdda are pushed on main. Only main remains locally and remotely, the primary checkout is the sole worktree, and aoe2-worktrees is absent. Twelve verified original archives, the progress bundle and byte-verified source copies retain recoverability.

The final recovered local gate passed 4224 unit and 230 browser checks, with three and two bounded skips respectively. Hosted corpus 36678433977, Linux checks and all four browser shards passed. CI 36678434022 failed two hosted Windows traversal fixtures. Review 7 accepts the root-alias repair with red/green controls; the corrected primary document population passes its complete companion. Assignment 105 includes that repair in one pending primary full gate and fresh remote run. Its active cleanup explains the current uncommitted primary changes. Full remote acceptance and final closure remain pending.

## Queued owner request

2026-09-29: after this consolidation, review the full repository and clean demonstrated code bloat and outdated or redundant documentation. Keep that next assignment separate from the remaining merge and retirement work.
