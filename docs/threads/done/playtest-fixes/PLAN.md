# playtest-fixes — make the LLM agent actually able to play, Fable-5-only models

Objective: close the five defects found by the 2026-06-09 verification run (devlog: "LLM playtest verification run on ClaudeCodeProvider") and switch all playtest LLM calls to `claude-fable-5` per the user's standing instruction. Root causes were confirmed live; this plan is repair, not investigation.

## Findings being fixed

| ID | Defect | Root cause (confirmed) |
|---|---|---|
| A | Agent has zero agency — 42/42 commands rejected (`not_a_unit`/`not_a_building`) | Snapshot has no own-entity section; tactical prompt renders only aggregates/selection/enemies/queues, so the model never sees a real entityId and fabricates them ("TC is assumed ID 2") |
| B | Rejections invisible to the agent — it retried the same wrong ids for 4 straight decisions | Dispatch outcomes drain to the trace but never enter the next tactical prompt |
| C | Game self-ticks ~600-1000 ticks during each ~60-100s claude call — bridge tick hit 5413 vs maxTicks 2000; all 5 baseline checkpoints missed; visual oracle inert | The page's frame loop steps the bridge in real time while the agent thinks; `advanceTicks` is not the sole tick source |
| D | Recorder bundle export fails (`blob:` protocol unsupported) → engineHalt, 154-byte stub | `page.request.fetch` is an HTTP client; blob URLs only resolve in page context. Introduced by impl-345 M3; never exercised live until now |
| E | Checkpoint-skip diagnostic blames divisibility ("250 doesn't divide 1000" — it does) | Message text encodes the design-time assumption; actual cause was drift (C) |
| F | Models: tactical=sonnet-4-6, strategy=opus-4-7, observation=sonnet-4-6 | User directive 2026-06-09: playtest with Fable 5 only |

## Changes

1. **F — Fable-5-only.** `MODEL_PRICES` gains `'claude-fable-5': {input 10, output 50}` (per claude-api skill table; existing rows stay — fail-loud covers unknowns). `playtest-llm.mjs` agent config (tactical+strategy), observation oracle call, and `playtest-llm-auto-fix.mjs` fix call all move to `claude-fable-5`; cost-note text re-derived. Spec §15.7 records the Fable-5-only rule; memory file records the preference.
2. **A — own-entity context.** `AgentStateSnapshot` gains `ownUnits` (id/kind/position/task, cap 150), `ownBuildings` (id/kind/position/isComplete, cap 64), `nearbyResources` (id/kind/position/amount, visibility-filtered like enemies, cap 64, sorted by distance to first own building). Tactical prompt renders all three with an explicit "use ONLY entityIds from this JSON — never invent ids" instruction; stale "state JSON does NOT respect fog" system-prompt line corrected (Phase-6.B made fog-filtering the default).
3. **B — rejection feedback.** `LlmAgent` history entries gain `dispatchSummary`; new `reportDispatchOutcome(events)` appends the engine verdicts onto the just-recorded entry; runner calls it after `drainDispatchLog()`. Prompt renders per-entry outcomes plus a warning block when the previous decision had rejections.
4. **C — paused-sim decisions.** `__AOE2_TEST__` gains `setPaused(boolean)` (pass-through to `bridge.setPaused`). `RunnerHost` gains optional `setPaused`; `runLlmPlaytest` pauses once after boot when available. The Playwright host's `advanceTicks` becomes atomic unpause→stepN→repause inside one synchronous `page.evaluate`, so RAF can never interleave: bridge tick moves only via `advanceTicks`, `tickAfter - tickBefore === ticksToAdvance` exactly, checkpoints align, `maxTicks` regains exact semantics. `bridge.step` early-returns while paused, so commands queued during think-time drain inside the atomic advance (observer order preserved).
5. **E — honest diagnostic.** Skip warn reworded to name the actual misalignment (checkpoint not on the advance grid) instead of asserting non-divisibility.
6. **D — chunked bundle export.** Drop the blob round-trip: in-page `JSON.stringify(getRecorderBundle())` into a page global, pull 4 MB slices through `page.evaluate` (under the JSON-RPC cap), reassemble + parse in Node, delete the global. `exportRecorderBundleToFile` (blob path) is removed — playtest-llm.mjs was its only consumer.
7. **Test-size debt.** New runner tests would push `llmRunner.test.ts` past its 692 legacy pin — split it along describe blocks instead and DELETE the legacy entry (ratchet toward 0; closes the debt pinned in 5a14832).

## Verification

TDD per change (vitest). Full `npm test` for the suite. Live verification: `npm run playtest:llm -- --use-dev-server --max-ticks 2000 --observation` on the ClaudeCodeProvider (dev-server path because `npm run build`'s tsc gate is red from in-flight civ-engine edits — external, see the 2026-06-09 gate-exception devlog entry). Acceptance: majority of agent commands ACCEPTED; `ticksRun === bridge tick`; checkpoints 1000/2000 captured; bundle non-stub; all calls priced as `claude-fable-5`. Multi-CLI review (Codex + Claude on the new fable-5 string) before close; full four-gate run + commit once the civ-engine tree settles.
