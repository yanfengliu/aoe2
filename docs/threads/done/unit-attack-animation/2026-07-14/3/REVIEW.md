# Review iteration 3

## Scope

Three independent in-process reviewers tried to refute the post-external-review fixes against live code: fog/tombstone confidentiality, replay/checkpoint lifecycle, and animation/ambient continuity. Every reviewer was told to grep symbols and run focused tests rather than approve from the prompt.

## Findings and disposition

- **IMPORTANT — projector-level fog rejection initially prevented stationary reveals; retaining raw entities then exposed hidden-state side channels. Fixed.** `visibility.ts` retains all raw live entities; `renderStateOps` is the sole perspective filter. Live and replay HUD counts use filtered entities, and prior-position capture requires the prior frame's visible cells plus current visible identity, preventing a newly revealed enemy from interpolating out of a hidden coordinate.
- **IMPORTANT — fresh midpoint cancellation rebuilt a different pose than a warm renderer. Fixed.** Fresh initialization reconstructs the source-root state at cancellation time and follows the normal resolver; exact tool matrices match warm history.
- **IMPORTANT — replay's first animation callback injected a full tick. Fixed.** Initial and resumed callbacks establish the clock at zero delta; elapsed wall time advances only on later frames.
- **IMPORTANT — partially suppressed ambient harmonics still moved on wall time while paused. Fixed.** `AoeVoxelWorldRenderer` advances one dependency-facing animation clock only by positive simulation-display deltas. Pause repeats the exact timestamp; bridge/replay rewinds rebase without decrement; AoE hit geometry uses the same timestamp.
- **MEDIUM — replay HUD still counted raw fog-hidden entities. Fixed.** It now consumes the same perspective-filtered render state as the live HUD.
- **TEST — Vitest transpilation hid an inferred replay-bundle type mismatch. Fixed.** The integrated replay fixture uses the typed `SessionBundle<GameEvents, GameCommands>` contract and `tsc --noEmit` passes.
- **TEST — `ReplayController.ts` reached 501 lines. Fixed.** The new condition was compacted without behavior change; the hard 500-line architecture test passes.
- **EVIDENCE — the browser matrix diagnostic is pre-harmonic base geometry. Corrected.** It proves revision-matched accepted/presented base recipe state only. Separate unit coverage proves snapshot-batch base-matrix parity and time-sampled prepared hit geometry; the Voxel runtime-clock seam proves harmonic pause stability.

## Result

Final refuter reruns converged with no concrete code/test finding: fog scope 6 files/24 tests, fog+replay scope 7 files/37 tests, and animation-clock scope 4 files/16 tests. The complete Vitest, lint, typecheck, and production build gates passed before `03bf46e` was committed and pushed. Full ambient freeze on pause is an accepted product rule and the canonical docs now state it explicitly.
