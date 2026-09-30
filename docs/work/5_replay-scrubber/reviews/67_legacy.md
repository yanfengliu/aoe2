# Phase 3C TimelinePanel UI - Implementation Review 50

## Scope

Reviewed the first Phase 3C implementation of `TimelinePanel`, replay hotkeys, app bootstrap wiring, and the related timeline styles/tests.

## Reviewers

- Codex (`gpt-5.5`, xhigh): completed. Verdict: needs changes.
- Claude (`claude-opus-4-7[1m]`, max): unreachable due to account limit (`You've hit your limit - resets 7pm America/Los_Angeles`).

## Findings and disposition

- [HIGH] Host save-load could replace the live bridge while replay mode still held the old captured bridge, so a later replay exit could restore stale pre-load state. Disposition: fixed by `exitReplayBeforeLiveBridgeReplacement(replayController)` before `handleLoadGame` swaps the bridge, with a regression in `tests/replay/ReplayController.test.ts`.
- [MEDIUM] Replay hotkeys conflicted with focused timeline controls: Space could double-activate a focused button, and range inputs were treated as text inputs so some replay keys would be suppressed. Disposition: fixed by calling `preventDefault()` when a registered hotkey handles an event, treating `input[type=range]` as a non-text control, and binding replay hotkeys only while replay mode is active.
- [MEDIUM] Timeline placement overlapped the playfield/bottom HUD and had only jsdom coverage. Disposition: fixed by reserving bottom viewport space with CSS while the panel is visible and by capturing desktop/mobile Playwright screenshots plus geometry checks.
- [MEDIUM] Canonical docs/version surfaces did not describe Phase 3C. Disposition: fixed in changelog, architecture, drift log, decisions, PLAN, design, summary, and detailed devlog. No package version bump is needed because `package.json` is already at the active `0.1.6` release for this replay-scrubber unit.

## Follow-up

Run the post-fix multi-CLI review as impl-51. Claude should be retried, but if the quota limit remains, document it and proceed with Codex if it completes.
