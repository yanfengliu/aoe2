# Multi-villager construction — iter-2 review

**Diff range:** `c6119b4..HEAD` (iter-2 changes only).
**Iter-1 REVIEW:** `../1/REVIEW.md`.
**Reviewer:** Claude (`claude-opus-4-7[1m]`, max effort) — verified all iter-1 findings closed cleanly.

## Reviewer status

- **Codex** — UNREACHABLE this iteration. Two attempts (full prompt + focused iter-2-only prompt) both failed to emit the `===BEGIN-REVIEW===` markers. Codex spent its budget on PowerShell exec calls reading source files and never produced a structured finding section. Will retry in a future iteration if needed; iter-1 Codex review is the most recent substantive Codex pass on this feature.
- **Claude** — converged on the focused iter-2-only diff after a slow start (~7 min). Verified each iter-1 finding's disposition against the live code. Approved iter-2.

## Findings

**None.** Iter-2 is clean. Claude's verifications:

| ID | Finding | Iter-2 disposition | Verified |
|---|---|---|---|
| M1 | HP-bar test bypassed projector | Switched to `bridge.getRenderState().entities[].currentHp` | ✓ — projector path goes through `visibility.ts:48-117`, `projectEntity` reads `getEntityHealth` at line 60 and surfaces `currentHp` at 114; civ-engine only re-runs the projector when entity is dirty |
| M2 | Mid-build join budget too loose | Run same fixture twice, assert `joinTicks < soloTicks/2` | ✓ — broken join branch makes `joinTicks ≈ soloTicks` and the ratio assertion fails |
| MED1 | Branch ate fall-through on helper false | `&& setUnitBuildCommandDirect && return true` then fall through | ✓ — verified the four `return false` paths in `setUnitBuildCommandDirect` execute before any mutation; fall-through chain lands cleanly at the move fallback |
| L1 | Missing focused negative-case test | Added complete-building fall-through test; non-villager covered by helper entry guard | ✓ — partial-fix rationale acknowledged as reasonable |
| L2 | Spec/plan referenced thin wrapper | Reworded both | ✓ — wording consistent across docs |
| I2 | Spec validator wording drift | Reworded validator section | ✓ — matches the AI-tolerance-style deferred-validation pattern |
| N1 | Stray double blank line | Collapsed | ✓ |

## Anti-regression status

All eight checklist items from iter-1 still hold (Claude's iter-1 review verified these against the live code; iter-2 changes do not move any of them).

## Disposition

**Iter-2 converged.** No further iteration needed. Per AGENTS.md, single-reviewer convergence is acceptable when the other CLI is unreachable; the next iteration would retry the unreachable Codex if substantive findings emerged. None did.

Move to Task 12 (devlog/changelog/version bump), then Task 13 (close thread + push).
