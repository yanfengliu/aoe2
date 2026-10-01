# Round 3 — Completed finite packet and rejected cost disposition

## Target

This round audits the completed finite packet against the same four frozen sources and protocol. Recovery contract ../snapshots/rejected-source-inputs.json.txt SHA627bc301db02c337375f9c60addacdf1216ee56f5473eb818421a9e58b84f9fd and its four byte-exact LF snapshots retain the rejected source. The authored report lists actual native/capture/restoration artifact hashes; active raw evidence remains ignored.

## Reviewers and coverage

Independent reviewer /root/content_tracker/snapshot_pair_acceptance_review used the assigned fleet review pin (Astra/xhigh). This is that actual authored report, without invented reviewers or broader coverage. Root and worker dispositions below are separate from its original text.

## Reports

Complete original authored report source SHA7d542ad0c472249d292eccc72c82e91c68b2aa05d80f146e7d020a3ee6263392, 18367 bytes. Exact original bytes are recoverable from [the authored review input](../snapshots/review-originals.json.txt), round3. The full rendering below changes CRLF to LF only; no claim, finding, reason or verdict is summarized or rewritten. Its display body SHA7d542ad0c472249d292eccc72c82e91c68b2aa05d80f146e7d020a3ee6263392, 18367 bytes and 122 LF bytes identify that rendering, not the original byte identity.

<!-- BEGIN REPORT 3 7d542ad0c472249d292eccc72c82e91c68b2aa05d80f146e7d020a3ee6263392 -->
# Independent rejected-candidate disposition - 2026-10-01

Reviewer: `/root/content_tracker/snapshot_pair_acceptance_review`, assigned fleet-pinned Astra/xhigh. Base `aaf59f33e74da2b5113697c71b48d57f2bffecf4`, workspace `replay-comparison-cost-1001`. This is an independent read-only audit of the completed finite experiment and rejection decision. It is not approval to ship the candidate or final acceptance of a root integration.

## Disposition

REJECT the fifth candidate on measured complete-case cost. The packet supports the root's decision: the candidate satisfies the focused correctness checks in this run, but the original 600-tick case takes about 1.90 times the baseline on Node 20 and 2.05 times on Node 24. The original hosted timeout remains unresolved. The shared same-reason budget is 5/5 spent; this audit authorizes no sixth attempt, repeat, timeout change, retry or engine change.

Source review, observed correctness and cost acceptance are separate outcomes. The source/preflight review passed the frozen conservative-qualification implementation. The completed focused checks now establish bounded runtime correctness and material mutation sensitivity. Those successes do not satisfy the required cost improvement, and do not establish the hosted defect is repaired.

## Direct evidence audited

I read all 13 native command receipts and all 26 captured stdout/stderr files, including empty stderr files, rather than substituting the owner's summary. I inspected the four mutation assertion traces, both correctness-suite results, restored-contract result and all six complete-case score results. I separately read the six restoration receipts, actual job/outer result, job process trace, baseline/closing resource receipts, native-workload result and workload result. For the 29 input guards I parsed each actual receipt and the source manifest it names, checked their digest bindings, and compared every saved source row against the frozen input map. The summary was then checked against this evidence.

All 26 actual captured-log hashes match their corresponding native receipts. All 29 guard receipts report 3115 checked inputs and zero mismatches. Their source-manifest hashes match the actual saved manifest files, their installed-manifest hashes agree, and each saved source manifest contains 2276 rows. Relative to the frozen source manifest, only the expected helper mutation or occupation A/B swap appears; no other source row differs. All 29 guard-file hashes also match the exact guard index retained in `finite-result-summary.json`.

The capture files contain decoded captured process text. Decorative Unicode is visibly mojibake in the files; this audit does not call them byte-exact native stdout. The ASCII test names, counts, assertion messages and durations are readable. The hashes below identify the captured files, not an unrecorded pre-decoding byte stream. Native Process.ExitCode and Stopwatch receipts are distinct from the text capture. Reported nodeProcessCpuSeconds excludes separate child-process CPU.

## Correctness and SP2 runtime disposition

Node 20 and Node 24 each returned native exit 0 with four passing files and 27 passing tests, no skipped correctness case. This includes the full original 600-tick test, separate 700-tick lifecycle test, native 120's 240 unstripped comparisons plus 120 pair checks, and all 17 synthetic contracts. The unfiltered restored Node 20 contract run returned native exit 0 and 17 PASS. These observations bind the reviewed source hashes below, one local host, the pinned Node binaries/loader and the named test inputs; they do not imply a full repository gate, hosted acceptance or arbitrary-JavaScript clone equivalence.

