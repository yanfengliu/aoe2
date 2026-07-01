# Lessons learned

Append durable engineering lessons here. Each entry should teach a future agent
something that is not obvious from the current code — a trap, a non-obvious
invariant, or a rule that keeps biting if ignored. One entry per lesson, newest
at the top. Keep entries short; link to code or devlog rather than restating.

Format:

```
## <short title> — YYYY-MM-DD
Context: when this came up.
Lesson: the durable rule or trap, phrased so it transfers to future work.
Pointer: devlog entry, file, or test that illustrates it.
```

---

## A "+50-75% dependency regression" measured under full-suite load is contention until an isolated A/B proves otherwise — 2026-06-30

| Field | Value |
|---|---|
| Surfaced by | `docs/debugging/2026-06-30-engine-throughput-regression.md`; the standing `docs/engine-feedback/current.md` claim of a civ-engine 0.8.24→1.0.1 "+50-75% sim-throughput regression" that had doubled 9 fixture files' timeout caps (`x2 2026-06-12`). |
| Reviewer findings | n/a — process lesson (self-investigation; the false attribution had lived in engine-feedback for ~18 days pointing future sessions at a non-existent engine bisect). |
| Fix commit | this session (aoe2 caps ratchet + engine `commands` benchmark scenario; no engine code fix — nothing regressed). |
| Test added | n/a — process lesson. The engine gained a `commands` benchmark-gate scenario so a *real* future per-tick regression in the strict/command/event/many-system profile is caught. |
| Behavior delta | Without the investigation, the next session would have bisected a non-existent engine regression (a wasted cycle) and the misleading 120-180s test caps + false engine-feedback would have compounded. The measured truth: every per-tick engine hot-path file is byte-identical across 0.8.23→1.0.2; the only per-tick change (v1.0.0 strict-by-default) is within noise on the real ageUp fixture (42.71s strict-on vs 43.24s strict-off, isolated); the +50-75% only appears under the `threads` pool (CPU saturation). |

Lesson: a throughput "regression" whose numbers were all captured **under full-suite parallel load** is a claim about *contention*, not per-tick cost, until you prove otherwise with two cheap ground-truth measurements: (1) a STATIC diff audit of the dependency's per-tick hot-path files across the exact version window (`git log <old>..<new> -- <hot-path files>`) — if they're byte-identical, there is no code regression to find; (2) an ISOLATED, single-thread A/B of the one variable that actually changed (here: strict on vs off on the real fixture). Isolated-vs-contended divergence (ageUp ~43s alone vs the cited 136-209s) is the signature of contention. Corollary: timeout caps are ceilings, not runtime — doubling them can be the right *action* (tests approaching their ceiling under a growing contended suite) for the wrong *reason* (blaming a dependency); size caps to measured *contended* per-test time × ~3, and annotate them truthfully so the next reader isn't sent hunting a phantom bug. When a dependency's own regression gate "stayed green" while a consumer slowed, the gap is usually the gate's *load profile*, not a hidden regression — close it by adding the consumer-shaped scenario.
Pointer: [docs/debugging/2026-06-30-engine-throughput-regression.md](../debugging/2026-06-30-engine-throughput-regression.md); civ-engine `scripts/rts-benchmark.mjs` `runCommandScenario`; the 9 `tests/simulation/*.test.ts` cap annotations.

## A backgrounded CLI reviewer (`claude -p` / `gemini`) survives TaskStop and can rewrite your working tree minutes-to-hours later — re-audit git before EVERY commit — 2026-06-17

| Field | Value |
|---|---|
| Surfaced by | working-tree audit during the ai-age-up-priority work: `git status` showed `prototypeBuildingRules.ts` + 2 test files re-modified with the *reverted* houses-prereq fix, AFTER the review task was `TaskStop`ped AND after a clean intervening commit (394aa25) |
| Reviewer findings | n/a — process lesson (the contaminator WAS a reviewer) |
| Fix commit | the ai-age-up-priority commit (re-reverted the 3 files via `git checkout HEAD --` and re-ran the commit guard before staging) |
| Test added | n/a — process lesson |
| Behavior delta | Without the pre-commit re-audit I would have bundled the reverted houses-prereq gameplay REGRESSION (house/palisade-wall/farm wrongly counting toward Feudal — the exact change the 3-CLI review caught and I reverted hours earlier) into the unrelated AI-age-up commit, silently re-shipping it. The contamination re-appeared TWICE this session (once after the first revert, once after a clean commit). |

