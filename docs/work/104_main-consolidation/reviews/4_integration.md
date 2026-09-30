# Review 4: final integration repair

## Target

Base `3bc906af51af5f29a48d11400d21aab79d714449`. Verified full patch SHA256 `98bb4da29c4edb0f76bf7da02af41157ec959944d291466494854bdc78c041d0`, incremental repair `45a8c7470c404a0f95c8bbd910b1ac6d7d229e926e66dd80852e328b13df24ab`. The staged index matches tree `f80ea0208cb3735188843512316b8763f16018a0`; no unstaged changes were present. Original target bytes remain in primary ignored recovery evidence.

## Reviewers and coverage

Independent Astra/xhigh, read-only. Reviewed IR-6 workflow repair, its regression, retained review 3 and authored visual record. Earlier reviews cover unchanged product and historical imports. Outside-diff grounding included the actual unit-suite consumer at ci.yml:148 and historical-source readers in the work-document tests.

## Reports

IR-6 closed. ci.yml:85 fetches immutable source with --no-tags --depth=1 and verifies its commit object. The step runs after checkout and before npm test in both unit-gate matrix legs. It supplies historical objects without replacing HEAD or fetching complete history.

ciHistoricalSources.test.ts:68 checks workflow placement and binds its revision to the seven approved imports. Its real shallow-clone case starts with the historical blob unavailable, executes workflow commands using the fixture revision, verifies exact historical bytes, and checks HEAD remains unchanged and shallow. Retained records preserve prior findings and distinguish visual evidence, focused checks and pending integrated acceptance.

## Findings and disposition

No new material finding. IR-1–IR-6 and FPR-1 are closed within recorded review bounds. Owner accepts closure; a subsequent synthetic fixture-pointer conflict discovered by the full gate is repaired without changing either pointer checker and requires its own narrow review.

## Verification

The reviewer checked hashes, staged-tree equality, contracts and Git ancestry. The pinned source is an ancestor of the base. No reviewer tests, gates, writes, browser or servers. Local shallow-clone behavior does not prove GitHub transport or remote execution; these remain remote obligations.

## Round outcome

No open material review findings on this exact target. Full integrated verification, main integration, remote CI and retirement remain separate integration-owner acceptance duties.
