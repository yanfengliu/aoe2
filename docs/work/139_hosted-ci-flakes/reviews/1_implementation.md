# Review 1: implementation

## Target

Repository aoe2, commit `945ec5e5` on branch `ci-flakes-1104`, which repairs [round 0](0_implementation.md)'s findings on `cae06026`; the prompt carried `git diff cae06026 945ec5e5`. Focus: whether each repair closes its finding, whether the handshake gate is deterministic, whether a repair weakened anything, and whether the records agree with the code and each other.

## Reviewers and coverage

- Codex `gpt-6-astra`, `model_reasoning_effort=xhigh`, `--sandbox read-only`, codex-cli 0.163.0. The runbook's sandbox check kept the lane: 0 failed commands. It ran four in-memory cancellation checks on the extracted frame gate. It had no network.
- Claude `claude-opus-5-5[1m]`, `--effort max`, Claude Code 2.1.308, with the same restricted tools as round 0. The report check kept the lane: one result, `modelUsage` only the pin. It made 93 tool calls (Read, Bash, Grep, Glob), and the tree's status and diff were identical before and after. Its Bash outside the worktree was denied, so it could not open the trace zips.
- Both lanes ran from fleet's ignored `tmp/review-runs/aoe2-ci-flakes-1104-r1/` on one prompt (SHA-256 `4ded2855…`). The reports are verbatim (Codex `7d2b859e…`, Claude `7650b31e…`), except that Codex's absolute worktree path is shortened to the repository path.

## Reports

### Codex (gpt-6-astra)

Two remaining findings; no blocker or major code finding.

1. **Minor — F10 remains open: the claimed evidence copy is absent.** [Review record:123](docs/work/139_hosted-ci-flakes/reviews/0_implementation.md:123) says the evidence was copied into the primary checkout with a SHA-256 manifest. I verified the primary checkout’s location, but `aoe2/tmp/ci-flakes-1104-evidence-20261104/` does not exist. The originals and `tmp/retain.mjs` remain in this worktree. Removing it would therefore still risk losing the evidence F10 was intended to preserve. Complete and verify the retention before marking F10 repaired.

2. **Nit — F1’s old timer bound remains in the plan.** [Plan:64](docs/work/139_hosted-ci-flakes/plan.md:64) still says the gate requires a read within one second of arming release. That contradicts the repaired [handshake:144–153](tests/browser/voxel-presented-hit-state.spec.ts:144) and the updated gate proof. Replace that obsolete bound.

The F0–F5 code repairs close the named findings within their stated bounds. Both named wait mutants settle after fewer than four reads, so they cannot race the release threshold. The frozen API copy preserves the closures used by this fixture; no reinstall or disposal path runs during its handshake. Cancellation also passed four in-memory checks using the extracted gate.

I checked outside the diff, including [renderer readiness:419](src/rendering/voxel/AoeVoxelWorldRenderer.ts:419), the voxel runtime’s restoration lifecycle, [build activity:148](src/game/simulation/selectionActivity.ts:148), HUD label formatting, API installation/disposal, and lobby speed parsing. I found no assertion weakening or additional code regression.

No files changed or browsers launched. Browser suites were not rerun; `ci:status` could not reach GitHub under the network restriction.

### Claude (claude-opus-5-5[1m])

#### Review round 1: commit `945ec5e5`, the repairs of round 0's F0–F13

**Verdict:** no blockers, and no major findings in the code. Each code repair (F0–F5) closes the finding it claims. The handshake gate is deterministic in both directions for the helper it gates and for both recorded mutants. What's left is in the records: F10's evidence copy, which four records say was made, was never made, and two plan Outcomes still say things round 0 withdrew. The rest are nits. I edited nothing; `git status --porcelain` is clean at `945ec5e5`.

##### Findings

**F10 (continues) — minor: the evidence copy the records describe does not exist**
- `docs/debugging/2026-11-04-hosted-ci-flakes.md:18`, `docs/work/139_hosted-ci-flakes/plan.md:23`, the devlog entry (`docs/devlog/detailed/2026-10-13_2026-10-13.md:485`) and the review record (`reviews/0_implementation.md:123`) all say the probes and measurements are kept in `tmp/ci-flakes-1104-evidence-20261104/` in the primary checkout, with a SHA-256 manifest.
- That folder doesn't exist in the primary checkout (`C:/Users/38909/Documents/github/aoe2`, found with `git worktree list`). There is no `snapshotHud.cjs` anywhere under its `tmp/`.
- The copy script, `tmp/retain.mjs`, is in the worktree. It targets that exact path (`:9`) and refuses to run if the path already exists (`:10`). It simply hasn't been run.
- So the evidence exists only in this worktree's ignored `tmp/` (`tmp/evidence/snapshotHud.cjs`, `tmp/probes/`, `tmp/probe-out/`, `tmp/pin-tree.ps1`). Removing the worktree after landing, as R7 requires, would delete what the records say is kept, including the evidence behind the OPEN art-style entry. The failure traces are in place in the primary checkout (`tmp/ci-flake-artifacts-20261104/`).
- Fix: run the script and check its manifest before the worktree is removed, or change the four records to say where the evidence actually is.