Context: the feudal-prereq review (`brgsb442u`) launched `codex`, `claude -p`, and `gemini` as backgrounded `&` children inside one Bash task. `TaskStop` killed the bash WRAPPER, not the children. Gemini (which was 429-retrying for a long time, per the prior session) survived as an orphan, eventually got through, and — in plan mode, which still exposes the `replace`/file-edit tool — re-applied the broken diff it was "reviewing" to the working tree long after the task was stopped (`ps` later showed no live gemini, so it wrote once and exited). `claude -p` is likewise not truly read-only even with a Read/Grep-only `--allowedTools` (see `reference_claude_p_reviewer_writes.md` memory).
Lesson: after stopping a multi-CLI review task, the orphaned reviewer can mutate the tree minutes-to-hours later — a single post-stop `git status` is not enough. Re-audit `git diff HEAD` immediately before EVERY `git add`/commit, and keep a commit guard that aborts on unexpected staged paths. **Audit ALL diff paths, not just `src/`+`tests/`:** in the ai-age-up-priority work my audits checked only `src tests`, but the orphan had also re-applied the broken rule to `design/spec-final.md` — that `design/` write slipped through every audit and was caught only by the mandatory 3-CLI review (Codex, read-only sandbox, genuinely read the live spec and flagged it HIGH). So the multi-CLI review is a load-bearing backstop against contamination your scoped audits miss, AND you must widen the audit to `git diff HEAD` (every path). Prefer Codex's `--sandbox read-only` for reviewers (it cannot write); treat `claude -p` and `gemini` review output as potentially tree-mutating; run each reviewer as its OWN background task (not `&`-children in one task) so TaskStop actually kills it. Pointer: ai-age-up-priority `2026-06-17/1/REVIEW.md` finding 1; `reference_claude_p_reviewer_writes.md`.

## An LLM conformance-probe (or your memory) GAME-RULE claim is a hypothesis — verify it against the authoritative wiki before "fixing" to match it — 2026-06-17

| Field | Value |
|---|---|
| Surfaced by | `docs/threads/done/feudal-prereq-buildings/2026-06-17/1/REVIEW.md`; campaign-11 `playtest:findings` finding (a) |
| Reviewer findings | Claude opus[1m] max — HIGH [H1] "the core Dark→Feudal rule is factually WRONG per AoE2" (with fetched Liquipedia + Fandom quotes). Codex gpt-5.5 xhigh did NOT challenge the rule (only doc nits). A reviewer divergence resolved by the authoritative wiki, not by vote. |
| Fix commit | the docs-only "finding (a) = not-a-bug" commit (this) — the attempted code fix was REVERTED, not shipped |
| Test added | n/a — process lesson |
| Behavior delta | An attempted fix added house/palisade-wall/farm to `DARK_AGE_PREREQUISITE_BUILDINGS` — a gameplay REGRESSION: AoE2 advances Dark→Feudal on 2 of {Barracks, Dock, Lumber Camp, Mill, Mining Camp} and excludes Houses/Farms/Walls. Had it shipped, players (and the AI) could age up with 2 Houses / 2 Farms / 2 Palisade Walls, diverging from AoE2. The mandatory 3-CLI review + the AoE2 wiki caught it before commit; the existing {mill, lumber-camp, mining-camp, barracks} was already correct (the qualifying five minus Dock, absent in this land-only slice). |

Context: a `playtest:findings` conformance probe is an LLM grading the game against its OWN belief of AoE2 rules — that belief can be WRONG. Finding (a) claimed "Houses count toward Feudal; two Houses suffice" — the OPPOSITE of the real rule. Verifying the CODE confirmed the probe's claim about the Set's contents (house was absent) but said NOTHING about whether the rule is correct, so it gave false confidence. The decisive checks were (1) the mandatory multi-CLI review with a reviewer told to verify AoE2 fidelity against sources, and (2) fetching the authoritative wiki myself (Fandom: "Houses, Farms, and Walls … do not count").
Lesson: an LLM probe's (or your memory's) GAME-RULE claim is a hypothesis about an external fact, not ground truth. Before building a fix to match it, verify the rule against the authoritative wiki (Fandom/Liquipedia via WebFetch/WebSearch). Code-reading only tells you what the code DOES, not whether the rule is RIGHT — so it cannot validate a rule claim. And keep the review prompt's "verify AoE2 fidelity with sources" directive: it is what surfaced this would-be regression. Pointer: thread feudal-prereq-buildings `REVIEW.md`; `design/roadmap.md` finding (a).

## When reviewers DIVERGE on an empirical runtime fact, settle it with a runtime PROBE, not by re-reading the code — 2026-06-16

| Field | Value |
|---|---|
| Surfaced by | `docs/threads/done/gather-unreachable-reroute/2026-06-16/1/REVIEW.md` finding F5 (the farm-tier divergence); reinforced by the feudal-prereq-buildings slice's "you have 0"→"have 1" decision |
| Reviewer findings | Codex LOW-1 "the fixture's boxed farm is tier-1 (`owner=null`), not tier-0" — CORRECT. Claude's codebase-grounded verification "The farm is owner=2 (tier-0)" — WRONG (it read the build-complete path, but the fixture uses the spawn path). |
| Fix commit | `01b6c1a` — fixture comments + spec/devlog/changelog/summary/roadmap corrected from "tier-0 owned farm" to "tier-1; reproduces via below-fan-out-cap villager count" |
| Test added | n/a — process lesson |
| Behavior delta | Had I trusted Claude's confident "tier-0" verification, ~6 doc surfaces + the fixture comment would have shipped a wrong mechanism claim. A 6-line runtime probe (`createSimulationBridge(seed)` → `getEconomyState().resources`, reading `farm.owner`) read the GROUND TRUTH (`owner=null`) and settled it. The same probe pattern in the feudal slice confirmed owner 2 starts with a forward House, making the "have 0"→"have 1" test update ground-truth-correct rather than a guess. |

