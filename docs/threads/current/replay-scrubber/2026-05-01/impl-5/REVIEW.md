# Phase 1B unit.context Implementation Review (impl-5)

**Date:** 2026-05-01
**Reviewers:** Codex `gpt-5.5` xhigh (effectively unreachable — Windows PowerShell sandbox loop) + Claude `claude-opus-4-7[1m]` max
**Disposition:** ACCEPT (Claude — no findings; Codex unreachable per AGENTS.md fallback)

## Codex unreachable

Codex CLI hit the Windows constrained-language-mode block on `[Console]::OutputEncoding=...` — the same issue as impl-4. The agent ran several PowerShell `rg` commands that succeeded (so it had data) but could not complete its review write-up because the PowerShell init wrapper's UTF-8 setter is blocked. Per AGENTS.md, proceeding with Claude.

## Claude ACCEPT — all 6 verification points hold

1. Routing parity: `routeUnitContextCommandDirect` matches pre-1B body verbatim modulo three intentional facade→helper substitutions. The `owner !== humanPlayerId` and monk branches are correctly hoisted to the bridge facade.
2. Monk validator gate: `monk_should_route_via_facade` rejection makes the bridge facade the sole monk-submission path.
3. Monk fallback move IS recorded: bridge facade's no-monk-target fallback uses `issueUnitMoveCommand` (commandified facade), emitting `unit.move`.
4. Non-monk submission: `submitWithResult('unit.context', { unitId, target })` matches `GameCommands['unit.context']`.
5. No mid-tick re-submission: handler delegates only to `routeUnitContextCommandDirect` which calls direct helpers + `garrisonUnit` only.
6. No civ-engine API change.

## Test count + gates

- 34 commands tests pass (was 28 + 6 new for unit.context).
- 568 tests total pass + 1 skipped (was 562 + 6 new this commit; -2 existing tests updated to step before checking garrison count).
- typecheck, lint, build, full test suite all green.

## Phase 1B → next steps

4 of 15 commands complete (`unit.move`, `unit.attack`, `unit.gather`, `unit.context`). Next: `unit.contextAtEntity` — same pattern but routes by entity ID instead of cell coords. After that: sheep.move, monk.contextAtEntity, etc.
