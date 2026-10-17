# Review 1: design

## Target

2026-10-17, work 133 in `C:/Users/38909/Documents/github/aoe2-worktrees/branch-completion-1017`. Initial target: `docs/work/133_branch-completion/performance-comparison.md`, SHA-256 `34AD765909DDD4553F4FE207416D6440918DBFABFA5A5AB894478C2B406C3A9D`. Its exact original UTF-8 bytes are retained below. The integration owner subsequently appended the operational 1.25 ratio and GPU 55-FPS thresholds; that append was not part of the initial reviewed bytes. The focused instrument addenda use those declared thresholds unchanged.

Supporting initial evidence: `frame-rate/tmp/probes/snapshotDeltaBrowser.mjs`, SHA-256 `56C9035962D8A9D53FDED7192E4006D0CE8D0825423DC7E924A8F4CB2793E1D4`; `frame-rate/tmp/probes/hudCompositorCounterfactual.mjs`, SHA-256 `CEC98F75043EA323DDA0D11B4B5F164979AC9C19B3F360B00D670ADC9F1043A4`; original `tmp/frame-rate/m2/` cost800 and HUD-counterfactual raw records; and the fixed tick-11,700 save identified in the report. The focused instrument was inspected at SHA-256 `37144CE7ACABA83A757270BE360DDCF7806013E64A000BE83F7C26D843FC58F0`, then at repaired SHA-256 `5DD829A7D2EA54C74817D221FF73ED0CB90780F92BA2AEE04D69908802191EEC`. These are historical targets, not claims about later source changes.

## Reviewers and coverage

Independent collaboration reviewer `/root/integration_review`, gpt-6-astra at xhigh under the fleet review pin. Read-only review of the benchmark contract, raw evidence, instrument sources and directly relevant application/runtime behavior; this review document is the only authorized write. No benchmark execution or final integrated implementation review. The initial report also includes a bounded source-only sanity check of the IR1 and IR2 repairs.

Prior attribution: `/root/software_performance_audit` first reported the missing speed parameter and Slow-versus-Normal tick mismatch. The reviewer independently checked that diagnosis against source and raw records. The integration owner identified the load-toast concern and supplied the fixed comparison contract; the reviewer independently checked its evidence. The reports below preserve the reviewer's authored conclusions and the successive focused instrument findings.

## Reports

### Independent Astra reviewer — original authored benchmark report

The benchmark needs an input correction before another candidate is scored. The proposed comparison preserves work 130’s question, but its contract must explicitly pin Normal speed and verify the measured state.

Reviewed `performance-comparison.md` SHA-256 `34AD765909DDD4553F4FE207416D6440918DBFABFA5A5AB894478C2B406C3A9D`, both probe sources, the raw M2 records, and relevant application code. No tests, builds, or browsers were launched.

- **BR1 — Material measurement mismatch: the settled HUD experiment runs less simulation.** [snapshotDeltaBrowser.mjs:21](C:/Users/38909/Documents/github/aoe2-worktrees/frame-rate/tmp/probes/snapshotDeltaBrowser.mjs:21) requests `civ=Britons&speed=normal`; [hudCompositorCounterfactual.mjs:35](C:/Users/38909/Documents/github/aoe2-worktrees/frame-rate/tmp/probes/hudCompositorCounterfactual.mjs:35) omits both. Outside the probe, [matchOptionParams.ts:42](C:/Users/38909/Documents/github/aoe2-worktrees/frame-rate/src/app/bootstrap/matchOptionParams.ts:42) selects Slow when speed is absent; [matchOptions.ts:19](C:/Users/38909/Documents/github/aoe2-worktrees/frame-rate/src/game/simulation/matchOptions.ts:19) defines Slow as 1.0× and Normal as 1.5×. The raw settled-live arms advance 14–15 ticks in 1.5 seconds, consistent with Slow, versus approximately 22–23 in the original Normal probe. Loading replaces the bridge while retaining the view, so the save does not restore Normal speed. The settled experiment supports a **Slow-speed glass/opaque comparison only**; its 14.8–19.8 fps cannot replace the original Normal-speed readings.

- **BR2 — Equal render digests do not prove equal benchmark inputs.** [hudCompositorCounterfactual.mjs:44](C:/Users/38909/Documents/github/aoe2-worktrees/frame-rate/tmp/probes/hudCompositorCounterfactual.mjs:44) hashes `getRenderState()`. That excludes the view’s speed, camera/zoom, rendering preferences, CSS, and hidden simulation state. Its matching `1080764759` demonstrates matching projected starting state, not complete workload equivalence. Both probes use fresh contexts and fixed viewports, and the HUD experiment reads actual blur/background styles; those are useful controls. Neither raw result records enough camera, tier, runtime/build, and speed information to certify equivalence across experiments.

