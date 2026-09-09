# Replay Load Sources + Phase 3D/3E — Implementation Plan

**Spec reference:** [DESIGN.md](DESIGN.md) and the slim sub-files under `design/`.

## Operating cadence

Each slice follows the same loop:

1. Write the slice's design sub-file under `design/0X-...md` (it may already exist; refine if needed before TDD).
2. Write red tests against the slice's test contract.
3. Implement until tests pass.
4. Run focused gates (`npm test -- <slice tests>`), then full gates (`npm test`, `npm run typecheck`, `npm run lint`, `npm run build`).
5. Multi-CLI review per AGENTS.md, synthesize into `<date>/<iteration_number>/REVIEW.md`. Re-iterate until reviewers nitpick.
6. Update `docs/devlog/detailed/<latest>.md` + `docs/devlog/summary.md`. For user-visible slices, bump `package.json` and add a `docs/changelog.md` entry.
7. Commit with a HEREDOC message; push to `main`.

## Slices

| # | Version | Title | Files touched (primary) | New tests |
|---|---|---|---|---|
| 1 | 0.1.8 | Replay-mode annotation affordances | `src/ui/annotation/MarkerListPanel.ts`, `src/app/bootstrap/createApp.ts`, `src/app/bootstrap/replayAnnotationGate.ts` (NEW) | `tests/annotation-ui/MarkerListPanel.replay.test.ts` (NEW), `tests/app/replayAnnotationGating.test.ts` (NEW) |
| 2 | 0.1.9 | Load current live session as replay | `src/ui/hud/createHudController.ts` (or a new `replay-source-current-session` helper), `src/app/bootstrap/createApp.ts` | `tests/replay/loadCurrentSession.test.ts` (NEW) |
| 3 | 0.1.10 | Prior Sessions "Replay" button | `src/ui/annotation/MarkerListPanel.ts`, `src/game/recording/RecordingService.ts` (read-side: surface `loadPriorSessionBundle(id)`) | `tests/annotation-ui/MarkerListPanel.test.ts` (extend), `tests/recording/RecordingService.test.ts` (extend) |
| 4 | 0.1.11 | File import | new `src/ui/replay/ReplayFileImport.ts`, `src/app/bootstrap/createApp.ts` | `tests/replay/replayFileImport.test.ts` (NEW) |
| 5 | 0.1.12 | `ReplayLoadDialog` modal | new `src/ui/replay/ReplayLoadDialog.ts`, `src/app/bootstrap/createApp.ts`, possibly `src/ui/hud/createHudController.ts` | `tests/replay/ReplayLoadDialog.test.ts` (NEW) |
| 6 | 0.1.13 | Browser e2e + integration | `tests/browser/replay-load-dialog.spec.ts`, `tests/integration/replay-flow.integration.test.ts` | both NEW |

## Multi-CLI review baseline prompt (per slice)

> "You are a senior code reviewer. Flag bugs, security issues, and performance concerns. Do NOT modify files or propose patches. Only return findings, explanations, and suggestions in plain text. Only point out an issue if it is real and important. If there is no issue, say so instead of nit-picking. Verify each claim against the live codebase — grep for the symbols, function signatures, and file paths it references; do not approve based on prompt text alone. Verify docs in the diff match implementation; flag any stale signatures, removed APIs still mentioned, or missing coverage of new APIs in canonical guides. Begin your review with the literal token \"===BEGIN-REVIEW===\" on its own line and end with \"===END-REVIEW===\" on its own line. Do not emit those markers anywhere else in your output."

Per-slice prompts add: the slice's title and version; a one-paragraph summary of intended behavior; the specific files in the diff; the test contract; any prior-iteration findings to verify.

## Closure

After slice 6 lands and converges:

1. `git mv docs/threads/current/replay-load-and-e2e docs/threads/done/replay-load-and-e2e`.
2. Final devlog entry summarizes the six versions shipped in this thread.
3. `docs/architecture/ARCHITECTURE.md` (if any structural change landed) reflects the new replay-load surface and `docs/architecture/drift-log.md` carries a row.