**F1 and F5 (continue) — minor: two plan Outcomes still state what round 0 withdrew**
- `docs/work/139_hosted-ci-flakes/plan.md:64`: "M2's gate needs its read to return within 1 s of arming the release". That is the old timer-based gate's bound. The same plan at `:43` and `gate-proofs.md:20` say the timer was replaced.
- `docs/work/137_resource-worker-ci/plan.md:74`: "with the premise gated" and "the fix makes the walk outlast the checks by construction". F5 accepted "by construction" as an overclaim, and F4 renamed the "premise" check a setup guard. The spec header (`resource-workers.spec.ts:3-5`) and `gate-proofs.md:30` now say the checks' time isn't fixed.
- `AGENTS.md:82` says `plan.md` owns current status, so readers will take these lines as current.

**F2 (continues) — nit: "the 0 has to be the order's" has a small gap**
- The "still walking" read (`resource-workers.spec.ts:178-179`) happens before `clickCell`'s three round trips: a `worldToScreen` evaluate, `mouse.move` and `mouse.click` (`command.ts:12-13`, `:31-32`).
- If the walk ends during those round trips, the House order reaches an idle worker. That still reads "Building House", because any build command gives the "building" label (`selectionActivity.ts:148-150`). It also still reads food 0, because a worker with a build command is counted for no resource (`resourceWorkerCounts.ts:65-72`). So `:181` passes, but the 0 came from the walk ending, not from the order.
- The gap is only the last few hundred ms of a walk of at least 6.7 s; a read any later fails `:178`. So this is a limit to write down, not a flake.
- The comment at `:175-177` and plan 137's ticked criterion (`:23`, "proven still walking when the House order lands") claim slightly more than the checks show. Name the gap in the comment or in the Bound at `gate-proofs.md:30`.

**F5 (continues) — nit: the speed pin checks the preset's name, not its value**
- `:141` requires `speed=normal`, but the 6.7 s bound depends on `GAME_SPEEDS.normal = 1.5` (`src/game/simulation/matchOptions.ts:19-23`), which the view multiplies in (`AoeVoxelGameView.ts:389`).
- If Normal were retuned to DE's own 1.7x, the pin would still pass and the walk would shrink to 5.9 s. The failure would be red, not a silent pass. Working the bound out from `GAME_SPEEDS` would pin the number itself.
- Otherwise the pin is sound: the lobby writes `speed=normal` by default (`setupScreen.ts:46`, `:121`), and `parseSpeedParam` reads it (`matchOptionParams.ts:40-44`).

**New — nit: `settled` doesn't tell "returned" from "threw"**
- `voxel-presented-hit-state.spec.ts:146` sets `settled` in `.finally`. So a wait that rejects also fails at `:150` with "the wait returned while frames were held". That includes a mutant that throws, a page error, or the wait's own 5 s budget running out during the hold on a host with round trips over about a second.
- The records cite that message as the evidence for both mutations (`gate-proofs.md:19`, plan 139 `:45`, debugging doc `:60`). It would read the same for a mutant that crashed.
- When `:150` throws, nothing awaits `waiting`, so a later rejection goes unhandled.
- Fix: record the outcome, for example `.then(() => 'returned', (error) => error)`, and assert on it. The red and green verdicts don't change.

**Records — nits**
- "Every smaller finding repaired" overstates it: devlog `:489` says "Eleven smaller findings were repaired too", the review record `:136` says every minor one was repaired, and plan 139 `:36` says "repaired except two rejected parts". But F12 (`:125`) is "Accepted as a note, no change."
- Debugging doc `:32` says "After the move click at 155475", but its offsets are measured from 155500. F6's own reads (Moving at 156391, food at 156436) are +916 and +961 ms from 155475, not +891 and +936. Name the starting point the offsets use; F6 says it is the click's end.
- Devlog `:487` and `docs/devlog/summary.md:2` still present the distance assertion as the proof ("asserts it is at least 8 cells long… proven red"). F4 renamed it a setup guard.
- Debugging doc `:35` calls the timing check "the new spec's premise check", the term round 0 used for the distance assertion.
- The 2026-10-19 debugging doc's Fix section (`:40`) stops at round 0's flow: no "Building House", no speed pin. This commit edited that file without updating it.
- Debugging doc `:59` says "passed on SwiftShader and on the GPU". The review record's Verification (`:132`) lists only SwiftShader runs of the repaired spec. If the GPU run was before the repair (plan 137 `:70`'s 12 of 12), say so.

