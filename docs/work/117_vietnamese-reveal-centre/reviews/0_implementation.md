# Review 0: implementation

## Target

Repository aoe2, branch `vietnamese-reveal-centre`, commit `d965bcfc` against base `f906a255` (origin/main at dispatch). The reviewed diff was `git diff f906a255..d965bcfc`: 17 files, 742 insertions and 72 deletions. It covers `vietnameseReveal.ts`, `wirePostSeedOps.ts`, the `wirePostSeedOps({...})` call in `wireBridgeOps.ts`, `systems/aiSystem.ts`, `ai.ts`, three new test files and a helper, the §12.2 spec paragraph, the defect-register entry and its rollover, a gate-proofs record, the changelog and the devlog. The diff was piped to each reviewer on stdin, and each read the worktree at that commit.

## Reviewers and coverage

Both reviewers got the same read-only prompt with six lenses: persistence through save, load and replay (the coordinator's explicit ask), the reveal's geometry, the AI scan, the tests, the documents, and the file-ownership scope. Neither ran a test or a build. The worktree was clean before the runs. Afterwards its only change was the owner's own wording edit to `docs/learning/gate-proofs.md`, made during the runs and checked by diff, so neither reviewer wrote to the tree.

- **Codex** CLI 0.158.0, model `gpt-6-astra`, `model_reasoning_effort=xhigh`, `--sandbox read-only --ephemeral`, report taken from `-o`. It used 186,296 tokens. Its stdout holds no `STATUS_DLL_INIT_FAILED` or `-1073741502`. It cited files outside the diff, and the owner spot-checked two of them: `registerAllSystems.ts:204` registers the AI system in replay worlds too, and `bootstrapFlush.ts:76` publishes visibility. It used no visible subagents.
- **Claude** Code 2.1.281, model `claude-opus-5-5[1m]`, `--effort max`, `claude -p` with `Read,Glob,Grep,Task` and the `git diff`, `git log` and `git show` commands only. The final `result` event's `modelUsage` held exactly one key, `claude-opus-5-5[1m]`, over 61 turns. It reported reaching its usage limit as it finished, and said its review still covered all six lenses. It did not check how a replay world handles the AI's queued orders, or re-measure the documents' numbers.

Both pins were smoke-tested first, each answering `ok`, per `../fleet/docs/skills/multi-cli-review.md`.

## Reports

Each report is reproduced as its reviewer wrote it. One redaction: Codex's link to `docs/changelog.md:7` carried an absolute local path, shortened here to the repository path.

### Codex (gpt-6-astra, xhigh)

- **Minor — `docs/changelog.md:7`: replay fidelity is overstated.** “A replay shows exactly the ground its recording holds” is only established for snapshot restoration. Replay worlds still run the changed AI (`src/game/simulation/bridge/registerAllSystems.ts:204`). For example, with a Town Center at `(20,12)`, a visible unit at `(33,13)` now triggers a sighting that the old scan missed; subsequent AI state and actions can diverge from an older recording. The legacy-recording test only opens its initial snapshot (`tests/replay/vietnameseRevealReplay.test.ts:129`), and the self-check fixture disables AI (`tests/simulation/vietnameseRevealHelpers.ts:37`). **Suggested fix:** qualify the promise as preserving recorded reveal data without reapplying the bonus, and note that older recordings re-simulate with the new AI rules.

No blocker or major implementation finding. By inspection, schema-1 restoration preserves visibility and memory (`saveBlobReaders.ts:19`, `hydrateFromSavedGame.ts:239`); bootstrap publishes visibility and flushes memory before returning the bridge (`bootstrapFlush.ts:76`, `:106`), covering tick-zero saves and recordings. The layer split retains the reveal, and replay construction supplies `savedGame`. The centred geometry, valid map-edge bounds, source cleanup, deterministic lowest-ID selection, and sixteen probe classifications are sound. The register rollover is verbatim, and edits stay within scope. No files changed; no tests or builds run.

### Claude (claude-opus-5-5[1m], max)

The change is sound on persistence. I found no blocker or major issue, only three minor doc and test gaps and some nits.

**Findings**

1. **Minor — `docs/changelog.md:7` and `design/spec-final.md:1538`: old replays can now play out differently.** `registerAllSystems.ts:204` registers the AI system in replay worlds too, so a replay runs the AI again between snapshots. A recording made before this change then runs the new centred scan, and can diverge from what was recorded: watch-tower placement, the town bell, and a failing `selfCheck`. The changelog only says "a replay shows exactly the ground its recording holds", which is true at snapshot ticks only. Version 0.3.243 set the precedent of saying so ("old replays can resolve combat differently"). **Fix:** add the same caveat for the AI scan.

2. **Minor — same two lines: very old saves lose the reveal.** Vietnamese could be picked from v0.1.87 (`?civ=`, changelog line 1842), but the reveal only arrived in v0.3.88. A Vietnamese save from that window holds no reveal at all. Before this change every load added one; now it never gets one. The docs say only that older saves "keep the cells that old reveal explored", which doesn't cover these. Not loading a reveal is arguably right, since Definitive Edition reveals at the start. **Fix:** state that saves and recordings from before v0.3.88 load with no reveal.

3. **Minor — `tests/simulation/aiBaseSightingCentre.test.ts:98-101`: a stated premise is never checked.** The comment says the AI's Town Center sees the probe cell, but only the Militia's position is asserted. Each "outside" probe expects no sighting, so it passes trivially if the AI cannot see the cell. That would happen if the sight raise through `setComponent` (line 85) ever stopped taking effect. The "inside" probes would go red in that case, so the suite as a whole still catches it. **Fix:** assert `bridge.isCellVisibleForOwner(AI, probe.x, probe.y)` when the decision is read.

4. **Nit — spec line 1538 and register line 11.** The claim that the old scan "missed enemies the Town Center saw past its south-east corner" needs Town Center sight above about 9.2 cells from the middle, which means Town Watch.
   - Without Town Watch, the old corner circle of 12 covered all of the Town Center's 8-cell sight; I checked the farthest cells by hand.
   - The AI never researches Town Center sight techs (spec line 1536); only the Byzantines get Town Watch free.
   - The changelog's wording, "an enemy it can see", is correct.

5. **Nit — spec §11.11 (line 1452).** The v0.3.88 text there ("a temporary vision source", "at post-seed") stays unedited, and the new paragraph says it replaces it. §11.11 itself never said the reveal ran on every load; that was what the code did. The worker's scope didn't allow editing it, so the coordinator should add a pointer from §11.11 to the new paragraph.

6. **Nit — `docs/learning/gate-proofs.md` (new entry), two wording points.**
   - "`selfCheck` on every segment": the test asserts `ok` and `checkedSegments > 2`, not zero skipped segments.
   - "each direction's last cell inside": the south-east (29,22) and north-east (30,6) probes sit just inside the circle but are not the last cells on the diagonal. They are still valid probes.

**Outside this change, for the register:** the town bell reads the *lowest-id* sighting, not the nearest (`aiSystemDefensePhase.ts:48-50`). A low-id unit at the edge of the scan can therefore hide raiders already inside `RAID_RADIUS`. This change shifts which units are candidates but did not create the problem.

**What I verified and found sound**
- **Persistence:**
  - The reveal runs before `bootstrapFlush`, which writes visibility unconditionally (`bootstrapFlush.ts:76`) and then flushes the fog memory.
  - `saveGameOps.ts:47-50` flushes before serialising at any tick, tick 0 included.
  - The recorder's first snapshot is taken in `connect()` (civ-engine `session-recorder.ts:164`), after the bridge is fully built.
  - The reveal's sources have numeric ids, so they land in the units layer and are saved in `aoe2.visibility`.
  - Nothing on the load path clears that layer or rebuilds memory: there is no `clearPlayer` call outside the map class, schema-1 memory is hydrated at `hydrateFromSavedGame.ts:239`, and replay worlds rebuild sight from the snapshot's slots.
- **`!savedGame` is the right signal:** `createWorld` has two callers. `createReplayWorldOnly.ts:19-26` always passes a save, and the app builds bridges only at `createApp.ts:116` (fresh) and `:276` (load).
- **Geometry:**
  - For sight 5 the source radius is 4.30, and the union of the four circles is exactly the centred circle.
  - The engine's sight test (`visibility-map.ts:242-248`) and its id-sorted radius query (`spatial-grid.ts:125-161`) use the same `dx²+dy² ≤ r²` rule, so `findBaseSighting` keeps the old loop's lowest-id contract.
  - I checked all 16 probe cells by hand, and the 6 failures under the corner scan reproduce.
  - The temporary source ids can't collide with the per-tick sight sync's ids (`visibilitySourceSync.ts:60`), and all are removed.
- **Docs and scope:**
  - The register rollover is byte-identical (diffed).
  - The case counts (5 + 2 + 17) and the mutation tallies in gate-proofs add up.
  - No edit falls outside the allowed scope.
  - `wirePostSeedOps.ts` is at exactly 500 lines. The size gate allows that (`fileSizeBudget.test.ts:91`), but a future edit there will need a split.

I did not run any tests; this review was read-only.

Your usage limit was reached as I finished, but the review covers all six areas you asked about. I did not check how a replay world handles the AI's queued orders, or re-measure the docs' numbers (58 of 80 cells, the screenshot diffs), because that needs running code.

## Findings and disposition

| ID | Finding | Disposition and reason | Repair or follow-up |
|---|---|---|---|
| F0 | The changelog and spec overstated replay fidelity: replay worlds run the AI again, so a recording made before this change can play out differently (Codex, minor; Claude 1, minor). | Accepted. `registerAllSystems.ts:204` registers the AI in replay worlds, so the reveal half holds only at snapshot ticks. | The changelog, the spec paragraph and the register's bounds now say a replay starts from the recorded explored ground, and that an older recording runs its AI again with the new scan. |
| F1 | A Vietnamese save or recording from before v0.3.88 holds no reveal and now gets none (Claude 2, minor). | Accepted. `?civ=` made the Vietnamese playable from v0.1.87, and the reveal arrived in v0.3.88. Not applying it on load matches DE, which reveals at the start only. | The spec, the register and the changelog say so. |
| F2 | The AI test never asserted its premise that the AI sees each probe cell, so an outside probe could pass because nothing saw it (Claude 3, minor). | Accepted. | `aiBaseSightingCentre.test.ts` asserts `isCellVisibleForOwner` for owner 2 at the probe when the decision is read. Mutation P, the sight raise removed, turns 16 of 17 cases red on that premise. |
| F3 | "Missed enemies the Town Center saw past its south-east corner" needs Town Center sight above about 9.2 cells, which means Town Watch, and the AI never researches it (Claude 4, nit). | Accepted. The defect shows through the AI's other units and buildings, or through a Town Center with Town Watch, which a Byzantine AI gets free. | The spec paragraph and the register entry are reworded. |
| F4 | The v0.3.88 account in spec §11.11 still describes the reveal without its timing or geometry, and needs a pointer to the new §12.2 paragraph (Claude 5, nit). | Accepted as a follow-up: that line is outside this worker's lines. | For the coordinator: one pointer sentence in §11.11. |
| F5 | Two gate-proofs claims were stronger than the tests: "`selfCheck` on every segment", and "each direction's last cell inside" when two diagonal probes are just inside, not last (Claude 6, nit). | Accepted. The self-check test was strengthened rather than the claim weakened, and the probe wording was corrected. | The replay case asserts no skipped segment and `checkedSegments === snapshotTicks().length - 1`. The probe wording is fixed in the test and in gate-proofs. |
| F6 | The town bell reads the lowest-id sighting, not the nearest, so a low-id unit at the edge of the scan can hide raiders already inside `RAID_RADIUS` (Claude, outside this change). | Recorded, not fixed: `aiSystemDefensePhase.ts` is outside this work, and the defect predates it. | For the coordinator, together with the owner's observation that the scan counts an ally's unit as an enemy. That one comes from reading `findBaseSighting` and the loop it replaced, and was not driven. |

## Verification

After the repairs, the three new test files pass 24 of 24, and mutation P is red as described under F2. The devlog entry for work 117 records the architecture suite, `tsc --noEmit` and eslint runs made before the repair commit. The product code reviewed at `d965bcfc` is unchanged by the repairs, which touch tests and documents only.

**Rebase addendum, added after the round closed (2026-10-11).** Under the gate lock the two reviewed commits were rebased onto main `648b50cd` (v0.3.245 and work 119's docs-only close-out). The implementation is now `96ff5986` and this record's commit `1d54e805`, with the 0.3.246 version commit on top. `git range-diff f906a255..06c9c3ad 648b50cd..1d54e805` shows the code and test patches unchanged from the reviewed `d965bcfc` and `06c9c3ad`, and a per-file comparison of the changed lines in the five code files and the two load-path test files agrees. What differs is the first commit's message and the documents: the changelog and devlog context, and the register rollover. Works 115 and 119 had already moved the 2026-09-24 and 2026-09-25 entries, so this work's rollover now moves the 2026-09-26 blast entry instead.

## Round outcome

Neither reviewer found a blocker or a major issue. Both confirmed by reading that the reveal's explored cells and fog-memory entries persist through schema-1 and schema-2 saves, loads and replay snapshots, and that `!savedGame` is the right fresh-match signal. F0 to F3 and F5 are repaired. F4 and F6 are follow-ups outside this work's files and go to the coordinator. The repairs were not re-reviewed: they change no product code, and they only strengthen test assertions and correct documents.