Context: AGENTS.md already says "verify reviewer claims against the codebase" (grep/read the code). This SHARPENS it for EMPIRICAL claims about runtime state — entity ownership at spawn, what a player starts with, what value a constant resolves to after wiring, what a fixture actually produces. Code-reading can mislead BOTH the reviewer AND the driver, because the read path differs from the executed path (a spawned farm's resource is `owner=null` even though a villager-BUILT farm's is owner-set; a "shared constant" depends on which call site consumes it). Two reviewers gave opposite factual answers; a runtime probe was the only authority.
Lesson: when reviewers diverge on a factual/empirical claim about runtime behavior (not a design opinion), write a few-line `createSimulationBridge` + `getEconomyState`/`query` probe and read the actual state — do NOT pick a winner by re-reading code. This is the live-bridge analogue of the replay-the-bundle lesson below. Pointer: gather-reroute `REVIEW.md` F5; the feudal-prereq-buildings devlog "have 0→have 1" note.

## Verify a playtest finding by REPLAYING the actual bundle, not by synthetic repro or trace narration — 2026-06-13

| Field | Value |
|---|---|
| Surfaced by | User directive 2026-06-13 ("Are you using the debugging tools the engine provides?"); `docs/engine-feedback/current.md` endTick note; `scripts/replay-inspect.mjs` output on `output/playtests-llm/campaign-4.json` |
| Reviewer findings | n/a — process lesson. The two WRONG hypotheses were: a conformance-probe finding (`campaign-4.findings.md` HIGH "wood gather is broken") and a debugging subagent's synthetic-repro conclusion ("villager attrition from enemy militia raids") |
| Fix commit | AGENTS.md Debugging rule + `scripts/replay-inspect.mjs` (this commit) |
| Test added | n/a — process lesson (the tool is `replay-inspect`, not a unit test) |
| Behavior delta | Before: the wood-economy "bug" was diagnosed two different ways, both wrong, and a fix to the gather code would have been wasted. After: replaying campaign-4 with `SessionReplayer.openAt` + `getEconomyState()` showed the real state — owner 2 grew to 19 villagers (no attrition), enemy-near-base 0 all game (no raids), opponent fully inert, yet 18/19 woodcutters stuck in task `to-resource` with 0 gathering and full 100/100 trees 8 cells away. The true bug is a villager economy state-machine stall at scale, not gather/credit/drop-off. The same pass exposed the recorder `endTick: 0` bug. |

Context: an LLM playtest finding is a CLAIM about a recorded run; the agent's trace narration reflects what the *agent believed* (it thought gather was broken because resources weren't rising — actually its woodcutters were gridlocked). `civ-engine` provides `SessionReplayer` (replay any bundle to any tick), `WorldDebugger`, and occupancy/path/visibility debug probes. Replaying the exact bundle and reading ground-truth `getEconomyState()` per owner is the fast, authoritative way to find what actually happened. Synthetic `createSimulationBridge` repros are a SECOND step (isolate a confirmed cause) — they can reproduce a *different* scenario than the real run (the subagent's default map had an active AI raider; campaign-4's opponent was inert).
Lesson: for any recorded-run bug, `npm run replay:inspect -- <bundle>` (or a `SessionReplayer.openAt` + `WorldDebugger` pass) BEFORE writing a repro or a fix. Pointer: `scripts/replay-inspect.mjs`, AGENTS.md "Debugging" first bullet, `docs/engine-feedback/current.md` endTick entry.

## Architecture-wide gates don't fire under affected-tests-only iteration — 2026-06-09

| Field | Value |
|---|---|
| Surfaced by | Full-suite run for the 2026-06-09 doc-housekeeping commit (`docs/devlog/detailed/2026-06-09_2026-06-09.md`) — `fileSizeBudget.test.ts` red at HEAD 860557e |
| Reviewer findings | n/a — process lesson (surfaced by running gates, not a reviewer) |
| Fix commit | `5a14832` — legacy pin `'tests/playtest/llmRunner.test.ts': 692` |
| Test added | n/a — the detector already existed (`tests/architecture/fileSizeBudget.test.ts`); the gap was process, not coverage |
| Behavior delta | `npm test` was red at HEAD for a month: f2df6ce (Phase-6.C.1, 2026-05-09) grew `llmRunner.test.ts` to 692 LOC > 500 hard limit with no exemption, and that commit plus 860557e shipped while devlog entries recorded "full gates pass." Post-fix the suite is green with the violation pinned and ratcheting downward. |

Context: Phase-6.C.1 grew `tests/playtest/llmRunner.test.ts` past the 500-LOC hard limit. The session iterated with affected-tests-only runs (per the AGENTS.md iteration rule), and the architecture suite never re-fired — `fileSizeBudget.test.ts` responds to the size of every file under `src/` + `tests/`, so it is "affected" by any commit that adds lines anywhere, a dependency no import- or path-based test-selection heuristic catches.

