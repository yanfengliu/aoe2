# Review 8: plan

## Target

Independent static runtime investigation, base4c6c, current serialized World contracts and retained diagnostic measurements. Its25-row authored inputs.json remains retained beside the original report.

Original authored report: C:\Users\38909\Documents\github\aoe2\tmp\replay-route6-1001\runtime-first-principles\report.md; 20369bytes/SHA256 3df7e52403340242a62279825382684a3b3be79f500367293ca1f51443a75ff2. This is late permanent preservation of an actual earlier round; its original chronology and substantive bytes are unchanged. Reports are embedded once, without citation or content normalization. Cited raw evidence stays ignored while this unresolved handoff remains active.

## Reviewers and coverage

/root/replay_runtime_first_principles; independent read-only lens and actual access are stated in the complete report. Coverage does not transfer to later source or execution.

## Reports

<!-- BEGIN EXACT ORIGINAL AUTHORED REPORT -->
# Independent runtime investigation — full snapshot cost

Frozen 2026-10-02 UTC. Investigator: `/root/replay_runtime_first_principles`. Base: `4c6c9e168b8aad29c5a584692f366a2e73906611`. This report is static investigation, not implementation, fresh timing, a proof that no runtime route exists, or acceptance of the latest Windows failure. The fixed contract was read before investigation. No game runtime, new probe, test, benchmark, profile, build, browser, server, review CLI or source mutation ran. The independent execution investigator's conclusions were not supplied to this investigator before this report froze.

## Finding and remaining gap

The strongest recovered evidence points at the repeated traversal and comparison of complete snapshots rather than game stepping or the remaining native clone calls. It is a historical 600-tick diagnostic, not a profile of the latest hosted 700 test. There is no evidenced fresh runtime saving to hand off. Native clone batching alone is poorly supported by the historical counts and has concrete correctness hazards. A materially different whole-snapshot native binary comparison is underexplored; it has a specific safety and cost discriminator, but I do not recommend spending the sole aggregate route on it before synthesis with the independent execution report.

The exact unresolved runtime gap is whether a complete, freshly certified native binary encoding plus fallback can cost less than the existing final native deep comparison across the entire original 600/700 cases while preserving all fields, own-key presence, signed zero, clone errors, native120 order and real gathering/deposit witnesses. The historical profile supplies a reason to ask that question. It does not supply its answer.

## Latest failure is a different evidence population

The complete hosted log has the 8-case occupation file passing at 33,527 ms at line 486, the 700 lifecycle case failing at 32,738 ms at lines 727–728, and native120 passing at 18,607 ms at line 984. The terminal failure names the lifecycle case at lines 1105–1108. The 600 case's duration cannot be recovered from the occupation file total. The log does not show CPU attribution, phase timing, validation counts, cache counts or foreign contention. This report makes no causal inference from those omissions. See [complete Windows log](../job-110619454097.log) and [actual CI receipt](../latest-ci-receipt.json).

## What the installed runtime actually does

The worktree's `node_modules/civ-engine` is a junction into the real sibling installation. Its package says 2.5.0. I read actual imported `dist/world.js`, `dist/json.js`, `dist/world-tick.js`, `dist/component-store.js` and `dist/map-gen.js`; the input manifest binds their bytes. I did not edit the installation or infer it from a remembered engine API.

`World.serialize` at installed `dist/world.js:33–105` loops through every component store and every row. It invokes `assertJsonCompatible` on each source value, then `structuredClone`, then constructs a fresh `[entity,data]` pair and component arrays. It independently validates and clones every state value. It also creates config, componentOptions, entities, resources, RNG, tags, metadata and poison fields. Thus every full serialization repeats validation, clone/cache handling, row construction and outer-object allocation. Both worlds retain those calls under the fixed contract.

`assertJsonCompatible` at installed `dist/json.js:2–54` creates a WeakSet and walks every array element or enumerable string-key object child. It checks finite numbers, rejects undefined/functions/symbol values and active cycles, and requires ordinary/null prototypes for object nodes. It constructs paths throughout the walk. Its validation is not a native-clone eligibility certificate: it reads enumerable getters, ignores own symbols, and can admit a transparent Proxy. Those distinctions matter if a future instrument claims clone eligibility or plain output without fresh proof.

Each 60 × 36 map contains 2,160 tile entities. Installed `map-gen.js:1–21` puts a position component on each tile. Product `scenarioSeedOps.ts:220–240` puts a terrain and renderable component on each tile. Both original inputs consequently serialize at least 6,480 tile-component values per world per tick. This count follows from construction, not a changed instrument's own counter. The original woodline fixture at `fixtures/economyBasics/woodlineClearing.ts:18–50` retains the same dimensions even though it has only one villager, two Town Centers and two trees. A one-worker fixture is therefore still a large full-world serialization input. Removing tiles, renderable values, their validation or their comparisons would remove required work.

