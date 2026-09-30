# Review 1: app export-census adjudication

## Target

Unchanged main 79c11dab981208f03dbbd7cb21debdcfd2d5cdda; compiler/reference census under ignored tmp/repo-cleanup-20260930. Read-only follow-up to review 0.

## Reviewers and coverage

Independent /root/repo_app_review, Astra/xhigh. Adjudicated all 208 scoped exports without cross-file consumers: 25 functions, 167 types and 16 values. Same-file identifiers reduced them to four declarations without local uses; clamp was already reported. No gates or writes.

## Reports

APP-C4: aoeVoxelArchitecture.ts:134 architectureMerlonBoxes has no local or cross-file consumer. Live aoeVoxelWallRecipes.ts:11/63 imports/calls architectureMerlonRing. Remove the dead row-of-merlons recipe/comment and correct the ring comment at :181 referring to rows above. Spec:1921 still names the retired boxes/layout; describe existing corner-ring/per-architecture proportions instead. The same live geometry remains; preserve historical docs and use existing building-recipe/detail checks.

APP-C5: agentCommandValidator.ts:31 AgentCommandShape has no local/cross-file consumer. The validator accepts unknown at :203 and returns CommandDispatchResult. Remove the four-line interface; typecheck covers references, validation is unchanged.

APP-C6: selfImprovementFindingComparison.ts:55 findingIdentityKey wrapper has no executable consumer. Active comparison uses findingIdentity through uniqueFindingIdentities (:41-46); within-run union uses live withinRunUnionKey. Delete only wrapper/comment, update current comments at comparison.ts:60, selfImprovementLoop.ts:178 and its test:103 to describe cross-run identity without implying the wrapper exists. Preserve algorithms; existing comparison/loop checks cover them.

## Findings and disposition

Owner accepts C4-C6 in the same mechanical cleanup batch. Remaining zero-cross-file exports have local consumers and stay. No additional orphan module deletion is justified; src/main.ts is the HTML entrypoint.

## Verification

Compiler census corroborated with same-file AST and explicit source/test/script references. No runtime checks, edits or processes.

## Round outcome

Three additional bounded deletions approved; implementation and final integrated review/gate remain pending.