SP1 remains closed: the candidate preserves modern-only pure normalization and the complete legacy operand, and the unexpected legacy marker/unit assertions passed. SP2 is CLOSED for the reviewed candidate's tested error classes: both native-backed root/nested Proxy controls, warm substitution, detached zero-byte ArrayBuffer and accessor native-forwarding controls passed in each unfiltered correctness suite. The eligibility mutant supplies real counterevidence that native value equality alone is insufficient: its warm Proxy case returned no error, its detached-buffer path raised TypeError instead of native DataCloneError, and its accessor source reached the native-clone spy once where twice was required.

Mutation verdicts and bounds:

| Mutant | Native exit | Observed outcome | Substantive assertion |
| --- | --- | --- | --- |
| Eligibility bypass | 1 | 3 FAIL, 14 filtered | Missing native rejection; TypeError instead of DataCloneError; native getter-object clone count 1 instead of 2 |
| Positional equality guard removed | 1 | 7 FAIL, 10 PASS | Changed/optional values falsely equal; reordered matching inputs falsely unequal; external-source and recovery inequalities hidden |
| Pure normalization replaced with in-place deletion | 1 | 1 FAIL, 16 filtered | Matching shifted-role input falsely unequal at contract line 109 |
| Final comparison ignores legacy | 1 | 4 FAIL, 13 filtered | Nested, optional, non-unit and unexpected-legacy differences falsely equal |

These are assertion failures with loaded tests, not import/startup failures. Two limits must stay with the result. The eligibility regex `Proxy|zero-byte|accessor` did not select the cold test whose title uses `Proxies`; that cold test is explicitly marked skipped in the mutant stdout. The warm Proxy test failed on the first root iteration, so that mutant did not reach its nested iteration. Both complete cold and warm root/nested cases passed in the unfiltered candidate suites. Also, the normalization mutant failed the matching expected-true branch at line 109 before reaching the later shared-source false-green fixture. Therefore the packet proves those mutants were detected, not that every later subcase separately went red. No rerun is needed to decide a candidate already rejected on cost, and none was performed.

## Equal-work complete-case cost

The receipts establish chronological Node 20 A/B/B/A, followed by Node 24 A/B. A is the original occupation test bytes; B is the candidate integration. The helper stays at the frozen candidate hash during all arms but is unused by the original A source. The score filter is the same original 600-tick test in every arm; each log reports exactly one passing case and seven filtered cases, with native exit 0 and empty stderr. The fixed 30s case timeout, scenario, all 600 comparisons/steps/clocks and independent live gather witness are unchanged.

| Arm, chronological order | Whole original 600-tick case seconds | Native command elapsed seconds |
| --- | --- | --- |
| Node 20 A1 | 10.471 | 13.3194671 |
| Node 20 B1 | 19.571 | 22.2850465 |
| Node 20 B2 | 19.565 | 22.2756548 |
| Node 20 A2 | 10.180 | 12.8955323 |
| Node 24 A | 6.353 | 9.0672860 |
| Node 24 B | 13.019 | 15.7606834 |

Node 20 mean whole-case baseline is 10.3255s and candidate 19.568s, ratio 1.8951140381. Node 24 whole-case ratio is 2.0492680623. Both Node 20 candidate samples are well above both bracketing baseline samples. This supports rejection of this measured implementation; it does not prove the entire private-comparator strategy impossible or predict a portable exact slowdown. The source's extra eligibility traversal is a plausible contributor, but this run did not profile phases, so no causal share is assigned to it.

The 13 native commands consumed 174.2062865 summed command-elapsed seconds and 186.9375 node-process CPU seconds excluding separate children. The whole owned Job reservation lasted 290.940s, including guards and orchestration outside command stopwatches. Earlier TDD/smoke work, prior four attempts, authoring and review are additional work, not included in those numbers; total end-to-end task cost is not measured here. A successful job exit means the finite protocol completed as designed, including expected-red mutants; it is not a positive performance verdict.

## Restoration and resource evidence

Each of the four mutation restoration receipts changes its exact recorded mutant digest back to the frozen helper and reports no unexpected bytes. The inner-final and outer-owned restoration receipts report both owned files already at candidate digests, also with no unexpected bytes. The final input guards bind those restored files.

