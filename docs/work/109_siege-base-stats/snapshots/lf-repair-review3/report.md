# Focused review: work109 review JSON line-ending repair

## Verdict and exact scope

Accepted for integration with no material findings in the reviewed docs-only repair. This is independent internal review by `/root/siege_internal_acceptance`, assigned Astra/xhigh; model identity is not separately instrumented. The exact target is staged tree `d0e9a29c02bad28fb7db7ecd5e69b5d85ef8ed28` against HEAD `0d290ab5f3f74ab080537158c5de86a613fed800` in `C:/Users/38909/Documents/github/aoe2-worktrees/siege-content-1001`. All 16 changed paths are documentation. Opening `git diff --cached --quiet <target>` and unstaged `git diff --quiet` both returned 0. `opening.json` records every reviewed file's byte count, SHA256 and indexed Git blob, five inverse-recovery proofs, nine source-continuity checks and both immutable authored-report checks. `closing.json` records the final rehash and evidence digests.

The existing indexed line-ending gate correctly caught the publication defect. The earlier focused review established retained bytes and readable provenance but did not establish compliance with the indexed LF policy for newly published paths. The local full runtime gate had run before those final paths were indexed. The current repair addresses that gap without weakening the gate.

## Recovery and preservation

I independently reconstructed each original by replacing each LF byte in the normalized file with CRLF, calculated its SHA256 and Git blob SHA1, and compared the latter with the exact original blob named by `git rev-parse 0d290ab5f3f74ab080537158c5de86a613fed800:<path>`. All five recovered blobs equal the shipped originals. Both reconstructed and normalized documents parse successfully, and their fully serialized parsed JSON values are equal. The manifest's original/normalized byte counts, SHA256 values and CRLF counts all match these independent calculations. No other bytes or JSON data changed.

| Snapshot under work109/snapshots | Original bytes | LF bytes | Original Git blob recovered exactly |
|---|---:|---:|---|
| integration-review1/closing.json.txt | 564 | 551 | `6336596705d5ae33138bd64a5a71a59712e2c2c2` |
| integration-review1/evidence-hashes.json.txt | 8,470 | 8,241 | `807af058dc8ca2040e7022aa85cdb2dd82bbc15f` |
| integration-review1/inputs.json.txt | 8,560 | 8,334 | `05da9c539f5d076849e699095b467d1dd0ef4c4a` |
| integration-review2/closing.json.txt | 446 | 434 | `5d4e865a552ec505c66d812e919aaaa40b7d5504` |
| integration-review2/inputs.json.txt | 12,168 | 11,911 | `cd3407edd6c18021e2309291067070d35843aac3` |

All 16 live changed files have zero carriage-return bytes and raw bytes equal their staged blobs, including the new delta manifest. The two original authored Markdown reports remain byte-identical to their prior reviewed versions and HEAD: review1 is 14,181 bytes, SHA256 `2c0db6bac1660aa0cdb97e59b51970be27e6da2f581a90ae0a4b9af48143fd65`; review2 is 5,174 bytes, SHA256 `14f10809028a1742a1a58819dddb7ac4516561b7e1ca8bd5a0d909fd4ee60c15`. The complete current review wrappers distinguish normalized JSON copies from unchanged authored reports and point to the inverse recipe. They preserve the original judgments, historical pending states and proof limits rather than silently rewriting the reports.

## Status, allocation and source continuity

The staged status, defect and devlog changes disclose that source `0d290ab5` was merged and pushed but hosted CI `36881959326` failed. Actual Linux and Windows job logs identify the same sole failing assertion at `tests/architecture/checkoutLineEndings.test.ts:220`, with exactly the five repaired JSON paths. Both report 4,375 passing tests, one failing test and four skips out of 4,380; Linux took 1,333.27 seconds and Windows 1,050.33 seconds. The docs preserve the earlier local 4,377/three-skip result as historical evidence and do not substitute it for hosted acceptance. Earlier review-round paragraphs retain historical shipping-pending statements; the later dated current status explicitly records the merged source and still-pending repair acceptance.

The documents keep the four successful browser shards and corpus outcome separate from the failed CI. They retain the corpus's 20,001 ticks per map, zero high findings and 43 medium/17 low finding instances without claiming the gameplay findings resolved. This focused review read the two actual failure logs; it did not repeat the separately owned browser/corpus acceptance or recover missing per-run corpus reports.

`docs/work/registry.json` changes only by adding allocated ID110/theme `corpus-evidence-retention`. It adds no preservation registration or gate exception. The matching work110 plan explicitly names the separate private branch, an uncommitted outcome, incomplete final integration and the bound of its filename-selection test. No work110 workflow or test implementation is included in this staged repair. Its checked local preparation steps do not claim hosted artifact delivery or historical missing-report recovery.

All nine original product/test/stat inputs match the SHA256 and byte counts recorded in the first review's exact-target record and their shipped HEAD blobs. A direct staged diff from HEAD over `src`, `tests`, `scripts`, `design`, `package.json`, `package-lock.json` and `.gitattributes` is empty. There is no runtime, dependency, engine, test-policy or attributes change. I read the indexed-line-ending test's mechanism: it examines tracked/index data and permits only exactly registered preserved imports; merely retaining `-text` attributes is insufficient for these new documents. The repair respects this mechanism.

## Checks and remaining boundary

I read every assertion result in `tmp/siege-content-1001/review-json-lf-repair/checks/results.json`, SHA256 `d1e21d156f4ed3174329da59475f036f8d9355dae454df67163aac8ae33e7e7b`: `success:true`, four actual files, 14 passing assertions, zero failures and zero pending/skipped assertions. These are checkoutLineEndings (five), workDocsIntegration (four), threadHygiene (three) and fileSizeBudget (two). The nested-suite total is not a file count. The integration owner reports the actual unpiped native command exited 0; I independently verified the result artifact and the unchanged staged target. The owner also reports the common work-document validator accepted 111 units; that separate command was not rerun by this reviewer.

No product test, simulation, World, runtime, browser, server, build, external CLI/model export, Git write or source/document edit was performed by this reviewer. Only the retained report and opening/closing manifests under primary ignored `tmp/siege-lf-repair-review-1001` were authored. A Git read initially used an ineffective current-directory value; it was repeated successfully with an explicit workspace and process-local safe.directory. A broad failure-log excerpt was truncated; the exact failure and summary lines used above were present and read. No verdict depends on unread truncated material.

This acceptance closes the bounded LF normalization and provenance correction. It does not declare repaired main/hosted CI green or close the corpus findings, authentic historical save/replay coverage, M7, full DE parity or the 21 remaining engine asks. Root owns repair integration, final status refresh and hosted acceptance. Publishing this complete report with LF input/closing records needs the normal indexed documentation checks, not another product runtime gate or a recursive independent publication-review round.
