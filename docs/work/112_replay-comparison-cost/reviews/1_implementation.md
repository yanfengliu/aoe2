# Round 1 — Clone-eligibility finding on the first candidate

## Target

This historical source round binds the pre-eligibility candidate and exact source hashes named in the full report. Its earlier source bytes remain in pre-eligibility/ and preflight-review-preimages/ under the active ignored handoff. They must not be discarded or confused with the later rejected four-source snapshot.

## Reviewers and coverage

Independent reviewer /root/content_tracker/snapshot_pair_acceptance_review used the assigned fleet review pin (Astra/xhigh). This is that actual authored report, without invented reviewers or broader coverage. Root and worker dispositions below are separate from its original text.

## Reports

Complete original authored report source SHA24299ce9e58f893038ef66c62460f51fe40f5e9d69090902ae61c1be6243c5cd, 14119 bytes. Exact original bytes are recoverable from [the authored review input](../snapshots/review-originals.json.txt), round1. The full rendering below changes CRLF to LF only; no claim, finding, reason or verdict is summarized or rewritten. Its display body SHA609ff5642393e8b043e1f048ad2a491a367769d5d605d31cf2a5216002380b22, 14117 bytes and 70 LF bytes identify that rendering, not the original byte identity.

<!-- BEGIN REPORT 1 24299ce9e58f893038ef66c62460f51fe40f5e9d69090902ae61c1be6243c5cd -->
# Independent frozen candidate source review — 2026-10-01

Reviewer: `/root/content_tracker/snapshot_pair_acceptance_review`, assigned fleet-pinned Astra/xhigh. Read-only review of the four frozen candidate sources against base `aaf59f33e74da2b5113697c71b48d57f2bffecf4` in `replay-comparison-cost-1001`. This is a source and contract review before candidate execution, not final integrated acceptance or a correctness/performance run.

## Decision

Source acceptance is HELD for SP2 below. The one-sided normalization correction SP1 remains closed. Root separately requested restoration of the original native120 serialization order during this review; its focused source correction is recorded below. The changed original600 and native120 populations are preserved in source, and I found no other material defect in the reviewed changes. No assertion about actual candidate runtime behavior or performance follows from this review. The specific native proxy counterexample must be confirmed or refuted on the pinned runtime before scoring; I have not executed it.

## SP2 — preserve native rejection of clone-ineligible equal inputs

Priority P1, contract concern requiring a focused native control before scoring. `tests/replay/exactSnapshotPairComparator.ts:38` accepts a newly encountered source solely because it is native-deep-equal to a prior detached candidate. Whole-value equality does not establish that native structuredClone can clone the new source. Consider a plain modern `{ value: 1 }` and a legacy `new Proxy({ value: 1 }, {})`, or plain `{ nested: { value: 1 } }` versus `{ nested: new Proxy({ value: 1 }, {}) }`. Native structuredClone rejects transparent Proxy objects. Native deep comparison is expected to treat their plain prototypes and enumerable values as equal, allowing line 38 to return a cached plain object instead of propagating the native cloning error. The exact pinned Node20/24 deep-comparison result has not been observed in this read-only review and must not be described as a reproduced failure yet.

This is within the source-visible validation boundary: installed `node_modules/civ-engine/dist/json.js:37-43` accepts objects with Object.prototype or null and recursively visits Object.entries; the transparent proxy examples expose that allowed shape. Real World serialization validates before cloning (`dist/world.js:41-42` and `:73-74`), so requiring real validated calls does not itself certify clone eligibility. The current unsupported-value control at `exactSnapshotPairComparator.test.ts:192-197` uses an enumerable function property; that does not compare equal to an earlier successfully cloned plain value and therefore does not exercise this branch. The invalid-transfer control takes the native options bypass and also does not exercise positional reuse.

Pin the whole class in independent native-versus-instrument controls, including root and nested transparent proxies on a first-use cross-source hit and after warm reuse. Establish the real native clone error and candidate behavior rather than accepting an error-shaped substitute or merely observing a boolean. A root-only proxy check would leave nested proxies unaddressed. Preserve the fixed clone/error contract when resolving this; do not silently narrow it to the current600 fixture. This is not a claim that the actual600 worlds currently contain proxies, nor a request for engine, generic serializer or production changes.

The first-use positional case is newly enabled by this change: the unchanged generic per-source serializer must initially invoke native cloning for an unseen source identity (`exactSnapshotSerializer.ts:21-28`). I have not broadened this review into an audit or repair of that generic helper's separate warm-mutation domain.

## SP1 and ownership review

SP1 remains closed in the exact candidate. Helper lines 6-15 copy state, component containers, each unit entry and each unit record before deleting the modern occupation marker/field. Final equality at line 56 compares the normalized modern snapshot to the complete untouched legacy snapshot. The tests' independent native expectation at lines 13-23 has the same one-sided oracle, and lines 118-129 require false for an unexpected legacy marker or legacy unit field.

