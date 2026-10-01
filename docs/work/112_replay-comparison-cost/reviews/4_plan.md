# Round 4 — Late preservation of the earlier first-principles judgment

## Target

This is explicit late preservation of an earlier source/evidence judgment on base aaf59f33e74da2b5113697c71b48d57f2bffecf4. Its original target is the fixed contract SHA6b853dd0cdead24466d7aa60ed76daf15be876098f6a5868e024a5a88269ad8d and the four then-existing inputs identified in the complete report. It occurred before the source reviews in rounds0–2 and the completed experiment in round3. The next publication number preserves that chronology rather than inventing a new review or repair route. Historical uncommitted source/protocol preimages remain in intentionally retained ignored evidence; the four final rejected sources have the separate promoted recovery contract.

## Reviewers and coverage

Independent investigator /root/content_tracker/snapshot_cost_first_principles provided read-only first-principles source and evidence judgment under inherited configuration. This was not the assigned fleet-pinned acceptance reviewer. No runtime saving, final source acceptance or hosted repair was established by that investigation.

## Reports

Complete actual original: C:/Users/38909/Documents/github/aoe2/tmp/replay-measurement-recurrence-1001/independent-readonly/snapshot-first-principles.md, SHA467eb42d40ab1c00e25ede8d476d9e6a75cecc27a090a38b509448674c2a5d02, 15701 bytes, LF-only. Exact original bytes are recoverable from [the authored review input](../snapshots/review-originals.json.txt), appended round4. The display changes CRLF to LF only; this original has no CRLF, so the body is byte-identical. No substantive text, finding, verdict or reason is summarized or rewritten. Full body SHA467eb42d40ab1c00e25ede8d476d9e6a75cecc27a090a38b509448674c2a5d02, 15701 bytes and 67 LF bytes.

<!-- BEGIN REPORT 4 467eb42d40ab1c00e25ede8d476d9e6a75cecc27a090a38b509448674c2a5d02 -->
# Independent source and evidence judgment — 2026-10-01

Owner: `/root/content_tracker/snapshot_cost_first_principles`. Parent owner: `/root/content_tracker`; root owns runtime reservation, code, acceptance and shipping. Base: `aaf59f33e74da2b5113697c71b48d57f2bffecf4`. This is a read-only outcome, not final source acceptance or a measured repair.

## Decision

Do not introduce cross-world mutable sharing into the existing generic `createExactSnapshotSerializer` API. A native value comparison can establish equal values at serialization time, but sharing its detached result between two independently returned snapshots allows a later caller edit to alter both operands. That can make the final equality oracle falsely green. Independent worlds alone do not prevent this: they can acquire the same detached object through the instrument.

The strongest bounded variation worth considering for the one remaining attempt is a PRIVATE SYNCHRONOUS PAIRED COMPARATOR for the original 600-prefix only. It owns both complete engine serializations, the exact existing cosmetic deletion, and the final native full-snapshot comparison in one call. Shared detached candidates never escape this call or its private caches. Its public result is a boolean; no callback receives an instrumented snapshot. Keep the current generic serializer implementation and native mutation/transfer/error controls unchanged. Keep the separate 700 lifecycle SOURCE unchanged. This proposal requires independent acceptance of the instrumentation boundary before scoring; no runtime saving is established here.

Positional candidate reuse is a subbranch of structural reuse, not a newly discovered independent mechanism family. Its concrete difference from rejected global interning is removal of JSON fingerprints, pool classification and pool search. The ownership change makes sharing internal to one comparison, instead of an observable property of independently returned mutable snapshots. If that privacy boundary cannot be maintained without weakening the fixed checks, reject this route rather than exposing shared results.

## Fixed facts and instrument limits

The four existing test/helper files and fixed contract hash match the supplied manifest. The fixed contract SHA-256 is `6b853dd0cdead24466d7aa60ed76daf15be876098f6a5868e024a5a88269ad8d`. The supplied current Windows log hash also matches: `ce7d25f276f6c6f811b40a55c365f5b32c8251dfbbbe3646665b708b401f9b8c`.