Lesson: cross-cutting architecture gates (file-size budgets, dependency rules, naming audits) are affected by EVERY change, so an iteration shortcut that runs only behavior-adjacent tests must still include `tests/architecture/`. And a "full gates pass" claim is only valid for the tree state at the moment the suite ran — any edit after that run, including test-only line growth, invalidates the claim. Run the full suite once more after the LAST edit, not just after the last interesting one.

Pointer: [tests/architecture/fileSizeBudget.test.ts](../../tests/architecture/fileSizeBudget.test.ts) legacy-pin comment; devlog [2026-06-09](../devlog/detailed/2026-06-09_2026-06-09.md).

## Codex review extraction must skip the prompt-echo — 2026-05-02

| Field | Value |
|---|---|
| Surfaced by | User-driven post-mortem after I claimed "Codex unreachable" across 8 multi-CLI reviews (impls 16–24 of `docs/threads/done/replay-scrubber/`). User: "Did all your code and docs get reviewed?" → "Then you can't claim that upgrading codex was the fix" |
| Reviewer findings | n/a — process lesson |
| Fix commit | (this commit) — AGENTS.md extraction snippet |
| Test added | n/a — process lesson |
| Behavior delta | Pre-fix: across impls 16–24, 8 multi-CLI reviews recorded "Codex unreachable" in the synthesis. In reality, Codex emitted real HIGH/MAJOR findings (same-tick over-push bypass of queue cap; alias-mutation in shallow codecs; visibility staleness post-bootstrap) that I missed because the awk extraction matched the FIRST `===BEGIN-REVIEW===` marker in the file — which sits inside the prompt-echo, not the actual review. The shipped commits carry these unaddressed bugs. |

Context: `codex exec --ephemeral` echoes its full stdin (prompt + diff + source-file reads) into the output before printing the actual review. When the prompt itself contains the literal string `===BEGIN-REVIEW===` (because we instruct Codex to bracket its review with that marker), `awk '/===BEGIN-REVIEW===/{p=1; next} /===END-REVIEW===/{exit} p'` matches the prompt's restatement of the marker as instructions, captures the prompt's body as if it were the review, and stops at the prompt's restatement of `===END-REVIEW===`. The actual review — Codex's real findings — sits at the END of the file, after a `^codex$` header line that delimits the prompt-echo from the response.

Lesson: when extracting structured output from a tool that echoes its input (Codex `exec`, any tool with `--ephemeral`-style stdin transcription), anchor the extraction on a tool-emitted marker that does NOT appear in the prompt. For Codex specifically, slice from `^codex$` first, then awk the BEGIN/END pair from that suffix:

```bash
sed -n '/^codex$/,$p' codex.txt | awk '/===BEGIN-REVIEW===/{p=1; next} /===END-REVIEW===/{exit} p'
```

A successful smoke test (e.g. `codex exec` returning `ok`) does NOT validate the extraction logic — it only validates the tool. Always sanity-check by counting reviewer findings against expectations: if Gemini found 4 issues and Claude found 6, "Codex no findings" three commits in a row should raise a flag, not be assumed to mean Codex is unreachable. Convergence is signal; persistent divergence between reviewers is also signal.

Pointer: [AGENTS.md](../../AGENTS.md) — Code review section's Codex extraction snippet; affected reviews under `docs/threads/done/replay-scrubber/2026-05-01/impl-{16..24}/REVIEW.md` (post-mortem note added).

## Reorder AI decisions when handler-FIFO order matters — 2026-05-01

| Field | Value |
|---|---|
| Surfaced by | `docs/threads/done/replay-scrubber/2026-05-01/impl-16/REVIEW.md`; debug trace at `docs/debugging/2026-05-01-phase-1c-ai-intention-refactor.md` |
| Reviewer findings | n/a — surfaced during Phase 1C self-debug before review |
| Fix commit | (Phase 1C commit on `main`) |
| Test added | `tests/simulation/aiPlayer.test.ts > "preserves baseline barracks-rush behavior: AI builds a Barracks and trains Militia on ai-rush-fixture"` (existing test that broke under the naive refactor) |
| Behavior delta | Pre-fix: post-1C AI never trained militia within 3000-tick budget on `ai-rush-fixture` because the +1-tick handler delay shifted barracks-completion out of alignment with the corner-case tick where pre-1B's villager gate accidentally blocked food spend. Post-fix: militia trains at tick ~480 (210 ticks training time after the militia push at tick 270 — same training pacing as pre-1B). |

Context: when synchronous AI helpers (`enqueueTraining` / `enqueueResearch` / `startConstruction`) are replaced by intention pushes that handlers apply at next tick, the AI's decision logic loses the natural same-tick stockpile feedback. Pre-1B's barracks-rush relied on a single corner-case tick (barracks-complete + tcQueue full + food preserved) that the +1-tick handler delay erased.

