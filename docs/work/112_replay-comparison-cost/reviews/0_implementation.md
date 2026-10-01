# Round 0 — Private-boundary preflight and modern-only oracle correction

## Target

This historical source/preflight round reviews the corrected native baseline named in the report before the initial TDD run. It does not review the final eligible-reuse implementation. Exact earlier source/protocol preimages remain in the active ignored handoff; the final four-source snapshot is a different later target.

## Reviewers and coverage

Independent reviewer /root/content_tracker/snapshot_pair_acceptance_review used the assigned fleet review pin (Astra/xhigh). This is that actual authored report, without invented reviewers or broader coverage. Root and worker dispositions below are separate from its original text.

## Reports

Complete original authored report source SHAaedd4ffc002105356887e8e2eb1c6b4dc0af7172ae6b4c39c1cc712f67352fac, 8021 bytes. Exact original bytes are recoverable from [the authored review input](../snapshots/review-originals.json.txt), round0. The full rendering below changes CRLF to LF only; no claim, finding, reason or verdict is summarized or rewritten. Its display body SHA6abdcc6e3adeab0922b458b85a24a83e39c5823c6ff16c1deb28d30d20a7200c, 8019 bytes and 51 LF bytes identify that rendering, not the original byte identity.

<!-- BEGIN REPORT 0 aedd4ffc002105356887e8e2eb1c6b4dc0af7172ae6b4c39c1cc712f67352fac -->
# Independent preparatory source review — 2026-10-01

Reviewer: `/root/content_tracker/snapshot_pair_acceptance_review`, assigned fleet-pinned Astra/xhigh. Scope: instrument contract and tests-first source only, base `aaf59f33e74da2b5113697c71b48d57f2bffecf4`, workspace `replay-comparison-cost-1001`. This is not final integrated acceptance, a runtime test result, or a measured performance verdict.

## Judgment

The private boolean ownership boundary and pure copied occupation normalization are suitable conditions for continuing this fifth candidate. SP1 blocked the initial preparation; the focused source correction below closes that finding. No preferred algorithm or performance approval is given. The native baseline intentionally duplicates object clones, so the clone-reduction assertion is an appropriate future substantive tests-first failure; it has not been executed by this reviewer.

## SP1 — preserve the original one-sided normalization oracle

Priority P1, preparation blocker. `tests/replay/exactSnapshotPairComparator.ts:22` normalizes both modern and legacy snapshots. `tests/replay/exactSnapshotPairComparator.test.ts:23` makes the independently calculated expectation use the same broader normalization. The original oracle outside the diff, `tests/replay/resourceWorkerOccupation.test.ts:93-95`, strips only modern and compares legacy unstripped. Consequently, a legacy snapshot that unexpectedly retains `aoe2.resourceOccupationVersion` or `unit.resourceOccupation` is unequal under the original oracle but accepted by the proposed baseline when its other values match. The remaining recording/lifecycle tests do not preserve that check at every original600 tick.

Preserve pure normalization on modern only and use the complete untouched legacy snapshot in final native equality. Add separate cold and warm synthetic controls for an unexpected legacy marker and an unexpected legacy unit occupation field. Align the native expected-value helper and role fixtures with the same one-sided original contract. If root instead intends to broaden the normalization contract, that needs explicit independent acceptance as an instrument correction before timing; it cannot be described as an unchanged oracle. The original investigator's construction also explicitly says to strip modern before serializing legacy.

## Coverage assessed

The source suite covers distinct equal inputs and a clone-count discriminator, nested mutation on both sides after warm reuse, arrays, own optional deletion/addition and null, signed zero, changed clone order/length with primitive requests, source detachment against external native-snapshot edits, transfer detachment, errors in either serialization, exact global restoration and next-call recovery. The role and aliased-DTO controls at `exactSnapshotPairComparator.test.ts:90-115` target the new false-green class: occupation-shaped values in unit, other-component and state roles. Pure copying at `exactSnapshotPairComparator.ts:8-15` prevents normalization from mutating shared cached leaves in this baseline.

The native alias control at test lines 147-157 distinguishes native clone identities and compares the pair result to a separately native-serialized value oracle. This is source preparation only; no pinned Node20/24 behavior was observed here. Source review does not certify a future cache implementation, candidate publication after failure, or global-wrapper restoration; the frozen candidate still requires inspection and execution.

Read outside the diff: `exactSnapshotSerializer.ts:14-31` keeps the existing per-source cache guarded by native whole-value equality and restores the pre-call clone in finally; `exactSnapshotSerializer.test.ts:27-34` performs all 240 unstripped native comparisons over 120 ticks; installed `node_modules/civ-engine/dist/world.js:38-44` and `:71-75` validate before component/state clones, and `:92-106` builds the complete snapshot. Those engine source reads support the required two validated full serializations. They do not identify a loaded hosted runtime or establish portable timing.

