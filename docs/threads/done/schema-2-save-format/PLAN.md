# Schema-2 Save Format Plan

Date: 2026-05-05

## Scope

Finish Phase 2F by bumping the save format to schema 2, keeping schema-1 compatibility, and updating tests/docs/browser expectations that still read legacy top-level side maps.

## Steps

1. Add failing coverage:
   - schema-2 save blob shape omits legacy top-level fields and stores Tier-1/Tier-3 state in `worldSnapshot.state`.
   - schema-2 load can hydrate visibility, match state, unit commands, and pending AI Monk intentions from `worldSnapshot.state`.
   - schema-1 helper coverage continues to prove legacy `sideMaps` are authoritative for back-compat.
2. Implement schema types and state slots:
   - bump `SAVE_SCHEMA_VERSION` to 2 and define `SaveBlobV1 | SaveBlobV2`.
   - add a world-state slot for pending commands.
   - add helpers for loading schema-2 visibility/match/pending state and rebuilding derived runtime caches.
3. Update save/load implementation:
   - emit schema 2 from `saveGame()`.
   - relax loader schema validation to accept 1 or 2.
   - route schema-1 through the existing legacy side-map hydration and schema-2 through world-state hydration.
4. Update tests and browser assertions that inspect saved blobs.
5. Run targeted tests, full gates, mandatory review, docs/devlog/changelog updates, then close the thread.
6. Commit and push to `main`.

## Validation

- Targeted: `npm.cmd test -- tests/simulation/saveLoad.test.ts tests/simulation/aiPlayer.test.ts tests/simulation/saveLoadIntegrity.test.ts tests/simulation/saveLoadValuePrune.test.ts tests/simulation/monkConversion.test.ts tests/browser/game-combat-and-meta-meta.spec.ts`
- Full gates: `npm.cmd test`, `npm.cmd run typecheck`, `npm.cmd run lint`, `npm.cmd run build`
- Review: Codex `gpt-5.5` xhigh and Claude `claude-opus-4-7[1m]` max, with live-codebase and docs-accuracy verification directives. Claude quota blockers are recorded if still present.
