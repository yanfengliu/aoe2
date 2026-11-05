# Review 2: implementation

## Target

aoe2, work 142 M1, the round-1 repairs: commit `30d551a8` ("Repair work 142 M1 after review round 1 (Codex)"), its diff against `fd2632ea`, SHA-256 `395e56babae934a111ffac25a6e84496865b64d84d2566e8e58e1ab37c7c97c6`.

## Reviewers and coverage

- Codex `gpt-6-astra`, `model_reasoning_effort=xhigh`, `--sandbox read-only`, codex-cli 0.163.0, serial with no delegation. It read the diff and the tree, cited files outside the diff (`src/rendering/voxel/aoeVoxelHitProxy.ts`, `src/input/voxelPointerInputController.ts`), ran the typecheck and 28 focused tests, checked the separating-axis test against an independent clipping oracle in 15,010 cases, and made in-memory mutations. The Codex log check printed `keep 0 lines of failed commands`. Browser tests and the full gate were not run by it.
- Claude lane: not run, as in rounds 0 and 1.

## Reports

### Codex (`gpt-6-astra`)

One P3 test-coverage finding. **P0–P2: none.**

**P3 — F6's test does not protect the renderer accessor.** `voxelSelectionController.test.ts:385` supplies artificial polygons, bypassing `presentedHitPolygons`. Replacing the accessor's implementation at `AoeVoxelWorldRenderer.ts:455` with still-pose geometry left all **31 focused tests passing**, reintroducing F6 through the producer. **Suggested fix:** test the real renderer accessor with a posed unit near a viewport edge, asserting a different selection result from its still pose.

| Repair | Resolution and regression sensitivity |
|---|---|
| F6 | Implementation resolved; coverage gap above. Reverting the controller to still geometry fails its assertion at line 397. |
| F7 | Resolved. Removing the separating-axis loop fails the corner regression at `selectionMembers.test.ts:53`. |
| F8 | Resolved. Restoring the old mount implementation fails the cue assertion at `primarySelectionVoiceMount.test.ts:55`. |
| F9 | Resolved for the helper exemption. Removing it rejects every armed case at `selection-controls.spec.ts:262`. Confirmed with the real fixture and helper using a stubbed page transport; browser execution was not repeated. |

**Accessor correctness findings: none.** Requested IDs, missing IDs, presented time, and empty results before readiness passed direct checks. The implementation reuses prepared parts through `aoeVoxelHitProxy.ts:69`, **outside the diff**. It still projects parts and constructs hulls. For 200 villagers, isolated local median cost was approximately **7.0 ms**, versus **17.4 ms** rebuilding recipes; these timings exclude viewport intersection.

**Polygon-intersection findings: none.** The SAT implementation handles either winding, duplicate/degenerate edges, points, segments, and touching boundaries. It passed **15,010** independent clipping comparisons and explicit boundary cases.

**Mount stand-in findings: none.** The test exercises the real bridge, mount, role lookup, controller polling, and cue dispatch. Its substitutes appropriately exclude sound synthesis and browser autoplay behavior.

**Browser-case findings: none within F9's scope.** It checks real key arming, occupied-cell acceptance, disarming, and unarmed refusal. It does not prove successful command execution: the pointer disarms before dispatch, including rejected orders (`voxelPointerInputController.ts:155`).

Validation: 28 baseline tests and typechecking passed; mutations were entirely in memory. Browser/full verification was not run. Remote CI and process inventory were unavailable under sandbox permissions. No browser or server was launched; the worktree remains clean.

(Report as written to `codex-report.md`, with the absolute-path links shortened to file:line; no other change.)

## Findings and disposition

| ID | Finding | Disposition and reason | Repair or follow-up |
|---|---|---|---|
| F10 | Codex: no test reaches `presentedHitPolygons` itself; a still-pose accessor would pass | Accepted | `tests/rendering/AoeVoxelWorldRenderer.test.ts` "hands back the presented polygons of a walking villager, which its still pose does not share": the accessor's polygons for a villager presented walking differ from its still pose, each is a click on that villager, and an id not presented gets nothing; red when the accessor hands back the still pose ("expected … to not deeply equal"), restored byte-identical |
| F11 | Codex: the F9 case shows the click is let through and spends the order, not that the order is carried out | Rejected, not a defect of the helper: whether an armed order is carried out is the pointer's and the simulation's, tested by `attack-ground-hotkey.spec.ts` and the A and P specs; the case's claim is the helper's exemption, as its title says | None |

The accessor's cost, 7.0 ms for 200 villagers against 17.4 ms rebuilding recipes, is paid once per double-click, not per frame.

## Verification

The full gate on `30d551a8`, the round-1 repairs, before this round's test: vitest 5,229 passed and 3 skipped, Playwright 281 passed and 2 skipped, receipt OK. The round-2 test passes, 5 of 5 in its file, and goes red with a still-pose accessor.

## Round outcome

One P3 finding (F10), accepted and repaired, and one observation (F11), rejected as outside the case's claim; no P0-P2. The review rounds end here: the round-2 repair is a test only.
