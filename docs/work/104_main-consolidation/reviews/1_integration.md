# Review 1: integration

## Target

Base `3bc906af51af5f29a48d11400d21aab79d714449`; initial final integrated patch SHA256 `c3a365f9667cae5884f4bcd17a9e5331672061b39710325136021a9d38e465f7`, product patch `d8714c97c4610d43afbaa83a29761ef9b051ff300d644181a4cf4eb1f564b480`. Exact patches remain under primary ignored tmp/main-consolidation-20260929. This round preceded the checkout-gate and loaded-seed repairs.

## Reviewers and coverage

Independent GPT-6 Astra at xhigh, read-only. The reviewer rechecked IR-1–IR-3 and the documentation migration, preservation evidence, gate boundaries and current acceptance records. Earlier grounding covered visibility persistence/lifecycle, target scans, render projection, stored preferences and replay audio. Outside-diff grounding included tickHaltGuard.ts:23, stepReport.ts:39 and the existing checkout guard.

## Reports

IR-1 is closed: selfplayMeasurement.mjs:18 rejects refused calls and requires one reported successful tick and an actual one-tick advance. Tests include a real failed engine tick that consumed its number. IR-2 is closed: profiles label actual loaded-world bounds and reject empty samples; aiTickAb.mjs:111 rejects comparisons without a steady chunk. IR-3 is closed: buildingVisionSources.ts:90 bounds derived sight before squaring and examines one maximal column per row. Saved values remain unchanged. Tests cover normal geometry, the documented approximation and huge finite values through both save schemas.

Independent migration inspection found 429 registered imports, including 296 reviews, matching registered SHA256 bytes. Compared with source Git blobs, 384 are byte-identical, 44 differ only in line endings and one differs only in Markdown link destinations after line-ending normalization. No other content differences. All 426 staged source deletions have identical blobs at the checkpoint revision and current base. The three active originals, their later September addenda and all seven documents first added after the checkpoint remain.

The new documentation checks distinguish strict defaults from the explicit production transition. They retain exact-case pointer checks, four independent population floors, current-thread hygiene, open-plan freshness, exact imports and fixed raw-import permissions. Their stated bounds exclude truthful status and product completion. Current records distinguish historical and worker measurements from integrated acceptance; the 10000-tick performance results explicitly concern the recovered performance tree rather than combined building sight.

IR-4 — P2: preserved historical CRLF imports conflict with checkoutLineEndings.test.ts:171, which rejects every CRLF index blob despite docs/work/.gitattributes preserving import bytes. The reported full gate rejects 45 imports. Permit only registered historical/review imports whose actual index bytes match their registered digest and whose effective text attribute disables normalization. Keep rejection for ordinary files, new work records, unregistered paths, modified imports and missing attributes. Renormalizing imports contradicts their preservation contract. This repair remains unreviewed. No other material finding in this scope.

The reviewer ran read-only file/hash/Git-blob audits, with no tests, gates, browser, server or writes. Product findings IR-1–IR-3 are closed. Integrated acceptance remains blocked by IR-4 and the unfinished full gate; main/remote/retirement duties remain with the integration owner.

## Findings and disposition

Accept IR-4 as F3. Assign a narrow index-byte preservation repair and negative controls, followed by focused independent re-review. This report claims no final acceptance.

## Verification

The reviewer inspected files and contracts read-only. The first integration unit run passed 4214 checks and failed the CRLF import collision; the wrapper did not retain a valid exit code, so its exit is not a green gate claim. Final full verification remains pending.

## Round outcome

The accepted finding requires a focused repair review before integrated acceptance. Original target patches remain recoverable in the ignored recovery evidence.