Current `exactSnapshotSerializer.ts:11–31` maintains one WeakMap keyed by source object identity, checks the entire source against its detached previous clone with bound native `isDeepStrictEqual`, and reuses only an equal cached clone. It scopes the global structuredClone replacement to synchronous serialization and restores it in finally. Modern occupation deletion edits returned cached unit clones; the next guard sees that mismatch and reclones. This report does not treat that invalidation as evidence of a defect: it preserves detached caller edits. Cold values, changed sources and newly allocated state values still clone natively.

Simulation stepping also repeats full state fingerprinting: installed `world-tick.js` records every state value before the tick in `clearStateDirty` and revisits unchanged keys in `getStateDirty`. `component-store.js` uses a touched-row incremental baseline for semantic component diff mode, rather than scanning every component. That source distinction blocks the casual inference that stepping scans the same 6,480 immutable tile records as serialization. The maintained `aiTickAb` and selfplay profiler answer stepping questions; neither isolates these full snapshot loops.

## Recovered raw historical measurements and their limits

The raw directory survives at `C:/Users/38909/Documents/github/aoe2-worktrees/engine-coverage-adoption-1001/tmp/work106-snapshot-profile/`. I read the actual `transport-v20.20.2.json`, `transport-v24.12.0.json`, `serializerTransportMeasure.test.ts`, `measurement-v20.20.2.json`, `final-intern-v20.20.2.json`, `transport-v20-profile-analysis.json`, its analyzer, and ordinary recovered focused output. The manifest binds the raw CPU profile, but I did not execute a new profile or rerun its analyzer.

| Retained 600 diagnostic observation | Node20.20.2 | Node24.12.0 |
| --- | ---: | ---: |
| Original complete clone requests per arm | 8,993,250 | 8,993,250 |
| Native clones | 32,008 | 32,008 |
| Exact-guard reuses | 8,961,242 | 8,961,242 |
| Bound-helper serialization phase | 6,658.676 ms | 4,616.671 ms |
| Final native deep comparison phase | 3,415.883 ms | 1,466.871 ms |
| Real stepping phase, both worlds | 968.930 ms | 747.247 ms |
| Entire doubled diagnostic loop wall | 32,077.228 ms | 19,782.043 ms |

The native clone fraction is 32,008 / 8,993,250 = 0.356%. The requests average 7,494.375 per world serialization; the source-derived 6,480 tile-component lower bound explains most of that scale. The ordinary recovered Node20 run separately reports the original600 case at 10,375 ms, the700 case at 9,384 ms, and native120 at 5,691 ms, with actual gathering/full/deposit witnesses 26/260/273 for each lifecycle world. These historical ordinary results preserve a successful baseline; they neither reproduce nor close hosted timing.

The diagnostic alternates two serializer arms on the same two stepped worlds. It adds two extra cross-arm full comparisons and full JSON digesting per tick. Its phase sums exclude setup, these extra comparisons and digesting. Its Node20 command timed out despite completing loop assertions; it is not green. Its CPU field includes process threads and does not isolate each arm or the final comparer. Foreign load cannot be assumed absent from this artifact.

The retained profile analysis's top self samples include multiple `node:internal/util/comparisons` keyCheck, innerDeepEqual and objEquiv frames, alongside the wrapper, GC and validator visit frames. These are different call-tree nodes and cannot simply be attributed to the final comparer. The diagnostic deliberately performs cache guards, final comparisons and extra cross-arm comparisons. The profile does support comparison traversal as a mechanism family worth scrutinizing; it does not prove which fraction of the latest 700 hosted timeout belongs to it.

The earlier raw120 native serialization is 3,036.692 ms versus 1,512.749 ms for the original cached helper on the same 1,798,530 requests. A cache-free serializer is not an evidenced improvement. The raw global interning arm cuts its final comparison phase from 656.017 to 246.668 ms while increasing serialization from 1,330.293 to 1,684.049 ms; whole scored phases improve only 2.8% on Node20 and regress on Node24. That outcome constrains a claim that making equality cheaper necessarily improves the whole case. The spent qualified paired comparator's complete-case regression remains binding historical evidence, rather than an impossibility theorem about every comparison representation.

## Different families examined

