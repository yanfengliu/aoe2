# Review 3: implementation

## Target

Repository aoe2, commit `ce2f933f` ("Follow the enemy's conversion progress, not the order (work 116)") on branch `fog-memory-own-buildings`, against its parent `0cee8e54`, which round 2 reviewed. Scope, focused on round 2's repair: the exception in `src/game/simulation/bridge/systems/fogMemorySystem.ts` now follows an enemy's progress record in `aoe2.conversionState` (`isEnemyOwner`) instead of convert orders, with the keep-rule removed. Also in scope: the reworked `tests/simulation/fogMemoryOwnBuildingConversion.test.ts` (nine cases), the matching docs, and round 2's record. Each reviewer received `git diff 0cee8e54..ce2f933f` (815 lines, sha256 `c32d887642079ec884c5b6ad39ed0aad64c7e6676131373c39ceaf0bcff86d39`) on stdin, with rounds 0-2's records and the plan in the tree. The worktree did not change while they ran. Phase 2 rebases the branch, so the landed commits carry new hashes; the diff digest identifies the reviewed change.

## Reviewers and coverage

- **Codex**, `gpt-6-astra` at `model_reasoning_effort=xhigh`, codex-cli 0.158.0, `--sandbox read-only --ephemeral`, `-o` capture; exit 0, 6,531-byte report. Its stdout's two matches for `STATUS_DLL_INIT_FAILED` and `-1073741502` are echoed text of round 0's record, not a sandbox failure. It cites files and lines outside the diff (`monkContextOps.ts:72`, `monkBuildingConversion.ts:76,108,130`, `dispatcher.ts:76`, `monkContextAtEntityValidator.ts:42`, `monasteryTechEffects.ts:118,135`, `hydrateFromWorldState.ts:151,170`).
- **Claude**, `claude-opus-5-5[1m]` at `--effort max`: **abstained.** The run ended after nine turns and 7.5 minutes with `is_error: true` and the account's message "You've hit your session limit"; it wrote no findings. The same limit stopped the author's session minutes later. The lane was not re-run: the coordinator asked for the handoff, and a re-run would draw on the same account limit.
- The brief asked whether the record-based exception is correct and complete, whether F11, F24 and F27 stay closed, whether the one live-against-load difference (F10) is stated completely, whether the tests prove their names, and whether the docs match the code. Codex ran nothing.

## Reports

### Codex (gpt-6-astra, xhigh)

1. MED — F27 remains open when replacement and conversion happen before the replacement’s first fog pass.

   src/game/simulation/bridge/systems/fogMemorySystem.ts:131 only protects a building while the human still owns it. At :153, an unseen converted building needs an entry for its current generation.

   A reachable command sequence is:
   - Pause an enemy conversion at 49 on human building X.
   - Queue deletion of X, construction at another valid nearby site, and `monk.contextAtEntity` targeting X, in that order.
   - All submissions validate before execution (`src/game/simulation/dispatcher.ts:76`). The Monk validator accepts the still-live old X (`src/game/simulation/handlers/monk/monkContextAtEntityValidator.ts:42`).
   - Construction reuses X. The Monk handler resolves the target’s current generation when executing (`src/game/simulation/bridge/monkContextOps.ts:72`), so it targets the replacement.
   - An in-range Monk resumes 49 and flips it before fog memory runs (`src/game/simulation/bridge/monkBuildingConversion.ts:108`, :130).

   With the replacement outside human sight, its old-generation memory cannot refresh it and is subsequently forgotten. The replacement disappears. The added test avoids this boundary by explicitly stepping before submitting the resumed conversion (`tests/simulation/fogMemoryOwnBuildingConversion.test.ts:204`).

   Suggested fix: clear progress at building destruction, or record the ownership transition at conversion so it does not require an earlier fog pass. Add the queued-command sequence without an intervening tick. Update the unconditional F27 closure at `docs/work/116_fog-memory-own-buildings/reviews/2_implementation.md:241`.

2. LOW — The save test no longer proves tick-by-tick equivalence throughout the active conversion.

   `tests/simulation/fogMemoryOwnBuildingConversion.test.ts:285` advances each match independently until progress reaches 49, then compares them. A loaded match that advances conversion more slowly can catch up at a later world tick and pass. Intermediate memory differences can also disappear before this comparison.

   This contradicts the “progress at every step” disposition in `docs/work/116_fog-memory-own-buildings/reviews/2_implementation.md:242`. The raw, unsorted comparison itself is appropriate; the execution schedule weakens it.

   Suggested fix: advance every match once per iteration, compare raw memory and progress after every step, and assert equal world ticks. Stop when the live match reaches 49.

3. LOW — The “paused save” portion can pass without saving a paused conversion.

   `tests/simulation/fogMemoryOwnBuildingConversion.test.ts:287` recalls the Monks, steps three times, and saves without asserting progress remains 49, ownership remains human, or the convert task is absent.

   If recall stops clearing conversion tasks, both matches flip during those three ticks. Their comparisons still agree, the second save contains an already-converted building, subsequent conversion commands accomplish nothing, and the final owner/render assertions pass.

   Additionally, :291 replaces the loaded Monk’s order before any tick observes its restored paused state. An incorrectly restored convert task can therefore be concealed.

   Suggested fix: assert human ownership, progress 49 and no convert task immediately before saving and after loading. Advance all three matches through several paused-conversion ticks before resuming. Keep the immediate raw-slot comparison.