The actual job receipt records native exit 0, root PID 57536, elapsed 290.940s, assigned-before-release true, successful membership query, successful job close, no members at closure, no leftovers and cleanupProof true. The process trace shows assignment before release, wrapper exit 0, empty membership and the kill-on-close handle being closed. The outer receipt records jobNativeExit0, outerRecoveryExit0 and outerClosingGuardExit0. The closing resource receipt at 2026-10-01T21:27:35.8103463Z records no 4291 listener, no shared gate lock and no live owned root identity. The 13 command receipts each follow the launcher's WaitForExit path. The owner additionally recorded a later all 13 PID/start-time absence check in the summary; I did not independently query live processes in this read-only artifact audit.

## Exact source and artifact binding

Current source bytes still match the rejected frozen candidate:

| Source | SHA-256 |
| --- | --- |
| Private helper | `7337c352f36f0876c7365e51f24f676c18ee6d809fb47bdd2514a7bb28e3a969` |
| Private contracts | `ffc17921ceba08b181b3c4708f9cc307cd18144458dd54e5b8bc0ca9cef423b5` |
| Original600 integration | `23fa3e8b3ece9b1e10a5bdcd7596d5e6c87102d866eed671b467e7cae06053b8` |
| Native120 integration | `ed2652947f7e1442d160b672782f21625814575169f6f7c7b338831c089e7ca6` |
| Protected generic serializer | `e3a0d85a749c8afb19053a360539d41e9dfa2eef92330f53e0a1eeeafdbd1e80` |
| Protected 700 | `0490585ce189b9b29afebb6b424526c7846cb05d9404e5d230fce1da11df2107` |

Source anchors outside a diff remain `tests/replay/exactSnapshotPairComparator.ts:7` (fresh eligibility traversal), `:37` (pure modern normalization), `:72` (qualified exact reuse), `:90` (both serializations and full final equality) and `:98` (finally restoration). The complete integration contract is at `tests/replay/resourceWorkerOccupation.test.ts:65`, including the independent gather witness at `:90` and all 600 comparisons at `:94`. Original instrumented-before-native order and all 240 unstripped checks remain at `tests/replay/exactSnapshotSerializer.test.ts:35`; separately native-backed pair checks follow at `:40`. Mutation-reach limits correspond to `tests/replay/exactSnapshotPairComparator.test.ts:109`, `:131`, `:211` and `:229`. Paths in this paragraph refer to the exact worktree source digests in the table.

The original A source is `ab932d333afd5031009d51ea115ad7a9fea79342482eadbb734eb0af8cd3eea1`. Source manifest is `9ab676a9a066b9075818e0777c35b1f4d711f56ac43d79a4e7367a821b97734b`; executed protocol is `716353c21de1208108bc923004e146c4f4dcac18ce7c3967f89296e8b6d2ccdf`; frozen source inputs are `f5af9e3533bceb7cb7eca29913a508944630e843e88945c7dfdc36c6b8d61654`. The independent summary check binds `finite-result-summary.json` at `d70f8ceb271695ca2e1116e5dbc494cf457249ca336b14a1d979983277d6c0a9`, including all 29 guard hashes verified above.

The following index names each complete native receipt and captured stdout read. For the four mutant stages, stderr hashes are also listed; all nine nonmutant stderr files are empty SHA-256 `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`. Paths are under `candidate-experiment/`; stage names expand to `<stage>-native.json`, `<stage>.stdout.log`, `<stage>.stderr.log`.

