# Annotation UI — Plan Iteration 2 Review (2026-04-29)

**Disposition:** ACCEPT (with inline corrections applied during plan-2 iteration). Convergent across 3 reviewers. Codex ITERATE on 1 MAJOR + 3 MINORs (paragraph-level), Gemini ACCEPT, Claude ACCEPT-with-1-MAJOR + 4 MINORs. The two MAJORs (Codex's FR-1 anti-regression checklist contradicting AO-4; Claude's AO-7b/AO-8 tee scope ambiguity) are 1-2 line fixes applied inline; no plan-3 iteration needed. Move to PHASE 1 implementation.

Reviewers: Codex (`gpt-5.5` xhigh — ITERATE), Gemini (`gemini-3.1-pro-preview` plan mode — ACCEPT), Claude (`claude-opus-4-7[1m]` max — ACCEPT-with-clarification).

This is the first iteration in this thread that used the full 3-CLI reviewer list per aoe2 AGENTS.md. The design-iteration regression is logged for AO-14's `docs/learning/lessons.md` update.

## Plan-1 verification (convergent ADDRESSED)

| ID | Finding | Codex | Gemini | Claude | v2 reference |
|---|---|---|---|---|---|
| B1 | TDD order inverted | ADDRESSED | ADDRESSED | ADDRESSED | §1 CE-1 single TDD task |
| B2 | Multi-CLI review missing Gemini; bad git diff | ADDRESSED | ADDRESSED | ADDRESSED | §1 CE-3 + §3 FR-1 use 3 CLIs + `git diff` |
| M1 | Test env dev deps + jsdom | ADDRESSED | ADDRESSED | ADDRESSED | §2 AO-1 |
| M2 | AO-7 too large | ADDRESSED | ADDRESSED | ADDRESSED | §2 AO-7a-d split |
| M3 | AO-12 seed URL preservation | ADDRESSED | ADDRESSED | ADDRESSED | §2 AO-12 |
| M4 | `pausedManually` carrier | ADDRESSED | ADDRESSED | ADDRESSED | §2 AO-2 (pauseState bag) |
| M5 | §6 Open Questions | ADDRESSED | ADDRESSED | ADDRESSED | §6 Decisions |
| M6 | api-reference.md retired | ADDRESSED | ADDRESSED | ADDRESSED | §2 AO-14 |
| M7 | CE runner ordering prereq | ADDRESSED | ADDRESSED | ADDRESSED | §1 CE-0 |
| M8 | Vitest integration layer | ADDRESSED | ADDRESSED | ADDRESSED | §2 AO-12.5 |
| M9 | panCameraTo API direction | ADDRESSED | ADDRESSED | ADDRESSED | §2 AO-4 |
| M10 | Visual + doc compliance | ADDRESSED | ADDRESSED | ADDRESSED | §2 AO-13 + AO-14 |

ADR 9 c-bump rationale, additive-surface verifications, and DESIGN-vs-PLAN field-level matches all confirmed by all three reviewers.

## Inline corrections applied (no plan-3 iteration)

### Codex MAJOR — FR-1 anti-regression checklist contradicts AO-4

§3 FR-1 originally said look for `world.getEntityRef` in `panCameraTo` resolution. AO-4 (correctly) specifies the OPPOSITE direction: `world.isCurrent(ref)` then `world.getComponent<Position>(ref.id, 'position')`. The FR-1 checklist is the future code-review prompt — if it tells reviewers to look for the wrong API, the post-implementation review would either flag false positives or miss real regressions.

Resolved inline: §3 FR-1 anti-regression checklist now requires `world.isCurrent(ref)` + `world.getComponent<Position>` and explicitly rejects `world.getEntityRef` / `currentRef` for this direction.

### Claude MAJOR — AO-7b/AO-8 tee scope ambiguity

AO-7b's "Tee mechanism: ... if the wrapper hasn't moved to AO-8 yet" hedge made tee ownership unclear. Per DESIGN §5, the tee is RecordingService's responsibility — it wraps `MemorySink` and forwards to `mirror.record*`. AO-7b should test only the mirror's `record*` primitives directly.

Resolved inline: AO-7b's tee bullet replaced with an explicit "Tee scope:" paragraph stating the production tee lives entirely in AO-8; AO-7b's tests construct `mirror` and call `mirror.recordTick(...)` directly with no tee wrapper.

### Codex/Claude MINORs (folded inline)

- **CE-1 wording.** "Confirm all 5 fail" was inaccurate (test 5 is the regression check that should pass). Updated to "first 4 (behavior tests) are expected to fail; test 5 (regression) should pass immediately." Also clarified that step 1 includes minimal type stubs so compilation succeeds before behavior is added.
- **AO-1 vitest alias remediation.** Added "if smoke fails, copy `node:crypto` alias into vitest.config.ts" sentence.
- **AO-2 `bridge.world` lifetime defensive note.** Added "consumers must call `bridgeRef().world` (or equivalent closure) — never capture `bridge.world` once and reuse across reload."
- **AO-8 `markers()` ordering committed.** Per DESIGN §5: tick-desc; MarkerListPanel consumes directly without further sorting.
- **AO-12.5 deterministic flush.** Committed to `vi.useFakeTimers() + vi.advanceTimersByTime(150)` (no private-surface reach-in, no public test-only API).

## Items considered, not flagged

- **CE-1 single TDD task feasibility** — feasible with type stubs in step 1; clarified inline.
- **AO-7b/AO-8 sequencing** — clean; AO-7b mirror primitives, AO-8 owns RecordingService + tee.
- **AO-12.5 vs AO-13 overlap** — intentional fast-vs-slow feedback layering.
- **AO-1 vitest alias smoke** — sufficient with the remediation note above.
- **AO-2 `bridge.world` lifetime** — handled by `bridgeRef` closure pattern in DESIGN §8.
- **PHASE 1 doc-accuracy review prompt** — generic clause is sufficient; CE-2 names the specific files.
- **AO-12 `installBrowserTestApi` readiness** — cheap belt-and-braces test; verified via `browserTestApi.ts:87-91`.
- **Scope (~640 lines)** — all +200 lines from v1 trace to plan-1 review fixes; lean, no document bloat.
- **AO-12.5 sequencing** — doesn't depend on AO-12 (createApp wireup); current placement after AO-12 is fine, could conceptually run after AO-11.

## Convergence trajectory

- iter-1 (plan): 2 BLOCKERS + 8 MAJORS + 8 MINORS (Codex+Claude only, missing Gemini)
- iter-2 (plan): 0 BLOCKERS + 2 MAJORS (paragraph-level inline fixes) + 7 MINORS (folded inline)

## Disposition

**ACCEPT — move to PHASE 1.** All BLOCKERS and MAJORS resolved inline; PHASE 1 implementation can begin with civ-engine v0.8.10 → v0.8.11. After PHASE 1 lands, AO-0 records the civ-engine HEAD and PHASE 2 (aoe2 v0.1.5) begins.
