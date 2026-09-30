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

- [ ] Every archived product change and preserved branch has an explicit, evidence-backed disposition; useful changes are verified and merged to main.
- [ ] Full npm run verify and affected human browser flows pass, visual evidence is inspected, independent integrated review has no unresolved material finding, and remote gates finish green after push.
- [ ] Only main remains locally, primary checkout is clean, aoe2-worktrees is absent, and retained recovery history cannot be lost during cleanup.

## Implementation steps

- [x] Building sight recovered and integrated, including the archived legacy replay repairs and the 500-line lifecycle split; focused checks and worker typecheck pass, final census and browser gate still pending.
- [x] UI/audio recovered and integrated; 48 focused tests and six headless browser contracts pass. Both explicit styles remain pixel-identical in three views; fresh default matches the existing Natural renderer.
- [x] Performance recovered and integrated; 139 focused checks pass and current-main castle/lab comparisons agree at every chunk and final save over 10000 ticks each. This measures the recovered performance tree, not the combined building-sight tree.
- [x] Historical migration integrated; 429 byte-verified imports, 426 same-blob completed-source removals and three retained active-owner files. Independent combined checker accepts 105 units and all 105 focused hygiene tests pass.
- [x] Repair F0/F1 successful-tick accounting and measurement bounds, and F2 map-bounded imported sight work. Focused red controls reproduce the defects; repaired contracts pass. Final independent review remains required; interim report is retained in reviews/0_implementation.md.
- [ ] Integration owner: reconcile canonical records and versions, retain the newly synced fleet canon, obtain independent review of the complete integrated bytes and run npm run verify.
- [ ] Merge main, record all branch dispositions and ancestry, push and follow CI, then remove all task-owned checkouts and branches and verify recoverability.

## Outcome

Pending. Record the verified revision, checks and limitations at closure.

## Queued owner request

2026-09-29: after this consolidation, review the full repository and clean demonstrated code bloat and outdated or redundant documentation. Keep that next assignment separate from the remaining merge and retirement work.