##### Your four questions

**1. Does each repair close its finding?**
- **F0: yes.** The poll now requires a frame drawn since the wait began, a running runtime, and accepted equal to presented for both epoch and revision. As long as nothing forces a sync during the wait (the precondition the doc states), that implies `isInteractionReady()` (`AoeVoxelWorldRenderer.ts:419-428`):
  - The hand-over happens only in `frame()` while running (`:326-331`).
  - `metrics().state` reads `'running'` only when the runtime's lifecycle is running (`ThreeRenderRuntime.ts:1095-1097`).
  - The runtime leaves the restoring state only inside a frame: `:401-418`, or a frame-ticket commit at `:856-861`.
  - The boar spec's non-null check comes before all three comparisons (`voxel-unit-attack-animation.spec.ts:198-205`).
- **F1: yes** (question 2).
- **F2: yes**, for the gap round 0 named. "Building House" comes only from a build command, and a walk that ends reads "Idle" (`selectionActivity.ts:148-153`, `:196`).
- **F3: yes.** A cancel before release removes the queued request, and a cancel after release cancels the mapped native id. The wrapper deletes its mapping before it runs (`:49-54`, `:59-62`).
- **F4: yes.** The non-finite check throws before the page evaluate (`placement.ts:43-48`), and the spec comment calls the distance assertion a guard (`:165-166`).
- **F5: yes**, apart from the nit above. The 1.5x wording is now right: `min(250, elapsed) × 1.5 ≤ 1.5 × elapsed` (`visibleSimulationTiming.ts:3-5`), and the villager's movement rate is 0.8 (`design/stats/units.csv:87`).

**2. Is the handshake gate deterministic?** Yes, for this helper and both mutants.
- **A wait that doesn't need a frame always goes red.** While frames are held nothing changes the renderer's state, so such a wait matches on its first poll. That is 2 reads with `frameDrawnSince` forced true, and 1 for the original `waitForPresentedSnapshot` (`git show c783b710`). The count never reaches 4, so the test's poll can only exit through `settled`, and `:150` fails.
- **The fixed wait can't return while frames are held.** Every other caller of `frame()` needs input or a test-API call the gate doesn't make: `hitTestPoint` (`AoeVoxelGameView.ts:317-320`), `getWorldCapture` (`:245-248`), and the one-time boot draw (`:160-161`).
- **Replacing `__AOE2_TEST__` is safe:**
  - The API is an object literal of arrow functions with no `this` and no getters (`browserTestApi.ts:286-427`), so the spread copy behaves the same.
  - The copy loses only the non-enumerable installation symbol (`:429`), which only the disposer reads (`:432-441`).
  - The property is a plain writable assignment (`:431`).
  - The game touches `window.__AOE2_TEST__` only when installing and disposing the API. Neither happens during the gate, so the comment's "never reads" is loose but harmless.
- **Possible false reds:** only a 5 s budget running out on a very slow host, as covered in the `settled` nit.

**3. Was any assertion weakened, or a new flake added?** No.
- The window check moved from inside one evaluate to a round trip later, which is stronger.
- "Building House" is the established label (`play-opening.spec.ts:245`, `selectionActivity.unit.test.ts:113`). It lasts through the walk to the site and the build, well past the 5 s poll.
- The URL pin is deterministic.
- The boar spec's non-null check can't fire while the wait holds, because nothing forces a sync between the wait and the read.

**4. Are the records consistent?** The register, gate-proofs, the debugging doc's Fix and Verification sections, dispositions F0–F9 and F11, the +936 ms figure and the 51/50 run split all match the code and each other. The exceptions are the findings above.

##### What I read

- **Rules and diff:** `AGENTS.md`, `browser-specs.md`, the round 0 record, `git show 945ec5e5`.
- **Specs and helpers, in full:** the gate, resource and boar specs, plus `presentation.ts`, `placement.ts` and `command.ts`. Also the gate at `cae06026`, the boar spec at `c783b710`, and the resource spec's diff from `c783b710` to `cae06026`.
- **Code outside the diff:**
  - `AoeVoxelWorldRenderer.ts:60-468`
  - `ThreeRenderRuntime.ts:180-269, 380-454, 556-576, 825-874, 1088-1102` (via `node_modules/voxel`, which is a junction to the sibling checkout)
  - `AoeVoxelGameView.ts:140-414`, `browserTestApi.ts:220-443`
  - `selectionActivity.ts:85-209`, `render.ts:195-254`, `resourceWorkerCounts.ts`, `entityNames.ts:170-175`
  - `matchOptions.ts`, `matchOptionParams.ts`, `setupScreen.ts`, `visibleSimulationTiming.ts`
  - `playOpening.ts:1-80`, `camera.ts:84-93`, `playwright.config.ts:40-95`, `units.csv:87`
