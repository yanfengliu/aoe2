# Review 2: implementation

## Target

Repository aoe2, commit `39edde7b` on branch `ci-flakes-1104`, which repairs [round 1](1_implementation.md)'s findings; the prompt carried `git diff 945ec5e5 39edde7b`. Focus: F14's outcome bookkeeping in the gate, and whether the other changes say only what the code and the evidence support.

## Reviewers and coverage

- Codex `gpt-6-astra`, `model_reasoning_effort=xhigh`, `--sandbox read-only`, codex-cli 0.163.0. The runbook's sandbox check kept the lane: 0 failed commands. It ran in-memory checks of the gate's outcome bookkeeping, including one with a simulated 1.3 s evaluate latency, and re-read all 101 retained evidence files against their manifest. It had no network.
- No Claude lane: a focused round on a small repair, where round 1's two lanes had agreed on the code.
- Run folder: fleet's ignored `tmp/review-runs/aoe2-ci-flakes-1104-r2/`, prompt SHA-256 `a59c3b64…`. The report is verbatim (SHA-256 `08069365…`), except that the absolute worktree path in its links is shortened to the repository path.

## Reports

### Codex (gpt-6-astra)

No blocker or major finding. F14’s code repair is sound; three documentation nits remain.

1. **Nit — slow-host diagnostic is overstated.** [Plan:65](docs/work/139_hosted-ci-flakes/plan.md:65) says exhaustion reports that the wait threw. The outer poll at [spec:154–156](tests/browser/voxel-presented-hit-state.spec.ts:154) can expire first. Using the extracted code, real Playwright assertions and simulated 1.3-second evaluate latency, it failed at 5.00 seconds with `Expected: true / Received: false`; the helper rejected at 6.31 seconds. Document both timeout paths. This is not a bookkeeping regression.

2. **Nit — the House-click gap has no demonstrated “few hundred ms” bound.** [Resource spec:179](tests/browser/resource-workers.spec.ts:179) quantifies that gap, but [command.ts:6–32](tests/browser/helpers/gameTestHelpers/command.ts:6) awaits projection, mouse movement and clicking without enforcing that bound. The retained `rw-newflow.probe.ts:81–85` timestamps before the click, so its measurements do not establish the gap’s duration. Keep the acknowledged gap; remove or qualify its duration.

3. **Nit — retuning Normal does not necessarily fail the spec.** [F5 disposition:133](docs/work/139_hosted-ci-flakes/reviews/1_implementation.md:133) claims it would. [Resource spec:141](tests/browser/resource-workers.spec.ts:141) checks only `speed=normal`; changing [its multiplier](src/game/simulation/matchOptions.ts:19) can preserve every HUD assertion while invalidating the numerical duration claim. Say the bound requires reassessment.

For F14, lines 147–161 distinguish rejection from return, assert pending before release, and await the callback-bearing promise before asserting returned. In-memory checks covered early return, early rejection, post-release return/rejection and non-settlement: no unhandled rejections or false greens occurred.

All 101 retained evidence files matched the manifest’s sizes and hashes. No files changed or browsers launched. Browser suites were not rerun; `ci:status` returned UNKNOWN.

## Findings and disposition

| ID | Finding | Disposition and reason | Repair or follow-up |
|---|---|---|---|
| F16 | Plan 139 said a very slow host fails the gate with the wait reported as throwing, but the handshake's own 5 s poll can expire first ("Expected: true / Received: false"), as a simulated 1.3 s latency showed (Codex 1, nit). | Accepted. Both paths are red; the record named only one. | Plan 139 and `gate-proofs.md` name both timeouts. |
| F17 | "The last few hundred ms" for the House click's gap is not measured: the retained probe timed the click's start, not its three round trips (Codex 2, nit). | Accepted. | The spec's comment, `gate-proofs.md` and plan 137 keep the gap and say its length was not measured. |
| F18 | Round 1's F5 disposition said a retuned Normal would fail the spec, but a new multiplier can keep every assertion passing while the duration claim no longer holds (Codex 3, nit). | Accepted; it corrects round 1's record, which stays as written. | `gate-proofs.md` already says the pin is by name, not value, and that a retune changes the bound; this row is the correction. |
| F19 | Owner's note, not a reviewer's: a wait that polls blindly four times and then returns, needing no frame, would pass the handshake. | Accepted as a written bound. The two recorded mutants, and any wait that returns within three reads, fail. | Named in the gate's header and `gate-proofs.md`. |

Codex otherwise found F14 sound: the gate tells a rejection from a return, asserts pending before the release, and awaits the callback-carrying promise before asserting returned. Its in-memory checks of early and late returns and rejections, and of a wait that never settles, gave no unhandled rejection and no false green.

## Verification

On `39edde7b` with these repairs, comments and records only: `tsc --noEmit` and ESLint exit 0. The architecture tests passed 152 of 152, and the three affected specs 14 of 14 on SwiftShader. The full gate runs on the final revision.

## Round outcome

No blocker, major or minor finding; four nits, all written down. No code behaviour changed, so no further round is needed.
