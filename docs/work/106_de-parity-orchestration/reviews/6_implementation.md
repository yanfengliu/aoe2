# Review 6: required Windows measurement-cost repair investigation

## Target

Status: investigation complete; later exact source acceptance is recorded in [review 8](8_implementation.md). Integration owner: `/root`. Worker: `/root/game_engine_coverage_adoption`, base `c4024020a09c99f74728f2a880a86fbcbaef8e48`, branch `codex/engine-coverage-adoption-1001`. This round investigates the unchanged 600-tick test's measurement cost and coverage, rather than accepting an integrated revision.

## Reviewers and coverage

Root dispatched an independent read-only pinned CLI investigation from first principles. It inspected the original contract, helper and retained cost evidence without a preferred implementation route. The implementing worker preserved the report and its historical source; it did not independently execute the reviewer process.

## Reports

The integration owner dispatched a fresh read-only first-principles investigation with the fixed original 600-tick contract and retained evidence, without a preferred route. The complete original report is preserved byte-for-byte in [independent-investigation-original.md](../snapshots/06_ci-cost-search/independent-investigation-original.md), SHA-256 `abbc3e0431386169de34b4b99e0b980e16e44a821c4b9468b8c6f1aba4d3e3da`. Execution provenance is retained under ignored `tmp/review-runs/cost-first-principles-1001` in the primary checkout; the owner reports actual exit 0, 504.279 seconds, initialized `gpt-6-astra`/`xhigh`, cleanup proof true and zero owned leftovers. This worker verified the report's copied bytes, not the reviewer process itself.

The original report inspected the experimental interning helper at its historical lines 45–69. That exact 86-line input is recovered in [rejected-intern-helper.ts.txt](../snapshots/06_ci-cost-search/rejected-intern-helper.ts.txt), SHA-256 `7efae125ec0b8e69bd854e1601a53a4ccfe76f446430ff28c3bf67040115157f`. Both final interning measurement files name this digest. The current helper has since changed; the original report's live-file citation is historical navigation, not acceptance of the replacement. Raw profiles and diagnostic measurements remain ignored while the issue is unresolved.

The original frozen wrapper formerly at `reviews/6_ci-cost-investigation.md` is preserved exactly as [review6-wrapper-before-structure.md](../snapshots/06_ci-cost-search/review6-wrapper-before-structure.md), SHA-256 `fdd80522a4669f2afcbaf08cec9fffbd694cc5c5e1a94422a601c9fc57f0fcc2`. This current wrapper is named `reviews/6_implementation.md` to satisfy the repository's supported review-stage contract. Historical manifests naming the original wrapper resolve to that exact snapshot; they do not bind this later wrapper.

## Findings and disposition

The reviewer independently identified repeated Vite imported-export lookup beneath the original native clone-cache comparator. It favored capturing that same native comparator once, preserving the exact guard, final full comparator, validation and synchronous restoration. It rejected a saving claim for interning: Node 20 was approximately flat while Node 24 was slower. The report is an investigation, not final-source approval or hosted acceptance.

The reviewer also found a concrete measurement-bound gap: the native 120-tick control proves prefix instrumentation equivalence, not full carry/deposit. The original 600-tick case had no explicit lifecycle witnesses. The owner authorized read-only tick, gathering, full carry, selected-load clearance and corresponding wood-credit observations on the original input before any fixture or score change.

## Verification

That baseline observation is RED: with the original helper and unchanged input, all 600 full comparisons and actual tick checks complete, but the selected worker first gathers at tick 514 and never reaches a 10-wood full carry within the bound. Node 20 exits 1 on the new full-carry witness after 12,523 ms. Evidence and the original-helper diagnostic are retained under ignored `tmp/work106-snapshot-profile`. No shorter route, easier tree, changed gather rate, larger original equivalence bound or raised permanent timeout follows from this finding. The owner must resolve that coverage defect before the worker claims lifecycle acceptance.

The candidate's separate same-run 600-pair phase measurements are bounded to serialization plus the native final comparator, excluding setup, steps, extra oracle work and digesting. Node 20 improves from 11,585.213 to 10,074.559 ms; Node 24 from 7,462.977 to 6,083.542 ms. Each arm has 8,993,250 requests, 32,008 native clones and 8,961,242 reuses; both versions retain the same full-input digest. The Node 20 doubled diagnostic exits 1 at its unchanged 30-second limit after completing both arms; this is explicitly retained as RED and does not describe the unchanged single-arm acceptance test. Final source/runtime manifests, lifecycle scope resolution, exact independent acceptance, full gate and hosted result remain required.

## Round outcome

The investigation rejected custom interning cost claims and favored native comparator binding without changing equality semantics. Its lifecycle finding led to [review 7's corrected contract](7_plan.md). The quoted pending conditions above describe this original investigation's point in time; [review 8](8_implementation.md) subsequently accepts the frozen source and retained focused/negative evidence. Integrated full gate and hosted Windows timeout closure remain pending. Complete original reports and cited changing inputs are preserved, and no new runtime check ran in this documentation repair.
