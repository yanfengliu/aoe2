# population-model — impl iteration 1

Reviewers: Codex (`gpt-5.5` xhigh, sandbox read-only) + Gemini (`gemini-3.1-pro` plan-mode). Gemini contamination check clean.

## Verified correct (both reviewers)
- **Opening cap stays 5.** Base seeded to 0 (`seedPlayerStarts`), then the completed starting Town Center is spawned (`seedScenarioEntities` → `addBuildingEntity(..., isComplete: true)`) and adds +5. Both reviewers confirmed the seed order and that bootstrap/darkAge tests assert cap 5 (and +House → 10).
- **No double-count.** Incomplete construction adds no supply; completion adds exactly once (the builder-completion path in `playerCommandsSystem` fires once when `construction.isComplete` flips).
- **Layering preserved.** `prototypeBuildingRules` does not import bridge code.
- Spec §6.10, changelog 0.1.23, package version, and per-building values all match.

## Finding + disposition
| ID | Sev | Finding | Disposition |
|---|---|---|---|
| Codex-1 (Gemini concurring as an "observation") | **HIGH** | The change had also added a 200 ceiling by clamping the STORED cap (`applyPopulationCapGain = Math.min(200, cap+provided)`). That is lossy: over-housing past 200 (e.g. TC + 40 Houses = raw 205, clamped 200) then destroying one House drops the cap to 195 instead of staying 200, because the raw supply (205) was never retained. A correct ceiling needs raw-supply tracking. | **RESOLVED by removal.** The 200 clamp was removed from this iteration and the limit split into a roadmap M1 follow-up that will track raw building supply (effective cap = min(raw, 200)). The shipped change is just the TC/Castle pop supply — the real spec divergence — which both reviewers verified correct. The ceiling is unreachable at current game scale, so retaining the pre-existing unbounded-by-housing behavior is fine for now, and keeps a clean invariant (stored cap = building-derived sum). |

## Outcome
The shipped change is a strict subset of what was reviewed (the core TC/Castle pop fix, verified correct) minus the flagged clamp — so it is **CONVERGED** without a further review round: the only finding is fully addressed, and the remainder was independently verified correct by both CLIs. Re-ran typecheck + lint + the pop/bootstrap/darkAge tests after removal: green.
