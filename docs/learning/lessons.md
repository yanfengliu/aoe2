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

## Don't tune a chaotic emergent quantity against a single-run validator — the noise exceeds the signal — 2026-07-04

| Field | Value |
|---|---|
| Surfaced by | The v0.1.91 Feudal gold-rebalance experiment. Chasing "AI reaches Castle," I tweaked `villagerTargetsForAge('feudal-age')` across three increments; each single-run corpus replay showed the age-up blocker relocating (food→gold→economic-collapse) instead of resolving. FIND devlog: [2026-07-03_2026-07-04.md](../devlog/detailed/2026-07-03_2026-07-04.md) "FIND (v0.1.91 experiment — TRIED then REVERTED)". |
| Reviewer findings | The v0.1.91 in-process reviewer said the change was SAFE and "likely to hit the goal" — a same-model code-level analysis that could NOT see the emergent chaos; only the replay (and reading `getEconomyState`) exposed it. So: a green review is not validation of an emergent-behavior claim. |
| Fix commit | none — the experiment was REVERTED (`git checkout` to v0.1.90's `{food:7,gold:1}`); no version bump, nothing user-visible shipped. |
| Test added | n/a — process lesson (the unit tests all passed; the failure was only visible in the AI-vs-AI replay). |
| Behavior delta | A 1-unit Feudal gather-weight shift (`{food:7,gold:1}`→`{food:6,gold:2}`) flipped the default-seed AI-vs-AI game from "owner-1 banks food to 1084, stalls on gold 75" to "owner-1 economy collapses — villagers die 17→9, food 17, gold hoarded 1704" — a totally different trajectory, neither reaching Castle. The replayed metric (owner-1 Castle-age progression + villager count) moved chaotically, not monotonically, with the weight. |

Lesson: some quantities are emergent + chaotic — e.g. an AI-vs-AI age-up outcome as a function of the gather-allocation weights. A single deterministic corpus run is one sample of a butterfly-sensitive system, so tuning against it is fitting noise: each "fix" just relocates the failure to a different resource/mechanism. Before attributing a stall to the lever you happened to change, VERIFY THE MECHANISM with the engine tools (`getEconomyState`: is it villager attrition? a missing prerequisite building? military over-spend?) — the real blocker is usually not the knob you were turning. Genuine mechanism bugs (v0.1.89's gold-hoard mis-allocation, v0.1.90's villager-reserve hole) are unit-testable and survive their own validation; a tuning guess against emergent noise will not, and should be reverted rather than shipped on a green review + one lucky/unlucky replay. If you must influence an emergent outcome, prefer a robustness mechanism that self-corrects regardless of trajectory (e.g. market-sell excess-resource-for-shortfall to fund an age-up) over pre-tuning an open-loop parameter.
Pointer: v0.1.91 FIND devlog entry; `src/game/simulation/ai.ts` `villagerTargetsForAge` (the reverted knob); `scripts/replay-inspect.mjs` + `getEconomyState` (the mechanism-verification tools that exposed the villager attrition).

## An isolated fixture (few/zero units) exposes latent accessor-cache crashes a busy game never hits — `markDirty` without a prior `get`/`mutate` throws at flush — 2026-07-04

| Field | Value |
|---|---|
| Surfaced by | The v0.1.85 Conscription live test, whose fixture gives owner 1 only buildings (no units). Researching Conscription there crashed the tick: `BridgeStateAccessor.flush: slot 'aoe2.combatStates' was marked dirty but no native value is cached`. Devlog: [2026-07-03_2026-07-03.md](../devlog/detailed/2026-07-03_2026-07-03.md) v0.1.85 entry. |
| Reviewer findings | n/a — found by TDD (the new live test), not a reviewer; the subsequent in-process review confirmed the fix (0 findings). |
| Fix commit | v0.1.85 — `accessor.get(combatStatesCodec)` before the `accessor.markDirty(combatStatesCodec)` in `applyTechnology`'s tail. |
| Test added | `tests/simulation/conscription.test.ts > Conscription — live train-speed effect > a Barracks trains a Militia in fewer ticks after Conscription is researched` (drives a real research→train cycle from a unit-less state). |
| Behavior delta | Before: `applyTechnology`'s tail unconditionally `accessor.markDirty(combatStatesCodec)`; in a tick where neither the completing tech nor anything else did a `get`/`mutate` on `combatStates` (a unit-less owner completing a non-combat tech), the accessor's native cache is empty and the end-of-tick flush THROWS, poisoning the world (all later steps fail). Reachable in production if an owner loses every unit while a tech is mid-research. After: the `get` populates the cache so the `markDirty` is valid regardless of what the tick touched; combat techs are byte-identical (they already `get`/`mutate` the slot). |

Lesson: `accessor.markDirty(codec)` is only valid if that codec was `get`/`mutate`'d earlier in the SAME tick (so a native value is cached to flush). A "conservative, always mark dirty" tail is a latent crash for any tick that didn't otherwise touch the slot — and the only reason it survives is that real games almost always DO touch it (e.g. villagers have combat state, get/mutated every tick). This is a general trap for the pattern "unconditionally markDirty at the end of a shared handler." Two defenses: (1) `get` before `markDirty` when you can't guarantee a prior access (cheap, behavior-preserving); (2) TEST subsystems from minimal/degenerate states — a fixture with zero units, zero resources, or a single entity surfaces cache/empty-collection crashes that a full scenario masks. When adding a fixture for a new mechanic, prefer the smallest world that exercises it, precisely because it strips away the incidental state that hides bugs.
Pointer: v0.1.85 devlog entry; `src/game/simulation/bridge/technologyOps.ts` (the `applyTechnology` tail); `src/game/simulation/fixtures/conscription.ts` (the unit-less fixture that exposed it).

## A single-tick "total gathered" snapshot ALIASES on the deposit-trip phase — a gather-RATE twin-fixture must measure over a window that outgrows one carry-load — 2026-07-03

| Field | Value |
|---|---|
| Surfaced by | Building the v0.1.81 Britons-shepherd (+25% sheep gather) live twin-fixture test — the assertion `britons > control + margin` failed with BOTH sides reading exactly 50 at t300, then 50/110/170/230 vs 50/100/150/200 at t300/600/900/1200. Devlog: [2026-07-03_2026-07-03.md](../devlog/detailed/2026-07-03_2026-07-03.md) v0.1.81 entry. |
| Reviewer findings | n/a — process/test-design lesson (caught during TDD red-green by instrumenting the gather site: a temporary log showed `civMult=1.25` vs `1.0` were BOTH applied correctly, proving the wiring was right and the *measurement* was wrong). |
| Fix commit | v0.1.81 (`349fa01`) — lengthened the race window so the compounding lead exceeded one carry-load of phase noise; moved the fixture villager/sheep east of the Town Center footprint. |
| Test added | `tests/simulation/civBonusEffects.test.ts > Britons shepherd bonus — live twin-fixture sheep race > a Britons villager harvests sheep faster than a non-Britons villager` |
| Behavior delta | Before the window fix the test was a false-negative: a genuinely-working +25% gather bonus (confirmed by the gather-site log) read as "no difference" because at t300 the faster villager happened to be mid-walk-back (carried 0, deposited 50) while the control carried a full 10 (deposited 40) — both totalling 50. The bonus itself shipped correct; the risk was concluding "the feature doesn't work" and thrashing the *implementation* instead of the *test*. |

Lesson: a villager's gather output is delivered in quantized deposit trips (gather to carry-cap → walk → deposit → walk back), so `depositedFood + carriedAmount` sampled at ONE tick is noisy by ±(one carry-load) depending on where each unit sits in its trip cycle — two units at different RATES can read equal, or even inverted, at a single instant. To test a per-tick rate multiplier via a twin-fixture race: (a) run long enough that the cumulative lead >> one carry-load (the lead grows ~linearly; here ~10 food per 300 ticks, so t600+ gave a clean margin); (b) put the resource adjacent to the drop-off so walk time doesn't dilute the gather-rate signal into invisibility; (c) if the bonus looks like it "does nothing," instrument the effect SITE (log the multiplier + inputs for the owner) before touching the implementation — a correct effect with a phase-aliased measurement is the likelier bug. Separately: fixture units must spawn OUTSIDE building footprints — a 4×4 Town Center at (4,4) occupies (4,4)–(7,7), and a villager placed inside errors with "spawns inside a building footprint."
Pointer: v0.1.81 devlog entry; `src/game/simulation/fixtures/civShepherd.ts` (short-walk geometry, sheep east of the TC); `tests/simulation/civBonusEffects.test.ts` (600-tick window, `ownerOneHarvested` = deposited-delta + carried).

## "Reuse existing verified art" is NOT a trivial UI change when it crosses a styling context — the CSS hook class travels with the markup and silently applies the wrong sizing — 2026-07-02

| Field | Value |
|---|---|
| Surfaced by | Self-audit at the start of the next UI slice, before writing new code; the v0.1.72 `tests/browser`-free DOM test had *locked in* the bug by asserting the selection-classed glyph was present. Devlog: [2026-06-30_2026-07-02.md](../devlog/detailed/2026-06-30_2026-07-02.md) v0.1.73 entry. |
| Reviewer findings | n/a — process lesson (self-caught; no reviewer ran on the v0.1.72 slice because I mis-classified it as trivial and skipped the visual protocol). |
| Fix commit | v0.1.73 (`unitRoleGlyph(role, cls?)` optional class param; `renderTrainButtons` passes `hud-command-glyph`). |
| Test added | `tests/ui/trainButtonIcons.test.ts > renderTrainButtons — command-card unit icons > prepends the unit role glyph and preserves the data-command hook + label text` (now asserts `class="hud-command-glyph"` present AND `hud-selection-unit-glyph` absent). |
| Behavior delta | Before: the command-card "Train X" unit icons rendered at 34px (the selection-panel size) + a `color-mix` accent tint, i.e. **2x** the 17px Build-button icons beside them and a different colour — the buttons visibly taller and inconsistent (measured `beforeTrain=34` vs `beforeBuild=17` via Playwright `boundingBox`). After: `afterTrain=17`, matching the build reference exactly. Affected surface: HUD selection panel command card for any production building (Town Center/Barracks/Stable/Archery/Monastery/Siege/Dock train buttons). |

Lesson: an inline SVG glyph carries its sizing/colour **hook class** in its markup, and the same art rendered in a different container gets that container's CSS only if the class matches. Reusing a glyph across styling contexts (selection panel `hud-selection-unit-glyph` = 34px accent vs command button `hud-command-glyph` = 17px currentColor) is therefore a *behaviour-visible* change, not a trivial move — so it needs the AGENTS.md visual protocol (before/after screenshot + a measured pixel/bbox check), not a "reuse = known-good, screenshot would only re-confirm" rationalization. The tell that I was rationalizing: the DESIGN.md asserted "the sizing CSS already targets `.hud-command-button` glyphs" without ever reading which *class* the reused helper emitted. Two cheap guards that would have caught it pre-merge: (1) a Playwright `boundingBox().width` assertion that the reused glyph equals the reference glyph's size in the same container; (2) grep the helper's `svg()` wrapper for the hardcoded class before assuming it inherits the destination's styling. When a "reuse" change gives a helper a new home, parameterize the hook class (default = old context) rather than assuming CSS will sort it out.
Pointer: v0.1.73 devlog entry; `src/ui/hud/icons/unitGlyphs.ts` `unitRoleGlyph(role, cls?)`; `src/ui/hud/selectionPanel.ts` `renderTrainButtons`; `src/hudIcons.css` `.hud-command-glyph` (17px) vs `.hud-selection-unit-glyph` (34px).

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

## A stateless per-tick surge schedule is absorbed by per-cell waypoint clamping — rate changes need a carry accumulator — 2026-07-02

| Field | Value |
|---|---|
| Surfaced by | `husbandry-speed-seam` thread TDD RED run: the live movement race measured 40 = 40 ticks (zero effect) while an executor probe simultaneously showed `speedPercent: 110` derived correctly — the design was wrong, not the wiring. |
| Reviewer findings | Self-caught during red-green (probe + measurement), before the adversarial review pass; the in-process Workflow review ran on the corrected carry design. |
| Fix commit | (this session's v0.1.66 husbandry commit, thread `docs/threads/done/husbandry-speed-seam/`) |
| Test added | `tests/simulation/movementTechEffects.test.ts` > "movementEntitlement / settleMovementCarry — the carry accumulator" > "delivers a real +10% under per-cell waypoint clamping (the quantization trap)" (plus the live race `tests/simulation/husbandry.test.ts` > "a Husbandry knight outraces a baseline knight over the same straight 20-cell run") |
| Behavior delta | Husbandry (+10% mounted speed) was a complete no-op under the tick-derived surge schedule: a knight crossed 20 cells in 40 ticks with or without the tech. Movement is issued as per-CELL waypoint legs (4 fine units) and `stepUnitTransformToward` clamps each tick's step to the remaining leg, so a 3-step surge landing on a 2-remaining leg is cut to 2 and a fresh-leg 3 leaves a 1-remainder tick — every leg costs 2 ticks either way, and larger surges just phase-shift into the same absorption. With the per-unit carry (`moveCarryHundredths`, banked shortfall, cap 300) the same walk takes 37 ticks — a real +10%. |

Lesson: this is the second face of the v0.1.26 gather-rate lesson (round(base/mult) no-ops at tiny integer cadences), one level up: even a mathematically-exact integer SCHEDULE of surges fails when a downstream per-leg clamp can discard the surplus — any fractional rate change flowing through clamped integer steps must CARRY its unconsumed entitlement across ticks (the `gatherProgressTicks` pattern), settling on ACTUAL consumption, not on what was granted. Corollaries: (1) "zero new state" is not a design virtue when the domain has residuals — check where granted-but-unconsumed quantity goes before choosing statelessness; (2) a behavior-shaped feature needs a MEASURED effect test in its RED phase (the race test is what exposed the no-op; the pure-schedule tests alone all passed green on the broken design); (3) when a derived value is confirmed correct at the use site but the behavior doesn't change, look for a downstream clamp/quantizer eating it.
Pointer: [src/game/simulation/movementTechEffects.ts](../../src/game/simulation/movementTechEffects.ts) `movementEntitlement`/`settleMovementCarry`; [src/game/simulation/bridge/transformOps.ts](../../src/game/simulation/bridge/transformOps.ts) `moveUnitOneSubgridStep`.

## Piping `npm test` into `tail`/`grep` masks its exit code — the `&&` gate then reports green on a red suite — 2026-07-02

| Field | Value |
|---|---|
| Surfaced by | v0.1.70 shipped (commit 7744459, pushed) with a RED `monasteryTechs.test.ts` — `monasteryTechOptions.ts` had `herbal-medicine` (grep count 2) but the test still asserted `['block-printing','sanctity']` (grep count 0). Caught one commit later when the forced-AI-gate full-suite run listed it among 6 failing files. |
| Reviewer findings | n/a — process/verification lesson (the adversarial reviews are diff-scoped; a stale sibling test the diff didn't touch is exactly what full-suite-green is supposed to catch, and the gate falsely reported green). |
| Fix commit | (this session's forced-ai-gather-gate commit — bundles the `monasteryTechs.test.ts` correction) |
| Test added | `n/a — process lesson` (the fix is the already-existing test, corrected). |
| Behavior delta | v0.1.70's gate command was `npm run lint 2>&1 \| tail -1 && npm run build 2>&1 \| tail -1 && npm test 2>&1 \| grep … \| tail`. In a pipeline `A \| B`, `$?` is B's exit, not A's — so `npm test \| grep` exits 0 (grep matched lines) REGARDLESS of vitest's failure, the `&&` chain returned 0, and I reported "four gates green." A failing test rode to `main` and stayed red for a full version. v0.1.68/69 were safe because those runs were UNPIPED (`npm run build && npm test`, whose real counts I read). |

Lesson: NEVER pipe `npm test` (or any gate command whose pass/fail you depend on) into `tail`/`grep`/`head` and then trust the pipeline's exit code or a background task's "exit 0" — the downstream filter's exit code masks the test runner's. To verify a gate: run it UNPIPED and read the actual `Test Files N passed`/`Tests N passed` summary, OR capture the runner's own exit explicitly (`npm test > log 2>&1; echo "EXIT: $?"`) and assert it's 0 before claiming green. This is the concrete mechanism behind the "evidence before assertions" rule — a masked exit code is a fabricated success signal. Corollary: `set -o pipefail` (or checking `${PIPESTATUS[0]}`) would also surface it, but the simplest habit is: don't pipe the thing you're gating on. Pairs with the 2026-06-14 "full suite is the gate" lesson — the suite only gates if you actually observe its verdict.
Pointer: [tests/simulation/monasteryTechs.test.ts](../../tests/simulation/monasteryTechs.test.ts); v0.1.70 commit 7744459.
