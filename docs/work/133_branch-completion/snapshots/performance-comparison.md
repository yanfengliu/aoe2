# Software-renderer performance: fixed comparison and disqualifiers

2026-10-17, work 133. User priorities remain finishing the branch work, with performance first. M1 and B improve CPU work and preserve pixels; neither alone establishes work 130's stronger late-match versus opening software criterion.

## Fixed question

Use the original saved tick-11,700 match at tmp/frame-rate/saves/allai-11700.save.json and the real opening of aoe2-prototype. Compare the same rasteriser, 800x600 viewport, Natural style, identical zoom and camera framing policy, graphics preferences and foreground workload. Begin every arm at its exact saved tick, wait for load notifications and transient layout to finish, record starting digest, measure settled live play over enough rendered frames, and retain exact input and environment. Preserve GPU1600x900 opening/late acceptance as a separate user-reported configuration. A measured correction to the existing instrument must receive independent scrutiny before comparing a new candidate with it.

Acceptance: the player-reported late-match regression is resolved on GPU and the software late/opening comparison meets work130's original close-cost/steady-rate intent under equivalent scenes and controls. Report any remaining delta rather than redefine completion around an upload counter. The initial plan supplied no numerical closeness threshold; an investigator must state and justify any proposed operational threshold before scoring and preserve the original evidence.

## Disqualifiers

- Different zoom, camera policy, render tier or scene workload mistaken for passage-of-time cost.
- A load toast, paused-only world or RAF callback duration passed off as settled live wall frame rate.
- Less simulated work, missing actors, missing fog/shadows, changed controls or weaker assertions.
- A counter improvement passed off as a measured whole-frame result; foreign load inferred from SwiftShader's own workers.
- A new visual trade, lower detail, sibling edit or dependency change without a justified separate decision.
- A timing victory without repeated matched arms, held-out state, exact inputs and relevant pixel checks.

## Existing evidence

The frame-rate worktree holds raw m2 cost800 and hud-compositor-counterfactual JSONs, preserved M1 baseline-dist, final B pixels and the maintained frame-cost probe. Its docs/work/130_frame-rate-through-a-match/m2-handoff.md records B's exact source/runtime pin and bounds. Root has integrated B, AI, gatherer and foundation overlays. No new performance source change is approved by this note.

## Independently reviewed correction and operational threshold

Round 1 independently confirmed that the compositor probe omitted speed and ran Slow, while the original ran Normal; its render-only digest omitted speed/camera/preferences, and it supplied no settled live opening arm. The old toast-contaminated Normal samples and newer Slow samples remain distinct historical observations. Corrected runs use explicit Normal (1.5x), both settled live opening and late arms, recorded actual camera/rasteriser/tier/preferences and full-world plus projected digests, and at least 60 delivered world frames per arm. Record tick rate, wall-frame intervals and callbacks separately; losing simulation work cannot pass. Keep base and corner framings and a held-out framing.

Predeclared operational meaning of close: the median late live wall-frame cost is at most 1.25 times its matched opening cost (late rate at least 80% of opening), with no lost Normal-speed tick work. This allows modest additional scene load while rejecting the original roughly 2.8-fold frame-cost growth; it is a local acceptance bound, not a new timing assertion in CI. GPU1600x900 must additionally retain approximately 60 fps, operationally at least 55 median fps in each matched arm. Report spread/tails and limited seed/host coverage. This threshold is declared before the next candidate measurements; it is not inferred from their outcome.

The fresh independent owner's proposed different mechanism is a one-property opaque ground draw-order counterfactual. No benefit has been measured. It may ship only with a valid paired improvement, unchanged representative and held-out pixels in both styles/rasterisers, no GPU regression, and independent code review. A partial win does not close the stronger software criterion.

## Final B measurement plan after rejected ground candidate

The rejected ground candidate was never cost-scored. To resolve the remaining uncertainty about B itself, run the accepted probe with both named arms serving the identical final B dist, retaining the original repeated ordering as reproducibility controls. Only the two build-root paths and build metadata filename change; every validity check and the predeclared thresholds remain. Pin the final built source/tree and cloned probe hash. This measures final B's absolute opening/late behavior, not a ground-candidate improvement. Use the complete base/corner/held-out matrix on GPU1600×900 and SwiftShader800×600, four repetitions per state/view, and score only complete valid records. Aggregate the median of four arm median wall-frame intervals per state/view; late/opening must be ≤1.25 and GPU median FPS must be ≥55. Report the full range and tails alongside the ratio, and retain invalid rows explicitly. No result exists yet.
