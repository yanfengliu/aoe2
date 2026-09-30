# conformance-capture — impl iteration 2

Reviewers: Codex (`gpt-5.5` xhigh, sandbox read-only) + Gemini (`gemini-3.1-pro` plan-mode). Gemini contamination check clean.

## Verifying iter-1 fixes
Both reviewers independently re-verified all four iter-1 fixes landed correctly:
- **HIGH (host rejections in trace):** `allDispatchEvents = [...preQueueRejections, ...dispatchEvents]` confirmed used for both agent feedback and the trace entry; no double-count (a command either reaches the engine drain OR is rejected pre-queue, verified against `browserTestAgentApi.ts:196-223`); new test asserts `unknown-kind` reaches the trace.
- **MED (stall guard):** `row.stopReason !== 'cost-budget-exceeded'` confirmed + tested.
- **MED (parse note):** all-invalid array → note; legit-empty array → no note; confirmed + tested.
- **LOW (stale spec ref):** gone; remaining observation mentions are removal-rationale or historical.

**Gemini: CONVERGED.**

## New findings (Codex iter-2) + dispositions
Codex went deeper on the decoupled script and flagged 4 robustness gaps (NOT CONVERGED at iter-2). All fixed:

| ID | Sev | Finding | Disposition |
|---|---|---|---|
| Codex-5 | MEDIUM | `playtest-findings.mjs` silently treated a MISSING `.llm-trace.jsonl` as an empty trace → a typoed prefix produced a misleading "0 commands / 0 rejections" record that then overwrote the envelope. | **FIXED** — the script now `process.exit(2)` with an error when `!existsSync(tracePath)`, before computing/writing anything. |
| Codex-6 | MEDIUM | The malformed-probe `note` was emitted to stderr only; the persisted `.findings.md` still read `_No findings recorded._` and the envelope stored no note — a missed console line hid a bad model turn. | **FIXED** — `formatFindingsMarkdown` takes `note` in meta and renders `> ⚠ probe note: …`; the script passes `result.note` and stores `envelope.findingsNote`. Test added for the markdown render. |
| Codex-7 | LOW | `--provider` accepted any value (the main runner rejects invalid values). | **FIXED** — `parseArgs` rejects anything but `claude-code`/`api`. |
| Codex-8 | LOW | The legitimately-empty findings array (model found nothing → no note) was not directly tested. | **FIXED** — added a test asserting `findings:[]` → `note === undefined`, alongside the existing all-invalid → note test. |

Codex also explicitly verified clean: no double-count of pre-queue rejections, the merged events reach both feedback + trace, cost-budget rows excluded from stalls (tested), and the stale spec ref gone.

## Outcome
Core logic verified clean by both reviewers; iter-2's 4 findings were peripheral script-robustness, all fixed with tests. iter-3 (Codex) confirms convergence on the fixes — see impl-3.
