# Report complete replay comparison coverage

Status: active
Owner: Codex orchestrator (/root), implementation worker /root/game_engine_coverage_adoption
Created: 2026-10-01
Updated: 2026-10-01

## Problem and outcome

The developer ledger currently calls a checked prefix successful when the recording has an unchecked tail. Its adapter checks engine `ok`, positive checked segments and zero skipped segments but loses the new engine comparison-coverage result. Report honest comparison bounds in JSON and Markdown. Engine `ok` remains a divergence verdict, not evidence that every interval was compared.

## Scope

Base is game `c4024020a09c99f74728f2a880a86fbcbaef8e48`, version `0.3.242`. The isolated worker branch is `codex/engine-coverage-adoption-1001`. Engine `eb61e448789a95ef907ae6f6e28e2dd33ae4c8a8` publishes core `2.5.0`; the worker independently loaded `ENGINE_VERSION=2.5.0` through its existing dependency junction. Root owns published-runtime verification, the linked-engine lock metadata and final integration.

Limit changes to the playtest evidence adapter/helper, ledger formatting, the script's adjacent no-payload bypass, focused tests and this developer reporting contract in spec §15.7. Preserve developer ledger schema version 1 with optional additive coverage metadata. Do not change world, save or bundle formats, gameplay, the playtest model policy, dependencies, other work units or siblings. Playtest tools report only; they never generate or apply fixes or touch Git.

The main session-start gate changed from running to RED: CI `36815167314` timed out the workforce test's 600 full non-cosmetic comparisons at its unchanged 30-second limit. All Linux/browser jobs and deterministic corpus passed. Root assigned that required priority repair before this adapter work. The repair belongs to [work 106](../106_de-parity-orchestration/plan.md), with test-only snapshot measurement, all 600 comparison ticks and the full comparator retained. Coverage production changes have not started.

## Approach

Require engine `ok`, at least one checked segment, zero skipped segments and `coverage.complete` before declaring strong evidence. Preserve the horizon, checked and uncovered ranges/reasons, enabled checks and actual state-comparison endpoints in detached additive metadata. Completeness is relative to the checks selected by the engine; the report must state those checks and must not describe state as compared at every tick. The script uses all default checks.

Remove the script's no-payload bypass so current engine results carry `no_payloads` coverage instead of losing the bound. Older consumer-created results and old ledger data without coverage stay readable and are reported as coverage unknown / DID NOT RUN. Normalize legacy evidence before routing findings so missing coverage cannot silently retain a verified/eligible classification. Errors name the affected recording bound and the comparison or recording action needed to establish evidence.

The priority CI repair first profiles the existing test and consults its retained 120-tick native-versus-cached instrument. Equal-work before/after measurements retain actual runtime/version, all comparison ticks, request/clone/reuse counters and independent native results. Descriptor and shallow equality candidates increased cost; interning was flat on Node 20 and slower on Node 24. All three were rejected. Capturing the original native comparator once removes Vitest imported-export lookup and reduces the measured 600-pair serialization-plus-final-comparison phase from 11,585.213 to 10,074.559 ms on Node 20 and 7,462.977 to 6,083.542 ms on Node 24. Those phase totals exclude setup, steps, extra oracle work and digesting. The doubled Node 20 diagnostic completed both arms but exited RED at 32.077 seconds against its unchanged 30-second limit. Separate unchanged single-600 and native-120 focused tests passed on both versions; neither result closes hosted CI.

Fresh independent investigation required explicit lifecycle witnesses on the original input. That baseline is RED: the selected worker first gathers at tick 514 and does not reach full carry within 600 ticks; the deposit assertion did not run after the full-carry failure. Root accepted the independent contract in work 106 review 7: retain the original default-map input and all 600 full comparisons with a truthful prefix/real-gather claim, then add a separate 700-tick modern/legacy proof on the unchanged existing woodline-clearing fixture. The native-120 control proves 240 unstripped full snapshot comparisons over a prefix; it proves no full-carry/deposit lifecycle. No fixture, rate, route, original comparison count or permanent timeout changed. Complete original reports, input manifests and changing reviewed source bytes remain recoverable in reviews 6/7 and their unique snapshots.

The recovered final sources passed all ten focused cases on Node 20.20.2 and Node 24.12.0 with engine 2.5.0 on 2026-10-01. Both worlds gather at tick 26, reach ten wood at 260 and deposit at 273 with exact stockpile and resources-gathered score credit ten. All 700 native full-state comparisons and clock checks execute. Economy-stopped, combined-credit-suppressed and score-only-suppressed controls fail; the exact cache-guard disconnect also fails. Runtime/input manifests remain equal before/after each final run. The added fixture has its own cost bound and is not a historical speedup. A task-owned write-tool error temporarily emptied four owned sources; the failed check was DID NOT RUN. Exact hash-bound recovery, null/empty write-guard RED/GREEN, original adjacent-body proof, typecheck and scoped lint preceded the final passing runs. [Work106 review 8](../106_de-parity-orchestration/reviews/8_implementation.md) accepts frozen source and retained controls; root's integrated full gate and hosted timeout closure remain pending.

## Acceptance criteria

- [ ] Independent literal cases cover complete coverage, checked prefix/uncovered tail, no payloads, no segments, all-disabled checks, selected checks, skipped segments, divergence and absent coverage.
- [ ] The original adapter fails the prefix-tail and coverage-absent controls; disconnecting the new completeness condition fails them again after the fix.
- [ ] Actual engine `2.5.0` small recordings demonstrate engine `ok=true` with terminal snapshots disabled and incomplete coverage, complete coverage with a terminal snapshot, and no-payload DID NOT RUN.
- [ ] JSON and human reports retain intervals, reasons, enabled checks and state endpoints; legacy absent coverage reads honestly.
- [ ] Existing classification and report mocks use explicit bounded coverage or legacy unknown expectations, without weakening their contracts.
- [ ] Priority work-106 CI-cost repair is reviewed, integrated and verified before adapter implementation resumes.
- [ ] Root accepts the final exact consumer revision, relevant full gate, main merge/push and remote gates. Whole-game replay determinism and work 107 remain separately owned.

## Implementation steps

- [x] Read repository instructions and relevant consumer/public engine types; freshly read remote status and loaded runtime version.
- [x] Copy primary registry plus exact immutable work-107/work-108 bootstrap plans into root's integration worktree, with SHA-256 equality, before editing this plan.
- [ ] Finish the required test-only CI-cost repair and its independent native/mutation evidence for root acceptance.
- [ ] Resume tests-first coverage adapter implementation after the shipping blocker is accepted.
- [ ] Hand off exact source digests, RED/GREEN/mutant results, public-runtime controls and report bounds; root integrates, reviews, gates and ships.

## Outcome

Pending. Coverage implementation remains paused for the required work-106 shipping blocker. No adapter change, code commit, main integration, full gate or shipped coverage claim follows from this plan. The test-only repair has three rejected routes, a bounded native-binding phase-cost reduction and ten passing final focused cases on both Node versions. Removing the exact cache guard fails the native-120 control at tick 2 and the original nested-mutation control. The corrected separate lifecycle contract is locally observed and frozen source independently accepted; integrated full gate and hosted checks remain open. Engine `2.5.0` runtime readiness is observed; whole-game replay determinism is not established here.