**Batch remaining native structuredClone calls.** This attacks calls the cache already removed in 99.644% of the retained diagnostic requests. The residual clone count is not a duration bound: newly allocated large state objects may be expensive. There is no per-type clone-size/cost artifact for latest700 to prove that opportunity. More seriously, replacing separate clone calls with one clone of an array of sources preserves shared references across requests where the original separate calls detach independently. A concrete counterexample is two clone requests whose input objects share a child: editing one returned snapshot field could then edit the other. Delaying the actual clone until World.serialize returns can also change captured values and error chronology when a later getter mutates an earlier source. Fixing these hazards requires fresh qualification/copying, whose cost is unknown. No batch implementation is proposed.

**Replace the clone backend with JSON, V8 deserialize/serialize, or a handwritten copier.** JSON conflates 0/-0 and missing/undefined values; raw current coverage explicitly guards signed zero and deletion. V8 cloning broadly follows structured clone but an unrestricted substitute changes exotic/native error and transfer behavior. A safe handwritten/native-binary clone needs a freshly qualified domain or a fallback before it changes read/error behavior. Cold-only qualification might be cheaper than the previous all-request qualifier, but only 32,008 historical requests remain to improve and its complete benefit is unmeasured. None is accepted or measured.

**Freeze live values or trust dirty/version state.** Freezing live component objects can change simulation writes. A dirty bit or source identity cannot prove the complete source still matches the previous snapshot when in-place or unmarked mutation occurs. Both conflict with the fixed requirements unless accompanied by complete proof of all values on every tick; that added work leaves an unresolved cost problem. The source does not provide a presently authorized immutable-value contract for every required field.

**Fuse validation and equality.** Installed validation reads all ordinary object entries before the clone wrapper compares them again. Harvesting those reads is a different pass-fusion construction, but an Object.entries monkeypatch would affect an unrelated global boundary and getters/proxies can alter read semantics. Changing engine validation to produce a clone/equality certificate is outside this assignment. This is an engine API opportunity, not an available candidate here.

