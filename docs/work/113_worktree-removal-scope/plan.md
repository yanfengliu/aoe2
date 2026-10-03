# Preserve external worktree targets while retiring owned trees

Status: planned
Owner: /root
Created: 2026-10-03
Updated: 2026-10-03

## Problem and outcome

The maintained controller safely removed the merged engine M2 worktree, then returned native1 because its own self-root junction target was intentionally gone. Branch cleanup was skipped. The outcome is successful owned-tree retirement while preserving every external target and all existing deletion safeguards.

## Scope

Root owns integration. Independent read-only investigator worktree_target_scope supplied [review0](reviews/0_design.md). Implementation has not started. Only controller target classification, its sacrificial sandbox class checks and associated docs are proposed. No recursive deletion, broader ownership exemption, foreign tree cleanup, engine product change or game runtime budget extension is included.

## Approach

Capture canonical validated deletion roots and link targets before unlinking. Exempt only a target proven physically inside this invocation's owned deletion tree; census protected targets through their captured canonical paths. Preserve external and ambiguous targets. The full authored investigation retains two alternative approaches, alias pitfalls and the acceptance matrix.

## Acceptance criteria

- Self-root and real descendant targets complete removal and merged-branch cleanup while independent external canaries survive.
- Alias-to-own, owned spelling escaping to external, sibling-prefix, dangling and unresolved-target cases preserve the stated boundary.
- A literal external-loss mutant fails the check and retains the branch; existing unlink, fresh-scan, admin-directory, merge and dirty guards remain effective.
- Tests are authored first in sacrificial contained sandboxes. Relevant focused checks, the required game gate and independent exact review precede executable shipment.

## Implementation steps

- Completed: preserve the full independent investigation and actual old cleanup disposition; branch-only maintained cleanup returned0 after fresh containment checks.
- Pending: assign implementation in an isolated controller-created worktree after its verification budget and dependency boundary are settled.
- Pending: tests-first implementation, red controls, affected checks, required full game verification, independent review, main integration and resource cleanup.

## Outcome

Investigation complete; source/test unchanged and no new runtime gate ran. The incident explains native1 after successful tree deletion, with no observed external damage. Controller source SHA256dfd9f07e7742ae45b3e9c94f79c6c86463270201b79995274e9726728ae52615 and test SHA256c243c718fa4637752eccd6957b161597d596029f4a0c31001f5f8ab3f4a07c07 bind the reviewed baseline. This plan remains open until the class fix is verified and shipped. M8 producer acceptance and game CI are separate outcomes; all21 consumer dispositions and the route7/M7 runtime holds remain open.