The actual hosted log reports Node 20.20.2 acquisition (line 148), original600 case 30,026 ms against 30,000 ms (lines 487–491), file total 38,401 ms, and the independent700 case 29,011 ms (line 738). Its final verdict is one failed file, 566 passed and one skipped; 4,376 passed cases, one failed and four skipped; elapsed 1,812.00 s (lines 1110–1126). The 26 ms overshoot describes this run, not a portable safety margin. The log alone does not separate validation, stepping, cloning, final comparison or contention.

Current `exactSnapshotSerializer.ts` is 33 lines. It captures native `isDeepStrictEqual` once, guards a per-source WeakMap clone with full native equality, forwards options/primitives to the captured clone function, and restores the global in `finally`. The original600 still steps both worlds on every tick, serializes modern, deletes only the occupation format, serializes legacy, and performs final native full equality. Native120 compares each world's instrumented result to native `World.serialize` at every tick: 240 unstripped comparisons. Independent700 remains an additional lifecycle input and cannot be scored as a historical speedup.

Installed engine `dist/world.js` still invokes validation before every component/state clone, constructs complete component entries and snapshot containers, and includes config, entities, options, resources, RNG, state, tags, metadata and poison. `src/json.ts` validates recursively on each call. These reads support a repeated-work mechanism; they do not prove the loaded hosted runtime is byte-identical to this sibling. No engine change is proposed.

Retained work106 evidence establishes four substantive routes: descriptor equality rejected (5,552.684 vs 1,512.750 ms), narrowed shallow equality rejected (2,281.927 vs 1,400.097 ms), global interning rejected (Node20 approximately flat, Node24 slower), and native import binding shipped but hosted closure subsequently failed. Descriptor/shallow source variants are not recoverable in that handoff, so their numbers do not bind exact algorithms. The interning source and current binding source are recoverable. The binding's prior same-run600 phase totals improve from 11,585.213 to 10,074.559 ms on Node20 and 7,462.977 to 6,083.542 ms on Node24; those totals explicitly exclude setup, steps, extra cross comparisons and digesting. The doubled Node20 diagnostic was RED despite finishing its assertions. Profile summaries show comparison internals remain prominent after imported-export lookup disappeared; they mix both measured arms and are not the current hosted profile.

## Mechanism families from first principles

| Family | Surviving work it targets | Evidence and decision |
|---|---|---|
| Native runtime access/transport | Repeated module proxy lookup or wrapper dispatch | Native function binding already addresses the source-backed export lookup. Capturing the final comparator adds only 600 avoided lookups versus roughly 9 million clone requests; no evidence supports spending the fifth attempt there. Native call batching would alter per-call alias/transfer/error behavior and is unproved. |
| Equality algorithm | Traversal cost per exact source guard and final comparison | Descriptor and shallow alternatives have adverse recorded costs. A canonical encoding must retain deletions, key presence, signed zero, array distinctions and native clone errors; ordinary JSON is disqualified. No source-backed native exact canonical encoding is established by this investigation. |
| Structural correspondence/reuse | Repeated leaf traversals in the final full comparator | Prior global fingerprint/pool interning relocated cost. A single guarded positional candidate removes that lookup machinery. Private paired ownership prevents the new cross-return edit hole. This is a bounded new subbranch, with unmeasured cost and explicit proof obligations below. |
| Validation/materialization | Engine JSON validation and complete snapshot construction | These remain on every hit. Avoiding them would bypass the required validated `World.serialize` or require forbidden engine/product changes. Blocked in the assigned scope, not proven impossible in general. |
| Scheduling/environment | Full-suite worker contention | `vitest.config.ts` uses threads at 50% cores, and hosted summed test time exceeds wall time. Exclusive scheduling may change elapsed time but does not reduce this test's own work; it is outside this test-instrument proposal and cannot be sold as a computation saving. The actual contention contribution is unmeasured. |

## Exact bounded construction

