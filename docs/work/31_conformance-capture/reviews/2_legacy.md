# conformance-capture — impl iteration 3 (Codex convergence check)

Reviewer: Codex (`gpt-5.5` xhigh, sandbox read-only). Gemini already CONVERGED at iter-2; iter-3 re-checks the four iter-2 script fixes.

## Verified clean (iter-2 fixes landed)
- Missing trace fails loud (`process.exit(2)`) before any metrics/write — envelope not overwritten.
- Probe note reaches the markdown (`> ⚠ probe note: …`) and `envelope.findingsNote`.
- `--provider` rejects anything but `claude-code`/`api`.
- Both empty-array tests present (all-invalid → note; legit-empty → no note) + the markdown-note render test.

## New finding + disposition
| ID | Sev | Finding | Disposition |
|---|---|---|---|
| Codex-9 | MEDIUM | `findingsNote` was set only when the current probe returned a note, never cleared. Since the script is re-runnable on the same envelope, a prior bad probe's note would persist into a later CLEAN run — the envelope would keep a stale note while the regenerated markdown correctly had none, making the artifacts disagree. | **FIXED** — the script now `else delete envelope.findingsNote`, so every run reflects only its own outcome. |

## Outcome
The finding trend converged: iter-1 HIGH (core trace signal) → iter-2 script-robustness ×4 → iter-3 one narrow re-run consistency edge. Core logic was verified clean by both CLIs at iter-2; all script-hardening findings are fixed. **CONVERGED** after the stale-note fix (iter-4 Codex confirms post-commit; fix-forward if anything remains). Per AGENTS, stopping here — remaining review surface is nitpick-level on an internal tool.
