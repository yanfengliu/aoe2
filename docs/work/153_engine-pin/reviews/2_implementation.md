# Review 2: hosted canonical-path fixture correction

## Target

Staged tree590f5b809ee301a67f8e7d46bd76350bfd562c3f against0aa2569211db3380074cd2126c99c49a02b57de2. Source changes only tests/scripts/engineInstall.test.ts; remaining changes are delivery records and the allocated work154/155 plans, with owner-approved schema3 design.

## Reviewers and coverage

Independent native gpt-6-astra/xhigh, read-only exact source/evidence review. No external reviewer export. Product/guard/package bytes are unchanged. Root owns gates and delivery.

## Reports

### gpt-6-astra / xhigh

AoE2 Windows path repair — independent read-only review

Target: staged tree 590f5b809ee301a67f8e7d46bd76350bfd562c3f against 0aa2569211db3380074cd2126c99c49a02b57de2 in C:\Users\38909\Documents\github\aoe2-worktrees\engine-pin-1107. Both the index-to-target and worktree-to-target diffs were empty. The nine-file change contains one executable test-file change and eight task/documentation files; product guard, renderer, package and lock bytes are unchanged.

Findings: no material findings in this bounded repair. tests/scripts/engineInstall.test.ts:24–25 still asserts the complete returned package path, now against an independently resolved filesystem realpath; it does not weaken the assertion to a basename or partial match. The ordinary physical fixture and the new checkout-alias fixture share that assertion. Lines 54–63 create a real junction, assert that its resolved spelling differs, exercise the guard through the alias, and unlink only that fixture-owned alias in finally before the existing recursive fixture cleanup. This covers parent-path alias spelling rather than hardcoding RUNNER~1, username casing, or a hosted runner path.

Verified surrounding source: unchanged scripts/check-engine.mjs:15 resolves the checkout root before constructing packageRoot; lines 28–33 retain directory/link and physical resolution checks. The repaired expectation agrees with that existing physical-path contract. Existing drift, stale-runtime and linked-engine negatives remain intact.

Evidence: retained canonical-path-red.log shows the new fixture genuinely failing the original full-path expectation (1 failed, 13 passed); canonical-path-green.log records 23 passed across engineInstall and runDirectly. I read these retained outputs without rerunning checks. The work153 plan and devlog distinguish the previous local full gate from the hosted Windows shard failure and explicitly leave repair gates/hosted follow-through pending. Work154 remains a preparation record, and work155 documents approved schema3 design without claiming runtime implementation.

Bounds: source, fixture topology, retained evidence and task-claim review only. No tests, gates, installs, browser/network actions or file writes; no independent hosted CI verification. Root still owns required full gates and hosted delivery follow-through.

## Findings and disposition

No material findings. Root accepted the unchanged full-path assertion and genuine checkout-alias control. Production guard and pinned artifacts remain unchanged.

## Verification

Root inspected hosted job128595444738 in CI42436197882: the only failed assertion compared the short RUNNER~1 path to canonical runneradmin. Final CI has nine successful jobs and this one failed job; corpus42436197812 passed. Local valid RED1 failed/13 passed; corrected23 install/CLI checks and9 staged document checks passed. Fresh audits passed their high thresholds:7 moderate development findings, zero production findings. The subsequent complete local correction gate passed5,504 unit cases/3 existing skips and345 browser cases/2 existing skips, plus content/type/lint/build;417 tracked processes, zero forced terminations or leftovers. The dirty receipt correctly refuses landing. Clean-commit certification and corrected hosted delivery remain pending.

## Round outcome

Exact source review accepted. No runtime correctness, completed full correction gate or hosted delivery is inferred from this review.