Add a separate private paired comparator rather than changing the existing default serializer. In each pair call, serialize modern fully, delete only `aoe2.resourceOccupationVersion` and `unit.resourceOccupation`, serialize legacy fully, and run the same captured native `isDeepStrictEqual` on the two COMPLETE snapshots. Preserve all600 steps, clock checks, equality decisions, comparison count and the independent live selected-worker gather witness in the original case. No simulation step occurs while the clone wrapper is installed.

The private serializer may retain one candidate per clone-call ordinal from the previous SUCCESSFULLY COMPLETED serialization, plus the original per-source guarded cache as a fallback. For every clone request, advance the ordinal, including options/primitive requests. An object candidate is selected by ordinal but accepted ONLY after native whole-value equality against the current source. On a candidate miss, use the original fully guarded source cache; on its miss, invoke native cloning. Record the actual returned result in a fresh current-call array. Publish that array only after `world.serialize()` succeeds; truncate it to the actual request length. Never consume a partially built array after an exception.

The ordinal is a candidate-selection hint, never evidence of equality. Added/deleted state slots, different registration order, extra modern scalars, entity changes or fewer requests may cause misses. Even a candidate from the wrong slot is safe only because full native equality succeeded; snapshot key names, entity IDs, row order and all outer structure are still generated by the real engine and checked by the final native comparator.

Most unchanged component values could then use the same private detached object in both snapshots. The source guard traversals still happen, while final native equality can stop at identical leaf references. On misses, the proposal adds a comparison and may be slower. The entire fixed case, not that favorable phase, must determine its score.

## Falsifiable correctness obligations

1. **Output ownership:** no shared candidate, instrumented snapshot or callback exposing it escapes the paired comparator. Do not replace the existing generic serializer with this API. A direct cross-return alias test must reject the exposed variant: serialize independently equal sources A/B, edit A's detached leaf AFTER both returns, and confirm B's detached leaf and both live sources are unchanged. A shared exposed leaf fails by construction; this is the reason for the private boundary, not a passing requirement to omit.
2. **Source detachment and independent worlds:** every stored object originates from native cloning or an already detached guarded candidate, never a live source. A modern-only non-cosmetic nested mutation must make pair equality false with legacy held fixed, both on cold start and after reuse. Mirror it on legacy. Equal worlds must not become equal merely because their original sources alias through instrument state.
3. **Deletion, optional presence and signed zero:** test nested changes, array changes, adding/deleting own optional keys, `null` versus absent, and `-0` versus `+0` against independently native-cloned operands. The native guard and final comparator must both remain native. No JSON fingerprint or per-value hash may decide equality.
4. **Order/length changes:** warm candidates, change source iteration order, add/delete an earlier clone request, insert a primitive request, shorten and then lengthen a sequence, and change one value at a shifted ordinal. Compare to independent native snapshots. The deliberately stale-position mutant must go RED on a changed value; exact guarded shift tests must pass. Candidate arrays commit only on success.
5. **Native options/transfer/errors:** any options argument forwards directly to the captured native clone, retaining transfer detachment, unsupported-transfer/clone errors and return behavior. Errors in either serialization or the comparator propagate. Each wrapper restores the exact pre-call `globalThis.structuredClone` in `finally`, including a failure midway through the second world. No errored serialization becomes the next correspondence baseline.
6. **Reference topology:** a native deep value comparison is not a certificate that two graphs have the same alias relationships. The candidate code has no graph-bijection proof. For example, compare the predicted Node behavior for `{a: shared, b: shared}` against `{a: copy1, b: copy2}` where all three leaves have the same value; then separately assert the native clone preserves each input's `a === b` relationship. I did not run this pinned-binary control or read embedded Node comparator source, so its exact Node20/24 result remains an explicit runtime obligation. The generic helper must not acquire new topology claims from this proposal. Private paired comparison is bounded to the same native VALUE oracle as the original600; if acceptance additionally requires cross-output clone identity or alias topology, positional sharing is blocked rather than exact.
7. **No hidden population loss:** inspect full engine snapshot key/entity/field counts and actual clone-request population against the frozen control. Retain native120's 240 unstripped comparisons and all original adjacent recording, seek, save/load and malformed-format bodies. The additional700 source hash must remain `0490585ce189b9b29afebb6b424526c7846cb05d9404e5d230fce1da11df2107`. Run the literal stale-guard and unequal-world controls; a counter equality is provenance, not whole-state proof.

