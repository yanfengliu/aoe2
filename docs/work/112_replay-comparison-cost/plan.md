# Keep exact replay comparisons within their existing test budget

Status: blocked
Owner: /root
Created: 2026-10-01
Updated: 2026-10-01

## Problem and outcome

Windows CI 36912947277 failed only the original 600-tick full non-cosmetic replay comparison at its unchanged 30000ms timeout. This work tested the fifth remaining measurement-cost route without reducing its comparisons, clocks or independent commanded-tree gathering evidence. The candidate passes bounded correctness but is rejected because complete case cost regresses on both tested runtimes. The hosted Windows failure remains open. Base: aaf59f33e74da2b5113697c71b48d57f2bffecf4.

## Scope

Worker `/root/content_tracker` owns the bounded test instrument and these records in replay-comparison-cost-1001. Root owns integration, acceptance and the runtime reservation. The rejected candidate changes two existing test callers and adds a private comparator with contracts. Generic serializer and the separate 700-tick lifecycle proof remain byte-exact. No production, engine, dependency, timeout, retry, scenario, population, comparison-count, gathering or persistence change occurred. Root-held status documents are excluded.

## Approach

The five-route ledger is exhausted: descriptor equality, narrowed shallow equality and global interning were rejected; native function binding shipped with bounded local improvement but the hosted defect recurred; the private paired comparator now regresses complete test cost. Source review corrected SP1 modern-only normalization and SP2 clone eligibility before candidate execution. Both validated World.serialize calls, complete legacy state and native final equality remain. Every possible reuse receives fresh conservative qualification; first native misses avoid redundant traversal. The comparator is limited to synchronous game Worlds and deterministic DTO fixtures, returns only a boolean and is not a general structuredClone replacement.

## Acceptance criteria

- [x] Preserve all 600 original comparisons/clocks and independent live selected-tree gathering; unchanged 700 lifecycle SHA0490585ce189b9b29afebb6b424526c7846cb05d9404e5d230fce1da11df2107.
- [x] Preserve 240 unstripped comparisons over 120 ticks in original instrumented-before-native order; add 120 independently native-backed pair checks and contracts for changed values, optional fields, signed zero, clone ordinals, non-unit metadata, transfer/errors and restoration.
- [x] Observe tests-first clone-work assertion RED, four literal mutation assertion RED verdicts and exact restored GREEN. Node20 and Node24 each pass four files/27 tests; restored contracts pass 17/17. Mutation coverage has the explicit limits in the finite result and disposition review.
- [x] Complete the fixed equal-work Node20 A/B/B/A and Node24 A/B protocol with pinned inputs and native exits. Each score arm executes exactly one original 600 case and filters seven adjacent cases.
- [ ] Improve complete case cost enough to address the required timeout. This criterion failed: Node 20 baseline 10.471/10.180s versus candidate 19.571/19.565s; Node 24 baseline 6.353s versus candidate 13.019s. The candidate must not ship.
- [ ] Root full verify, final integrated source acceptance, main merge/push and fresh hosted acceptance. These did not run for the rejected candidate; no hosted closure is claimed.
- [x] Prove assigned-before-release, Job query/close and cleanup, exact owned-source recovery, zero remaining native process identities and released lock/port. All 29 input guard receipts checked3115 rows without mismatch.

## Implementation steps

- [x] Read fixed outcome/disqualifiers and historical evidence; reconcile four spent routes before selecting the fifth. Preserve source/package/config and installed inputs.
- [x] Obtain independent first-principles judgment and pinned source reviews; retain SP1/SP2 findings and their repairs separately from actual runtime results.
- [x] Run only the approved lineage smoke, initial baseline TDD and one finite candidate reservation. The finite packet completed native0, but its cost criterion failed.
- [x] Freeze the rejected source and recoverable inputs; retain authored reviews and complete negative results. No sixth route, repeat, timeout change or engine extension is authorized.
- [ ] Root publishes the bounded rejection and decides retention/cleanup. Another automatic repair route requires an explicit human extension of the five-attempt limit.

## Outcome

Fifth candidate rejected on cost; automatic same-reason budget 5/5 spent. Correctness and mutation checks passed within their stated bounds, while complete case time increased about89.5% on Node20 by the two-arm means and104.9% on Node24 by the single pair. This local negative comparison does not identify the hosted timeout's entire cause or close that failure. No full verify, code commit, main merge/push or fresh hosted gate ran for this candidate. [Finite result](snapshots/finite-result.md), [five-route ledger](snapshots/five-route-ledger.md) and [four-source recovery contract](snapshots/rejected-source-inputs.json.txt) retain the evidence and limits. Original reviews remain recoverable by the authored preservation contract. Active ignored evidence is intentionally retained under tmp/replay-comparison-cost-1001/ until root accepts the handoff. The full parity goal, M7 human-extension bound and21 engine feedback scopes remain open.