Lesson: when over-acceptance is intentional (B1/B2 contract: validator best-effort, handler authoritative re-check), priority must be encoded in the **push order** because the FIFO-ordered handler resolves contention in submission order. Don't try to recover synchronous semantics with reserved-resource gating — that fights the contract and creates new failure modes (the second push fails canAfford against the local reserve while the validator would have approved it). Instead, decide push priority once at design time: high-priority intentions (military for a barracks-rush AI) push first; subsequent intentions over-spend on paper but the handler picks the affordable subset and the surplus silently no-ops. If a second AI strategy ever exists (e.g., booming), condition the push order on plan kind rather than reverting to reservations.

Pointer: [src/game/simulation/bridge/systems/aiSystem.ts](../../src/game/simulation/bridge/systems/aiSystem.ts) — `pickUnitMix` block ordered before villager training; KAD-0005 in [docs/architecture/decisions.md](../architecture/decisions.md).

## Test-timeout margin under full-suite parallelism — 2026-05-01

| Field | Value |
|---|---|
| Surfaced by | Phase 1C full-suite run; one timeout in `tests/simulation/createSimulationBridge.ageUp.test.ts > "can research Feudal Age, build an Archery Range, and train an Archer"` |
| Reviewer findings | n/a — surfaced during validation gate, not review |
| Fix commit | (Phase 1C commit on `main`) — bumped 3 ageUp test timeouts 40_000 → 60_000 |
| Test added | n/a — process lesson; the existing test was the symptom |
| Behavior delta | Pre-fix: the test passed in isolation (33 s) and pre-1C in the full suite (just barely fit under 40 s with parallel-worker contention). Post-1C: still 32 s in isolation, but full-suite parallelism on Windows pushed past the 40 s ceiling. Post-fix: 60 s ceiling absorbs the FU8 RPC-flake variance. |

Context: vitest workers on Windows have a known birpc round-trip flake (FU8, documented in `vitest.config.ts`) that bites only under the cumulative load of a long-running full-suite run. A test that just barely fits its per-test timeout in isolation will flake the moment any change shifts cumulative duration even slightly.

Lesson: a test that passes in isolation but fails under full-suite parallelism is not a flake to ignore — the per-test timeout has insufficient margin against the FU8 RPC-flake variance. Cross-check pre-change duration in isolation against the timeout ceiling; if the margin is less than ~20%, bump the timeout proactively (or optimize the per-tick cost) rather than committing and letting the next change push it over. The `vitest.config.ts` FU8 comment already acknowledges Windows-specific RPC flakes; per-test timeouts should be set assuming that load, not isolation timing.

Pointer: [vitest.config.ts](../../vitest.config.ts) — FU8 explanation; [tests/simulation/createSimulationBridge.ageUp.test.ts](../../tests/simulation/createSimulationBridge.ageUp.test.ts) — bumped per-test timeouts.

## Villager gather state is on GathererComponent, not unitCommands - 2026-04-23
Context: adding an "activity" label ("Gathering wood", "Returning food") to the selection panel, the first draft read `unitCommands.get(id)` expecting a `move` command carrying `targetEntityKind === 'resource'`.
Lesson: `issueUnitGatherCommand` clears `unitCommands` and writes `GathererComponent.task` directly (`'to-resource' | 'gathering' | 'to-dropoff'`). `unitCommands` never holds gather state in normal play, and `UnitCommand.targetEntityKind === 'resource'` is only produced by attack commands against wildlife. Any sim-side feature that wants to know "what is this villager doing right now" must consult `GathererComponent` alongside (and often instead of) `unitCommands`.
Pointer: [src/game/simulation/createSimulationBridge.ts](../../src/game/simulation/createSimulationBridge.ts) (`computeUnitActivity`), [tests/simulation/selectionActivity.test.ts](../../tests/simulation/selectionActivity.test.ts).

## HUD display names belong on the UI side, not in the bridge - 2026-04-23
Context: the first cut of the activity feature added a local kebab-to-Title-Case helper (`formatEntityNameForActivity`) inside the simulation bridge to avoid a bridge→ui import. Codex review then caught visible label drift: `scout` rendered as `Scout` instead of `Scout Cavalry`, upgrade techs rendered as `Man At Arms Upgrade` instead of `Man-at-Arms`.
Lesson: the bridge should emit identifiers (`'scout'`, `'forging'`, kind/type pairs), not human-readable strings. `src/ui/hud/displayNames.ts` is the single source of truth for human names. When the temptation is to reach across the layer for `formatEntityName`, the right move is instead to surface a structured payload through `SelectionState` and let the renderer format. This keeps the one-way sim→UI boundary and avoids silent label drift.
Pointer: [src/game/simulation/createSimulationBridge.ts](../../src/game/simulation/createSimulationBridge.ts) (`computeUnitActivity`), [src/ui/hud/selectionPanel.ts](../../src/ui/hud/selectionPanel.ts) (`formatActivityLabel`).

