# Phase 3C TimelinePanel UI - Implementation Review 51

## Scope

Reviewed the post-impl-50 Phase 3C diff after the stale-bridge, hotkey, layout, and docs fixes.

## Reviewers

- Codex (`gpt-5.5`, xhigh): completed. Verdict: needs changes.
- Claude (`claude-opus-4-7[1m]`, max): unreachable due to account limit (`You've hit your limit - resets 7pm America/Los_Angeles`).

## Findings and disposition

- [MEDIUM] Mobile layout still reserved only the desktop `78px` game-root offset even though the mobile panel wraps to a taller one-column shape. Disposition: fixed by moving the game-root reserve to `--timeline-panel-reserve` and increasing it to `112px` under the mobile media rule. Desktop, mobile portrait, and mobile landscape Playwright geometry now all report no overlap.
- [MEDIUM] `TimelinePanel.render()` rebuilt marker/hotspot pins and rescanned `bundleHotspots(...)` on every tick, including hidden-panel tick updates. Disposition: fixed by skipping dynamic work while the panel is hidden and caching rendered pins by `(bundle, startTick, endTick)`. Added a regression that pin DOM nodes are preserved across tick-only updates.
- [MEDIUM] The stale-bridge save-load guard was tested only as a helper, not as an app/bootstrap ordering seam. Disposition: fixed by extracting `replaceLiveBridgeAfterReplayExit(...)` in `src/app/bootstrap/replaceBridgeForLoad.ts`, using it from `createApp.handleLoadGame`, and adding ordering tests that prove replay exit happens before bridge creation/replacement.

## Follow-up

Run impl-52 review against the current diff after these fixes. Claude should be retried and documented if still quota-blocked.
