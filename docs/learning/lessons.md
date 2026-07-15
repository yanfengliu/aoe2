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

## Verify graphics on the REAL default view (with fog + a real base), not a full-vision showcase fixture — 2026-07-05

| Field | Value |
|---|---|
| Surfaced by | User: "Can you actually visually check your work always? The screen looks weird." A full default-view capture (`aoe2-prototype`) then exposed three iso bugs. Devlog: [2026-07-05_2026-07-05.md](../devlog/detailed/2026-07-05_2026-07-05.md) (v0.1.113). |
| Reviewer findings | n/a — user-surfaced; my per-increment zoomed showcase captures (v0.1.104–112) all "passed" while shipping the bugs. |
| Fix commit | v0.1.113 (fog iso diamonds + unit-bar iso anchor + `ACCENT_MAX_SCALE` cap + iso-box turret). |
| Test added | `tests/phaser/worldLayers.test.ts` (renderFog paints iso diamonds not `fillRect`; a masked cell → `worldToIso` corners; unit bar centres on the iso centre) + `tests/phaser/buildingRoofAccents.test.ts` (turret is `fillPoints` not a billboard; centre accents rise ≤68px on a 4×4; 4×4 accent ≈ 3×3, cap not linear). |
| Behavior delta | In a real match the fog rendered as top-down `fillRect(x*cellSize)` squares over the iso diamond world → a large misaligned black blob; unit HP-bars sat at `x*cellSize` (off their units); a Town Center roof turret rose as a ~102px flat billboard column and a Barracks banner as a ~154px flagpole (accents scaled by full roof width, 256px for a 4×4). The showcase fixtures I'd been capturing boot with FULL vision (no fog) and one isolated building each, so none of the three ever appeared. After the fix the shroud follows the diamonds, bars sit on units, and accents are capped small. |

