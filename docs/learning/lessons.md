# Lessons

The one-line form of every lesson this repo has paid for. Read this file at session start; it is short by construction.

Each rule links into [lessons-evidence.md](lessons-evidence.md), which holds the war story and the anchor. Open that only when a rule is in doubt, or the work is in that area — it is not session-start reading.

A new lesson is an entry there plus one line here. Run `npm run lessons:check` to keep the two in step: a rule always has an entry, and an entry always has a rule.

When a lesson becomes a gate — a test, a lint rule, a fixed command — delete both halves. The machine enforces it, so nobody needs to read it.

## Rules

- The Browser pane advances the game ONLY when it renders a frame — verify state and interaction there, never rate or pacing ([evidence](lessons-evidence.md#the-browser-pane-advances-the-game-only-when-it-renders-a-frame-2026-09-01))

- A measurement HORIZON is part of the instrument — anything that changes WHEN an outcome lands must be measured at two, or you count arrivals and miss losses ([evidence](lessons-evidence.md#a-measurement-horizon-is-an-instrument-and-24000-ticks-was-the-wrong-one-2026-08-30))

- A rendered cue must be judged across the axes it VARIES over — every post-processing art style, both ownership colours, a bright and a dark background ([evidence](lessons-evidence.md#a-rendered-image-judged-from-one-capture-is-one-capture-not-a-verification-2026-08-30))

- A profile's SELF TIME says where the process is, not why — get the CALL COUNT before optimising a hot function ([evidence](lessons-evidence.md#self-time-says-where-not-why-the-cost-may-be-the-call-count-not-the-work-2026-08-30))

- A background helper (auto-aggro, auto-rotate) can satisfy an outcome assertion alone — place the test's target OUT OF THE HELPER'S REACH ([evidence](lessons-evidence.md#background-helpers-satisfy-outcome-assertions-2026-08-27))
- Never `git checkout` a file you have uncommitted work in to end a red-check — comment the code path out and restore by string, or commit first ([evidence](lessons-evidence.md#git-checkout-during-a-red-check-destroys-uncommitted-work-2026-08-27))

- A comment claiming "X is not in the roster" is a claim with a shelf life — grep the absence-claims graveyard whenever the roster grows ([evidence](lessons-evidence.md#absence-claims-have-a-shelf-life-2026-08-26))

- A positive assertion on an effect BOTH the feature and its fallback produce proves nothing — assert the mechanism (the standing order), not the shared outcome ([evidence](lessons-evidence.md#assert-the-mechanism-not-the-shared-outcome-2026-08-25))

- A cross-owner op must never touch another player's UI state; and a pointer→view seam no test crosses can silently drop its arguments for months. ([evidence](lessons-evidence.md#cross-owner-ui-state))
- A fixture that PRE-GRANTS the thing under test cannot test how that thing is obtained ([evidence](lessons-evidence.md#a-fixture-that-pre-grants-the-thing-under-test-2026-08-23))
- The browser suite serves `dist/` — an unrebuilt run measures the PREVIOUS commit, and its screenshots look like a real UI defect ([evidence](lessons-evidence.md#the-browser-suite-serves-dist-2026-08-23))
- A menu derived from world state ANSWERS DIFFERENTLY after you mutate that state — snapshot eligibility before the write ([evidence](lessons-evidence.md#a-menu-derived-from-world-state-answers-differently-after-you-mutate-that-state-2026-08-23))
- Ask what a REGION can work, not whether one resource is reachable — a flood fill answered in one run what six per-target probes could not ([evidence](lessons-evidence.md#ask-what-a-region-can-work-not-whether-one-resource-is-reachable-2026-08-23))
- A success metric written for a FROZEN system reads a decided match as a frozen one — measure every player, and whether the game ended ([evidence](lessons-evidence.md#a-success-metric-written-for-a-frozen-system-reads-a-decided-match-as-a-frozen-one-2026-08-23))
- Adding to a system does not prove it RUNS — play a real match and measure before and after ([evidence](lessons-evidence.md#adding-to-a-system-does-not-prove-it-runs-play-a-real-match-and-measure-before-and-after-2026-08-20))
- A cell whose screen point sits under a HUD panel gets no pointermove — a browser test must pick mouse-REACHABLE cells ([evidence](lessons-evidence.md#a-cell-whose-screen-point-sits-under-a-hud-panel-gets-no-pointermove-a-browser-test-must-pick-mouse-reachable-cells-2026-08-19))
- An expectation derived from the same constant the code renders from moves WITH it — state the claim literally, then mutate ([evidence](lessons-evidence.md#an-expectation-derived-from-the-same-constant-the-code-renders-from-moves-with-it-state-the-claim-literally-then-mutate-2026-08-19))
- A whole-population characterization hash detects change but cannot LOCALISE it — a slice that legitimately moves it must bring a per-item digest ([evidence](lessons-evidence.md#a-whole-population-characterization-hash-detects-change-but-cannot-localise-it-a-slice-that-legitimately-moves-it-must-bring-a-per-item-digest-2026-08-19))
- A feature can pass every fixture test and still be UNREACHABLE from its menu — assert the player-facing options list ([evidence](lessons-evidence.md#a-feature-can-pass-every-fixture-test-and-still-be-unreachable-from-its-menu-assert-the-player-facing-options-list-2026-08-19))
- Verify graphics on the REAL default view (with fog + a real base), not a full-vision showcase fixture ([evidence](lessons-evidence.md#verify-graphics-on-the-real-default-view-with-fog-a-real-base-not-a-full-vision-showcase-fixture-2026-07-05))
- Read engine-tool output by LABEL, never by column position — a transposed food/gold column misdirected 3 increments ([evidence](lessons-evidence.md#read-engine-tool-output-by-label-never-by-column-position-a-transposed-foodgold-column-misdirected-3-increments-2026-07-04))
- Adversarial reviewer subagents can spawn nested grandchildren that orphan as stale "running" chips — tell them not to ([evidence](lessons-evidence.md#adversarial-reviewer-subagents-can-spawn-nested-grandchildren-that-orphan-as-stale-running-chips-tell-them-not-to-2026-07-04))
- Manual `until … do sleep` pollers for harness-tracked background tasks hang forever — don't write them ([evidence](lessons-evidence.md#manual-until-do-sleep-pollers-for-harness-tracked-background-tasks-hang-forever-dont-write-them-2026-07-04))
- Don't tune a chaotic emergent quantity against a single-run validator — the noise exceeds the signal ([evidence](lessons-evidence.md#dont-tune-a-chaotic-emergent-quantity-against-a-single-run-validator-the-noise-exceeds-the-signal-2026-07-04))
- An isolated fixture (few/zero units) exposes latent accessor-cache crashes a busy game never hits — `markDirty` without a prior `get`/`mutate` throws at flush ([evidence](lessons-evidence.md#an-isolated-fixture-fewzero-units-exposes-latent-accessor-cache-crashes-a-busy-game-never-hits-markdirty-without-a-prior-getmutate-throws-at-flush-2026-07-04))
- A single-tick "total gathered" snapshot ALIASES on the deposit-trip phase — a gather-RATE twin-fixture must measure over a window that outgrows one carry-load ([evidence](lessons-evidence.md#a-single-tick-total-gathered-snapshot-aliases-on-the-deposit-trip-phase-a-gather-rate-twin-fixture-must-measure-over-a-window-that-outgrows-one-carry-load-2026-07-03))
- Reusing verified art across a styling context is not a trivial UI change — the CSS hook travels with the markup ([evidence](lessons-evidence.md#reuse-existing-verified-art-is-not-a-trivial-ui-change-when-it-crosses-a-styling-context-the-css-hook-class-travels-with-the-markup-and-silently-applies-the-wrong-sizing-2026-07-02))
- A "+50-75% dependency regression" measured under full-suite load is contention until an isolated A/B proves otherwise ([evidence](lessons-evidence.md#a-50-75-dependency-regression-measured-under-full-suite-load-is-contention-until-an-isolated-ab-proves-otherwise-2026-06-30))
- A backgrounded CLI reviewer survives TaskStop and can rewrite the tree later — re-audit git before every commit ([evidence](lessons-evidence.md#a-backgrounded-cli-reviewer-claude--p-gemini-survives-taskstop-and-can-rewrite-your-working-tree-minutes-to-hours-later-re-audit-git-before-every-commit-2026-06-17))
- An LLM conformance-probe (or your memory) GAME-RULE claim is a hypothesis — verify it against the authoritative wiki before "fixing" to match it ([evidence](lessons-evidence.md#an-llm-conformance-probe-or-your-memory-game-rule-claim-is-a-hypothesis-verify-it-against-the-authoritative-wiki-before-fixing-to-match-it-2026-06-17))
- When reviewers DIVERGE on an empirical runtime fact, settle it with a runtime PROBE, not by re-reading the code ([evidence](lessons-evidence.md#when-reviewers-diverge-on-an-empirical-runtime-fact-settle-it-with-a-runtime-probe-not-by-re-reading-the-code-2026-06-16))
- Verify a playtest finding by REPLAYING the actual bundle, not by synthetic repro or trace narration ([evidence](lessons-evidence.md#verify-a-playtest-finding-by-replaying-the-actual-bundle-not-by-synthetic-repro-or-trace-narration-2026-06-13))
- Architecture-wide gates don't fire under affected-tests-only iteration ([evidence](lessons-evidence.md#architecture-wide-gates-dont-fire-under-affected-tests-only-iteration-2026-06-09))
- Codex review extraction must skip the prompt-echo ([evidence](lessons-evidence.md#codex-review-extraction-must-skip-the-prompt-echo-2026-05-02))
- Reorder AI decisions when handler-FIFO order matters ([evidence](lessons-evidence.md#reorder-ai-decisions-when-handler-fifo-order-matters-2026-05-01))
- Test-timeout margin under full-suite parallelism ([evidence](lessons-evidence.md#test-timeout-margin-under-full-suite-parallelism-2026-05-01))
- Villager gather state is on GathererComponent, not unitCommands ([evidence](lessons-evidence.md#villager-gather-state-is-on-gatherercomponent-not-unitcommands---2026-04-23))
- HUD display names belong on the UI side, not in the bridge ([evidence](lessons-evidence.md#hud-display-names-belong-on-the-ui-side-not-in-the-bridge---2026-04-23))
- Occupancy bindings should separate blockers from crowding ([evidence](lessons-evidence.md#occupancy-bindings-should-separate-blockers-from-crowding---2026-04-23))
- `fontFamily` alone does not prove a webfont loaded ([evidence](lessons-evidence.md#fontfamily-alone-does-not-prove-a-webfont-loaded---2026-04-23))
- Windowed edge-pan tests need explicit monitor metrics ([evidence](lessons-evidence.md#windowed-edge-pan-tests-need-explicit-monitor-metrics---2026-04-23))
- Topmost hit tests must follow draw order ([evidence](lessons-evidence.md#topmost-hit-tests-must-follow-draw-order---2026-04-23))
- Exact-click stack cycling needs its own click-cell memory ([evidence](lessons-evidence.md#exact-click-stack-cycling-needs-its-own-click-cell-memory---2026-04-22))
- Selection geometry must stay shared end-to-end ([evidence](lessons-evidence.md#selection-geometry-must-stay-shared-end-to-end---2026-04-22))
- Keep rule-table extractions behavior-preserving ([evidence](lessons-evidence.md#keep-rule-table-extractions-behavior-preserving---2026-04-22))
- Owned sheep need a real `visionSource` to peel fog ([evidence](lessons-evidence.md#owned-sheep-need-a-real-visionsource-to-peel-fog-2026-04-22))
- Move-order caches belong outside serialized commands ([evidence](lessons-evidence.md#move-order-caches-belong-outside-serialized-commands-2026-04-22))
- Phaser `activePointer` stays at (0,0) when the HUD captures events ([evidence](lessons-evidence.md#phaser-activepointer-stays-at-00-when-the-hud-captures-events-2026-04-17))
- Phaser `camera.worldView` is integer-rounded each frame ([evidence](lessons-evidence.md#phaser-cameraworldview-is-integer-rounded-each-frame-2026-04-17))
- A spec-correct one-line change can be a pervasive behavior change — the full suite is the gate, not diff review ([evidence](lessons-evidence.md#a-spec-correct-one-line-change-can-be-a-pervasive-behavior-change-the-full-suite-is-the-gate-not-diff-review-2026-06-14))
- Scope a hot-path behavior fix to a recovery-path-only guard to avoid mass deterministic-test churn ([evidence](lessons-evidence.md#scope-a-hot-path-behavior-fix-to-a-recovery-path-only-guard-to-avoid-mass-deterministic-test-churn-2026-07-01))
- A stateless per-tick surge schedule is absorbed by per-cell waypoint clamping — rate changes need a carry accumulator ([evidence](lessons-evidence.md#a-stateless-per-tick-surge-schedule-is-absorbed-by-per-cell-waypoint-clamping-rate-changes-need-a-carry-accumulator-2026-07-02))
- Piping `npm test` into `tail`/`grep` masks its exit code — the `&&` gate then reports green on a red suite ([evidence](lessons-evidence.md#piping-npm-test-into-tailgrep-masks-its-exit-code-the-gate-then-reports-green-on-a-red-suite-2026-07-02))
- The chaotic AI-vs-AI corpus cannot cleanly validate an economy micro-tweak ([evidence](lessons-evidence.md#the-chaotic-ai-vs-ai-corpus-cannot-cleanly-validate-an-economy-micro-tweak-2026-07-04))
- A verified-by-metric oracle finding is a claim about the metric, not the game — 14 of 16 "pinned units" were the sensor, not the sim ([evidence](lessons-evidence.md#a-verified-by-metric-oracle-finding-is-a-claim-about-the-metric-not-the-game-14-of-16-pinned-units-were-the-sensor-not-the-sim-2026-07-09))
- An early-window test green-lights a fix that still freezes later — bound the streak over the full horizon ([evidence](lessons-evidence.md#an-early-window-movement-test-green-lights-a-fix-that-still-freezes-terminally-bound-stationary-streaks-over-the-full-horizon-and-only-the-prove-rerun-catches-what-the-diff-cannot-2026-07-09))
- A render cue derived from a hidden-information event must gate on visibility AT THE EVENT, not at draw time ([evidence](lessons-evidence.md#a-render-cue-derived-from-a-hidden-information-event-must-gate-on-visibility-at-the-event-not-at-draw-time-2026-07-10))
- A render predicate that mirrors a drawing function must match what is ACTUALLY painted, not a simplified model ([evidence](lessons-evidence.md#a-render-predicate-that-mirrors-a-drawing-function-must-match-what-is-actually-painted-not-a-simplified-model-2026-07-10))
- A cache-backed mutation must pair with markDirty — and a round-trip test that reads both sides from world.state can't prove it ([evidence](lessons-evidence.md#a-cache-backed-mutation-must-pair-with-markdirty-and-a-round-trip-test-that-reads-both-sides-from-worldstate-cant-prove-it-2026-07-10))
- Gating a commit on an async test run: the task-level exit code and a look-alike summary can both lie ([evidence](lessons-evidence.md#gating-a-commit-on-an-async-test-run-the-task-level-exit-code-and-a-look-alike-summary-can-both-lie-2026-07-11))
- A Phaser Graphics re-submits its whole command list to the GPU every frame — "caching the redraw" is only half the fix ([evidence](lessons-evidence.md#a-phaser-graphics-re-submits-its-whole-command-list-to-the-gpu-every-frame-caching-the-redraw-is-only-half-the-fix-2026-07-11))
- Renderer cache identity must include the world epoch, not only a local revision ([evidence](lessons-evidence.md#renderer-cache-identity-must-include-the-world-epoch-not-only-a-local-revision-2026-07-12))
- A moving unit's current root is not its occupancy assignment — persist destination authority separately ([evidence](lessons-evidence.md#a-moving-units-current-root-is-not-its-occupancy-assignment-persist-destination-authority-separately-2026-07-14))
- A raw fog store needs two-time visibility for interpolation, not only a current-identity filter ([evidence](lessons-evidence.md#a-raw-fog-store-needs-two-time-visibility-for-interpolation-not-only-a-current-identity-filter-2026-07-14))
- Pause proofs must exercise the dependency-facing animation clock, not only authored base matrices ([evidence](lessons-evidence.md#pause-proofs-must-exercise-the-dependency-facing-animation-clock-not-only-authored-base-matrices-2026-07-14))
- Event visibility must be synchronized at mutation boundaries and persisted, not reconstructed by the renderer ([evidence](lessons-evidence.md#event-visibility-must-be-synchronized-at-mutation-boundaries-and-persisted-not-reconstructed-by-the-renderer-2026-07-14))
- A normal-crease edge source cannot discriminate in voxel geometry — every face junction is exactly 90°, so it inks every cube edge equally ([evidence](lessons-evidence.md#a-normal-crease-edge-source-cannot-discriminate-in-voxel-geometry-every-face-junction-is-exactly-90-so-it-inks-every-cube-edge-equally-2026-08-17))
- Equal values across stuck entities are not evidence of a shared allocator — they are equally consistent with nothing having happened ([evidence](lessons-evidence.md#equal-values-across-stuck-entities-are-not-evidence-of-a-shared-allocator-they-are-equally-consistent-with-nothing-having-happened-2026-08-20))
- When a unit will not move, count the DECISION per unit per tick before reading any code ([evidence](lessons-evidence.md#when-a-unit-will-not-move-count-the-decision-per-unit-per-tick-before-reading-any-code-2026-08-20))
- A global election followed by a local veto is a deadlock, not a safety check ([evidence](lessons-evidence.md#a-global-election-followed-by-a-local-veto-is-a-deadlock-not-a-safety-check-2026-08-20))
- An egress test one neighbour deep passes a two-cell pocket ([evidence](lessons-evidence.md#an-egress-test-one-neighbour-deep-passes-a-two-cell-pocket-2026-08-20))
- This game's screenshot diff has a ~1% animated noise floor; read every diff against it, not against zero ([evidence](lessons-evidence.md#this-games-screenshot-diff-has-a-1-animated-noise-floor-read-every-diff-against-it-not-against-zero-2026-08-20))
- Run the typecheck gate before theorising about a test's numbers — vitest alone will happily run a call TypeScript would have rejected ([evidence](lessons-evidence.md#run-the-typecheck-gate-before-theorising-about-a-tests-numbers-vitest-alone-will-happily-run-a-call-typescript-would-have-rejected-2026-08-23))
- A fixture that parks villagers on the ground the AI builds on measures the fixture, not the AI ([evidence](lessons-evidence.md#a-fixture-that-parks-villagers-on-the-ground-the-ai-builds-on-measures-the-fixture-not-the-ai-2026-08-23))
- Reading a gate's output through `tail`/`grep` instead of its exit code hides the gate ([evidence](lessons-evidence.md#reading-a-gates-output-through-tailgrep-instead-of-its-exit-code-hides-the-gate-2026-08-24))
- A cell index in a projected frame is a CONTRACT with the decoder, not a private key ([evidence](lessons-evidence.md#a-cell-index-in-a-projected-frame-is-a-contract-with-the-decoder-not-a-private-key-2026-08-24))
- A `as unknown as` fake is invisible to the typechecker exactly where the code starts asking it new questions ([evidence](lessons-evidence.md#a-as-unknown-as-fake-is-invisible-to-the-typechecker-exactly-where-the-code-starts-asking-it-new-questions-2026-08-24))
- A probe that finds NOTHING is a claim about your query — verify the field exists and the source is unfiltered ([evidence](lessons-evidence.md#a-probe-that-finds-nothing-is-a-claim-about-your-query-2026-08-29))
