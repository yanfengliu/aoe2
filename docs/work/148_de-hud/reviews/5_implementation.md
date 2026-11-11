# Review 5: implementation (M3a, a refused placement's short sentence)

## Target

aoe2, work 148 M3a: commit `d18c1e48` on branch `de-hud-m3-1111`, the diff against `origin/main` (`da1418ec`). The change: one module writes every placement-refusal and cancellation sentence and reads its kind back (`src/game/simulation/handlers/building/placementRefusal.ts`), the validator and `bridge/foundationStart.ts` call it, and the HUD shows one short sentence per kind (`src/ui/hud/placementRefusalCopy.ts`, `toast.ts`, `createHudController.ts`), with its tests, the capture script's `PLACE_CLICK` and the records.

## Reviewers and coverage

Codex `gpt-6-astra` with `model_reasoning_effort=xhigh`, `--sandbox read-only`, `--ephemeral`, one lane (codex-cli 0.163.0), from a run folder outside the reviewed tree. The prompt gave the six acceptance conditions (the long reasons the same to the character; every refusal a kind of its own and a reworded or new one failing a test; the fallback's own case; contract tests red with the defect put back; a longer-than-real sentence at three sizes with its room printed; no wall-clock assertions) and asked seven things: the sameness of the long reasons branch by branch, what the recogniser can miss or misread, what slips past the gate and the class test, any other route by which the long sentence reaches the player, races and platform dependence in the browser spec, side effects of the toast's `max-width` and of the capture script's move, and whether the records say anything the code does not do. The tree's `git status --porcelain` and `git diff HEAD` were empty before the run and after it, and `HEAD` was `d18c1e48` at both ends. No Claude lane was run: one independent reviewer with a read-only sandbox was judged enough for a change of this size.

## Reports

### Codex (`gpt-6-astra`)

The report whole, redacted only of its absolute paths.

1. **R5-1 — P2: The class test misses existing unreachable variants, allowing silent fallback.** `tests/simulation/placementRefusalKinds.test.ts:58` tests `undefined` with and without an anchor, but tests `0` only with an anchor and positive counts only without one. The typed record guarantees kind keys, not variant coverage.

   I confirmed this with an **in-memory mutation only**: when `unexploredCells === 0 && !anchor`, write "Placement blocked for house (2x2) at (5,0): no selected builder can reach this site." All **14 producer-gate and kind-test bodies still passed**, while `placementRefusalKind` returned `null`. The HUD consequently substitutes "Building site obstructed." The lexical gate at `tests/architecture/placementRefusalProducers.test.ts:85` cannot detect this change inside the approved builder.

   Cover the full unreachable variant matrix and a real producer case without a suggestion. This also corrects the unsupported "every variant" guarantee in §14.2 and plan 148.

2. **R5-2 — P2: Browser assertions race the toast's independent expiry timer.** `tests/browser/de-placement-refusal.spec.ts:134` first waits for the foundation to disappear, then starts looking for its toast. Foundation absence persists; the toast starts fading after 2,400 ms and is removed 240 ms later by `src/ui/hud/toast.ts:56`. A delayed poll or browser round trip can therefore observe correct cancellation after its message has disappeared, producing an unrecoverable false failure. The 20-second state timeout does not protect the message observation.

   The room tests have the same exposure: line 166 measures two copies in separate browser calls against the same expiring toast. Capture the cancellation's toast observation from before the click, and control the expiry clock during layout measurements. The state polling itself complies with condition 6; the transient observation is the problem.

**Verdict: request changes to the test gates.** I found no current production regression: 3,450 validator comparisons and 600 cancellation comparisons against `da1418ec` were character-identical and recognised. Current prefixes are disjoint, so kind order is not load-bearing. I found no alternate long-reason route to player text, attack-alert regression, or change to capture behaviour without `PLACE_CLICK`.

Checks were read-only and in memory. I did not rerun browser rendering or establish a failure specifically at half speed; GitHub access blocked CI verification. No files changed.

## Findings and disposition

- **R5-1, repaired.** The class test no longer lists variants by hand. Each kind's sentences are every combination of what its builder takes: five sites, a suggestion or none (three anchors), each count of unexplored cells the builder tells apart (none given, 0, more), ten causes and four count clauses for an obstruction, eleven things the builders can find with both fog verdicts and three prices for a cancellation. Each must be recognised as its kind with its building, and no two combinations may write one sentence. A case of its own holds the unreachable sentence's six wordings. The live-bridge case gained the sentence's other opening from a real producer (a seat with no fog of its own, the reachability gate's second arm) and checks that the real unexplored refusal carries no suggestion. The reviewer's mutation is now a mutant of the red proofs (`unreachable-one-wording`). The records say "every combination of what its builder takes" where they said "every variant", and the test's header states the bound: a builder given a branch on a value outside those lists needs the value added.
- **R5-2, repaired.** The browser spec reads a log, not the toast on screen. A `MutationObserver` on the toast container, installed before the click, writes down every refusal toast's words and height in the task that adds it; the cancellation case starts the log before its click and reads it after the state it waits for; the room cases measure both copies inside that same task, so no timer of the page's runs between the toast's arrival and its measurement. The one check still made on the live toast is that it leaves, which is a state that lasts.
- Not asked for and not changed: a real producer case of an unreachable site with no suggestion (it needs a builder with no open ground in reach, which no fixture has); the combinations hold that wording.

## Verification

The repairs are commit `1f0dd521` on the branch. The three unit files pass (25 cases: 11, 10 and 4) and the browser spec's six cases pass with the same measurements as before. The mutants were rerun on it, the reviewer's among them, and all ten are red (plan 148, "Tests (M3a)"); the gate on the repaired tree is in plan 148's Outcome.

## Round outcome

Two P2 findings, both in the tests and both repaired; none in the product. [Round 6](6_implementation.md) checked the repairs.