Lesson: a "visual verification" done on a showcase/isolated fixture is not verification of the real game. Showcase fixtures deliberately strip context (full vision → no fog, one building → no depth interplay, `disableAi` → nothing moves), which is exactly the context where integration bugs live. For any render change, FIRST capture the real default view (`waitForBoot` = `aoe2-prototype`, WITH fog and a real base) at default zoom and look at the whole frame; only THEN zoom into the specific feature. Anything drawn per-cell or per-entity in world space (fog, bars, overlays, selection, placement) must be re-derived through the SAME projection (`worldToIso`) as the terrain/entities — a leftover `x*cellSize` is invisible on a fixture but glaring in a match. Pair this with ground-truth (`getEntityHealthBarStates()` / `getBuildingVisualStates()`) instead of eyeballing pixel gaps on a compressed screenshot — the "floating HP bar" I almost chased was actually correct (18px above the roof's top corner) and the dump proved it.
Pointer: [2026-07-05_2026-07-05.md](../devlog/detailed/2026-07-05_2026-07-05.md) v0.1.113; `src/phaser/scenes/gameScene/worldLayers.ts` (renderFog / renderEntityHealthBars); `src/phaser/scenes/gameScene/buildingRoofAccents.ts` (`ACCENT_MAX_SCALE`).

## Read engine-tool output by LABEL, never by column position — a transposed food/gold column misdirected 3 increments — 2026-07-04

| Field | Value |
|---|---|
| Surfaced by | The v0.1.92 wood investigation. An explicit-label dump (`FOOD=94 WOOD=1 GOLD=1084`) contradicted my v0.1.90–91 reading of the SAME replayed state as "food 1084, gold 75." Corpus corrections in the v0.1.90–92 devlog CORRECTION entry: [2026-07-03_2026-07-04.md](../devlog/detailed/2026-07-03_2026-07-04.md). |
| Reviewer findings | n/a — self-caught by re-dumping with labels; the in-process reviewers didn't catch it because they reviewed the CODE/E2E (correct) not my prose reading of the corpus table. |
| Fix commit | none yet — the mis-grounded v0.1.92 reorder was reverted unshipped; v0.1.89–91 stay (their code is correct + unit-tested, just inert in the corpus). |
| Test added | n/a — process lesson. |
| Behavior delta | `scripts/replay-inspect.mjs` prints `… | wood | food | gold | stone | …`. I read the `gold` value (1084) as `food` and a lower column as `gold`, concluding "the AI banks 800+ food and is gold-blocked at 75." Truth: it banks GOLD (~1084, over-gathered/unspent) and STARVES food (~94, all spent) — the opposite. Every v0.1.90 (reserve) and v0.1.91 (market-trade) design rested on that inverted read; both turned out INERT in the corpus anyway (the AI has only 1/2 Castle prereqs so it never even qualifies for the age-up those fixes target — a second positional/lookup error, counting `barracks` as a Feudal prereq when the set is {stable, archery-range, blacksmith, market}). |

Lesson: when a number from `getEconomyState`/`replay-inspect` is going to drive a decision or a doc claim, read it by EXPLICIT LABEL — dump `FOOD=… WOOD=… GOLD=…` (or read the printf field order in the script) — never eyeball a positional table and never trust a set-membership probe you hand-rolled (verify the real predicate, e.g. `FEUDAL_AGE_PREREQUISITE_BUILDINGS`, don't guess its members). A transposed column or a wrong prereq set is invisible (the numbers "look plausible") yet silently inverts the whole diagnosis, so every downstream fix targets the wrong constraint. This is the concrete, expensive instance of "verify the MECHANISM before attributing a stall to the lever you changed": I verified a number but mis-parsed it, which is worse than not checking — it manufactured false confidence across three increments.
Pointer: the v0.1.90–92 devlog CORRECTION entry; `scripts/replay-inspect.mjs:63,88` (header vs printf field order); `src/game/simulation/prototypeBuildingRules.ts:280` (the real Feudal-prereq set).

## Adversarial reviewer subagents can spawn nested grandchildren that orphan as stale "running" chips — tell them not to — 2026-07-04

| Field | Value |
|---|---|
| Surfaced by | User asked "why is the 'verify no hidden food sinks' agent still running." It was a grandchild the v0.1.90 test-validity reviewer spawned on its own to exhaustively confirm a test fixture had no hidden food income; the reviewer's returned result said the check COMPLETED, but the grandchild's `/tasks` chip lingered as "running" for ~6h. |
| Reviewer findings | n/a — process lesson (surfaced in the running session, not a code review). |
| Fix commit | none (runtime): confirmed 0 live `claude`/agent processes back the chip (not consuming CPU), and `TaskStop <grandchild-id>` returns "no task found" (a grandchild owned by an exited parent is not a task the driver can target). |
| Test added | n/a — process lesson. |
| Behavior delta | A dispatched `general-purpose` reviewer has full tool access, including the Agent tool, so it may spawn its OWN verification subagents. When the parent reviewer returns, the harness cleans up the parent but can leave the grandchild as an orphaned "running" chip in `/tasks` — visually alarming (the user notices), un-stoppable from the driver side, though (unlike an orphaned `sleep`-loop) it does not consume CPU once idle. |

Lesson: when you dispatch an adversarial reviewer (or any `general-purpose`/`Explore` agent) that could recursively spawn its own agents, add "do NOT spawn sub-agents; do the verification yourself inline" to the prompt — otherwise a nested grandchild can orphan as a stale, driver-un-stoppable "running" chip that alarms the user (it reports to its parent, but the harness may not tear down its task entry). If one appears: verify it's idle (`wmic process where "name='node.exe'"` → 0 `claude`/subagent procs backing it) so you know it's a stale chip, not a live drain; it's then harmless and the user can clear it from their `/tasks` panel. Distinct from the `sleep`-loop poller trap below (those DO burn CPU); this one is a cleanup/UI-tracking gap, not a resource leak.
Pointer: this session's v0.1.90 test-validity review; `project_campaign_run_ops` memory (orphan-cleanup note).

## Manual `until … do sleep` pollers for harness-tracked background tasks hang forever — don't write them — 2026-07-04

| Field | Value |
|---|---|
| Surfaced by | User noticed "tasks running for 6 hours." Diagnosis (`wmic process … commandline`): ~8 orphaned bash processes stuck in `until grep -qE "PLAYTEST EXIT" tmp_validate_playtest.log; do sleep 10/15/20; done` loops, launched hours earlier while waiting on 12000-tick validation playtests. |
| Reviewer findings | n/a — process lesson, found in production (the running machine), not a code review. |
| Fix commit | none (runtime cleanup): `for p in $(wmic process where "name like '%bash%' and not commandline like '%taskkill%' and commandline like '%do sleep%'" get processid \| grep -oE "^[0-9]+"); do taskkill //F //PID $p; done`. |
| Test added | n/a — process lesson. |
| Behavior delta | Two independent bugs made the poll condition PERMANENTLY unsatisfiable, so each loop ran forever: (1) the `PLAYTEST EXIT` marker was echoed to the harness TASK-OUTPUT file, NOT to `tmp_validate_playtest.log` (the file the poller grepped) — so it could never match; (2) later cleanup `rm`'d `tmp_validate_playtest.log`, so `grep … 2>/dev/null` returned nothing on a missing file → condition false forever. The harness auto-backgrounds a foreground command that exceeds its timeout, so these `until` waits became detached and survived across many turns, accumulating CPU/handle pressure. |

Lesson: do NOT write `until <cond>; do sleep N; done` pollers to wait on a background task the harness already tracks — when that task completes, the harness re-invokes you with a `<task-notification>` automatically, so the poller is redundant AND a hang risk. Two specific traps if you ever must poll: (a) grep the SAME file the marker is actually written to (a `cmd > log; echo MARKER` writes MARKER to the *task-output* channel, not into `log`), and (b) never `rm` a file another still-running poller greps — a missing file makes `grep -q … 2>/dev/null` false forever, not done. Prefer: launch the real work with `run_in_background`, do other work, and let the completion notification wake you. To wait on non-harness/external state, bound the wait (`for i in $(seq 1 N); do … done` with a hard cap), never an unbounded `until`. When a session ends or you kill a task, audit for detached descendants (`wmic process … commandline like '%do sleep%'`, orphaned dev servers) and taskkill them.
Pointer: this session's validation-playtest waits; `project_campaign_run_ops` memory (orphan-cleanup note).

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

Pointer: [loop-ops/docs/skills/multi-cli-review.md](../../../loop-ops/docs/skills/multi-cli-review.md) — "Reading Codex output" (moved out of AGENTS.md 2026-07-09, promoted to the fleet-canonical runbook 2026-07-10 with `-o` extraction as primary); affected reviews under `docs/threads/done/replay-scrubber/2026-05-01/impl-{16..24}/REVIEW.md` (post-mortem note added).

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

Pointer: [src/game/simulation/bridge/systems/aiSystemProductionPhase.ts](../../src/game/simulation/bridge/systems/aiSystemProductionPhase.ts) — `pickUnitMix` block ordered before villager training; KAD-0005 in [docs/architecture/decisions.md](../architecture/decisions.md).

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
Pointer: [src/phaser/scenes/gameScene/cameraController.ts](../../src/phaser/scenes/gameScene/cameraController.ts), [tests/browser/helpers/gameTestHelpers.ts](../../tests/browser/helpers/gameTestHelpers.ts), [tests/browser/game-hud-and-camera.spec.ts](../../tests/browser/game-hud-and-camera.spec.ts).

## Topmost hit tests must follow draw order - 2026-04-23
Context: precise unit-click geometry still felt wrong on close overlaps because the final same-layer tiebreak was using array index in the wrong direction.
Lesson: in this Phaser scene, `displayedEntities` are drawn in array order, so later entries are visually on top. Any hit-test fallback that uses array index as a render-order proxy must prefer the highest index, or exact clicks will still select the underneath entity when units overlap tightly.
Pointer: [src/phaser/scenes/entityHitTest.ts](../../src/phaser/scenes/entityHitTest.ts), [tests/phaser/entityHitTest.test.ts](../../tests/phaser/entityHitTest.test.ts).

## Exact-click stack cycling needs its own click-cell memory - 2026-04-22
Context: fixing precise unit selection uncovered a subtle overlap bug where the first exact click on a stacked unit could jump to the next target just because that unit was already selected from a different gesture.
Lesson: if left-click selection can cycle overlapping hits, remember the last exact click cell separately from the current selection. Key the cycle off a repeated click in the same click cell, and let that cycle win over same-cell double-click promotion, or stacked selections become inconsistent after drag-boxes, tile clicks, or prior exact clicks elsewhere on the same unit.
Pointer: [src/phaser/scenes/gameScene/selectionController.ts](../../src/phaser/scenes/gameScene/selectionController.ts), [tests/browser/game-selection.spec.ts](../../tests/browser/game-selection.spec.ts).

## Selection geometry must stay shared end-to-end - 2026-04-22
Context: tightening unit click precision exposed two opposite failure modes at once: padded hit circles made close units impossible to click cleanly, while splitting click and marquee logic across different geometry/filter rules made preview highlights disagree with the final selection.
Lesson: keep one exact rendered-body contract for left-click hit tests, marquee intersection, and live marquee preview, then run the final preview ids back through the same bridge-side selectability filter used on mouse-up. If selection needs an extra tie-breaker like "human-owned first," keep that policy scoped to selection only so generic context-command targeting does not inherit it.
Pointer: [src/phaser/scenes/entityHitTest.ts](../../src/phaser/scenes/entityHitTest.ts), [src/phaser/scenes/gameScene/selectionController.ts](../../src/phaser/scenes/gameScene/selectionController.ts), [src/phaser/scenes/gameScene/pointerInputController.ts](../../src/phaser/scenes/gameScene/pointerInputController.ts), [tests/phaser/entityHitTest.test.ts](../../tests/phaser/entityHitTest.test.ts), [tests/browser/game-selection.spec.ts](../../tests/browser/game-selection.spec.ts).

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
Pointer: [src/phaser/scenes/gameScene/cameraController.ts](../../src/phaser/scenes/gameScene/cameraController.ts) `getEdgePanDelta`; devlog entry 2026-04-17 on canvas aspect fix.

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

## The chaotic AI-vs-AI corpus cannot cleanly validate an economy micro-tweak — 2026-07-04

| Field | Value |
|---|---|
| Surfaced by | The v0.1.96 investigation (this session): a baseline-vs-fix side-by-side replay of the default-seed 12000-tick corpus. |
| Reviewer findings | n/a — process/validation-methodology lesson. |
| Fix commit | (this session's v0.1.96 commit — remove the villager age-up-reserve coupling). |
| Test added | `n/a — process lesson` (the correctness proof is `tests/simulation/aiVillagerReserve.test.ts` + `aiMarketAgeUp.test.ts` + the mechanism analysis, NOT the corpus). |
| Behavior delta | The first-attempt v0.1.96 fix (waive the age-up reserve below the villager ALLOCATION target) was **byte-identical to the v0.1.95 baseline at every sampled tick for both owners** — INERT on the default seed, because neither AI hits the qualified-but-villager-poor deadlock state on that seed's natural trajectory (owner 1 stays 1/2 prereqs / unqualified → the reserve is empty either way; owner 2 only qualifies at 21 villagers, already above the target). The deadlock only manifested when a throwaway build-order reorder pushed an AI to qualify early — and even then, owner 1 and owner 2 in the SAME run landed in opposite states (food 89 stuck vs 667 banking). Chasing "AI reaches Castle in the 12000-tick corpus" across v0.1.89–96 spent many ~24-min runs on a metric the corpus is both too SHORT to show (Castle lands ~t13-15k) and too NOISY to attribute. |

Lesson: an AI-vs-AI corpus is a chaotic emergent system — a one-line economy change butterflies the whole trajectory, so owner-vs-owner and run-vs-run corpus deltas are noise, not signal. Three correctives: (1) prove an economy change with a DETERMINISTIC fixture that isolates the exact mechanism (+ a labeled replay of the SPECIFIC bundle per the engine-tools-first rule), never a raw corpus delta; (2) a change can be byte-identical to baseline on the default seed (INERT there) yet correct — inert-on-the-default-seed is NOT the same as wrong, and NOT the same as validated, so state which it is; (3) know the corpus's window — the AI reaches Castle ~t13-15k, so a 12000-tick smoke structurally cannot show it, which makes "Castle inside the corpus" the wrong ship-gate. Diff the baseline and the fix bundle at identical ticks before believing any corpus "improvement"; if they are byte-identical, your change is inert on that seed and the corpus is telling you nothing about it. Pairs with the 2026-07-04 read-output-by-LABEL lesson (same arc) and the engine-tools-first rule.
Pointer: [tests/simulation/aiVillagerReserve.test.ts](../../tests/simulation/aiVillagerReserve.test.ts); [tests/simulation/aiMarketAgeUp.test.ts](../../tests/simulation/aiMarketAgeUp.test.ts); `scripts/replay-inspect.mjs`.

## A verified-by-metric oracle finding is a claim about the metric, not the game — 14 of 16 "pinned units" were the sensor, not the sim — 2026-07-09

| Field | Value |
|---|---|
| Surfaced by | `docs/debugging/2026-07-09-pinned-units-oracle.md` — replaying the canary-drill baseline bundle (`canary-pinned-units-20260709161951`) per the engine-tools-first rule. |
| Reviewer findings | n/a — surfaced by replay diagnosis, not review. |
| Fix commit | (this session's v0.1.128 commit — pinnedUnitsOracle rebuild + scout wander fixes). |
| Test added | `tests/playtest/pinnedUnitsOracle.test.ts` (id-reuse interval split, undriven-owner gate) + `tests/playtest/pinnedUnitsOracle.confinement.test.ts` (gathering exemption, frozen `to-resource` fires) |
| Behavior delta | Before: 16 medium violations at seed `aoe2-canary`, saturating the oracle and forcing the canary drill to `canary-invalid`. Ground truth: 4 were berry bushes whose entity ids were later reused by villagers, 4 were the inert human's correctly-idle units, 6 were healthy gatherers (incl. a zero-walk gold miner adjacent to both mine and TC), and only 2 were real stuck scouts. After: 0 violations; the pinned canary can measure sensitivity again. |

Lesson: `verificationStatus: 'verified'` + `verificationMethod: 'metric'` means the METRIC was mechanically confirmed against the bundle — it does NOT mean the game misbehaved. Position-only pinning conflated entity-id reuse across lifetimes, undriven owners, and legitimately stationary work with real freezes. Before spending a fix cycle on an oracle finding, replay the bundle and classify WHO the entity was, WHO drove it, and WHAT it was doing across the flagged span; oracle misfire classes get fixed in the oracle (with tests that pin each exemption AND a still-fires case so the sensor keeps teeth). Pairs with the 2026-06-13 engine-tools-first rule.

## An early-window movement test green-lights a fix that still freezes terminally — bound stationary streaks over the full horizon, and only the prove-rerun catches what the diff cannot — 2026-07-09

| Field | Value |
|---|---|
| Surfaced by | The v0.1.128 prove rerun (`pinned-fix-prove` ledger): 16 → 1, scout 2257 frozen at (38,18) t498→t3000 (`movesInSpan: 0`) AFTER the deflection fix shipped green on gates + an 800-tick displacement≥5 test. |
| Reviewer findings | n/a — caught by the pass contract's mandatory rerun, not by review. |
| Fix commit | (this session's v0.1.128 commit — `pickEscapeHeading` emulation; round 2 in the debugging doc). |
| Test added | `tests/simulation/scoutWander.test.ts` "no AI scout freezes or two-cell-livelocks mid-match (livelock regression)" + the pure escape-heading suite pinning the recorded trap geometry |
| Behavior delta | Round-1 scout fix: roams ~500 ticks, then a two-state livelock — blocked heading (1,1) rotates to (-1,1), the wander-box west-edge reflection flips dx straight back to (1,1) every tick — freezes it for 2502 ticks (83% of the match) beside its own forward house. Round 2: emulated heading selection finds the phase-dependent staircase escape ((38,17)→(39,17), legal only because fine-stepping crosses y before x); the 2000-tick livelock regression reads positions every tick and requires ≥3 distinct cells per 600-tick block (a plain stationary-streak bound sampled every 25 ticks aliased away two-cell ping-pong — adversarial-review finding). |

Lesson: two rules that are each locally correct — "rotate 90° when blocked" and "reflect at wander-box edges" — composed into a permanent freeze the moment they interacted, and every test shaped as "moved N cells by tick T" stayed green because the scout DID move first. Correctives: (1) for keeps-moving invariants, assert over the FULL horizon with a max-stationary-streak bound, not early-window displacement; (2) when a movement rule mutates heading, verify its interaction with every OTHER rule that also mutates heading (reflection, clamp) — emulate the composed step, don't reason about rules one at a time; (3) prove-fixed means rerun-and-compare at bug-class granularity — a code diff plus green gates was precisely the false-confidence state here. Pairs with the metric-vs-game lesson above and the 2026-06-14 full-suite-gate lesson.

## A render cue derived from a hidden-information event must gate on visibility AT THE EVENT, not at draw time — 2026-07-10

| Field | Value |
|---|---|
| Surfaced by | Adversarial review of the v0.1.129 death-feedback diff (workflow `wf_91c007b7-2e0`) — HIGH `fog-filter` + MEDIUM `sim-determinism`, both refuter-reproduced against the live code. |
| Reviewer findings | Claude in-process review: HIGH "fog leak: a death in fog is revealed when the viewer uncovers the cell within DEATH_FEED_TICKS" + MEDIUM "an isolated unit's own death is dropped because vision is recomputed". |
| Fix commit | (this session's v0.1.129 commit — at-death `witnessedBy` gate). |
| Test added | `tests/simulation/unitDeathFeed.test.ts` "does NOT surface a death to a non-witness even at the death cell" + "surfaces a death only to players who witnessed it" + the live heresy `witnessedBy` assertion |
| Behavior delta | Before: the death feed filtered on CURRENT visibility at projectFrame time. Two symmetric bugs. (1) LEAK: enemy dies at cell C in your fog at tick N; you scout C at N+5 (< the 10-tick window) → the death animation plays in the dead unit's owner color — off-screen-combat intel real AoE2 fog never grants. (2) DROP: your lone scout dies at N; it was its own sole vision source, so prototypeVisibility (runs later in the same tick's update phase) re-fogs C before projectFrame → your OWN unit's death is filtered out and never shown. After: each death records `witnessedBy` (players with vision of the cell at death time, captured before destroy + recompute) and the feed gates on that set — the leak can't happen (you weren't a witness) and your own death always shows (the owner is always a witness). |

Lesson: when a transient RENDER cue is derived from an event that carries hidden information (a death, a reveal, a stealth detection), the fog/visibility decision belongs at the MOMENT THE EVENT HAPPENED, not at the moment you draw it. Filtering on current visibility is wrong in BOTH directions and the two failures hide each other in casual testing: it leaks events you shouldn't see (you gain vision after the fact) and drops events you should (the event itself changed vision — a dying unit was its own vision source, and the recompute runs before you project). Capture the eligible-viewer set synchronously at the event site, before any same-tick recompute, and gate the cue on membership. Pairs with the metric-vs-game lesson (2026-07-09): a cue that is "verified to render" is not "verified to respect fog" — the fog model needs its own adversarial test in both directions.

## A render predicate that mirrors a drawing function must match what is ACTUALLY painted, not a simplified model — 2026-07-10

| Field | Value |
|---|---|
| Surfaced by | The v0.1.133 occlusion-outline adversarial review (ultracode Workflow) — a refuter executed the shipped functions against all five painted polygons and reproduced false-positive white ghosts. |
| Reviewer findings | 2 dimensions converged (detection-geometry + render-layer), both MEDIUM CONFIRMED; 3 more real (test-gap MEDIUM, depthKey-comment LOW, accent-exclusion LOW); 6 refuted. |
| Fix commit | v0.1.133 (`14c8321`). |
| Test added | `tests/phaser/occlusionSilhouettes.test.ts` "does NOT flag a unit ABOVE the pitched roofline (review regression: apex over-claim)" |
| Behavior delta | `buildingSilhouettePolygon` (the occlusion detector) modelled a pitched roof as a full-height apex directly over the ground TOP corner (`top.y - (wallPx + pitchedApexPx)`). But `drawIsoBuilding` PAINTS a hip roof whose ridge is INSET toward centre by `ridgeFraction 0.42` (`hipRoofFaces`), so the real top pixel sits ~37px BELOW the modelled apex. A villager ~3 cells NW of its own Town Center — fully visible, poking above the roofline — had its centre fall in that empty band and got a white "hidden unit" ghost stamped over it. After: the top point is computed from the SAME `hipRoofFaces` geometry (`.ridgeBack`), so the polygon encloses exactly the painted volume. |

Lesson: when a feature's DETECTION geometry is meant to mirror a DRAWING function (occlusion silhouette ↔ the building painter; hit-test ↔ the sprite; selection ring ↔ the figure), derive it from the SAME code the renderer paints, not a hand-simplified re-derivation — a plausible simplification (apex-over-corner) silently diverged from the real inset-ridge hip roof and over-claimed a band of empty sky, false-triggering the cue on visible units. Two corollaries the review also proved: (1) a green test suite that only exercises the TRUE-positive case (unit clearly behind) says nothing about the FALSE-positive band — add a test at the boundary the simplification gets wrong (a unit just above the real roofline); (2) share the load-bearing invariant as ONE function (here `depthKey`, used by both the render sort and the predicate) rather than documenting a "they agree" test that doesn't exist. Pairs with the metric-vs-game lesson: "verified to render" ≠ "verified to match the paint."

## A cache-backed mutation must pair with markDirty — and a round-trip test that reads both sides from world.state can't prove it — 2026-07-10

| Field | Value |
|---|---|
| Surfaced by | Full-codebase review iter-1, Claude persistence lens (H1); `docs/threads/done/full/2026-07-10/1/REVIEW.md`. The reviewer ran a 7-auditor `markDirty` sweep that converged on exactly the two wildlife sites. |
| Reviewer findings | Claude-A HIGH "wildlife HP & death silently not persisted — missing `markDirty(wildlifeStatesCodec)`"; Claude-A MEDIUM (M14) "`snapshotEquivalence` round-trip structurally cannot catch `markDirty` gaps". |
| Fix commit | v0.1.134 (wildlife markDirty + `wildlifePersistence.test.ts` + `boar-hunt-fixture`). |
| Test added | `tests/simulation/wildlifePersistence.test.ts` "a killed corpse-persisting boar stays dead after a save + load round-trip" |
| Behavior delta | `playerCommandsSystem` (villager damages boar) and `entityDestroyOps.killWildlifeEntity` (boar dies, corpse persists) mutated the cached `wildlifeStates` value object but marked only `combatStatesCodec` dirty. `accessor.flush()` re-serializes only dirty slots, so `world.state.aoe2.wildlifeStates` stayed stale while the live game read the correct cache. Before: save after a hunt → boar reverts to full HP on load; save after a kill → boar RESURRECTS `isAlive:true` and becomes huntable again (test showed it reload at 3 HP). After: both sites `markDirty(wildlifeStatesCodec)`; the corpse reloads dead (HP 0). |

Lesson: with a write-back cache (the `BridgeStateAccessor`), the load-bearing invariant is "every mutation of a cached value object is paired with `markDirty(itsCodec)`" — `mutate(codec, fn)` guarantees it, but hand-written `accessor.get(codec)…` + a separate `markDirty` of a DIFFERENT codec (here `combatStates` while mutating `wildlifeStates`) silently drops the write. Two traps make it near-invisible: (1) the LIVE game reads the cache, so gameplay looks perfect — the divergence only shows across a real save/load; (2) a SHARED slot can be re-dirtied by an unrelated writer (a live boar's per-tick retaliation flushes the whole wildlife map), masking the bug until the entity STOPS acting (death) — so the reliable repro is the terminal state, not the mid-state. And a snapshot-equivalence test that reads the "live" side through a fresh accessor bound to the same `world.state` it compares against verifies codec fidelity but is BLIND to cache-only mutations (both sides read the stale store). To catch this class, drive real gameplay and compare an OBSERVABLE projection (render/economy state) across an actual `saveGame()` → load, not two reads of the persisted store.

## Gating a commit on an async test run: the task-level exit code and a look-alike summary can both lie — 2026-07-11

| Field | Value |
|---|---|
| Surfaced by | Full-review iteration 4, Codex MEDIUM-8 ("the committed hard file-size gate is red"); `docs/threads/done/full/2026-07-11/4/REVIEW.md`. |
| Reviewer findings | Codex MEDIUM-8 CONFIRMED — `tests/simulation/saveLoad.test.ts` was 519 LOC (> the 500 hard cap), unexempted, so `fileSizeBudget.test.ts` was RED on `main`. |
| Fix commit | ba6d159 (extract `captureSnapshot` → `saveBlobTestUtils`, 519→476). |
| Test added | n/a — process lesson (the `fileSizeBudget` test already existed and correctly failed; the failure was in READING it). |
| Behavior delta | Commit `d692ce5` (M14) landed on `main` with a RED file-size gate. The gating `npm test` was launched in the background as `… ; echo "exit=$?"`, and its ACTUAL result — `Test Files 1 failed | 242 passed`, `Tests 1 failed | 2009 passed | 2 skipped (2012)` — was never read; instead a STALE concurrent background task's green summary (`2009 passed | 2 skipped (2011)`) was taken as the run's result. The tells that were missed: the total count (`(2011)` vs the real `(2012)`) and the literal `1 failed`. The trailing `echo` also made the task-level exit code `0` regardless of `npm test`'s real non-zero exit. Without iter-4's independent review, `main` stayed red until the next full-suite read. |

Lesson: when a commit's gate is a background/async `npm test`, neither the task-level exit code nor a glanced "N passed" line is proof. (1) A trailing `echo`/`|| true`/`; true` makes the task exit `0` no matter how the suite exited — capture and read `npm test`'s OWN exit (`echo "exit=$?" >> log` then grep the log for it), don't trust the harness's task status. (2) Grep the suite's own summary for `failed` AND verify the TOTAL count — a green-looking "2009 passed" is worthless if the total (`2011` vs `2012`) shows it came from a DIFFERENT run; concurrent background suites emit look-alike summaries, so always read the summary in the CORRECT log file, and prefer running the gate suite ALONE. (3) Corollary for the file-size ratchet specifically: `npm test` DOES run `fileSizeBudget.test.ts`, so any test file you grow past 500 LOC (here two: `saveLoad.test.ts` via M14a and `selfImprovementLoop.test.ts` via the H6 test) fails the gate — split by lifecycle/role into a sibling or a shared `*TestKit.ts`, never grandfather a newly-grown file.

## A Phaser Graphics re-submits its whole command list to the GPU every frame — "caching the redraw" is only half the fix — 2026-07-11

| Field | Value |
|---|---|
| Surfaced by | User report "game is still very slow"; a headless render benchmark + a throttle-independent per-render-CPU probe (prerender→postrender). Devlog `docs/devlog/detailed/2026-07-11_2026-07-11.md` (v0.1.146 perf entry). |
| Reviewer findings | n/a — measurement-driven perf lesson (self-diagnosed). |
| Fix commit | v0.1.146 (terrain `RenderTexture` bake in `sceneRenderer.ts`). |
| Test added | n/a — perf lesson (the `terrainCache` test still guards the redraw-SKIP contract; the bake is browser/measurement-verified). |
| Behavior delta | Per-frame render CPU dropped ~199 ms → ~5.35 ms (≈37×). The terrain layer went from ~24,283 GPU fill submissions/frame to ONE textured-quad draw. Before: the game was ~5 fps-bound by render regardless of activity or entity count; after, render is ~5 ms/frame. |

Lesson: a `Phaser.GameObjects.Graphics` object re-walks and re-submits its ENTIRE command list to the GPU EVERY frame, whether or not you redrew it that frame. So "caching" a static/complex Graphics by skipping the re-ISSUE of its draw commands (what v0.1.131 did for the ~24k-fill terrain — it stopped re-running `drawTerrainCell`, computing a signature to decide) does NOT reduce the per-frame GPU cost: the persisted 24k fills still render every frame and dominated at ~199 ms/frame EVEN in the sparse early game (independent of entity count). To actually remove the cost, rasterize static/slow-changing complex geometry to a `RenderTexture` (or `generateTexture`) ONCE and display the texture (1 draw call); keep the Graphics only as a hidden draw-source. Two measurement corollaries: (1) headless RAF is throttled (~4.5 fps) so browser FPS is a red herring — measure per-render CPU via the throttle-independent `prerender`→`postrender` window instead; (2) a DRAW-CALL count (countable headless with a Proxy/spy Graphics that records every op) is a reliable proxy for GPU-bound render latency when real FPS can't be measured — 24k calls/frame was the tell before any browser run. Trade-off to weigh when baking: a texture is fixed-resolution, so it upscales (nearest-neighbor under `pixelArt`) when the camera zooms past the bake resolution; bake at ≥ max-zoom res if crispness at full zoom matters and the size fits the GPU texture limit (universally 4096).

## Renderer cache identity must include the world epoch, not only a local revision — 2026-07-12

| Field | Value |
|---|---|
| Surfaced by | Adversarial review of the first voxel replay path: a replay scrub rebuilt the simulation world at revision 1 but the Three presenters reused resources whose local incarnation/revision also read `1:1`. |
| Reviewer findings | HIGH stale presentation across bridge/replay replacement; separate review also found an acknowledgement API that defaulted missing identity from the newer accepted world. |
| Fix commit | Shared voxel engine `7fbae42` plus AoE2 v0.1.147. |
| Test added | `tests/browser/voxel-renderer.spec.ts` replay scrub asserts a new epoch and changed captured world pixels; shared `render-world.test.ts` rejects the prior world identity. |
| Behavior delta | Before: a new world could be accepted at revision one while unchanged version strings kept the old GPU geometry, and a stale acknowledgement could alias a replacement world. After: cache versions and presentation acknowledgement carry the full `{worldId, epoch, revision}` identity; pixels rebuild and presented state advances only after successful render. |

Lesson: a monotonic revision is monotonic only inside its namespace. Any renderer cache, async job, acknowledgement, remove operation, or capture watermark that survives world replacement must key on world/epoch plus local incarnation/revision; defaulting a missing epoch/world from current state manufactures the exact alias the identity was meant to prevent. Prove this at the output boundary: reset to a new epoch with the same local revision and assert captured pixels/resources change, not merely that accepted state changed.

## A moving unit's current root is not its occupancy assignment — persist destination authority separately — 2026-07-14

| Field | Value |
|---|---|
| Surfaced by | `docs/threads/done/motion-continuity/2026-07-13/1/REVIEW.md` during crowded save/load and overflow reconstruction review. |
| Reviewer findings | Codex in-process HIGH — crowded moving root was treated as assigned slot; HIGH — missing slot fields conflated legacy saves with explicit overflow; HIGH — reconstruction opportunistically promoted overflow after a peer freed its slot. |
| Fix commit | `8f2a130` |
| Test added | `tests/simulation/createSimulationBridge.unitMovement.test.ts > continues toward the same crowded-cell slot after a mid-movement save/load`; `tests/simulation/unitMotionPersistence.test.ts > keeps an authoritative overflow unit overflowed across save/load`; `tests/simulation/unitMotionPersistence.test.ts > restores overflow before smoothly claiming a slot freed before save` |
| Behavior delta | Before: a crowded unit saved while fine X 80 was still moving toward assigned X 83 could reload owning X 80, clear early, and diverge; an explicit overflow unit could also be promoted ahead of uninterrupted play. After: numeric slot authority or explicit overflow reconstructs independently of the serialized root, and any newly available slot is reached under the ordinary Euclidean fine-step bound before the command clears. |

Lesson: occupancy answers two different questions during movement: where the body is now, and which unique subcell endpoint it owns. A fine transform can answer only the first. Persist the assigned slot (or an explicit no-slot/overflow marker) as separate additive authority, reconstruct owned numeric slots before legacy fallbacks and overflow claims, and never snap the live root to make reconstruction convenient. Prove continuation against an uninterrupted twin tick by tick, including command state and Euclidean step bounds; a codec round trip or one post-load position cannot catch early completion or opportunistic promotion.

## A raw fog store needs two-time visibility for interpolation, not only a current-identity filter — 2026-07-14

| Field | Value |
|---|---|
| Surfaced by | `docs/threads/done/unit-attack-animation/2026-07-14/3/REVIEW.md` during independent fog/replay refutation. |
| Reviewer findings | Codex in-process IMPORTANT — hidden stationary entities could not reveal under projector rejection; after raw retention, a newly visible enemy inherited its hidden prior coordinate and live/replay `visibleEntities` surfaces counted raw entities. The all-world `entityCount` diagnostic was intentionally not perspective-filtered. |
| Fix commit | `03bf46e` |
| Test added | `tests/simulation/unitAttackAnimationVisibility.test.ts > does not interpolate a newly revealed enemy from its prior fogged position`; `tests/replay/makeReplayBridge.fogOwner.test.ts > hides enemy units under player-1 fog by default and reveals them for fogOwner 2` |
| Behavior delta | Before: projector filtering permanently omitted a stationary hidden entity, while naïve raw retention could render a newly revealed enemy from its prior fogged coordinate at interpolation alpha 0 and expose hidden entities through visible-entity HUD surfaces. After: raw identity survives, final render state applies current perspective, prior positions require prior-frame visibility plus current identity, and live/replay `visibleEntities` consume filtered state while `entityCount` remains an explicitly all-world debug/performance metric. |

Lesson: a raw presentation store and a player-visible frame answer different questions. Retaining raw entities is necessary for state-only LOS changes, but interpolation is a relationship across two observations: the source coordinate must have been visible in the prior frame and the same generation must be visible now. Filtering only by current identity turns hidden history into a side channel. Keep the raw store behind one final perspective boundary, filter auxiliary surfaces such as prior positions and visible-entity metrics too, keep all-world `entityCount` explicitly diagnostic, and test hidden→visible movement rather than only hidden→hidden removal.

## Pause proofs must exercise the dependency-facing animation clock, not only authored base matrices — 2026-07-14

| Field | Value |
|---|---|
| Surfaced by | `docs/threads/done/unit-attack-animation/2026-07-14/3/REVIEW.md` after the browser pause assertion was traced through `inspectPresentedPartMatrix`. |
| Reviewer findings | Codex in-process IMPORTANT — partially attack-controlled siege parts still sampled wall-clock harmonics while paused; IMPORTANT — direct simulation time could move backward on replay scrub and violate Voxel's monotonic clock contract; EVIDENCE — the browser diagnostic returned pre-harmonic base matrices. |
| Fix commit | `03bf46e` |
| Test added | `tests/rendering/AoeVoxelWorldRenderer.test.ts > freezes Voxel ambient animation time while simulation display time is paused` |
| Behavior delta | Before: a paused cancellation/recovery pose could keep oscillating on GPU wall time even though its inspected base matrix stayed byte-identical, and a backward replay scrub could submit a smaller `nowMs` to Voxel. After: one accumulated clock advances only by positive simulation-display deltas, repeats exactly during pause, rebases without decrement on bridge/replay replacement, and drives both Voxel harmonics and time-sampled AoE hit geometry. |

Lesson: a diagnostic that returns authored/base geometry cannot prove the final animated matrix is frozen. Trace the value all the way to the dependency or GPU seam and assert the clock sample that actually drives the transform. When the dependency requires monotonic time but the game supports rewind, use an accumulated consumer clock: positive display deltas advance it, equal time freezes it, and backward discontinuities rebase the source sample without decrementing the injected clock. Keep picking on the same clock so visible and interactive geometry do not diverge.

## Event visibility must be synchronized at mutation boundaries and persisted, not reconstructed by the renderer — 2026-07-14

| Field | Value |
|---|---|
| Surfaced by | `docs/threads/done/unit-attack-animation/2026-07-14/{4,5,6,7,8,9,10,11}/REVIEW.md` during repeated live-code fog/replay/performance/animation refutation. |
| Reviewer findings | Codex iteration 4 HIGH owner visibility bypass; iteration 5 HIGH stale same-tick LOS plus MEDIUM fresh-replay resurrection; iteration 6 MEDIUM stale final tower LOS plus scan growth; iteration 7 MEDIUM fine-only invalidation; iteration 8 MEDIUM tower-order mutation plus MEDIUM neutral-building invalidation; iteration 9 MEDIUM coincident-root pose loss; iteration 10 MEDIUM exact-boundary warm/fresh mismatch; iteration 11 MEDIUM production-path gait-equivalence overclaim plus an exact-time discontinuity. |
| Fix commit | `abbcd5c`; earlier coincident-root renderer commit `1d294f1`; interim exact-boundary attempt `ea765bd`; production-channel correction `f57f5ab`. |
| Test added | `tests/simulation/unitAttackAnimationFeed.test.ts > does not publish a hidden target coordinate to the attacker owner`; `tests/simulation/unitAttackAnimationFeed.test.ts > refreshes visibility before each same-tick impact`; `tests/simulation/unitAttackAnimationFeed.test.ts > reuses one current snapshot across max-pop fine moves and impacts`; `tests/replay/unitAttackAnimationReplay.test.ts > persists suppression when tower fire removes the final local witness source`; `tests/replay/unitAttackAnimationReplay.test.ts > does not resurrect a persisted fog-suppressed cue in a fresh replay bridge`; `tests/simulation/visibilityMutationBatching.test.ts > keeps tower targeting on the pass-start snapshot, then publishes final LOS`; `tests/simulation/visibilityMutationBatching.test.ts > invalidates only when one of the bounded entities actually changes vision`; `tests/rendering/aoeVoxelUnitAttackAnimation.test.ts > keeps a coincident-root attack visible with deterministic prior facing`; `tests/rendering/aoeVoxelUnitAttackLifecycle.test.ts > keeps fresh moved-root sampling continuous across the cancellation boundary`; `tests/rendering/aoeVoxelUnitAttackLifecycle.test.ts > keeps the attack channel deterministic while fresh gait history restarts`. |
| Behavior delta | Before: ownership could admit a hidden target coordinate, same-tick mutations or tower kills could use stale LOS, fresh replay could resurrect a hidden cue, visibility scans could multiply across a burst or tower pass, neutral structures invalidated the cache, a valid stacked attack could disappear, and an attempted full warm/fresh gait reconstruction jumped between the exact cancellation time and the next instant. After: both actor footprints must be visible at impact, mutation fingerprints and one final tower refresh make LOS current without order-dependent rescans, per-perspective suppression survives checkpoints, bounded neutral destruction stays cache-neutral, coincident roots keep a finite strike pose, and roots plus the attack channel remain continuous while fresh disposable gait history may restart. |

Lesson: presentation privacy cannot be repaired after coordinates have entered a render feed. Decide eligibility at the combat mutation boundary from current authoritative visibility, persist any later hide-once suppression before checkpoint publication, and make cache invalidation describe the exact source set the mutation can change. Systems that resolve a batch from one snapshot must keep that snapshot immutable until the batch ends, then publish one final refresh. When valid geometry is degenerate, preserve the event and choose an explicit deterministic presentation fallback instead of silently dropping it. At renderer handoffs, distinguish persisted attack-channel truth from disposable gait smoothing: prove roots and attack phase/weight/suppression through the production interpolation path, but do not invent prior locomotion history merely to force full warm/fresh matrix equality.