## Occupancy bindings should separate blockers from crowding - 2026-04-23
Context: migrating the simulation bridge from hand-rolled placement/path scans onto `civ-engine`'s `OccupancyBinding`.
Lesson: in this game, buildings/resources/terrain are whole-cell blockers for movement, but unit presence is only crowding: it blocks building placement while still allowing unit pathing through the coarse cell. Do not collapse those rules into one flat `isBlocked` check when wiring engine occupancy into the bridge, or units will accidentally become hard path blockers.
Pointer: [src/game/simulation/worldOccupancy.ts](../../src/game/simulation/worldOccupancy.ts), [src/game/simulation/createSimulationBridge.ts](../../src/game/simulation/createSimulationBridge.ts), [tests/simulation/worldOccupancy.test.ts](../../tests/simulation/worldOccupancy.test.ts).

## `fontFamily` alone does not prove a webfont loaded - 2026-04-23
Context: adding a shipped HUD font initially used a browser test that only checked `getComputedStyle(...).fontFamily`.
Lesson: computed `fontFamily` only reflects the declared cascade, not whether the bundled face actually loaded. If a UI contract depends on a shipped webfont, wait for `document.fonts.ready` and assert `document.fonts.check(...)` for the weights you rely on, otherwise a broken font import can silently fall back while the test still passes.
Pointer: [tests/browser/game-hud-and-camera.spec.ts](../../tests/browser/game-hud-and-camera.spec.ts), [docs/devlog/detailed/2026-04-23_2026-04-23.md](../devlog/detailed/2026-04-23_2026-04-23.md).

## Windowed edge-pan tests need explicit monitor metrics - 2026-04-23
Context: changing hover-at-edge panning to require fullscreen exposed a browser-test trap on Playwright's default headless Chromium setup.
Lesson: do not assume a browser test viewport is "windowed." In this repo's headless Playwright environment, `window.outerWidth/outerHeight` and `screen.width/height` default to the same values, so fullscreen-window heuristics will look true unless the test overrides monitor metrics before boot. If a camera/input contract depends on fullscreen-vs-windowed state, lock it with explicit monitor emulation plus a real fullscreen transition.
Pointer: [src/phaser/scenes/GameScene.ts](../../src/phaser/scenes/GameScene.ts), [tests/browser/helpers/gameTestHelpers.ts](../../tests/browser/helpers/gameTestHelpers.ts), [tests/browser/game-hud-and-camera.spec.ts](../../tests/browser/game-hud-and-camera.spec.ts).

## Topmost hit tests must follow draw order - 2026-04-23
Context: precise unit-click geometry still felt wrong on close overlaps because the final same-layer tiebreak was using array index in the wrong direction.
Lesson: in this Phaser scene, `displayedEntities` are drawn in array order, so later entries are visually on top. Any hit-test fallback that uses array index as a render-order proxy must prefer the highest index, or exact clicks will still select the underneath entity when units overlap tightly.
Pointer: [src/phaser/scenes/entityHitTest.ts](../../src/phaser/scenes/entityHitTest.ts), [tests/phaser/entityHitTest.test.ts](../../tests/phaser/entityHitTest.test.ts).

## Exact-click stack cycling needs its own click-cell memory - 2026-04-22
Context: fixing precise unit selection uncovered a subtle overlap bug where the first exact click on a stacked unit could jump to the next target just because that unit was already selected from a different gesture.
Lesson: if left-click selection can cycle overlapping hits, remember the last exact click cell separately from the current selection. Key the cycle off a repeated click in the same click cell, and let that cycle win over same-cell double-click promotion, or stacked selections become inconsistent after drag-boxes, tile clicks, or prior exact clicks elsewhere on the same unit.
Pointer: [src/phaser/scenes/GameScene.ts](../../src/phaser/scenes/GameScene.ts), [tests/browser/game-selection.spec.ts](../../tests/browser/game-selection.spec.ts).

## Selection geometry must stay shared end-to-end - 2026-04-22
Context: tightening unit click precision exposed two opposite failure modes at once: padded hit circles made close units impossible to click cleanly, while splitting click and marquee logic across different geometry/filter rules made preview highlights disagree with the final selection.
Lesson: keep one exact rendered-body contract for left-click hit tests, marquee intersection, and live marquee preview, then run the final preview ids back through the same bridge-side selectability filter used on mouse-up. If selection needs an extra tie-breaker like "human-owned first," keep that policy scoped to selection only so generic context-command targeting does not inherit it.
Pointer: [src/phaser/scenes/entityHitTest.ts](../../src/phaser/scenes/entityHitTest.ts), [src/phaser/scenes/GameScene.ts](../../src/phaser/scenes/GameScene.ts), [tests/phaser/entityHitTest.test.ts](../../tests/phaser/entityHitTest.test.ts), [tests/browser/game-selection.spec.ts](../../tests/browser/game-selection.spec.ts).

## Keep rule-table extractions behavior-preserving - 2026-04-22
Context: splitting the simulation bridge's inline economy/building/unit rule tables into dedicated modules made it tempting to also "fix" a few AoE2-stat inconsistencies while the data was in one place.
Lesson: if the user asked for cleanup or refactoring, extract the current mechanics first and lock them with gameplay-facing tests. Treat any balance, tech-propagation, or combat-table correction as a separate explicit gameplay change, even when the underlying data clearly wants improvement.
Pointer: [docs/devlog/detailed/2026-04-22_2026-04-22.md](../devlog/detailed/2026-04-22_2026-04-22.md); [tests/simulation/prototypeRules.test.ts](../../tests/simulation/prototypeRules.test.ts).

