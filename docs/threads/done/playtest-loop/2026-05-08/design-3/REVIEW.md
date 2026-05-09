# Playtest Loop — Design Iteration 3 Review

Date: 2026-05-08

Reviewers: Codex (`gpt-5.5` xhigh, read-only sandbox) and Claude (`opus-4-7[1m]` max, Read/Glob/Grep). Both verified iter-3 against the live codebase and the iter-1+iter-2 REVIEW.md files.

## Disposition

**Iter-3 converges.** Both reviewers ACCEPT modulo one substantive bug in pseudocode (`engineHalted === true` won't fire — the type is `EngineHaltDetails | null`). Codex flags it HIGH; Claude flags it LOW. Either way the implementer would notice on first run, but it's a real iter-2 regression vs the original spirit of "halt detection." Plus three small NITs and one architecture-section-name correction.

Iter-3 fixes are inline edits to DESIGN.md; no iter-4 is needed before PLAN.

## Findings

### HIGH (Codex H1) / LOW (Claude L1)

`bridge.getHudState().engineHalted === true` doesn't fire. The field type is `EngineHaltDetails | null` (`src/game/simulation/types.ts:426`), wired from `haltState.halted` in `createSimulationBridge.ts:366`. Strict `=== true` is never true.

**Fix.** Replace `engineHalted === true` with `engineHalted !== null`. When the probe matches, copy `halt.code`, `halt.message`, `halt.tick`, `halt.phase`, `halt.systemName` into `envelope.details` so REPORT.md can surface the failed system / phase. Applied to DESIGN.md L108.

### NIT-1 (Claude)

Recorder-error stop-reason discriminator should be pinned: `recorder.lastError instanceof SinkWriteError` (imported from `civ-engine/session-errors`). Prevents a future implementer from inventing string-tag dispatch. Applied to DESIGN.md L107.

### NIT-2 (Claude)

Probe order ambiguous when both `engineHalted` and `matchState.outcome !== 'running'` are true on the same tick. Pin: `error → engineHalt → stopWhen → maxTicks`; first match wins. Applied to DESIGN.md L106.

### NIT-3 (Claude)

`runPlaytest.test.ts` (200-tick smoke) should explicitly assert `envelope.stopReason === 'maxTicks'` so a future engine change that ends matches in <200 ticks doesn't silently change what the test exercises. Applied to DESIGN.md test-plan section.

### LOW-1 (Codex L1)

`docs/architecture/ARCHITECTURE.md` doesn't have a "Component Map" or "Boundaries" section — the actual sections are `Repository layout`, `Runtime layers`, `Test boundaries`, `Where new work belongs`. The design's update target names are wrong.

**Fix.** Update DESIGN.md "Architecture surface" section to name the right ARCHITECTURE.md sections: add `src/game/playtest/` to `Repository layout`; add a paragraph to `Runtime layers` noting the bridge-vs-RecordingService boundary and the playtest runner's external-recorder approach.

## Verified clean (both reviewers)

- `bridge.getMatchState()` exists at `createSimulationBridge.ts:76, 184`, returns `MatchState` with `.outcome` (`types.ts:466-473`).
- `SessionRecorder` config-object constructor + `sourceKind: 'synthetic'` + `connect/disconnect/toBundle` all match live API (`session-recorder.d.ts:10-86`).
- `recorder.lastError: SessionRecordingError | null` exists (`session-recorder.d.ts:64`); `SinkWriteError extends SessionRecordingError` (`session-errors.d.ts:42`).
- `match-completes` failing on every non-`stopWhen` reason is sane.
- Single-AI vs passive-human reliably attacks the human: `findOwnedUnit(humanPlayerId, 'villager')` (`aiSystem.ts:750`) and `townCenterRefsCodec` lookup (`:768-775`) are both visibility-independent. `unitCommandOps.ts:219-250` validates target existence and enemy ownership but does not require fog visibility. Existing combat test (`tests/simulation/createSimulationBridge.combat.test.ts:81-115`) confirms the AI-attacks-passive-human path works.
- `git apply --check` is appropriate for the propose-only contract; the validation-gap paragraph is correctly scoped.

## Action plan

Apply inline to DESIGN.md, then commit:

1. L108 probe: `engineHalted !== null`; copy halt struct fields into envelope details.
2. L107: pin `recorder.lastError instanceof SinkWriteError` discriminator.
3. L106: pin probe order `error → engineHalt → stopWhen → maxTicks`.
4. Test plan: assert `envelope.stopReason === 'maxTicks'` in `runPlaytest.test.ts`.
5. Architecture surface: name actual ARCHITECTURE.md sections (`Repository layout`, `Runtime layers`).

After these inline fixes, proceed to `writing-plans` for the implementation plan. Iter-3 is the converged design.