- **BR3 — The load-toast correction is justified, but its quantitative replacement remains missing.** The old save arm waits one second after resuming, rather than waiting for the toast to disappear ([snapshotDeltaBrowser.mjs:299](C:/Users/38909/Documents/github/aoe2-worktrees/frame-rate/tmp/probes/snapshotDeltaBrowser.mjs:299)). Its 4.6–6.2 fps records contain 272 DOM nodes; settled records contain 271. The newer maintained load helper explicitly waits for zero toast elements. This invalidates a claim that those old windows measured settled gameplay. It does **not** establish what settled Normal-speed performance is; BR1 prevents that inference.

The corrected input contract should require:

1. **Frozen, identifiable arms.** Preserve the original opening and exact tick-11,700 save—SHA-256 `314CA31AD1EAF78AABF1F081E18125CECF2164165BE74DC991AF621EB9C62DA9`. Record build/runtime hashes. Compare performance variants with the same integrated simulation behavior; an old branch build versus a new AI/gatherer build can change the measured workload.
2. **Explicit settings and actual-state assertions.** Use `seed=aoe2-prototype&civ=Britons&speed=normal`; assert running state and report achieved ticks per second. Pin viewport/DPR, camera coordinates, zoom, art style, actual rasteriser/ground tier, fog perspective, and transparency preference. Keep the original base/corner framing policy; do not reduce scene complexity to make opening and late costs converge.
3. **Settled, reproducible starts.** Load each late arm afresh, pause at exactly tick 11,700, wait for notifications/layout to settle, warm rendering without advancing that state, and record full simulation and projected-state digests. Then resume and measure. Apply an equivalently defined opening start.
4. **Separate verdicts and diagnostics.** Use delivered-world-frame wall intervals for live FPS, with repeated alternating arms, minimum sample counts, bounded timeout, and spread/tail reporting. Keep synchronized `readPixels` cost, RAF callback duration, and upload counts separately labelled. Paused results and synchronized FPS cannot establish live pacing.
5. **Predeclared acceptance.** State and justify what “close” means before scoring. Retain the original qualitative requirement and historical evidence; do not select a threshold from the candidate’s result.

This correction preserves the original question: it removes load transients and restores the original simulation rate without removing actors, effects, or controls.

The user-reported configuration is RTX 4090/ANGLE D3D11 at 1600×900. Existing records support a bounded GPU improvement and subsequent approximately 60-fps late samples. They do not establish arbitrary late-game performance or software parity. Work 130 additionally promised late/opening closeness on the software rasteriser; that criterion remains open. The HUD experiment suggests compositor cost, but supplies no basis for declaring completion or introducing an automatic visual fallback.

Cheap source inspection shows the integrated IR1 reservation map and IR2 ownership/domain filters address the reported mechanisms. I did not inspect their complete test evidence or perform final acceptance review.

### Independent Astra reviewer — corrected-instrument addendum, 2026-10-17

This is focused pre-scoring scrutiny of `tmp/work133-ground/liveComparison.mjs` SHA-256 `37144CE7ACABA83A757270BE360DDCF7806013E64A000BE83F7C26D843FC58F0`. It is not a benchmark run, a result approval, or final integrated code acceptance. The fixed operational thresholds remain late/opening median wall-frame cost at most 1.25 and GPU median FPS at least 55 in each matched arm; this review does not relax them.

**Verdict: the corrected capture may supply comparable observations, but its current `valid` flag is insufficient for candidate scoring. Resolve BR4 and perform the cross-arm audit below first.** BR1 and BR3 are corrected at source level: line 74 explicitly requests Britons and Normal, lines 77–83 hold the opening or exact tick-11,700 load paused while load/save notifications settle, and lines 98–111 check Normal's 1.5× simulated work and reject the 250 ms visible-time clamp. The outside-probe simulation path applies that multiplier at [AoeVoxelGameView.ts:389](C:/Users/38909/Documents/github/aoe2-worktrees/branch-completion-1017/src/app/AoeVoxelGameView.ts:389); [visibleSimulationTiming.ts:1](C:/Users/38909/Documents/github/aoe2-worktrees/branch-completion-1017/src/game/visibleSimulationTiming.ts:1) supplies the 250 ms bound. The tolerance of approximately one tick accounts for the fractional tick accumulator. A Slow arm over this window cannot satisfy the Normal tick check.