| Stage | Native receipt SHA-256 | Captured stdout SHA-256 | Captured stderr SHA-256 |
| --- | --- | --- | --- |
| mutant-eligibility | `e8575b0fe6223f70c34cff0d46483bfb108dc261904c9c8f3993cdd146e1b5a5` | `d8d8806a87b72bc9b94f09feb70e1bcd0663ff325908ef3698b9c49f31b1a8a5` | `fbfff81d7edcebc343873c024ec5064b03851f5b74ebf922445873a09c3996e2` |
| correctness-node20 | `56cf9064a739a470f14b6767e96cc3768891f88e7e44879cc73fd161f3799b32` | `74c6e5cf2a61ce0acf00a5180f4564fba661001f6799abd123049bc2ba59467c` | `empty` |
| correctness-node24 | `fed29a8c4f072ec494baa8b20bd9f0a40226f0938b74b1cdc3dbd0bdf6dadc74` | `988decf7beb4e347b1ad7ba59dc77f00dd4b0c0a2f16aaee83ea797e6cc9a7be` | `empty` |
| mutant-guard | `1fc324f04964aef00330d6efa9dd302d75216eef6495c52bdf11534264622225` | `041f914bbbae01207b9af6e6f1c7960d79f275fa0d55256d504a9e59e85fa424` | `72a31a679f5c550c017f26775f4ae3f0c528a90bdec39eaa2d0ec19ee493d69f` |
| mutant-normalization | `626d4902b954413e9aebd06a4ef621b6e21670429a3d5596a73620a61601473e` | `d91f6a8894eff406a9a2b0bffa746e79723f6b8bf1cb78652df2040686697efc` | `91c95d5215c2291d189829b4c3242267c5a345fc28bf4ec4e80c70965e27224e` |
| mutant-final-legacy | `477bf62510a3156f3b9aa9cc4cc2e4a02ff4101ba0a67c757b36be4bd18b2c14` | `1d23b74e4034db18b057d666fc3edfdfa1783721f24d2d66d7f7f5b3c3da732f` | `44d794412d73848c7d29e21f1008c4dbd4aeeae95401fee4f20750461c2d3950` |
| restored-contracts-node20 | `36e3b4a55b762ccd72058872e202c04315d8d499a0c20b5ba9fc0b603e902c68` | `1651744c4d69d1995e019265f1ac861254a6159c0be0ff90bbdc84502e9028ae` | `empty` |
| score-node20-A1 | `45ca1404e9fb0e4fca7ea3e57ffe2503e8af1138213d0775ef2076fb9b0fee24` | `9f237b6d1dddcbf9f36294eb4599a5efdae051ca7316ec0f376cfaf903e68e32` | `empty` |
| score-node20-B1 | `6256d27081f45dbc937226664a30c679795b759eb127e7dbcedc0f8203f53061` | `adf52bd62d1bcc59b300d115988b4e354c1d625ca86f8648f1f69876ed825c76` | `empty` |
| score-node20-B2 | `da5ad59a5a59cc8db0812a7b8dc5ac8904684225fd2d54bd6c0b14697350254d` | `d54276ae73893ce52911b82d639bbfbd2728c5937354ba31143e58ee6605a91b` | `empty` |
| score-node20-A2 | `4d464962b981af07c1faca014b360fd7802a2b6031e1439e50a766143cf9de77` | `cba5b606d2ac51942f21a034c75e646f66d89f5e35972a1f552e83ae13473c9a` | `empty` |
| score-node24-A | `efe1a1df91edea4bd669b684f24ff3c37999dcaf94305ba882ed4611d976a5ec` | `651b8a620882803d96cc851a28177e10b2dddea373363d05ce91449de2c13eaf` | `empty` |
| score-node24-B | `071f95f06021bcfa19ef43d8603d796b632ebae458c9e2e28d12acb4eee16b6d` | `53d6b12afe1bf4baca6fb62280420f159ce4967781fa6bb2dfa810204853dc86` | `empty` |

Additional complete artifact reads, including restoration and containment:

| Artifact under candidate-experiment | SHA-256 |
| --- | --- |
| mutant-eligibility-restore.json | `50b157a50108cd286645dde1af7a88247d59703abff0c2d1ecdfd8bb8b9f3ece` |
| mutant-guard-restore.json | `50dea9014401005ffebbf19a19eaaf4cbe517316b032115219c261ba6ed651d8` |
| mutant-normalization-restore.json | `ffc2a1ad1815251d5b5f3e91a67b6f504dee3b6c15028aea32b0c646db2eee60` |
| mutant-final-legacy-restore.json | `885c841ec2640e2008cec6e02ea3958a4fc3477d2cf1f292d8d6727b1357c618` |
| inner-final-restoration.json | `10fade5547142d09fa740c050348cbd552c33c11137f1f23395a7c3c15b92cdb` |
| outer-owned-restoration.json | `4bd1c534ffc1625da42b3d90ce56ac737157e706ab7a584a0a8dbffb38ad816f` |
| job-gate-result.json | `7564e9eab1c9b3bc0adfb4572fe3e445dd84b2018b1466439fcf6374fc196fe6` |
| job-process-trace.log | `3e8baa31634149aa0ec371d82f1864f5251fd603e8b3b57d51c562e229b28971` |
| outer-execution.json | `960b4c2a4d765a46f55f22a3f6a7f290fde8bed5efeba96d57b7ddaf6348c911` |
| resource-baseline.json | `1aa33e15b47043c1d5daafc6aa9e9f1e5f6f66fbc504c8d4fd27fd3d531471aa` |
| resource-closing.json | `81f2b3232785409a91de5da3f86b2727fcfcf17bf2509c30d88994136fc6cb73` |
| native-workload.json | `9d47e977f969a5332e754082a60ee4237acb21540d79d3b47340a485757a78a0` |
| workload-result.json | `de4d16efd472ee6383594204f0e8f80a3e0bc5b4cbe8c1197687d5064829ceaf` |

