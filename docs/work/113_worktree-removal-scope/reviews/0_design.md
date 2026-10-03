# Review 0: design

## Target

Game main fad2b74eec40cf1ea6ed3ef9bed167040f1d7476; maintained controller and sandbox tests are pinned in the authored report. This is a source investigation and design proposal, with no implementation or runtime check.

## Reviewers and coverage

/root/worktree_target_scope independently inspected the bounded source, tests and current-state evidence. The observed removal event/counts came from root; the investigator did not reproduce deletion or inspect that event's raw output. Root accepts the scoped diagnosis and protection contract.

## Reports

### /root/worktree_target_scope

# Worktree target scope investigation

Date: 2026-10-02. Owner: `/root/worktree_target_scope`, independent read-only investigator assigned by `/root`. Status: bounded source investigation complete; no implementation or gate run.

## Result

The controller's post-removal census treats the worktree's own link target as an external directory that must survive. That is inconsistent with the deletion it just authorized. The observed successful removal followed by exit 1 is explained by `scripts/controlWorktree.mjs:399–400`, `:313–325`, and `:432–433`. Branch cleanup follows the refusal, so the branch remains after the tree and its Git registration are gone.

The safe immediate completion is controller `delete-branch engine-m2-integration-1001` from the engine primary checkout, after a fresh dry run. Independent read-only Git checks confirm its tip equals engine main, and no registered worktree holds it. This operation deletes a checked merged ref with an expected-SHA guard; it does not delete a directory or traverse a junction.

The code fix should change the population of protected census targets. It must keep every link unlink, both fresh scans, admin-directory refusal, merge/dirty checks, and Git removal restrictions. An exception based only on a lexical path prefix is unsafe.

## Scope and evidence identity

Inspected maintained source, tests, applicable local policy, lessons, architecture, devlog, and bounded allocation documents. No product/source/index edit, foreign worktree mutation, test/full gate, source export, provider CLI, browser, server, runtime experiment, or commit occurred. Only this ignored report was created.

Independent primary Git result: aoe2 HEAD `fad2b74eec40cf1ea6ed3ef9bed167040f1d7476`, on `main`. `git status --short` produced no entries but warned that `.pytest_cache/` could not be opened; this is not a claim that every ignored directory was readable. Worktree listing remains populated by the coordinator's active/retained checkouts. This investigator did not alter them.

SHA-256 of bytes inspected:

| Path | SHA-256 |
| --- | --- |
| `aoe2/scripts/controlWorktree.mjs` | `dfd9f07e7742ae45b3e9c94f79c6c86463270201b79995274e9726728ae52615` |
| `aoe2/tests/scripts/controlWorktree.test.ts` | `c243c718fa4637752eccd6957b161597d596029f4a0c31001f5f8ab3f4a07c07` |
| `civ-engine/docs/work/registry.json` | `805201097defdabb9faaa0a74bafbaf9a9b7ef09553917b511988fd06ac2bf27` |
| `civ-engine/docs/work/74_file-sink-streaming/plan.md` | `612632de71d5b020afdba3d22efb766f987083effe91d617734e02f465c37b15` |

The last two values were supplied in the assignment as unchanged after cleanup and independently re-read here with the same values. This confirms those exact files, not the complete engine tree.

The assignment reports engine removal was first dry-run, then executed over `C:/Users/38909/Documents/github/civ-engine-worktrees/engine-m2-integration-1001`, merged and clean at `3c676619468ca431335158062cb104abd9742844`. Its only reparse point was `mcp/node_modules/civ-engine` targeting that same worktree root. The controller unlinked it, found no links on its fresh scan, removed the tree successfully, then reported the target gone after a before-census of 8,757 files and 1,419 directories. These event/count claims were received from the coordinator; this investigator did not reproduce the deletion or inspect its raw output.

Independent current-state reads found:

- Engine primary HEAD, `refs/heads/main`, and `refs/heads/engine-m2-integration-1001` all equal `3c676619468ca431335158062cb104abd9742844`.
- `git merge-base --is-ancestor 3c676619468ca431335158062cb104abd9742844 refs/heads/main` returned 0.
- The removed worktree directory is absent and its path is absent from `git worktree list --porcelain`.
- Engine listing has primary, `engine-feedback-1001` at `192990f3d6fc8b482875f14c5c1572cebd09bd36`, and `engine-reader-m8-1002` at `3c676619468ca431335158062cb104abd9742844`. The latter is a surviving candidate, not a claim about its contents. Neither was touched.

`git check-ignore tmp/worktree-target-scope-1002/1_investigation.md` returned that exact path.

## Source trace and root cause

`scan()` at lines 122–142 records each link and its `readlink` target without descending it. `linkTarget()` at lines 112–117 resolves the target string relative to the link's parent, but does not call `realpath`.

`remove()` first validates merge containment, changes, worktree root, device boundaries and admin-directory link absence. At lines 399–400 it adds every target to `before` by normalized lexical spelling and calls `census()` without considering what the operation is allowed to delete. The root target therefore receives a valid positive count.

All links are unlinked at lines 401–404. A fresh scan at line 405 precedes Git removal. The tree's absence and lack of registration are checked at lines 421–423. `checkTargets(before)` then runs at line 432. Its line 318 labels any previously readable target now gone as damage. Because the own root is intentionally gone, it must refuse before `dropBranch()` at line 433. This is a source-derived explanation, not a claim that an external target was damaged in this incident.

The header's line 17 promise that every former target loses nothing lacks an ownership boundary. Git recursively deletes two validated trees: the worktree and its specific admin directory, documented at lines 36–38 and found at lines 261–273. Expected loss in either needs an explicit, narrow rule; parent directories, other admin directories and shared modules are outside that rule.

Current tests use sacrificial, contained sandboxes and independent canaries. They cover external modules/sibling targets, a dangling target, unlink/rescan mutants, admin-directory links, and merged/dirty/locked/nested-worktree refusal. No test gives a link an intended target in its own worktree. Most positive removal cases inherit the `rawWorktree()` external `node_modules` junction, so the self-target omission is systematic.

## Minimal safe contract

A census target is exempt from preservation only when, before unlinking, its actual resolved directory is proven to belong to a tree this invocation has already validated for deletion. That set is the registered worktree root and its real descendants; if admin targets are included, only the specific validated admin directory and its real descendants. Do not include the worktree parent, common Git directory, all worktrees, repository siblings, or a path merely sharing a string prefix.

Resolve and capture both deletion roots and existing link targets before any unlink. Use the captured resolved target as the census path for every protected target. Classification alone is not enough: storing the original spelling can make a surviving external target unreachable through a junction that the controller intentionally removed.

Do not infer owned membership from a missing/unreadable target, a failed `realpath`, or a fallback string. A known already-dangling target can retain the current no-before-count behavior; other inability to establish target identity must not grant an exemption. The current census's null/permission and 500,000-entry bounds remain limits unless deliberately strengthened in scope.

Exempting a target changes only the post-removal accounting. The controller must still unlink the link itself one at a time and prove every deletion tree free of links as before. It must never follow links while deleting, add recursive deletion, force removal earlier, skip external checks globally, delete the branch before external checks, or catch and suppress all target-loss refusals.

## Distinct implementation approaches

1. **Captured canonical deletion roots and targets.** The smallest coherent change is a helper that resolves targets before unlinking, recognizes equality or separator-bounded descendant containment against the resolved deletion roots, and stores canonical external target paths in `before`. Deduplicate by the same captured canonical form. This fits the present architecture and addresses ordinary relative paths, case variations and junction aliases. Use Windows path namespace normalization consistently on both sides. Do not simply add `!inside(l.target, wt.path)` to line 400.

2. **Physical directory membership from the existing no-follow scan.** Stronger proof is to collect filesystem directory identities for the root and real directories the scan entered. Match a resolved target's identity to that inventory. This avoids relying on casing or path spelling, and keeps junction targets outside the scanned deletion tree protected. It adds scan result/state and needs reliable identity support (prefer bigint device/inode values and no exemption when identity is unavailable). This is a bounded alternative if case-sensitive Windows directories or short/extended aliases make path proof ambiguous, not a requirement to create a filesystem framework.

