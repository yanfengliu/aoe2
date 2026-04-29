# Review iteration 1 — construction HP ramp (0.1.4)

Diff: `agent/construction-hp-ramp` (commit `632a34f`) vs `main`. Reviewers: Codex (`gpt-5.4` xhigh), Gemini (`gemini-3.1-pro-preview` plan), Claude (`opus` xhigh). Raw outputs in `raw/{codex,gemini,opus}.md`. Gemini's run was hit by an SSL alert mid-stream but salvaged the review section before the restart.

## Cross-reviewer agreement

- **Doc / coverage drift (3/3 reviewers).** Codex F3, Claude F2, and Gemini's premise on F1 all agree the devlog overstates what's verified. The new test exercises the happy-path formula only; damage-during-construction, save/load mid-build, scenario-seeded `isComplete: true`, and destroy-during-construction are unverified.
- **Force-set at completion silently heals damage (2/3 reviewers).** Claude F1 and Gemini F2 independently caught that `playerCommandsSystem.ts:397-399` overwrites the live `currentHp` with `maxHp` on the completing tick. A foundation chipped to 5/75 at 95% built pops to 75/75 the moment the last tick fires, which contradicts both canonical AoE2 (foundations finish damaged) and the devlog claim that "damage taken during construction is preserved."

## Codex-only

- **F1 [MEDIUM].** `findPreferredEnemyBuildingInRadius` in `targetFindingOps.ts:463` skips incomplete buildings. Auto-aggression (`autoAggressionSystem.ts:119`) uses that selector for idle-military building targeting, so nearby military / AI still won't auto-attack an enemy foundation even though the new HP ramp makes them targetable in principle. The "canonical AoE2 / foundations are vulnerable" framing only holds for explicit player attacks today.
- **F2 [MEDIUM].** HUD selection panel (`selectionPanel.ts:266`) renders raw `${selectionState.health.current} / ${selectionState.health.max}`. Foundations are selectable. Mid-build HP is now fractional (per-tick `+0.567` for a House), so the panel will print `41.857142857142854 / 75`.

## Claude-only

- **F3 [LOW].** Devlog claims the existing health-bar renderer "picks up the change with no render-side edits." Not visually verified end-to-end; the project rule is to capture before/after + pixel diff for visual changes. Worth eyeballing in `npm run dev` before merge.
- **Verifications clean** for: (a) damage during construction (combat reads/writes `buildingHealthStates.currentHp` directly without checking `isComplete`), (b) save/load via `hydrateFromSavedGame.ts:254-255` direct restore (does NOT route through `addBuildingEntity`), (c) scenario-seeded `isComplete=true`, (d) destroy-during-construction, (e) fog-memory snapshots intentionally omit HP fields, (f) float-drift math.

## Gemini-only

- **F1 [FALSE POSITIVE].** Claimed save/load is broken because `addBuildingEntity` re-floors to startHp. Wrong — Claude verified hydration goes through `hydrateFromSavedGame` direct `buildingHealthStates.set(id, {...hp})`, not `addBuildingEntity`. Disregard.
- **F3, F4, F5 [NITS].** Magic-number 0.1 duplicated, fractional HP precision, per-tick recompute of `hpPerTick`. Real but low impact; deferring.

## Decisions

| Finding | Action |
|---|---|
| Force-set heals damage (Claude F1, Gemini F2) | **Fix.** Replace `currentHp = maxHp` with `currentHp = Math.min(maxHp, Math.round(currentHp))` — absorb only IEEE-754 drift, not in-flight damage. Update changelog/devlog/summary text accordingly. |
| Auto-aggro skips foundations (Codex F1) | **Fix.** Drop the `if (construction && !construction.isComplete) continue;` skip on line 463 of `targetFindingOps.ts` (auto-aggro radius scan). Keep line 353 (drop-off semantics — can't drop off at a foundation). |
| HUD shows fractional HP (Codex F2) | **Fix.** Floor `selectionState.health.current` at the selection-panel render site so the panel shows integer HP. Leave bridge-side `getEntityHealth` raw so health-bar fill ratio stays smooth and the test surface keeps the exact value. |
| Coverage thin (Codex F3, Claude F2) | **Partial.** Add save/load mid-construction HP regression test. Skip damage-during-construction fixture (would need new militia-vs-foundation fixture), scenario `isComplete=true` is implicitly covered by every existing scenario test. Update devlog to honestly state what's covered. |
| Render-side visual nit (Claude F3) | **Defer.** No render code changed in this diff; the change is HP value flowing through the existing health-bar pipeline. |
| Magic number / micro-perf (Gemini F3-F5) | **Defer.** Real but not blockers. |

## Verification on iteration 2

After fixes land, re-review prompt should specifically verify: (a) auto-aggro unit test pursues enemy foundation, (b) HUD selection panel test asserts integer HP display for in-construction building, (c) save/load mid-construction HP round-trip test passes, (d) docs match the new "damage preserved end-to-end including completion" behavior.
