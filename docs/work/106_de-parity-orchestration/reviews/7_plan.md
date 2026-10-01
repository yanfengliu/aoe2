# Review 7: occupation regression coverage contract

## Target

Reviewed base: `c4024020a09c99f74728f2a880a86fbcbaef8e48`. Independent reviewer: `/root/occupation_coverage_contract_review`. Integration owner: `/root`. Status: the owner accepts the corrected verification contract; final implementation, execution and source acceptance are separate requirements.

## Reviewers and coverage

The independent contract reviewer ran no tests, profiles, builds, browser, server or child agents; its initial remote status was unavailable in the sandbox. It inspected the literal fixture/input bounds and retained baseline evidence. This is a source/evidence judgment, not empirical acceptance of the replacement.

## Reports

The complete 15,231-byte original authored report is preserved exactly in [independent-contract-original.md](../snapshots/07_occupation-contract/independent-contract-original.md), SHA-256 `7d30c81e568ca18e477554c4bddafa91ca18c6dc318f8386caa4263106e91d97`. Its original 9,501-byte JSON manifest, SHA-256 `7286daa9ed6b49c78bc1a60bc16a7d165be159d07d30c256914122211f453ffc`, names 46 inspected inputs and remains exact in ignored review storage. The promoted [inspected-inputs.json.txt](../snapshots/07_occupation-contract/inspected-inputs.json.txt) is 9,257 bytes, SHA-256 `47751d70eaed03d27ba56f87507cfeefed7339ee45c45667d982e2533db97d86`. Its only transformation is 244 CRLF pairs to LF; parsed JSON deep equality and unchanged source-hash values are verified. The `.txt` suffix and LF representation satisfy the snapshot/checkout contracts without changing report findings or reviewed data. Exact original bytes and the conversion proof remain under ignored `tmp/parity-106/occupation-doc-repair/` in integration.

Recoverability is explicit. Before replacement, the worker preserved the three uncommitted reviewed helper/test inputs, the original-helper diagnostic, review 6 and work-108 plan under ignored `tmp/work106-snapshot-profile/review7-inputs`; all six match the manifest. The cited intermediate [occupation test](../snapshots/07_occupation-contract/reviewed-resourceWorkerOccupation.test.ts.txt), [native-120 control](../snapshots/07_occupation-contract/reviewed-exactSnapshotSerializer.test.ts.txt), [helper](../snapshots/07_occupation-contract/reviewed-exactSnapshotSerializer.ts.txt), [original-helper diagnostic](../snapshots/07_occupation-contract/reviewed-original-helper-lifecycle-baseline.test.ts.txt) and [work-108 plan](../snapshots/07_occupation-contract/reviewed-work108-plan.md.txt) are promoted solely to recover this authored report's changing inputs. The maximum promoted changing input is 17,382 bytes, below 256 KiB. Raw profiles, logs, execution manifests and cost comparisons remain ignored while the issue is unresolved. Existing reports, patches and reviewed snapshot bytes are unchanged.

The original `reviews/7_occupation-contract.md` wrapper is preserved as [review7-wrapper-before-structure.md](../snapshots/07_occupation-contract/review7-wrapper-before-structure.md), SHA-256 `a3a798ae10f7e40ed27c685dab10a4a6b10d1c8e405a0479c29db532a0bf5688`; this current wrapper is `reviews/7_plan.md`. Historical references to `reviews/6_ci-cost-investigation.md` resolve to [the exact review-6 wrapper snapshot](../snapshots/06_ci-cost-search/review6-wrapper-before-structure.md), rather than the rewritten [current review 6](6_implementation.md). Historical `snapshots/07_occupation-contract/inspected-inputs.json` resolves to the exact original in ignored storage and equivalent LF JSON data at `inspected-inputs.json.txt`. Immutable reports and original input records retain their historical citations.

## Findings and disposition

The reviewer confirmed the original default-map 600-tick case does not establish full carry/deposit: its first measured wood harvest is at tick 514, and the inspected literal rate/capacity puts full carry no earlier than tick 748 before return travel. It accepted retaining all 600 full comparisons on the same input, truthfully naming a commanded-worker prefix with actual selected-target gathering, and adding a separate 700-tick proof on the unchanged existing `woodline-clearing-fixture`. Both bounds retain full validated snapshots, native final equality and the unchanged 30-second case limit. The added fixture is additional work and cannot be presented as a historical speedup.

Literal acceptance requires real clock advancement, one owner-2 worker starting empty with capacity 10, the near tree's original 12 wood, a complete owned Town Center, ordered selected-target wood gathering/full carry/deposit, exact owner wood and resources-gathered score credit 10, modern wood metadata/marker 1 and absent legacy own keys at those phases. Same-tick reassignment is valid. Both-world stopped economy and suppressed deposit credit must go RED while snapshots and clocks alone could agree. The native-120 control remains 240 unstripped comparisons over a prefix. Original transfer, mutation/error and adjacent save/load/recording/seek/training bodies remain retained.

## Verification

The integration owner authorized implementing and executing these separate bounds after reading the complete report. This contract round itself ran no runtime checks. The later final ten-case Node20/24 runs and literal negative controls are reviewed separately in [review 8](8_implementation.md); its source verdict does not close the integrated full gate or hosted acceptance.

## Round outcome

Root accepts the corrected unchanged600 prefix plus separate existing-fixture700 lifecycle contract. The complete original report retains its then-pending implementation/source wording unchanged in its snapshot. This current wrapper records the subsequent source acceptance without rewriting that history. Integrated verification, main/remote shipping and work108 adapter implementation remain pending.