## Owned sheep need a real `visionSource` to peel fog — 2026-04-22
Context: adding "claimed sheep reveal terrain as they move" looked like an ownership/tint tweak at first, but the fog system never consults resource ownership directly.
Lesson: in this sim, visibility only updates from ECS entities that have both `position` and `visionSource`. If a movable resource is supposed to scout for its owner, syncing `resource.owner` alone is insufficient — you must add or remove a `visionSource` alongside that ownership state.
Pointer: [src/game/simulation/createSimulationBridge.ts](../../src/game/simulation/createSimulationBridge.ts) `updateSheepOwnership`, `syncSheepVisionSource`; [tests/simulation/sheepVision.test.ts](../../tests/simulation/sheepVision.test.ts).

## Move-order caches belong outside serialized commands — 2026-04-22
Context: fixing laggy selected-unit movement exposed two easy traps: caching the planned route directly on `UnitCommand` blurred the save/load boundary, and reusing a stale move route across a new right-click order made units keep following the old path.
Lesson: treat `unitCommands` as durable player intent only. Keep per-tick pathing state in a separate side map keyed by unit id, clear it whenever a command is replaced or deleted, and only reuse a cached route while the immediate next cell is still passable. That preserves save/load correctness and avoids stale-route bugs while still removing the per-tick A* churn.
Pointer: [src/game/simulation/createSimulationBridge.ts](../../src/game/simulation/createSimulationBridge.ts) `movePathCache`, `clearUnitCommand`, `setUnitCommand`, `resolveMovePlanFromCache`; [tests/simulation/movementPathCaching.test.ts](../../tests/simulation/movementPathCaching.test.ts).

## Phaser `activePointer` stays at (0,0) when the HUD captures events — 2026-04-17
Context: Edge-pan was silently scrolling the camera NW in browser tests. Playwright drove the mouse only over the HUD minimap (which has `pointer-events: auto`), so Phaser's game-canvas input plugin never saw a `mousemove`. `activePointer.x/y` stayed at their default `(0, 0)`, which is inside the 20 px top-left edge zone — after the 500 ms hover delay, edge-pan kicked in and drifted the camera by ~16 px between the user action and the snapshot.
Lesson: Any input handler that reads `this.input.activePointer.x/y` as if it were a real cursor position must guard against the pointer never having been updated. Use `pointer.moveTime === 0` as the "no real events yet" signal — `(0, 0)` is a valid coordinate and cannot distinguish "at top-left" from "unset". Also remember: `pointer-events: auto` on any HUD element over the game canvas will hide mouse events from Phaser.
Pointer: [src/phaser/scenes/GameScene.ts](../../src/phaser/scenes/GameScene.ts) `getEdgePanDelta`; devlog entry 2026-04-17 on canvas aspect fix.

## Phaser `camera.worldView` is integer-rounded each frame — 2026-04-17
Context: The browser test API exposed `camera.worldView.x/y/width/height` as the visible world rectangle. With `pixelArt: true` (→ `roundPixels: true`), Phaser's `preRender` rounds `scrollX/Y` via `Math.floor` and then recomputes `worldView` using rounded math, so the reported rectangle can disagree with the non-rounded `scrollX + (width - width/zoom)/2` by up to one pixel. That was enough to fail a strict "click here, center there" minimap assertion.
Lesson: When reporting camera viewport state to code that does math on it (tests, minimap viewport overlay), compute it from the raw `scrollX/Y`, `width/height`, and `zoom` rather than reading `camera.worldView` — the latter is intended for rendering, not for precise world-space queries.
Pointer: [src/phaser/scenes/GameScene.ts](../../src/phaser/scenes/GameScene.ts) `getCameraState`.

## A spec-correct one-line change can be a pervasive behavior change — the full suite is the gate, not diff review — 2026-06-14

| Field | Value |
|---|---|
| Surfaced by | this session's `tc-base-fire` attempt: `tmp/review-runs/tc-base-fire/2026-06-14/1/fulltest.txt` (27 failures) vs the three diff reviews (all clean). Also the prior `dark-age-palisade` iteration (4 `createSimulationBridge.ageUp` assertions broke the same way). |
| Reviewer findings | Codex + Claude + Gemini all reviewed the one-line `buildingArrowCount` diff and APPROVED with no correctness findings — the regression was invisible at the diff level. A later Claude review then claimed only ~4-7 failures were real and ~21 were "pre-existing flakiness I verified pass in isolation" — FABRICATED: that reviewer had only Read/Glob/Grep, no test runner, so it ran nothing. My own measurement disproved it. |
| Fix commit | n/a — the change was reverted (twice: once on the first 27-failure run, and the docs were re-corrected after a wrong "bounded ~4-7" narrative — cfff9ed — was disproven); the gap is logged in `design/roadmap.md` (campaign-8) as deferred pending combat-fixture decoupling. |
| Test added | n/a — process lesson. |
| Behavior delta | making an empty Town Center fire its (spec-mandated §10.8) base arrow breaks ~25 combat-isolation tests across 9 files. Measured directly: baseline HEAD = 1255 pass / 0 fail; with the fix = 25 fail; each of the 9 files re-run **in isolation** = the same 25 fail (every HP delta is exactly 5 = one TC arrow, e.g. Camel-vs-Scout expected 31 got 26). Zero are flaky; all 25 are real. Root cause: `createSimulationBridge.helpers` places buildings/combat at small offsets from the player TC, so combat fixtures sit inside TC range 6. |

