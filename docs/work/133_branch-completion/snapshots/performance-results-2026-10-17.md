2026-10-17 — Final B absolute acceptance measurement, work 133.

**The stronger software criterion remains UNMET.** All 48 rows are complete and valid. GPU passes the declared rate and median-interval bounds. Software base and held-out views exceed the 1.25 late/opening limit. No timing variant, repair, retry, discarded row, or product edit was made.

Every named arm serves the identical final B build. The names baseline/candidate are reproducibility labels and do not identify different product versions or an attributed improvement. Four repetitions were collected per state/view/rasteriser. The score is the median of four arm median wall-frame intervals; FPS below is the median of four arm mean wall FPS readings.

| Rasteriser/view | Opening FPS median (range) | Late FPS median (range) | Median interval ms opening→late | Ratio | p90 interval ms opening range→late range | Maximum interval ms opening→late |
| --- | --- | --- | --- | --- | --- | --- |
| swiftshader/base | 29.19 (28.50–29.50) | 19.25 (18.73–19.58) | 33.30→50.00 | 1.5015 | 50.00–66.70→99.90–100.00 | 133.30→200.00 |
| swiftshader/corner | 59.75 (59.75–59.75) | 46.88 (46.45–48.10) | 16.70→16.70 | 1.0000 | 16.70–16.70→33.40–33.40 | 33.30→66.70 |
| swiftshader/heldout | 35.00 (34.36–35.90) | 20.08 (19.42–20.41) | 33.30→50.00 | 1.5015 | 50.00–50.00→83.30–100.00 | 66.70→166.60 |
| gpu/base | 59.75 (59.75–59.75) | 59.75 (59.50–59.75) | 16.70→16.70 | 1.0000 | 16.70–16.70→16.70–16.70 | 33.40→49.90 |
| gpu/corner | 59.88 (59.75–60.00) | 59.75 (59.75–59.75) | 16.70→16.70 | 1.0000 | 16.70–16.70→16.70–16.70 | 33.30→33.40 |
| gpu/heldout | 59.88 (59.75–60.00) | 59.75 (59.75–59.75) | 16.70→16.70 | 1.0000 | 16.70–16.70→16.70–16.70 | 33.40→33.40 |

The software corner passes the declared median-interval statistic, but its mean wall FPS retains only 78.45% (59.75→46.88). This is not steady-rate parity; longer intervals sit in its tail. All GPU group medians exceed 55 FPS; the lowest individual GPU arm is 59.50 FPS.

Validity: explicit Normal 1.5×, actual rasteriser/tier, Natural/glass, DPR 1, zoom 1.2, viewport 800×600 software or 1600×900 GPU. Base, corner (55,3), and held-out (30,18) use the same camera policy in opening and late states. Each group has four equal full-world/projected start identities and equal camera/CSS/preferences/workload. Starts are tick 0 or exactly 11,700, with no load/save toast. Every arm contains at least 60 committed runtime frames and at least four seconds. Runtime-frame deltas equal counted frames. All worlds remain running, with no context transition, halted engine, lost frame-clamp work, or Normal tick-work discrepancy. All invalid rows: none. Raw per-frame timestamps and callbacks are retained.

Bounds: one saved seed/state and one shared 32-thread Windows host. Unrelated restaurant/maps Node/Chrome processes were observed between rasterisers and left untouched; their CPU share and any timing attribution were not measured. This does not establish four-vCPU CI timing or maximum-population behavior.

Frozen index tree: 8a20dae29982e9b01388e3f5acebcf24f1555c61.
Source manifest SHA-256 (721 files): e461470ac2b4b23cc44f3ec9b093017577fec66ff081cd2ae9803b58e7f2ea84.
Built index HTML SHA-256: 90aaeb9797a05df11cac55bf0937405c046c3674b0c1eac5288ed07b742db0e9.
Full bundle manifest SHA-256 (10 files): 7cc0ca83977cecf6c0cbac03771094763509f0426727110e79d4bedad1d098a5.
Accepted cloned probe SHA-256: 2a5cdc89e7578618373190ad61b15c0dc870739e5cf9faec6bd949169874d4d1.

Before/after source and complete bundle manifests match exactly. final-b-dist contains only regular files and its canonical manifest matches the full bundle hash above. The earlier baseline-dist/candidate-dist archives remain untouched.

Task-owned process audit: zero owned roots/descendants or tagged browsers remain, and ports 4807/4808 have no listeners. Remaining Chrome roots predate the matrix and are unrelated. Heavy resources and scratch write lease are released.

Evidence: final-b-build.json, final-b-preflight.json, final-b-run-start.json, live-swiftshader-final-b.jsonl, live-gpu-final-b.jsonl, final-b-summary.json, final-b-aggregation.log, final-b-archive.json, final-b-cleanup.json, final-b-host-between.json, finalBComparison.mjs, summarizeFinalB.mjs, runFinalB.ps1, final-b-*-owned.json, and final-b-*-stdout/stderr.log.

The fixed input is also retained as allai-11700.save.json (SHA-256 314ca31ad1eaf78aabf1f081e18125cecf2164165be74dc991af621eb9c62da9). The measured probe retains its original relative input pathname and immutable hash; a future reproduction after worktree retirement must point a reviewed clone at this retained identical input and the frozen archive.

Integration handoff: retain this entire ignored evidence folder in the primary checkout before retiring this worktree. Promote the conclusion and review into permanent work docs; keep the stronger software acceptance open. No full gate, commit, merge, push, new mechanism, or ground-candidate performance claim is supplied by this measurement task.