- **Records:** both debugging docs, both plans, the register (`:1-40`), gate-proofs (`:1-32`), the devlog entry and the summary line.
- **Artifacts:**
  - `tmp/retain.mjs`.
  - `tmp/boar-after-r0.{sh,log}`: three rounds of 20, all passed. Its probe copy's body matches the spec, it imports the real helper, and its config matches the suite's (800x600, one worker, no retries).
  - `tmp/mutants/presentation.ts.fixed2`, which matches the committed helper.
  - `tmp/tsc.log` and `tmp/eslint.log`, both empty.
  - The primary checkout's `tmp/` listing.

**Not checked:** I ran no tests, so the gate's 5 of 5 and 10 of 10 rest on the records; no log of those runs is kept. I couldn't open the trace zips because Bash outside the worktree was denied, so the +891/+936 starting-point nit rests on F6's own numbers.

## Findings and disposition

| ID | Finding | Disposition and reason | Repair or follow-up |
|---|---|---|---|
| F10 | Continues: the evidence copy that four records describe did not exist yet; `tmp/retain.mjs` had not been run (Codex 1; Claude, F10). | Accepted. | Run: 101 files, 1,758,667 bytes, in `tmp/ci-flakes-1104-evidence-20261104/` in the primary checkout. Its `manifest.json` (SHA-256 `ee4d8a57…`) was re-read and every file's bytes and digest matched (0 mismatches). |
| F1 | Continues: plan 139's Outcome still gave the old timer gate's 1 s bound (Codex 2; Claude). | Accepted. | The bound now names the handshake, and the one failure a very slow host can still give: the wait's own 5 s budget running out while frames are held, which the gate reports as the wait throwing. |
| F5 | Continues: plan 137's Outcome still said "premise gated" and "by construction" (Claude). The speed pin checks the preset's name, not its 1.5x value (Claude, nit). | First part accepted. Second accepted as a written bound: a retuned Normal would fail the spec, not pass it silently. | Plan 137's Outcome names the three checks and the bounds. `gate-proofs.md` states the pin is by name. |
| F2 | Continues, nit: the "still walking" read comes before the House click's three round trips, so a walk ending inside them would pass (Claude). | Accepted as a written bound. It is the last few hundred ms of a walk of at least 6.7 s; any later end fails the read. | Named in the spec's comment, in `gate-proofs.md` and in plan 137's Outcome. |
| F14 | New, nit: the gate's `settled` flag could not tell a wait that returned from one that threw, and a later rejection went unhandled (Claude). | Accepted. | The gate records the outcome as pending, returned or the error, asserts it is pending after the polls and returned after the release, and leaves no rejection unhandled. Both mutants still fail 10 of 10, now at `Received: "returned"`. The gate passed 5 of 5. |
| F15 | New, nits in the records: "every smaller finding repaired", though F12 was a note; the trace offsets' origin; the devlog and summary presenting the distance assertion as the proof; "premise check" for the timing check; the 2026-10-19 doc's Fix section stopping at round 0's flow; and the GPU run of the repaired spec missing from the verification (Claude). | Accepted. Round 0's record stays as written, as history, and this row is its correction: its outcome's "every minor one was repaired" should have excepted F12. | Plan 139, the devlog, the summary, both debugging docs and plan 137 corrected. The GPU run is listed below. |

Both lanes otherwise found each round-0 repair closed. Their reasons: the wait's conditions match `isInteractionReady()` given its stated precondition. The handshake gate is deterministic both ways, since a wait that needs no frame settles before the fourth read. The copied, frozen API is safe. And no assertion was weakened.

## Verification

On `945ec5e5` with this round's repairs: `tsc --noEmit` and ESLint exit 0. After round 0's repairs the three affected specs passed 14 of 14 on SwiftShader and 14 of 14 on the GPU. This round's gate change passed 5 of 5, and each mutant failed 10 of 10 and was restored byte-identical. The full gate runs on the final revision.

## Round outcome

No blocker or major finding. Every finding was repaired or written down as a bound. F14's repair changes test code, so a focused round 2 checks it.
