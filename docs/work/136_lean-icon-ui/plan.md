# Preserve allocation 136: lean-icon-ui

Status: active
Owner: Codex integration owner
Created: 2026-10-18
Updated: 2026-11-04

## Problem and outcome

Preserve this permanent allocation while landing the separate work135 documentation. Allocation identity does not establish product acceptance.

## Scope

Allocation and actual ownership/status metadata only. The staged UI release remains parked in lean-ui-1017. Its code, release documents, closeout packet and staging are unchanged and excluded from this landing. Original primary and staged owner plans remain preserved outside this minimal record.

## Approach

Retain the allocator's ID/theme and existing integration ownership. Import no implementation or release packet as an allocation dependency.

## Acceptance criteria

- The permanent ID/theme and truthful open status are retained.
- Other owners' source, staging, evidence and release decisions remain unchanged.

## Implementation steps

- Record the allocation-only boundary in this LF plan.
- Leave implementation and release follow-up with the existing owner.

## Outcome

Active and unmerged. The staged UI release remains parked in lean-ui-1017. Its code, release documents, closeout packet and staging are unchanged and excluded from this landing. This scoped documentation landing grants no art, UI or game acceptance.

2026-11-04 ([work 138](../138_worktree-retirement/plan.md)): the parked release's checkout `lean-ui-1017` was removed through `scripts/controlWorktree.mjs`. Its 200 staged paths, the code, release documents and work 136 records, are the index commit `retained/lean-ui-1017~1`, and the branch tip holds the same tree. The clean baseline checkout `work136-ui-baseline` at `1dc71788`, which main contains, was removed too. The primary's `tmp/work136-*` folders were not touched. Shipping or dropping the release is the owner's call, with a recommendation in work 138's decision table.