The comparator returns only a boolean. Its caches, snapshots and normalization results remain lexical locals; its two actual call sites pass real Worlds. It captures the pre-call clone function per pair and restores that exact function in finally at line 62. It captures native isDeepStrictEqual at construction and uses it both for candidate/source guards and the complete final comparison. No fingerprint, hash, field whitelist or dirty count decides equality.

Every clone request advances ordinal before the options/primitive branch (lines 30-34). Position is only a selection hint; both positional reuse and per-source fallback require full native equality (lines 36-40). Returned objects originate in native cloning or earlier detached candidates. The fresh current array becomes previous only after a full successful serialization (lines 46-51), so request order/length changes do not publish partially built positional state. A pair error clears persistent positional candidates and rethrows (lines 59-61). The WeakMap can retain detached values from a partial call, but each later fallback is independently re-guarded; that retention alone does not publish an unfinished snapshot. Options, including an explicitly supplied value, take the captured native function at lines 33-34.

Pure normalization does not edit a cached leaf. The shifted-role and shared-source DTO checks at contract lines 90-115 exercise unit/component/state aliases, including a fixture where unsafe in-place stripping would erase non-unit occupation fields. Both serializations now complete before normalization, so candidate entries remain full detached values during the second serialization. The equality claim is native VALUE equality on the validated plain DTO domain; this is not a graph-bijection or independently returned clone-identity claim.

## Original600 and native120 preservation

I read the full 244-line occupation test and its exact diff against the base. The only executable changes are importing the new helper, constructing its comparator and replacing the former three-line pair equality calculation with one comparator call. The default map, disabled AI owners, selected villager/tree, accepted real gather commands, every600 step on both Worlds, every clock assertion, independent live gather witness, comparison count and final gathering assertion remain unchanged. Source anchors: `resourceWorkerOccupation.test.ts:65-98`; the unchanged live reads are lines 76-78 and gather condition lines 90-92. Adjacent recording, seek, save/load, malformed-format and legacy absent-field bodies have no diff.

The native120 file retains two unstripped generic-versus-native full comparisons on each of120 ticks (lines 31-38): still240. Native snapshots are made outside the generic and paired clone wrappers. After those comparisons, only the independently native modern snapshot is stripped; the complete legacy snapshot remains intact. Lines 39-44 add120 pair-result comparisons against that native expectation and separately require the native pair to be equal. The comparison count remains120, as do the original clone-counter controls. These additions do not replace the original native equivalence population.

The generic serializer and separate700 lifecycle file have no Git diff and retain their supplied exact hashes. The installed engine source outside the diff still constructs the full snapshot, including config, entities, components/options, resources, RNG, state, tags, metadata and poison (`node_modules/civ-engine/dist/world.js:92-106`). The unchanged Vitest config still has the 30000ms test timeout. None of this source inspection establishes a loaded hosted runtime or hosted closure.

## Existing evidence and prospective experiment

The retained native-baseline logs substantiate tests-first assertion RED: expected two object clones to equal one, with one failure and11 passes. The native receipt says exit1 and0.7781921 seconds; the Vitest output reports213ms. This is evidence about the prior native baseline only. I did not run it, and it is not evidence that the guarded candidate passes.

I additionally read the finite workload, recovery script and relevant outer Job Object cleanup source. The finite workload pins owned source swaps, restores known mutant/baseline bytes in finally and refuses unknown live bytes; recovery preserves unknown content instead of overwriting it. It plans three distinct literal mutants: positional guard removal, in-place normalization, and ignoring legacy in final equality. It then plans fixed original600 Node20 A/B/B/A and Node24 A/B, with native exits and complete case results separate from process costs. This is prepared work, not executed evidence.

Launch readiness is not certified by this review. During inspection, the finite workload referenced `candidate-inputs.json`, which was not yet present. The lower-level Job Object wrapper closes its owned job and releases its lock in finally. After the parent identified the actual outer launcher, I read `invoke-candidate-experiment.ps1`: its lines 17-24 explicitly invoke owned-source recovery and the closing input guard outside the killed Job, and its exit handling fails on unsuccessful recovery/guard. That satisfies the promised restoration arrangement in source. Its `candidate-protocol.json` and `candidate-inputs.json` remain preparation inputs that were not finalized in this reviewed target. These are preparation bounds, not extra TypeScript findings. This optional source read is not a new process-containment proof.

## Frozen target and closing audit

All four source hashes matched the opening manifest and an intermediate closing inspection. Root then requested a native120 order correction under its assigned owner; the other three source hashes remain unchanged and the revised native120 is bound below. The initially reviewed target was:

| Path | SHA-256 |
| --- | --- |
| `tests/replay/exactSnapshotPairComparator.ts` | `a54f2378d905146e077499ce681fc03fdb1d7a1b5f76d8a29b7dad1e9c46020d` |
| `tests/replay/exactSnapshotPairComparator.test.ts` | `54ab114a627cc0291d19840f4bb12fdce6c447e158fddeed284a76ed4b9d8569` |
| `tests/replay/resourceWorkerOccupation.test.ts` | `23fa3e8b3ece9b1e10a5bdcd7596d5e6c87102d866eed671b467e7cae06053b8` |
| `tests/replay/exactSnapshotSerializer.test.ts` | `83adae0cc305195ab765a869421b37d4099b6cad23b9d903a499c985eab6ca57` |

Candidate manifest SHA-256: `9250955b5c805d6e299d8b537a7a7db24389b87a446fd4d50f822819620fb4fd`. Protected generic helper: `e3a0d85a749c8afb19053a360539d41e9dfa2eef92330f53e0a1eeeafdbd1e80`. Protected separate700: `0490585ce189b9b29afebb6b424526c7846cb05d9404e5d230fce1da11df2107`. Previous authored preflight review remains unchanged at `aedd4ffc002105356887e8e2eb1c6b4dc0af7172ae6b4c39c1cc712f67352fac`.

Optional launch sources read: finite workload `1489f0096ebf064bb6f335649c0e471d96075a09840eb3f55f29c14987ac9f39`; recovery script `0ecc9561c2e48263af31d348deecfca32021b078cdbd46f6dd5072b5e66675aa`; recovery manifest `5b2885a0324c068c620676fa2fc85cda0483958abffe734d39a00ed01ae28dda`; outer job launcher `f08514d134e45e9585fb6e20aa9d9ec2368d879491897b7d62b5c8a14c2d3d09`; input checker `2375eb859befcce0bbe6de5ac9e0644b6f6a271f5c58b6441909f85c0edd802b`.

Only plain read-only filesystem/Git inspection and this authorized ignored report write occurred. No World construction, test, benchmark, profile, build, browser/server/process launch, network or external model CLI ran. No source, canonical documentation, index, dependency or engine mutation occurred. No task-owned process cleanup is needed. No approval denial occurred. Final correctness/mutation runs, equal-work cost evidence, integrated source review, full gate, main/push and fresh hosted acceptance remain unperformed by this reviewer.

## Focused native120 order correction and remaining native boundaries

Root requested retention of the original generic-then-native order, which the initial native120 revision had reversed while retaining its comparison population. I read the corrected code: `exactSnapshotSerializer.test.ts:35-37` now stores `instrumented = serialize(world)` first, then `native = world.serialize()`, then performs the full unstripped equality. The additional pair check still uses separately native snapshots and preserves the complete legacy operand. Current source SHA-256: `ed2652947f7e1442d160b672782f21625814575169f6f7c7b338831c089e7ca6`. Parent preserved the earlier `83adae0c...` source under `preflight-review-preimages/native120-before-order-repair.test.ts`. This focused source correction has no new finding; no runtime occurred.

The actual outer launcher read above has SHA-256 `72cb3f8c8a05f601538db1e30e18e623e5d2b6a1730295f94b3beb6dd3ef2633`. It supersedes any inference that the lower-level Job wrapper was the entire launch arrangement.

An additional unexecuted native boundary named during coordination is a detached zero-length ArrayBuffer compared with a valid zero-length buffer. Native cloning must reject a detached buffer; this review has not determined whether the pinned native equality throws, returns true or returns false for that pair, nor whether an equality exception has the same native error semantics. Treat it as an explicit native-control question, not a reproduced defect or a claim about the actual600 worlds. ArrayBuffers are outside real World's plain JSON component/state domain but within the synthetic hook's stated transfer/error controls. Root and nested transparent proxies remain the concrete SP2 source concern within the installed validator's accepted shape.

The parent confirmed no candidate runtime or scoring has run. This report is the complete authored source blocker artifact now; a later corrected implementation needs a separately bound focused review. The earlier preparatory review remains unchanged.
<!-- END REPORT 1 24299ce9e58f893038ef66c62460f51fe40f5e9d69090902ae61c1be6243c5cd -->

## Findings and disposition

F0/SP1 stays corrected. F1 (original SP2): native deep equality does not prove clone eligibility; positional reuse can suppress Proxy cloning errors. This round held the unsafe source. Conservative fresh qualification and new native controls are later corrections, not findings that this historical report accepted.

## Verification

Read-only source review; no candidate runtime or cost execution occurred for this reviewed target. Native120 call order was repaired during preparation and the report records its exact closing target. Later actual controls are bound to the subsequent frozen eligible source.

## Round outcome

Historical source HOLD for F1. Preserve its dissent and limits; the later source repair and positive controls do not rewrite this round as a pass.
