# Phase 3C TimelinePanel UI - Implementation Review 53

## Scope

Reviewed the post-impl-52 Phase 3C diff after no-payload UI guards and docs/version updates.

## Reviewers

- Codex (`gpt-5.5`, xhigh): completed. Verdict: needs changes.
- Claude (`claude-opus-4-7[1m]`, max): unreachable due to account limit (`You've hit your limit - resets 7pm America/Los_Angeles`).

## Findings and disposition

- [MEDIUM] Space play/pause and terminal playback could leave the panel button stale because `TimelinePanel` renders off mode/tick changes, while `isPlaying()` can change without a tick after hotkey pause and was still true when the terminal tick event fired. Disposition: fixed by refreshing the panel after Space play/pause and emitting the terminal tick after `ReplayController` clears `playing`. Added controller coverage for terminal playback tick state.
- [MEDIUM] Marker/hotspot pins after the capped replay range were enabled and visually clamped to the end of the track. Disposition: fixed by disabling pins outside `[startTick, replayTimelineUpperBound(metadata)]`, with a regression covering markers and hotspots after a failed tick.
- [MEDIUM] The mobile reserve might still be too small below the tested mobile widths. Disposition: fixed by increasing the mobile reserve to `156px` and adding a 320px visual geometry pass.
- [MEDIUM] Phase 3C is user-visible and needed its own package/changelog version. Disposition: fixed by bumping `package.json` and `package-lock.json` to `0.1.7` and moving the Phase 3C changelog entry to `0.1.7`.

## Follow-up

Run impl-54 review against the current diff after these fixes. Claude should be retried and documented if still quota-blocked.