3. **Expected-loss subtraction from every census.** Census external ancestors while excluding the validated deletion subtree, or subtract only its actual owned entries. This can handle a link targeting a parent directory that legitimately loses the child worktree. It is a wider accounting change with more risks than this incident needs. Do not approximate it by subtracting a root's aggregate count: existing census skips links and can overlap aliases, and subtraction could hide real external losses. Keep it separate unless the acceptance contract explicitly includes ancestor targets.

Recommendation: approach 1 with a fail-closed ambiguity rule and end-to-end sandbox tests. If the implementation cannot prove physical containment for a Windows spelling, refuse or retain external protection rather than broadening the exception. Approach 2 supplies a safe fallback design. Approach 3 is outside the narrow fix.

## Classification matrix and pitfalls

| Shape before unlink | Required treatment |
| --- | --- |
| Link to exact own worktree root | Expected owned loss; successful removal and merged branch cleanup |
| Link to a real descendant in that worktree | Expected owned loss; same result |
| Relative link to own root/descendant | Resolve relative to the link parent, then apply actual containment |
| External alias/junction spelling resolving to own root | Expected physical owned loss; alias outside remains untouched, though it may become dangling |
| Own path spelling resolving through `wt/tmp/escape -> external` | External; capture canonical external path, keep census and external canaries |
| Own descendant link pointing to an external target | External, regardless of the link location |
| Sibling `wt-extra`, root parent, common Git root, other worktree/admin root | External; separator boundary and exact deletion roots matter |
| Windows casing/short/extended-path alias | Accept only when actual identity/consistent resolved paths prove containment; do not trust lowercased lexical equality alone in an ambiguous case-sensitive directory |
| Already dangling link | Unlink itself safely; no newly invented owned exemption |
| Unreadable/unresolved target | Unknown, never an owned exemption; retain/refuse within stated census bounds |
| Exact own validated admin root or real descendant | Expected deletion if this contract includes the second Git deletion root; never exempt a sibling admin root |

An external ancestor target may still report an expected decrease caused by removing its worktree child under the narrow contract. That safe false alarm is an explicit bound, not evidence to skip an entire parent. Solving overlapping censuses requires the broader approach 3 and its own tests.

## TDD proposal and acceptance checks

Add contract tests first in the existing sacrificial controller suite. Keep every target inside `sb.root`, use independently created junctions, check raw target canary bytes directly, and retain `contained()` plus finally cleanup. Do not use a live engine/game tree to reproduce the bug.

Required red cases for the current code:

- Self-root target: retain the normal external `node_modules` canaries, then place an ignored nested junction such as `wt/tmp/mcp/node_modules/civ-engine -> wt`. Expect exit 0, own directory absent, registration absent, merged branch absent, and both external canary byte strings intact. Current code should instead exit 1 and leave the branch.
- Internal real descendant target: create `wt/tmp/owned-data/CANARY`, a junction to that real directory from another ignored subtree, and the normal external modules target. Assert the same complete cleanup and external bytes. Current code should give the corresponding false target-loss refusal.
- Alias-to-own target: create a junction outside the worktree but inside the sandbox pointing to the owned worktree; have the owned link target that alias. Assert the outside alias itself was not deleted, actual owned data is gone, and external canaries survived. Handle the resulting dangling alias in cleanup.

Required protection cases:

- A link target spelled under the worktree but routed through an `escape` junction to an external sandbox directory. After safe unlink/removal, census must use the captured resolved external path and return 0 with external bytes intact. This catches canonical classification with a stale lexical census path.
- A sibling prefix collision (`wt-name-extra`), a direct external target, and a target outside the worktree through an alias. Each stays protected; no owned classification from string-prefix resemblance.
- A post-Git external-loss mutant confined to the sandbox deletes a known external canary just before `checkTargets(before)`. The controller must return 1, name the external target, and leave the merged branch. Include the lexical-under-owned/physical-external target in that control so a careless lexical exemption goes red. Do not rely exclusively on the platform-conditional Git junction hazard to test census protection.
- Existing unlink/rescan/admin/unmerged/dirty/locked tests retain their assertions. If own-admin targets are accepted, add one positive own-admin target plus a sibling-admin target preservation control.