**BR2 remains a pair-validation requirement.** Lines 86–89 and 114 record actual camera, tier, rasteriser, Natural style, DPR, HUD blur/background, transparency preference, and both world and projected digests. Full-world serialization flushes pending commands and visibility/match state before taking the snapshot ([saveGameOps.ts:42](C:/Users/38909/Documents/github/aoe2-worktrees/branch-completion-1017/src/game/simulation/bridge/saveGameOps.ts:42)); it excludes replay attack-cue evidence by design. However, lines 102–112 check arms separately. They never reject different matched starting world/projected digests, camera coordinates, rasteriser strings, or CSS. Before scoring, a strict paired audit must require equality of the recorded starting inputs for each same-state/same-view baseline/candidate pair, assert the expected HUD CSS and fog perspective, and reject missing arms or non-finite counters. Opening and late worlds naturally differ; their framing/settings must follow the fixed policy rather than comparing their world digests to each other. Preserve and identify the complete served bundles: line 114 hashes only index.html and labels both arms with the baseline index tree, which alone does not establish candidate/runtime identity.

**BR4 — Material false-pass path: attempted world draws can count as delivered frames.** Lines 58–60 and 109 use the application's `framesDrawn` field to recognize and count frames. [AoeVoxelWorldRenderer.ts:319](C:/Users/38909/Documents/github/aoe2-worktrees/branch-completion-1017/src/rendering/voxel/AoeVoxelWorldRenderer.ts:319) calls `runtime.frame()` and then increments its own frame index unconditionally at line 324. Outside the changed repository, [ThreeRenderRuntime.ts:400](C:/Users/38909/Documents/github/voxel/src/three/ThreeRenderRuntime.ts:400) returns without drawing while the context is lost; the local built runtime has the same early return. That case can retain Normal simulation ticks and produce fast callbacks without delivering world frames. The probe already records `runtimeFrames`, but never validates its delta or renderer lifecycle. Require at least 60 actual runtime frames, agreement between the measured-frame count and runtime frame delta, a running renderer, and no context loss/restoration during each measured arm. Reading counters without enforcing them does not close this hole.

The start counters and timer are captured together before resuming; end counters, tick, and stop time are captured in the terminating RAF callback before save serialization. That removes asynchronous polling from the measurement endpoint. The interval FPS uses the first-to-last measured frame interval, while `wallMs` and counter/tick deltas include the complete start-to-stop window; retain those distinct denominators. The defaults provide opening and late, base/corner/held-out views, alternating baseline/candidate/candidate/baseline order, a four-second floor, and a bounded timeout. These are appropriate capture controls once actual rendered frames and paired inputs are validated. Record tick rate alongside frame rate so less simulated work cannot pass.

This addendum approves neither a visual trade nor a production fallback. The two acceptance questions remain separate: a valid paired speed improvement and unchanged representative/held-out pixels are needed to accept the ground candidate, and the original GPU plus software late/opening criteria are needed to close the performance objective. No tests, builds, benchmarks, browser sessions, or product edits were performed for this scrutiny.

### Independent Astra reviewer — focused validity recheck, 2026-10-17

Read the changed validity paths in `tmp/work133-ground/liveComparison.mjs`, SHA-256 `5DD829A7D2EA54C74817D221FF73ED0CB90780F92BA2AEE04D69908802191EEC`, after the ground owner repaired BR2 and BR4. **The instrument is ready for candidate measurement and scoring within the declared bounds.** No additional instrument round is requested before collecting the measurements.

Lines 59–65 accept a measured frame only when the runtime frame counter advances by exactly one. Lines 113–116 require at least 60 such frames, agreement with the complete runtime-frame delta, a running and non-halted world, and no WebGL loss/restoration or wrapper/runtime mismatch. Thus the context-loss false pass in BR4 is rejected. Lines 120–124 compare full-world and projected starting digests, actual camera, rasteriser, tier, art style, preferences including HUD CSS, and workload against the first arm of each state/view pair. Thus BR2's observed input-identity gap is closed in the collector. The explicit Normal URL, exact start ticks, toast settling, atomic endpoint, clamp rejection and tick-conservation check remain intact.

Score only a complete matrix of valid arms and preserve the exact baseline/candidate bundles. The index.html hash is a useful identifier for the preserved artifact; it does not replace the artifact's full provenance. Apply the predeclared median late/opening interval-cost ratio of at most 1.25 and GPU median FPS of at least 55 without substituting callback cost, upload counts, or the aggregate FPS field for a median. Record spreads and tails, Normal tick work, and the limited seed/host coverage. This readiness finding does not assert that any candidate passes or that the user-reported performance regression is closed. No measurements, gates, builds, browser sessions, or product edits were run by this reviewer.

## Findings and disposition

