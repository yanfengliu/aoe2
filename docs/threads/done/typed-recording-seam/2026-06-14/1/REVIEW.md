# REVIEW — typed-recording-seam, iteration 1 (2026-06-14)

**Change under review:** Adopt civ-engine 1.2.0 typed-recording generics — remove the `toEngineWorld`/`fromEngineWorld` cast seam from the SessionRecorder/SessionReplayer paths so a component-typed `GameWorld` flows through by inference; retain `toEngineWorld` only at the WorldDebugger/RenderAdapter boundaries (still default-generic in 1.2.0). Type-only; no behavior change.

**Reviewers:** Codex (gpt-5.5, xhigh, read-only sandbox) · Claude (opus[1m], Read/Glob/Grep) · Gemini (gemini-3.1-pro-preview, plan mode). Diff piped via stdin; all prompted to verify against the live codebase + `../civ-engine/dist/*.d.ts`.

## Verdicts

| Reviewer | Verdict | Engine-`.d.ts` independently verified? |
|---|---|---|
| Codex | **No findings.** Ran `typecheck` itself (passes); confirmed inference preserves `GameComponents`, `fromEngineWorld` gone, `toEngineWorld` only at WorldDebugger/RenderAdapter, no explicit 2-arg specializations. | Yes (read `../civ-engine/dist`) |
| Claude | **APPROVE.** Verified all 6 checklist items against engine d.ts line-by-line; confirmed `openAt` returns *exactly* `GameWorld`; confirmed `infer TDebug`→`JsonValue` is load-bearing (a placeholder would break the `ReplayContext.replayer` assignment via `tickEntriesBetween`'s covariant `TDebug`). | Yes (`node_modules/civ-engine`=1.2.0) |
| Gemini | **No issues found.** All 6 checklist items pass on the aoe2 side. | No — sandbox blocked `../civ-engine/dist`; engine-side claims rest on the prompt (covered by Codex + Claude). |

**Convergence: reached.** Three independent APPROVE/no-findings; the only notes are nits and pending doc work — no correctness findings.

## Findings & disposition

| ID | Severity | Source | Finding | Disposition |
|---|---|---|---|---|
| 1 | **HIGH (gate, not reviewer)** | `npm test` `fileSizeBudget.test.ts` | `ReplayController.ts` grew 500→506 LOC (hard 500 cap; file was exactly at the ceiling on main). The `ReplayReplayer` comment+type block added 6 lines. | **Fixed.** Collapsed the pureHelpers type-import I'd already edited (6→1 line) and tightened the `ReplayReplayer` comment/type block (7→4 lines), staying within the change's own footprint. Now **498 LOC**; `fileSizeBudget` green. |
| 2 | LOW (nit) | Claude | `typedRecordingSeam.test.ts` header over-attributed: it implied this test catches a stray `<E,C>` at *any* call site, but such a stray arg is caught at the offending site's own typecheck, not here. | **Fixed.** Reworded the comment to scope the guard accurately (recorder-config acceptance + `ReplayReplayer.openAt` typing; cross-site stray args caught at their own site). |
| 3 | INFO (not a finding) | full suite | `createSimulationBridge.combat.test.ts > "lets the AI build a Barracks and kill a human villager"` timed out at 30 000 ms during the 429 s full-suite parallel run. | **No code change.** Re-ran in isolation → **passes (exit 0)**. This is the documented sim-throughput flaky timeout under load (`docs/engine-feedback/current.md`); a type-only change cannot affect runtime. Noted only. |
| 4 | INFO | Claude | `RecordingService.ts:48` types `world: World<any, any, any>` (reads only `serialize`/`tick`/observers). | **No change.** Intentional, pre-existing permissive typing outside this seam — not erasure introduced here. |
| 5 | INFO (pending) | Claude | Doc-discipline: `docs/devlog/summary.md` still describes the seam as spanning all four boundaries; `engine-feedback/current.md` still references the seam as a pending follow-up. | **Addressed in the same task** — devlog/summary/engine-feedback updates land before the thread closes (the diff under review intentionally carried no doc churn). |

## Gates (post-fix)

`typecheck` ✅ · `lint` ✅ · `build` ✅ · affected tests (replay 130 + runPlaytest 3 + fileSizeBudget + contract) ✅ · full suite re-run in progress (prior run: 1228 passed / only the two findings above, both now resolved/flaky). Contamination audit after Gemini: clean (`git status` = only the 9 intended files + thread docs).

**Disposition: ready to land** after the full-suite re-run confirms green and the doc updates are applied. No second review iteration warranted — reviewers converged with zero correctness findings.