## Score and stopping boundary

Before the fifth substantive implementation, root must accept the changed instrumentation ownership contract independently. Record it as the fifth attempt in the existing same-reason ledger; do not reset the budget. Preserve original/current source and runtime manifests. Root should use the maintained existing serialization/native-equality instrument in the actual Vitest loader, compare equal pinned work in both Node20/24 arms, and score complete original600 case CPU/elapsed cost plus its unchanged assertions. Phase savings and cross-clone reuse counters alone do not qualify. Native focused controls, integrated literal `npm run verify`, exact final source review and fresh hosted Windows/Linux/browser/corpus verdicts remain required. A rejected/flat/unsafe fifth attempt ends with the surviving exact evidence and gap, not an unrecorded sixth mechanism.

## Provenance and actual tool boundary

Read: actual AGENTS.md/local rules, lessons/devlog/architecture excerpts, hard-problem skill and fleet playbook, fixed manifest, all four pinned sources, current Windows log, engine serialization/validation source, scenario seed/type shapes, Vitest config, retained work106 reviews6/7 and original investigation, prior search contract/final handoff/profile summaries/measurement source. Broad directory listings and long document reads returned OUTPUT TRUNCATION, not a denial; I used focused follow-up reads for the mechanism evidence. I did not inspect every unrelated architecture paragraph or every raw profile sample.

Parent expressly authorized plain read-only PowerShell filesystem/Git inspection after I asked about the no-CLI boundary. Actual tool denials: NONE. I ran only filesystem reads/searches/hash reads, tool metadata discovery and this authorized ignored authored handoff write. No World construction, simulation, test, benchmark, profile, build, browser, network request, external reviewer/model CLI, Git command or mutation, dependency change, canonical write, process or server launch occurred. No task-owned GUI/browser/process cleanup was needed.

Additional inspected digests: prior `search-contract.md` `73ed60c247f51d78bb6ae718c6a1a748f86c531f7689b197f642c210e5c6d48f`; prior `ci-cost-final-handoff.md` `2929d33a6a3368be2a7e19ec65f0115d8500384a0e169fc46c11e755812d4e03`; transport Node20 profile summary `28f2b7635dc2a2e109f378057501d80be0c040e64cd2d7cd253b0dd45101f6bf`; Node24 profile summary `eab9568b8452714a020ad35f9fbd3e6fa85d646441b454248136fa3bc2c45c8e`; inspected sibling `dist/world.js` `0d0d9decd305bdecbfb0b66c881afa973d29340dcfa84ca1a03ca6ee8d05d086`; `src/json.ts` `7cdfc551d3e59bf981f940f80f2a436c2d74056a9ce6e16566be0f877b0fc588`.

The exact remaining gap is whether this PRIVATE paired reuse construction can satisfy the stated native-value and ownership controls while materially reducing the complete unchanged600 measurement on pinned Node20/24, and then avoid the actual hosted Windows timeout. Read-only evidence does not establish that result.
<!-- END REPORT 4 467eb42d40ab1c00e25ede8d476d9e6a75cecc27a090a38b509448674c2a5d02 -->

## Findings and disposition

The report rejected mutable cross-return sharing and proposed a conditional private ownership boundary for the remaining fifth route. Later SP1/SP2 reviews, corrected controls and the measured COST REJECT remain separately attributed in rounds0–3. This late preservation neither overrides those results nor grants another attempt.

## Verification

Owner verified the actual15701-byte source SHA, full retained body identity and decoding of the appended recovery row. The original four recovery rows and all rounds0–3 targets/bodies remain byte-exact. No test, benchmark, runtime, network, index or gate was run for this preservation.

## Round outcome

Earlier read-only judgment preserved completely after the fifth route was rejected. Budget5/5 and the hosted timeout remain open; publication and staged integration acceptance are separate pending work.
