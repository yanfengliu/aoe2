# Review iteration 10

## Scope

OpenAI Codex externally reviewed iteration-9 repair commit `1d294f1`, the pending documentation/release diff, and the high-risk visibility/tower contracts in live commit `abbcd5c`. The first full-range attempt reached its 20-minute wrapper timeout without a final message and left no process or review artifact; a narrower diff-noise-free rerun retained full read-only repository access and completed after 13.5 minutes. Anthropic Claude remained unavailable under the recorded tenant export boundary and was not retried or routed around.

## Findings and disposition

- **MEDIUM — fresh and warm animation histories diverged exactly at the cancellation timestamp. Confirmed and fixed.** The fresh reconstruction branch used a strict `sampleTimeMs > cancelTimeMs` condition, so a moved actor at the exact cancellation time initialized as `attacking` while a warm history resolved `moving`. The fresh boundary now reconstructs from the prior fixed-tick source state without recursing through the equal-time branch; later samples retain the existing cancellation-time reconstruction. A red-green 100 ms regression compares mode, locomotion weight, direction, attack weight, and ambient suppression, and the 150 ms matrix-equivalence regression remains green.
- **MEDIUM — two lesson evidence anchors named replay tests that did not exist verbatim and described commit ancestry backward. Confirmed and fixed.** The table now uses the exact live Vitest node titles and describes `1d294f1` as the earlier renderer commit relative to `abbcd5c`.
- **LOW — the detailed devlog overstated all iterations 1–9 as external. Confirmed and fixed.** The review history now explicitly distinguishes the in-process three-lens iteration 3 from the recorded OpenAI external passes.

## Result

The cancellation-boundary regression failed before the fix (`fresh.mode === 'attacking'`, warm `moving`) and passed afterward; the two focused renderer files passed 33 tests. Iteration 10 independently found no substantive defect in `abbcd5c` and approved its system ordering, mutation-aware visibility, footprint witnesses, immutable tower pass, final refresh, suppression publication, bounded hydration, legacy compatibility, save stripping, and final fog filtering. Because iteration 10 found a substantive behavior defect, iteration 11 must re-review the repaired boundary and final documentation before convergence.