The three earlier authored reviews remain unchanged: SP1/preflight `aedd4ffc002105356887e8e2eb1c6b4dc0af7172ae6b4c39c1cc712f67352fac`; initial candidate/SP2 `24299ce9e58f893038ef66c62460f51fe40f5e9d69090902ae61c1be6243c5cd`; eligibility source/preflight `c83d3f355140e095376f27c828ee5a6a87cdcc2f6b94b509582068509200d9da`.

## Publication and remaining limits

The four-source recovery input passes static inspection: `docs/work/112_replay-comparison-cost/snapshots/rejected-source-inputs.json.txt` at SHA-256 `627bc301db02c337375f9c60addacdf1216ee56f5473eb818421a9e58b84f9fd` binds the base revision and the four rejected source digests above. I read the complete contract and checked all four retained `.txt` files against their current source bytes: matching SHA-256, matching lengths of 4633, 15915, 15003 and 3385 bytes respectively, and zero CR bytes. These are actual LF source recovery inputs, not runtime captures. The unchanged generic serializer and lifecycle source remain recoverable at the named base revision. The candidate remains rejected and unshipped.

The earlier authored review originals also need complete recoverable preservation. The owner proposes a base64/SHA/length/path input retaining their mixed line endings, with clearly labelled full-text LF display wrappers. That actual input and its wrappers remain pending this reviewer's inspection. LF normalization is acceptable for display only when the exact originals remain recoverable and their decoded hashes/lengths match; a normalized wrapper must not claim the original byte hash.

No full integrated verify, fresh hosted Windows/Linux/browser/corpus acceptance or merge/push acceptance was performed for this rejected candidate. The focused green and local timing packet do not establish those unavailable outcomes. The candidate has not been recommended for active tests. The exact unresolved product-work gap is a valid way to remove the original hosted 600-tick timeout without weakening any comparison/gathering/error contract; the current five-route budget supplies no authorization to continue searching.

This audit executed no World, test, benchmark, profile, build, gate, network call, external model CLI, browser/server or new subagent. This audit used file reads, JSON interpretation and static hashes, and authored only this one authorized ignored report. Some initial broad output was truncated; I replaced it with named-file and parsed-row reads and reread the omitted guard stdout/stderr. No source, prior report, canonical docs, index, dependency or engine was changed. This new report is written as UTF-8 without BOM and LF-only from creation. No task-owned process was created by this reviewer.
<!-- END REPORT 3 7d542ad0c472249d292eccc72c82e91c68b2aa05d80f146e7d020a3ee6263392 -->

## Findings and disposition

F0/SP1 and F1/SP2 are closed for the reviewed source/test classes. Mutation limits remain explicit: cold Proxies filtered, warm root failure before nested, normalization matching-true failure before the later shared-source fixture. F2/COST-1 rejects the candidate: Node20 mean1.8951x andNode24 single-pair2.0493x complete case cost. Correctness does not satisfy the required improvement. Root accepts rejection; same-reason budget5/5 is spent.

## Verification

The independent reviewer read all13 native receipts/all26 captured texts, parsed29 guarded manifests/receipts, inspected restoration/Job/resources and verified four source recovery files. Candidate Node20/24 each4files27PASS, restored17PASS; four literal mutants ASSERTRED. All29 guards matched3115 rows, hidden Job/outer cleanup passed and owned resources were released. Logs are decoded captured process text with decorative mojibake, not byte-exact stdout. No runtime or live-process query was performed by this reviewer.

## Round outcome

REJECT on complete case cost. Focused correctness is accepted within its bounds; candidate full verify, final root integrated acceptance, shipping and hosted repair did not run. Another optimization needs explicit human budget extension.