## Initially reviewed inputs

- Preflight proposal: `tmp/replay-comparison-cost-1001/preflight.md`, SHA-256 `53489545b98bc74c851ee64f7137773bceff36dfc637fe9caeb3152e36ac027b`.
- Native baseline helper: `tests/replay/exactSnapshotPairComparator.ts`, SHA-256 `034e3c130d3948a91c4af678f49aa56421772336b0ba57652aaa2ff6421a96ab`.
- New source contracts: `tests/replay/exactSnapshotPairComparator.test.ts`, SHA-256 `5b84b46def0a4fa0fe22efb24b92143498acbe08e7a85f580cb89e10f91020bf`.
- Primary immutable fixed contract: SHA-256 `6b853dd0cdead24466d7aa60ed76daf15be876098f6a5868e024a5a88269ad8d`.
- Primary independent investigation: SHA-256 `467eb42d40ab1c00e25ede8d476d9e6a75cecc27a090a38b509448674c2a5d02`.
- Unchanged original occupation test: `ab932d333afd5031009d51ea115ad7a9fea79342482eadbb734eb0af8cd3eea1`.
- Unchanged generic serializer: `e3a0d85a749c8afb19053a360539d41e9dfa2eef92330f53e0a1eeeafdbd1e80`.
- Unchanged native120: `71536b1d60a64f5a4b5dfdb6a3f16403f148d9db1dcea221ef57fa6a66bc1380`.
- Unchanged separate700: `0490585ce189b9b29afebb6b424526c7846cb05d9404e5d230fce1da11df2107`.

These source hashes matched opening and intermediate inspection. The helper and test changed under their assigned owner after SP1 was reported, before the report was written. The corrected bytes were then read separately; their closing hashes appear below. Preserve both reviewed uncommitted source versions; hashes alone do not recover them.

## Bound and tool provenance

Only filesystem reads/searches/hash reads, read-only Git inspection, and this expressly authorized ignored report write were performed. Git initially refused dubious ownership; command-local `-c safe.directory=<exact worktree>` enabled subsequent read-only status/revision/check-ignore without changing configuration. A Windows wildcard search failed and was replaced with a directory/glob search. Some long instruction output was truncated, so relevant rules and source evidence were reread in bounded excerpts. No approval denial occurred.

Per the assigned no-runtime/no-network boundary, this reviewer did not run `ci:status`, World construction, tests, benchmarks, profiles, gates, build, browser, servers, external CLI reviewers or model calls. The parent/root owns the session CI baseline and runtime reservation. No source, canonical docs, Git/index, dependency or engine mutation occurred. No background/browser/GUI resource was created. Final frozen candidate review, both literal substantive mutants, complete unchanged600 scoring, native120 additions, full integrated gate, main/push and fresh hosted acceptance all remain outstanding.

## Focused SP1 source correction

After the parent accepted SP1, I read both entire revised files. Helper `exactSnapshotPairComparator.ts:22` now normalizes only modern and compares the complete legacy result unchanged. The independent native expectation at `exactSnapshotPairComparator.test.ts:23` does the same. Updated role fixtures now leave the legacy marker absent, retain modern markers where relevant, and keep the aliased-source false-green control meaningful with all legacy unit occupation fields absent. Separate assertions at test lines 118-129 require false for an unexpected legacy marker and for an unexpected legacy unit occupation field.

SP1 is CLOSED in source preparation. No additional bounded preparation blocker was found. The helper is still deliberately a native, redundant-clone baseline; these corrected files do not contain the guarded candidate algorithm and have not run. A future source change requires its own review. Correctness execution, native120 additions and unchanged original600 integration are pending, as are all performance and final acceptance requirements above.

Corrected helper SHA-256: `c19e36b9b156429da52c5b21da1458ff88ec3d953b3bbb295cec06eb18ba01d9`.

Corrected tests SHA-256: `19f82f6f31fe885e48dde0efd30eec0be9e8a24525c051c9d06a2e6518467320`.
<!-- END REPORT 0 aedd4ffc002105356887e8e2eb1c6b4dc0af7172ae6b4c39c1cc712f67352fac -->

## Findings and disposition

F0 (original SP1): an initial two-sided normalization could hide unexpected legacy fields. The modern-only correction preceded the initial authorized baseline execution. Retain the original finding and its source correction; later source/runtime results belong to later rounds.

## Verification

This reviewer ran no runtime. Its static preflight checks and their bounds are stated in the full report. The subsequent separately authorized initial native baseline had one substantive clone-work assertion failure and11PASS; that is owner runtime evidence, not reviewer execution.

## Round outcome

Historical preflight source pass after F0 correction. Candidate optimization, cost and hosted acceptance remained pending at this round.