Prove the new contract red against the inspected old revision and green after the fix. Record both exact source digests and results. A mutant that exempts every target must go red on the independent external-loss control. Reintroducing the self-target census defect must go red on root and descendant cases. Alias controls must not share the production containment predicate.

Avoid forcing or deleting live foreign resources to produce a red test. Tests are about operation results and independently retained files, rather than assertions derived solely from the new helper's own output.

## Safe branch-only cleanup handoff

Current preconditions were independently true at inspection, not guaranteed forever. Coordinator should freshly execute the dry run and then the maintained controller from `C:/Users/38909/Documents/github/civ-engine`:

```text
node C:/Users/38909/Documents/github/aoe2/scripts/controlWorktree.mjs delete-branch engine-m2-integration-1001 --dry-run
node C:/Users/38909/Documents/github/aoe2/scripts/controlWorktree.mjs delete-branch engine-m2-integration-1001
```

Use the normal owner-capable context. The sandbox's Git ownership mismatch required per-command `git -c safe.directory=<exact primary>` only for this investigator's read-only checks; no global configuration was changed. Do not replace controller cleanup with manual `git branch -D`, `update-ref`, recursive deletion, worktree pruning, or removal of any other branch/tree.

`dropBranch()` at lines 211–229 rejects main, obtains the current branch SHA, proves it is in main, checks the current registered holders, then uses atomic `git update-ref -d refs/heads/<branch> <sha>`. A moved unmerged tip or a newly checked-out holder is refused. The remaining metadata cleanup uses only that branch's local config section. This investigator did not perform either command.

## Verification and integration bounds

First command was `npm run ci:status`; it returned exit 1 with `UNKNOWN — could not resolve the commit to report on.` Subsequent raw Git reads showed the sandbox SID differs from the primary owner, causing Git dubious-ownership refusal. Therefore this investigator has no fresh remote CI verdict. The coordinator's inherited Windows 700 lifecycle failure and exhausted route 6 extension remain the controlling reported state. Route 7/full-suite permission remains pending; no new full gate or workaround was run here.

For implementation, run only the affected controller tests while iterating, in the authorized owned game worktree. Before any executable-change commit, repository policy requires the actual `npm run verify` chain to pass on the exact change; a focused controller run does not satisfy that requirement. This investigation grants no repair-budget extension and cannot unblock that commit gate by relabeling the fix as docs. No dependency change is proposed, so no new audit requirement arises from this fix.

Independent review is required for the eventual deletion-boundary change, tied to its exact final revision and tests. Record the observed defect and its full tested class in the existing defect register, record red controls in gate proofs, and update the controller/policy wording to say which targets are protected. Keep authored implementation plan/review in the permanent allocated work folder when promoted by the integration owner; this temporary evidence remains ignored while the issue is unresolved. No user-visible game rule/version change or structural architecture change is implied by this tooling repair.

This report is source judgment with read-only state checks. It does not claim implemented, tested, reviewed, committed, merged, or hosted acceptance. No browser or GUI process was created, and no task-owned process remains from this investigation.

Authored body preserved in full: SHA2568782f3f2da572a2d15e0d303a693dab10e6ac0f1966fa1f8ed5f10f67cf50897,17989bytes. Its original dated state remains historical.

## Findings and disposition

| ID | Finding | Disposition and reason | Repair or follow-up |
|---|---|---|---|
| F0 | Unconditional target census mistakes owned deletion for external loss, then skips branch cleanup. | Accepted from source and current-state evidence. | Pending captured canonical target classification and whole-class sandbox controls. |
| F1 | Lexical containment or a stale alias census path can hide or misclassify external targets. | Accepted protection requirement. | Preserve resolved external census paths; no broad exception or deletion workaround. |

## Verification

Independent read-only source/current-state checks only. The original report records exact bounds and digests. No implementation test, mutant, full game gate or controller product change ran. Root's separate actual branch-only cleanup returned0 and is preserved in its ignored publication receipt.

## Round outcome

Diagnosis and minimal contract accepted. Implementation, class proof, exact review and executable shipping remain pending; current status belongs to plan.md.
