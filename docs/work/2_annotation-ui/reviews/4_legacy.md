# Annotation UI — Design Iteration 5 Review (2026-04-29)

**Disposition:** ACCEPT. Convergent across both reviewers. v5 paragraph-level fixes (N19-N23) all ADDRESSED. Remaining findings are nitpicks (`_pendingRebuild` cell scope + `installBrowserTestApi` editorial mention) — both folded into the design as one-line corrections in this iteration. Move to PLAN.

Reviewers: Codex (`gpt-5.5` xhigh — ITERATE on 1 MAJOR + 1 MINOR), Claude (`claude-opus-4-7[1m]` max — ACCEPT). Both reviewers' MAJOR/MINOR findings overlap exactly. The Codex MAJOR is the same fact as Claude's MINOR (`_pendingRebuild` cell scope) graded differently for severity; resolved inline in v5 before submitting this synthesis.

## Iter-4 verification (convergent ADDRESSED)

| ID | Finding | Codex | Claude | v5 reference |
|---|---|---|---|---|
| N19 | `HudBridge.loadGame` Promise<void> contract | ADDRESSED | ADDRESSED | ADR 10 row + §8 step 4. `saveLoadPanel.ts:208` is the single call site to update |
| N20 | `rebuildAnnotationStack` single-flight | ADDRESSED | ADDRESSED | §8 chain: `_pendingRebuild` cell + `await resolvedPrior` |
| N21 | best-effort dispose | ADDRESSED | ADDRESSED | §8 try/catch around `prior.dispose()`; continue construction; `recording.stop()` runs last |
| N22 | byte-shape softening + initial-snapshot split | ADDRESSED | ADDRESSED | §5 reconstruction note (markers id-keyed within tick) + `session_snapshots` ongoing-only |
| N23 | `pausedManually` step() ordering | ADDRESSED | ADDRESSED | ADR 10 row: AFTER `flushOutOfBandRenderChange()`, BEFORE `haltState.halted` and match-outcome |

## Inline corrections applied during v5 iteration (no v6 needed)

### `_pendingRebuild` cell scoped per-createApp

Codex MAJOR / Claude MINOR. v5 example originally declared `_pendingRebuild` at module scope; both reviewers correctly flagged that HMR / multi-instance test harness re-bootstrap (which `installBrowserTestApi` explicitly supports) would let two `createApp` instances chain off the same cell and dispose each other's stacks.

Resolved inline: cell moved inside `createApp` closure, with comment explaining why; helper signature already takes `prior?: AnnotationStack | Promise<AnnotationStack>` so no signature change needed.

### `installBrowserTestApi` consumer mention removed

Both reviewers MINOR. ADR 10's `HudBridge.loadGame widened to async` row originally said "existing test API consumers of `loadGame` (e.g., `installBrowserTestApi`) likewise await." Verification: `src/app/bootstrap/browserTestApi.ts` does NOT call `bridge.loadGame`; the only consumer is `saveLoadPanel.ts:208`.

Resolved inline: ADR 10 row updated to spell out the exact two-file scope (`createHudController.ts:69,285` type; `saveLoadPanel.ts:208` call site).

## Convergence trajectory

- **iter-1:** 9 BLOCKERS + 11 majors/minors → cut scope to capture-only, restructure recording surface
- **iter-2:** 6 BLOCKERS + 5 majors/minors → coordinated civ-engine extension, no-hydration semantics, sidecar persistence
- **iter-3:** 1 BLOCKER + 4 majors + 3 minors → ADR 9 example correctness, ADR 10 haltState semantics, rebuildAnnotationStack helper, version target, exportPriorSession algorithm
- **iter-4:** 0 BLOCKERS + 4 majors (plan-stage) + 4 minors → loadGame async contract, single-flight, best-effort dispose, byte-shape softening, step() ordering
- **iter-5:** 0 BLOCKERS + 0 substantive majors (1 inline-resolved cell-scope, 1 editorial)

## Disposition

**ACCEPT — move to PLAN.** Architecture stable across 5 iterations; final substantive corrections all paragraph-level and applied. The implementation plan should reuse v5's §3 architecture, §5 contract, §8 wireup helper, §9 ADRs verbatim and convert §11 testing strategy + §14 acceptance criteria into ordered work packages.