| ID | Finding | Disposition and reason | Repair or follow-up |
|---|---|---|---|
| BR1 | Settled HUD counterfactual used Slow rather than Normal. | Accepted by the integration owner; independently confirmed. Historical Slow results are invalid as a replacement for Normal measurements. | Corrected instrument explicitly requests Normal and checks its tick work; focused recheck accepted this source correction. Valid new measurements are still required. |
| BR2 | Render-only digests did not establish equal benchmark inputs. | Accepted; the first corrected collector still lacked cross-arm rejection. | Repaired instrument at 5DD829A7 compares full-world/render digests and actual settings/workload per state/view pair. Focused source recheck accepted the repair. |
| BR3 | Original late windows included a load-toast tail. | Accepted as a measurement-bound correction; old 4.6–6.2 FPS windows do not establish settled gameplay. | Corrected instrument waits for load/save toasts to disappear while paused, then measures live play. No settled Normal result was authored by this reviewer. |
| BR4 | Wrapper frame count could advance without a runtime draw. | Accepted for repair during this round. | Repaired instrument at 5DD829A7 counts runtime frames and rejects mismatches/context transitions. Focused source recheck accepted the repair. |
| IR1 / IR2 | Prior integration findings and their repairs. | Source mechanisms appear addressed; this is limited inspection, not final acceptance. | Preserve the separate [round 0 report](0_integration.md) and obtain final integrated review with test evidence. |

## Verification

The reviewer read the original raw records, checked relevant probe and application code, and read the corrected instrument before and after the focused repairs. No tests, builds, benchmarks, browser sessions, localhost servers, or product-source edits were performed. The initial required CI-status attempt in the earlier review session returned UNKNOWN in the sandbox; the owner separately recorded elevated green remote status. That owner observation is not independent remote verification by this reviewer.

Document preservation checks compare the embedded initial target bytes to its reported SHA-256 and preserve the original authored report unchanged. No new gate is needed for this documentation-only write. No task-owned browser or server process was launched.

## Round outcome

The flawed Slow counterfactual remains historical diagnostic evidence only and cannot replace the original Normal workload. BR1–BR4's instrument concerns are addressed at the repaired probe revision for collecting and scoring a complete valid comparison. Candidate performance, pixel equivalence, the stronger software late/opening criterion, the actual GPU regression, and final integrated code acceptance remain unproven by this round. The plan owns current status.

## Retained initial target

The following fence contains the exact original `performance-comparison.md` text, encoded as UTF-8 without a BOM and with LF line endings, including its final LF. Extract only the fence contents to reproduce SHA-256 `34AD765909DDD4553F4FE207416D6440918DBFABFA5A5AB894478C2B406C3A9D`.

<!-- reviewed-comparison-begin -->
```markdown
# Software-renderer performance: fixed comparison and disqualifiers

2026-10-17, work 133. User priorities remain finishing the branch work, with performance first. M1 and B improve CPU work and preserve pixels; neither alone establishes work 130's stronger late-match versus opening software criterion.

## Fixed question

Use the original saved tick-11,700 match at tmp/frame-rate/saves/allai-11700.save.json and the real opening of aoe2-prototype. Compare the same rasteriser, 800x600 viewport, Natural style, identical zoom and camera framing policy, graphics preferences and foreground workload. Begin every arm at its exact saved tick, wait for load notifications and transient layout to finish, record starting digest, measure settled live play over enough rendered frames, and retain exact input and environment. Preserve GPU1600x900 opening/late acceptance as a separate user-reported configuration. A measured correction to the existing instrument must receive independent scrutiny before comparing a new candidate with it.

Acceptance: the player-reported late-match regression is resolved on GPU and the software late/opening comparison meets work130's original close-cost/steady-rate intent under equivalent scenes and controls. Report any remaining delta rather than redefine completion around an upload counter. The initial plan supplied no numerical closeness threshold; an investigator must state and justify any proposed operational threshold before scoring and preserve the original evidence.

## Disqualifiers

- Different zoom, camera policy, render tier or scene workload mistaken for passage-of-time cost.
- A load toast, paused-only world or RAF callback duration passed off as settled live wall frame rate.
- Less simulated work, missing actors, missing fog/shadows, changed controls or weaker assertions.
- A counter improvement passed off as a measured whole-frame result; foreign load inferred from SwiftShader's own workers.
- A new visual trade, lower detail, sibling edit or dependency change without a justified separate decision.
- A timing victory without repeated matched arms, held-out state, exact inputs and relevant pixel checks.

## Existing evidence

The frame-rate worktree holds raw m2 cost800 and hud-compositor-counterfactual JSONs, preserved M1 baseline-dist, final B pixels and the maintained frame-cost probe. Its docs/work/130_frame-rate-through-a-match/m2-handoff.md records B's exact source/runtime pin and bounds. Root has integrated B, AI, gatherer and foundation overlays. No new performance source change is approved by this note.
```
<!-- reviewed-comparison-end -->
