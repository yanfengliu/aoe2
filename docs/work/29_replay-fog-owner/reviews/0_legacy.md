# replay-fog-owner — impl iteration 1 (+ iter-2 fix verification)

Diff: working tree vs 4587ba4 (~29 files; fog-owner feature + civ-engine 1.0.x absorb + timeout-cap doubling). Reviewers: Claude (`claude-fable-5[1m]`, full tool access), Codex (`gpt-5.5` xhigh), Gemini (`gemini-3.1-pro-preview` plan-mode). Enriched prompt with seven focus areas incl. an explicit pointer at the adapter-lifecycle question — all three independently converged on it.

## Verdicts

- **Codex:** 2 HIGH + 1 MEDIUM. No other runtime defects in validator/fog/wiring/cost paths.
- **Claude:** 1 MEDIUM (same as Codex H1), 1 LOW/MEDIUM (same as Codex H2), 1 LOW perf, 2 doc slips. "The feature is correctly built, the transactional enterReplay guarantee holds on every throw path I could construct, the absorb is semantics-preserving."
- **Gemini:** clean except the same adapter-lifecycle question ("verify adapter/listener cleanup on the reused GameWorld during setFogOwner").

## Findings + dispositions

| ID | Severity | Finding | Disposition |
|---|---|---|---|
| Codex-1 / Claude-1 / Gemini | HIGH/MED | Fog switches rebuild the bridge over the SAME world without disconnecting the old RenderAdapter — `connect()` registers `world.onDiff`; every toggle leaked a listener that clones the diff and projects into an abandoned store each tick (scrubs were safe only because they re-materialize the world). | FIXED — `makeReplayBridge` returns `ReplayBridge` with `disposeReplayRenderAdapter()`; controller disposes the outgoing bridge after each successful swap (setFogOwner / openReplayAt / exitReplay-after-restore, so a throwing restore keeps the surviving session's adapter alive). Mechanism + wiring test-pinned. |
| Codex-2 / Claude-2 | HIGH/LOW | `fogOwner` assigned before the cell swap in setFogOwner (and before exitReplay in enterReplay) — a throwing `replace`/restore left the label/state desynced from the active bridge, and the no-op guard would swallow the retry. | FIXED — both sites assign fogOwner (and context) only after the swap fully succeeds; pinned by a failing-replace test (retry works) and the bad-bundle test (prior session's perspective intact). |
| Claude-3 | LOW (perf) | `fogOwnerCandidates()` called `bridge.getEconomyState()` (full uncached economy projection incl. every map resource) on every panel render — 10×/s during playback. | FIXED — candidates computed once per `enterReplay` into `ReplayContext.fogOwnerCandidates`; accessor returns a copy; pinned by a call-count test. Three older stub bridges gained `getEconomyState`. |
| Codex-3 / Claude-4b | MEDIUM/LOW | Engine-version drift in docs: absorb written as "1.0.0/1.0.1" while the lockfile captured 1.0.2 and the additive 1.1.0 landed in the sibling during the session. | FIXED — changelog/devlog/engine-feedback name the full 1.0.x line; the feedback bisect range is 0.8.24..1.0.2 (1.1.0's additions are off the tick path). |
| Claude-4a | LOW | Changelog said "10 new tests"; actual count differed. | FIXED — 17 new tests, enumerated. |
| Claude obs. | INFO | `getHudState().visibleCells/exploredCells` counts follow the fog owner (they read the projected frame); docs only promise resource/age panels stay P1. | ACCEPTED as-is — the counts SHOULD follow the rendered perspective (they describe the frame on screen); the pinned contract is the resource/age binding. |
| Claude obs. | INFO | Scrub-preserves-chosen-perspective has no dedicated test pin. | ACCEPTED — covered implicitly by the buildReplayBridge default param; cheap pin candidate for a future pass. |

## Verified clean (iter-1 highlights)

Fog projection follows the owner end-to-end (projector playerId gates units AND the visible/explored cell arrays; renderStateOps footprint filter same owner; render cache is per-bridge closure state so perspectives cannot bleed). Transactional enterReplay holds on every constructed throw path. The 1.0 absorb is semantics-preserving (`runMaintenance<T>` synchronous, same flush order; stub fixes preserve each test's controller-state intent; the obsolete CAVEAT comment was deleted not stranded). Helpers extraction byte-identical with type-only back-imports (no cycle). Timeout doubling touches only `it()` timeout args + one const; no assertion weakened. Spec §15.3 / README / changelog match the implementation.

## Iter-2 (fix verification, Claude)

All five iter-1 fix groups VERIFIED with file:line evidence (incl. an independent recount of the 17 new tests and a character-level check that the helpers extraction is behavior-neutral). Iter-2 additionally caught **one new LOW in the iter-1 fix itself**: `setFogOwner`'s *failure* path leaked the INCOMING bridge's adapter (it connects to the surviving world at construction; a throwing `select`/`replace` left it registered). FIXED in the same iteration — the swap is wrapped and a throwing swap disposes the incoming bridge before rethrowing (pinned: the failing-replace test asserts the incoming bridge was disposed and the active session bridge was not). Iter-2's INFO hardening (a disposed bridge could self-reconnect through `flushOutOfBandRenderChange` and steal the shared out-of-band flag) was also closed with a `renderAdapterDisposed` guard. Iter-2's remaining note — the changelog's `threads/done/` pointer is forward-looking — resolves with the thread move at close. Post-fix gates: 1215 passed, typecheck/lint/build clean, ReplayController at exactly 500 lines. **CONVERGED.**
