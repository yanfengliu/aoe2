# Phase 1B unit.gather Implementation Review (impl-4)

**Date:** 2026-05-01
**Iteration:** impl-4 → addressed inline
**Reviewers:** Codex `gpt-5.5` xhigh (effectively unreachable — see below) + Claude `claude-opus-4-7[1m]` max
**Disposition:** ACCEPT after inline fixes (Claude ACCEPT-with-2-NITs; Codex unreachable)

## Codex unreachable

Codex CLI hit the Windows constrained-language-mode block (`Cannot set property. Property setting is supported only on core types in this language mode. + [Console]::OutputEncoding=...`) repeatedly while exploring the codebase via PowerShell. The agent burned its tokens running file-reads through the blocked PowerShell channel and never produced a clean BLOCKER/MAJOR/MINOR/NIT verdict at the end of the run.

Per AGENTS.md: "If a CLI is unreachable (quota exhaustion, model name rejected by harness), proceed with the remaining reviewer and note the unreachable CLI in REVIEW.md and the devlog." — Claude's review is the binding signal for this commit.

## Claude NIT-1 — missing `not_a_resource` validator-branch test

`tests/commands/unitGather.test.ts` covered 5 of 6 validator codes. The `not_a_resource` branch (resourceId alive but lacks `resource` component) had no test. unit.attack covered all 6 of its codes, so unit.gather dropped one notch below the established Phase 1B coverage convention.

**Fix in impl-4:** added `rejects when alive resourceId points to a non-resource entity` test. Constructs a unit + gatherer + creates a separate entity tagged `terrain` (alive but not a resource) → submits gather with that resourceId → expects `{ code: 'not_a_resource', ... }`.

## Claude NIT-2 — orphaned `^` arrow comment in wireBridgeOps.ts

The comment `// ^ used below for the registerCommandHandlers deps; not threaded into systems because no deterministic-resolution system needs it.` was written when `setUnitAttackCommandDirect` was the sole non-threaded helper directly above. After this commit, `setUnitGatherCommandDirect` sits below — also non-threaded, but visually below the `^`.

**Fix in impl-4:** comment rephrased to cover both helpers explicitly: "`setUnitAttackCommandDirect` + `setUnitGatherCommandDirect` are used by the registerCommandHandlers call below, but NOT threaded into any system — no deterministic-resolution system calls attack or gather today, and their AI-decision counterparts (when they exist) push intentions instead."

## Other findings cross-checked clean (Claude verified all 5 prompt items)

- ✓ `setUnitGatherCommandDirect` body is verbatim identical to pre-1B `issueUnitGatherCommand` body — diffed against `git show HEAD:` lines 259-289. All 4 guards + 5 mutation steps preserved.
- ✓ Validator codes correct (id integrity → unit alive → unit shape → gatherer shape → resource alive → resource shape).
- ✓ No AI / deterministic-system caller — grep confirms `issueUnitGatherCommand` only at unitCommandOps:345 and :386. `setUnitGatherCommandDirect` does not appear in `registerAllSystems.ts` or `registerBridgeSystems.ts` (whereas `setUnitMoveCommandDirect` does; `setUnitAttackCommandDirect` does not — `gather` correctly joins `attack` in the non-threaded bucket).
- ✓ Both call sites (`unitCommandOps.ts:345, :386`) are HUD-time inside `issueUnitContextCommand` / `issueUnitContextCommandAtEntity`.
- ✓ No civ-engine API change.

## Test count + gates

- 28 commands tests pass (was 27 + 1 new for not_a_resource).
- 562 tests total pass + 1 skipped (was 555 + 7 new this commit).
- typecheck, lint, build, full test suite all green.

## Phase 1B → next steps

3 of 15 commands complete (`unit.move`, `unit.attack`, `unit.gather`). Next per PLAN v4: `unit.context` (the routing facade itself — selects garrison / attack / gather / move based on what's at the target cell). `unit.contextAtEntity` follows similarly.