4. NIT — The rationale overstates what a conversion record proves and how long it survives.

   `docs/work/116_fog-memory-own-buildings/reviews/2_implementation.md:261` says the record lasts “exactly as long as a one-tick flip stays possible.” The implementation at `src/game/simulation/bridge/systems/fogMemorySystem.ts:130` follows the requested record-based rule, including false positives:

   - A Castle, Town Center, wall or farm replacing a destroyed conversion target inherits its exemption, although those types cannot be converted (`src/game/simulation/monasteryTechEffects.ts:118`, :135).
   - A record can contain zero progress after a same-tick competing conversion (`src/game/simulation/bridge/monkBuildingConversion.ts:108`).
   - An invalid conversion attempt can delete the record without the building changing hands or dying (`monkBuildingConversion.ts:76`). Thus the lifetime asserted in `design/spec-final.md:1514` and `docs/work/116_fog-memory-own-buildings/plan.md:50` is not unconditional.

   Such retained entries are hidden while human-owned and ordinarily removed after destruction. They nevertheless consume saved state and fingerprint work; the appearance comparison prevents unchanged entries from forcing serialization every tick.

   Suggested fix: describe conservative retention while an enemy record exists, qualify reused-building convertibility, and document the unnecessary-entry cost. If exact eligibility is desired, use the conversion eligibility rules too.

F11: Closed for the established same-entity recall/resume sequence in current-version play. The previously noted legacy save containing an unseen foundation at progress 49 without memory can still flip on its first loaded tick before memory is established.

F24: Closed by inspection. An exempt human building reaches `remember` with its current owner and appearance (`fogMemorySystem.ts:157`); the stale-entry keep path is gone.

F27: Partially closed. A replacement that receives an own-building fog pass is covered. Finding 1 bypasses that prerequisite.

For current-version states with memory already established, I found no additional conversion-related live/load divergence independent of F10. Hydration prunes dead IDs (`src/game/simulation/bridge/hydrateFromWorldState.ts:151`, :170), and the memory codec preserves array order (`src/game/simulation/bridge/bridgeStateSerialize.ts:91`). F10’s direct exemption difference is dormant against non-converting AI; F10 overall also includes the already-recorded F33 route through human conversion of a replacement unit.

Open questions:

- Will F10 land before this repair, or will the conversion boundary explicitly cover first-pass flips?
- Will a recorded replay checkpoint through conversion and interruption receive a `selfCheck` before integration?

Outside-diff reads included `src/game/simulation/bridge/monkContextOps.ts:72` and `src/game/simulation/bridge/monkBuildingConversion.ts:108`. No files were changed and no tests or builds were run.

### Claude (claude-opus-5-5[1m], max)

No report: the run stopped at the account's session limit after nine turns (see Reviewers and coverage).

## Findings and disposition

Earlier findings keep their IDs; this round's new ones continue from F34. Codex says F11 and F24 are closed and F27 only partly.

| ID | Finding | Disposition and reason | Repair or follow-up |
|---|---|---|---|
| F34 | F27 stays open by one route. Queue, for one tick: the deletion of a building of the player's paused at progress 49, a construction elsewhere that reuses its id, and an enemy's convert order on the old id, which the handler resolves to the new generation. The Monk resumes 49 and flips the replacement before any memory pass sees it. Out of the player's sight, it vanishes (Codex 1, MED). | Accepted as a bound. A memory pass can only act on what exists when it runs. The two in-code fixes Codex names, clearing the record at destruction or recording the transition at the flip, are in `entityDestroyOps.ts` and `monkBuildingConversion.ts`, outside this card. It is no regression: on main an unseen replacement had no entry either. It needs that command order in one tick and an enemy that converts buildings, which no AI does. | Spec §12.1 and the plan's Decisions state it; the F10 card (clear the record in `destroyBuildingEntity`) closes it, since the replacement then starts from no progress. Not staged as a test. |
| F35 | The save/load case stepped each match on its own to progress 49 before comparing, so a loaded match that converted more slowly could catch up and pass, which contradicts round 2's "progress at every step" (Codex 2, LOW). | Accepted. | Every match now steps once per iteration from the first load, compared after every step on world tick, raw slot, progress and owner. |
| F36 | The paused save was never shown to be paused: no assertion of the player's ownership, progress 49 or the absence of a convert order before saving, and the resumed order replaced the restored one before any tick observed it (Codex 3, LOW). | Accepted. | The case asserts all three before the paused save and the absence of a convert order after its load, then steps all three matches through five paused ticks before resuming. |
| F37 | The rationale overstated what a record proves and how long it lasts. A replacement of any type inherits a stale record, convertible or not; a record can hold zero progress; an invalid attempt deletes a record without a flip or a loss. **Correction to round 2's outcome**, which said the engine keeps the record "exactly as long as a one-tick flip stays possible" (Codex 4, NIT). | Accepted; wording only. Narrowing the exemption with the conversion eligibility rules was offered and not taken: the extra entries are never drawn and cost only state. | Spec §12.1 and the plan say the retention is conservative, name the record's other endings and the cost of the extra entries. |

## Verification

Run by the author on the working tree after the report (none of it on `ce2f933f` itself):

- `npx vitest run` on the two gate files: 14 of 14 pass with the tightened save/load case.
- The mutation runs of round 2's record are of `ce2f933f`'s cases. Round 3 changed only the save/load case, which no mutation targets, and did not rerun them.
- Not run: a Claude lane for this round (abstained, as above); `npm run verify` (phase 2); a recorded-replay `selfCheck`.

## Round outcome

One lane reviewed this round. F11 and F24 are closed. F27 is closed except for F34's same-tick replacement, which is recorded as a bound that only F10 can close. Both test gaps (F35, F36) are repaired, and F37 corrects round 2's wording. No logic changed after this round, so no further round was run. Two things are left for the coordinator: the abstained Claude lane, and the F10 card, which would close F34 and the exception's live-against-load difference together.