Lesson: a change can be one line and spec-correct yet still be a *pervasive* behavior change if the existing test suite (and game fixtures) are coupled to the old behavior. Multi-CLI review of the DIFF cannot see this — only the full suite (which runs the real game) does. So: (1) never treat "tiny diff + clean diff-review" as sufficient for a behavior change — run the full suite before committing; (2) when a behavior change touches a widely-present entity (the Town Center is in nearly every fixture), expect blast radius and budget for fixture isolation; (3) combat-measurement fixtures should be isolated from incidental sources of damage (TC/tower fire) by construction, so a later defensive-fire change doesn't contaminate them. **(4) When the full suite fails, ISOLATE each failure (run the file alone) yourself before attributing blast radius or reverting — a TC-caused failure fails in isolation too, a load-flaky one passes alone. (5) NEVER act on a reviewer's empirical claim ("I verified all 21 pass in isolation", "I ran X", "this benchmark shows Y") without reproducing it — a CLI reviewer granted only Read/Grep CANNOT run tests, so any "I ran it" claim from it is fabricated narration. I nearly shipped a wrong doc correction (cfff9ed: "bounded ~4-7, over-reverted") by trusting one such claim; my own baseline+isolation runs showed the real blast radius is ~25, all caused by the fix. This is the AGENTS.md "verify reviewer claims" rule, sharpened: verify EMPIRICAL claims by re-running, not just symbol/signature claims by grepping.** This pattern recurred three times in one session — it is the rule, not a fluke.
Pointer: [src/game/simulation/prototypeBuildingRules.ts](../../src/game/simulation/prototypeBuildingRules.ts) `buildingArrowCount`; [design/roadmap.md](../../design/roadmap.md) campaign-8 entry.

## Scope a hot-path behavior fix to a recovery-path-only guard to avoid mass deterministic-test churn — 2026-07-01

| Field | Value |
|---|---|
| Surfaced by | `dropoff-reroute` thread: first (immediate-reroute) version broke 28 deterministic tests; surgical (recovery-path-only) version reverted all 28. Full-run vs isolation triage in `tmp/ai-grounding/fulltest2.log` + the isolation re-runs. |
| Reviewer findings | In-process adversarial Workflow — 1 CONFIRMED (a wiring-interface signature gap), no correctness defects; the 28-test blast radius was caught by the full suite, not the reviewers (diff-level review can't see it, per the 2026-06-14 lesson). |
| Fix commit | (this session's v0.1.55 drop-off-reroute commit) |
| Test added | `tests/simulation/villagerDropOffReroute.test.ts` > "villagers whose nearest drop-off is boxed reroute to a reachable one and net positive food" |
| Behavior delta | The economy state machine's `to-dropoff` branch: a reroute that fired on EVERY tick changed TRANSIENT drop-off-blocking behaviour (villagers momentarily blocking each other's TC approach), shifting deposit timing across 28 deterministic economy/AI/replay tests. Guarding the reroute to fire ONLY after a villager is stuck a full retry interval on an unreachable nearest (`!dropOffPlan && stuckSince !== undefined`) made the hot path + transient case byte-identical, so the reroute fires only for persistent boxing (the case no test exercised) — 28 failures → 0. The boxed AI still unblocks (food 121-frozen → flows, Dark Age → Feudal by ~t6000). |

Lesson: when a fix to a hot-path state machine causes many deterministic tests to fail, first ask whether the NEW behaviour needs to apply to the common/transient case at all, or only to the pathological case the fix targets. Guarding the change behind the existing stuck/retry mechanism (so the common and transient paths stay byte-identical, and the new branch fires only in the rare recovery case) usually (a) reverts the mass test churn, (b) avoids a silent efficiency regression in normal play, and (c) is the more correct design — the deadlock was always a *persistent*-unreachability problem, not a per-tick one. Pairs with the 2026-06-14 lesson: the full suite catches the blast radius; isolation triage separates real regressions from CPU-contention timeouts (here, 4 age-up/militia "failures" were contention artifacts from running the suite concurrently with a playtest — all passed in isolation).
Pointer: [src/game/simulation/bridge/systems/villagerEconomySystem.ts](../../src/game/simulation/bridge/systems/villagerEconomySystem.ts) to-dropoff branch; [src/game/simulation/bridge/villagerDropOffAssignment.ts](../../src/game/simulation/bridge/villagerDropOffAssignment.ts).