**Use complete native binary encoding as a sufficient-equality fast path.** This is the strongest underexplored construction in this lens. Keep the original serializer and native120 unchanged. Encode the two complete normalized snapshots freshly with `node:v8.serialize`, then compare their full Buffer contents. If encodings differ, use the original native full equality. Do not use hashes, canonical-JSON assumptions, shared clones, an interning pool or cached byte strings. The Node documentation describes structured-clone-compatible serialization and explicitly warns that equal JS values can encode differently; therefore unequal buffers must never directly mean unequal snapshots. [Official Node20 API documentation](https://nodejs.org/download/release/v20.18.1/docs/api/v8.html#serialization-api) supports the API family, not performance on the pinned20.20.2 binary. Attempts to fetch the exact20.20.2 source/docs through the web tool failed and are not a verification claim.

This changes representation and moves traversal into the standard native serializer, rather than replacing the guard with another JavaScript field comparator or reusing values across worlds. It targets the historical final comparison's 3.416 s on Node20, with no savings yet established. It can be slower after fresh certification and buffer allocation, and it does nothing to the cached serializer's 6.659 s. Source inspection alone does not justify spending the candidate budget.

## Binary-route proof obligations before any scoring

Equal encodings are only sufficient when encoding retains every distinction native deep equality observes. Prototype identity and enumerable symbol keys are immediate counterexamples outside a certified ordinary-data domain: `Object.create(null)` and an ordinary object with identical fields can encode the same yet native strict equality distinguishes them; objects differing only in an enumerable symbol key may encode the same. An accessor can change on read. A Proxy can reject cloning. Buffer subclasses, array extra properties/holes and opaque objects need explicit treatment. V8 buffer allocation can fail where native comparison would return a boolean. No broad catch may turn an error into true or conceal an original World.serialize error.

A fresh safe-domain check must reject or native-fallback every unsupported distinction, without reading an accessor to qualify it and without retaining a stale certificate across mutation. Current engine validation alone is insufficient. A claimed native-output provenance certificate must prove every outer engine field and every cloned/cache-returned graph is ordinary data, including componentOptions, metadata, array extra keys and future caller edits; merely citing WorldSnapshot's TypeScript type is not such proof. The all-graph qualification cost must be included. There is no completed certificate or implementation in this handoff.

Independent expectations should come from native structuredClone/native World.serialize and bound `isDeepStrictEqual`, rather than the encoder/qualifier under test. Positive and false cases must independently change each root field/domain, nested state and every component record kind, remove optional keys, add keys, change -0/0, preserve unusual Unicode strings and embedded nulls, distinguish sparse arrays and extra keys, exercise symbol/prototype/accessor/Proxy fallback, and exercise detached returned edits across snapshots/worlds. Key order or graph alias layout differences that native equality accepts must reach native fallback and remain true. Native clone transfer/errors and finally restoration remain the original helper's responsibility and must remain tested. New comparison tests must show the one-world mutations are false, even when clocks and lifecycle predicates still match.

## Finite discriminator if synthesis selects this family

Root must accept the exact candidate construction, changed paths and domain proof before any source/runtime. Proposed product scope is no product change. Candidate source scope is one new test-only comparison helper plus independent contract tests, and only the final comparison call sites in the original600 and700 tests. Preserve the original serializer, native120 body/order, every phase predicate and cosmetic assertion, all 600/700 steps/serializations/comparisons and all adjacent checks. A private paired API or a source certificate is not preapproved by this report.

The first authorized discriminator should be independently reviewed safety controls and a complete-case comparison, not a synthetic per-record speed loop. Suggested finite scoring is Node20 ABBA and Node24 AB, each arm running all three original files with the same loader/pool/reporting and no title filter. Record the individual original600,700 and120 case durations, command wall, process CPU and child bound, foreign load, input/install/binary digests and exact counts. Example native command form is `<pinned node> node_modules/vitest/vitest.mjs run tests/replay/resourceWorkerOccupation.test.ts tests/replay/resourceWorkerOccupationLifecycle.test.ts tests/replay/exactSnapshotSerializer.test.ts --pool=threads --poolOptions.threads.singleThread --reporter=verbose`. This is a proposal, not an executed command or finalized protocol.

Precommit one finite safety/TDD packet, meaningful literal wrong-field/signed-zero/unsafe-domain mutants, and the six whole-case scored commands. Do not add an alternative after flat/unsafe results. A first authorized whole matched pair that exposes a material regression should stop according to the precommitted rule. Based on historical ordinary three-file Node20 command time around31s, six score commands alone are roughly186s of local wall; safety controls, mutations, restoration and cleanup make an estimated300–600s bounded packet plausible. Latest hosted contention can invalidate this estimate; root must set actual Job and per-command bounds. Full local verify, independent integrated review and new hosted Windows/Linux/browser/corpus are additional required costs and remain entirely unrun here.

If this family is not selected, its exact remaining gap and counterexamples are retained without spending an implementation attempt. Neither a cold clone microbenchmark nor the historical comparison phase proves complete-case/hosted improvement. Whole-suite savings and concurrency belong to the separate execution investigator's evidence and root's synthesis.

## Provenance, work and cleanup

[inputs.json](inputs.json) binds 25 actual source/evidence artifacts. The current helper and all three original test bytes match the pinned preparation; installed World and JSON hashes also match that preparation. The raw Node20 transport JSON is `fa53f1dd03ef319299f4922354b11594c5fada1c2f3f334385f3dec68812dbfe`; the referenced raw CPU profile is `a20c43a5f3d1b8afc0bc0d43d6e91b49da5bcded48cebe964ca5b04b293537b3`. No raw evidence was rescored or overwritten. The report's historical profile interpretations are explicitly bounded above.

Through manifest creation this investigator issued25 shell-tool calls for static reads/controller/authoring, two web calls, one clock read and collaboration updates. One initial controller call failed on Git ownership; the exact elevated create then succeeded and the new branch alone was renamed to `codex/runtime-first-principles-route6-1001`. No broad Git config changed. Multiple read commands had truncated outputs or wrong path guesses; none is counted as a read of omitted bytes, a runtime failure, or proof of source absence. The material cited source/test/artifact reads were then made directly. No costly slot was acquired. Exact total investigation wall/CPU before dispatch is unavailable; the frozen report records the static work instead of claiming zero orchestration cost. Shell authoring/cleanup after this freeze belongs to this same investigation and is recorded in the closing receipt.

The read-only worktree has no source/index changes. It is removed through the sanctioned junction-safe controller before final handoff; the closing receipt records the actual result. Only the intentionally retained ignored report/manifest/receipt remain under primary `tmp/replay-route6-1001/runtime-first-principles/`. No owned game/browser/server/GUI process was launched. Root owns synthesis, source selection, final integration and the sole additional aggregate route.

<!-- END EXACT ORIGINAL AUTHORED REPORT -->

## Findings and disposition

The binary-encoding family and its independent false-case proof obligations were retained but not selected or implemented. The report does not establish a fresh runtime saving or authorize its proposed commands.

## Verification

Static source, historical artifacts and bounded documentation lookup only. No fresh measurement or product/source mutation.

## Round outcome

Historical independent runtime investigation complete. The unselected family spent no implementation route.
