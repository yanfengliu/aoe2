# Review 16: integration

## Target

Independent documentation acceptance by `/root/doc_acceptance_1010`, 2026-10-10. Base `861d7a1ab3d70d1915810f5f88392f48214cdbfc`; staged candidate tree `3b007f229f5aae955073c102320950d977af9f92` in `C:/Users/38909/Documents/github/aoe2-worktrees/status-doc-repair-1010`. Read-only `git diff --cached --exit-code <candidate-tree>` returned 0, and the unstaged diff was empty. The candidate contains exactly 12 documentation paths, 34 insertions and 8 deletions. This review excludes its own later promotion and any subsequent change to that tree.

## Reviewers and coverage

`/root/doc_acceptance_1010` independently inspected the complete staged diff, relevant maintained document assertions, work113's original design report, the paired work97/98 owner records and wrapper dispositions, preserved devlog history, retained local receipts and bounded failure excerpts from root-acquired hosted logs. This reviewer did not independently fetch or rerun hosted CI. No external provider export, subagent, product test, full gate, simulation, browser, GUI, server, cleanup or code change occurred.

The acceptance question is whether this bounded documentation correction repairs the recorded content defects, preserves authored evidence and current open work, and avoids claiming a product or Windows timeout fix. It does not accept controller implementation, gameplay, replay cost, engine adoption, M7 or full parity.

## Reports

This is the original authored report of `/root/doc_acceptance_1010`, not a root-authored summary. Root may promote its exact body into work112 review16 and records its SHA-256 separately after writing.

Inspected evidence identities:

| Evidence | SHA-256 |
| --- | --- |
| `tmp/status-1010/doc-checks-final.json` | `2abe32380d8a7a0bfd3b8d5444bd28226d95d16a58b19679ed3b96c25bef8835` |
| `tmp/status-1010/audit-handoff.json` | `472de1867dd4ee4e606afd2509442c7eab01d1306986350d1037a69b383c5adb` |
| `tmp/status-1010/repair-preimage.json` before the agreed wording correction | `bf3327a9af811ba24fb45203f9d989ffb147da43ef883d16c9d6671060fe84f4` |
| `tmp/status-1010/status-evidence.json` | `602b661066cbd423bf733b8c447c37758a5d91421fb35a732522965c916e40b9` |
| `tmp/status-1010/job-111109419482.log` | `bb12ebf9fd9067d3c2e179e874d75a7f6c4a2d346b83b967005435d39d05cfdb` |
| `tmp/status-1010/job-111109419585.log` | `e1078402924dfac3d98af2cd2c46ddf0e15bf2be9b5ef98ec390ec84c3ccb870` |
| `tests/architecture/workDocsIntegration.test.ts` | `9575291714ceb13c2fb040e93dc767b8215e8490ee62456bfbad3509968111a2` |
| `tests/architecture/checkoutLineEndings.test.ts` | `ea97d7a388609459c1d1d1b8dcb75115db353aa8f1297e4cf580298468fbaa79` |

## Findings and disposition

| ID | Finding | Disposition and reason |
| --- | --- | --- |
| DOC16-A | Work112's two appended CRLF endings violate the stored-byte check; work113's design-stage review requires a design document. | Corrected within the candidate. The work112 diff removes only those two CR bytes. Work113 gains a substantive five-line design that matches review0's canonical ownership boundary and explicitly leaves implementation and class verification pending. No report body, registry or assertion was altered to make either defect pass. |
| DOC16-B | Advancing the dated devlog exposes work97/98's old maintenance dates. | The paired wrappers and retained owner records receive substantive audits, rather than dates alone. Both remain active, distinguish historical evidence from current behavior, and name their unverified acceptance work. The four file digests independently match the exact-copy handoff. |
| DOC16-C | The initial ignored repair receipt says the removed condensed summary bullets were retained "verbatim". | Root accepted a wording correction in the ignored receipt. Direct containment is false: detailed summary-source-line47/48 retain fuller original entries, not those later condensed sentences. Those entries cover the removed summaries' substance, and the summary now has exactly 50 task bullets. This review makes no verbatim claim about the removed sentences. |

No material finding remains against the 12-path documentation candidate.

Work97 preserves the recorded owner-1 freeze observation and requires a fresh protected-map baseline and carrier characterization before retry or closure. Work98 preserves the Codex lane, save/load and instrument disposition, seed-2 corpus acceptance and C2/C6/C8 as open. Bounded source reads confirm the cache still returns its internal entry and the later occupation tests contain real `SessionReplayer.selfCheck` assertions; those tests do not prove acceptance of the whole cache class. No runtime result is renewed by either status audit.

Root-acquired Windows and Linux log excerpts confirm the two document failures and the separate Windows700 lifecycle timeout (32,122ms case, 30,000ms limit); Linux passes that lifecycle file. Root's status-evidence receipt binds these logs to run37090436154 on861d7a1 and reports all four browser jobs and corpus37090436149 successful. The corpus conclusion is from root's actual ci:status stdout, not an independent corpus export by this reviewer. The candidate leaves the document incident OPEN pending local/hosted acceptance and leaves the Windows failure open. Historical work112 round15 remains unchanged and retains the earlier separate browser timeout and unknown historical engine-byte identity.

Existing engine `retry-final-receipt.json`, `hosted-acceptance/artifact-inspection.json` and the retained engine work74 closure support the producer checkpoint: code48297848, docs707380ab, hosted37088530675, asset606946549, version2.6.1 and the bounded native reader proof. The same receipt separates installed runtime2.5.0 and all21 consumer dispositions/E03/E21/M3 from producer acceptance. The candidate preserves those open bounds, route7 budget and M7 holds; no new runtime allowance is implied.

## Verification

The complete staged diff contains no source, test, package, dependency, registry, attribute, engine or version change. Independent Git comparisons found no changed work review or historical artifact. The two retained legacy owner reviews preserve their complete historical prefixes byte-for-byte: 42,968 lumber-camp bytes and 49,520 concurrency bytes. Their only changes are the appended dated status records. Work113's new design links resolve to its existing plan and original review0.

The retained native content-check JSON reports success, 9/9 assertions passed and 0 pending/skipped: five checkout-line-ending assertions and four work-document integration assertions. Its actual test-result entries name the two maintained files in the candidate worktree; aggregate suite counts are not treated as extra executed files. The earlier 8-pass/1-fail result remains retained and identifies the open-plan freshness assertion. This reviewer read both result bodies and the maintained assertions/helpers; it did not run them again.

Bounds remain literal references, metadata, staged Git line endings/attributes and preserved bytes. WorkDocsIntegration reads filesystem document content, so its staged acceptance also relies on the independently empty unstaged diff. Neither checker proves status truthfulness, review quality, gameplay correctness, elapsed-cost improvement or Windows acceptance. The new local policy requires these actual game checks before docs/work publication and does not weaken a gate.

Initial Git invocations encountered sandbox ownership refusal; the attempted tree write was refused and produced no tree. All successful Git operations were read-only with invocation-local `safe.directory`; no global configuration or index was changed. Only this ignored report was written. No task-owned browser, GUI or server resource was created.

## Round outcome

PASS for the exact bounded documentation candidate, with the receipt wording bound DOC16-C and root-supplied latest-hosted provenance stated above. The product objectives remain open. Root still owns exact-body promotion, final shipping records, any required affected content checks after those additions, merge/push, hosted follow-up and owned-resource cleanup. This report grants no controller fix, full runtime comparison, provider export, timeout change, engine adoption or parity closure.
