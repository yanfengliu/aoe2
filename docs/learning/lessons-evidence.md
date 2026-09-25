# Lessons — evidence

The war story and the anchor behind each line in [lessons.md](lessons.md). Not session-start reading: open an entry when its rule is in doubt, or when the work is in that area.

Every entry this file held before 2026-09-24 was retired by a gate; the proofs are in [gate-proofs.md](gate-proofs.md), which also names the commit the deleted entries read back out of.

One rule has left [lessons.md](lessons.md) by a different route and never had a section here: the browser-spec duration budget, deleted on 2026-09-06 because the gate it named was built and the MEASUREMENT refused it. Nothing about it is in `gate-proofs.md` — no gate landed — and its substance is a rule in [local-rules.md](../policies/local-rules.md) with the full account in the defect register.

## The default look that doubled CI's frame (2026-09-24)

v0.3.233 made the DE style ("Natural") the default, after v0.3.232 gave it a textured ground. The lane's `npm run verify` was green: 3852 unit tests, 225 browser specs. Main's CI on that commit (run 36077810827) failed two browser shards on the first attempt, both on frame timing: `game-hud-and-camera-camera.spec.ts:323` and `selection-panel-height.spec.ts:233`. Every shard ran 50-60% longer than on the run before, and `unit-motion-smoothness.spec.ts` logged a live animation-frame median of 233.3 ms against 116.6 ms on run 36073613836. v0.3.234 put Moebius back as the default.

Why the local gate could not see it: on Windows the suite draws on the GPU (`tests/browser/helpers/browserRasteriser.ts`), where both grounds cost next to nothing. The lane did look at SwiftShader, and looked wrongly twice: it compared the DE style before and after its ground rather than against Moebius, on all 32 threads of the development machine rather than CI's four, where fragment work spreads thin; and its GPU figure was a median interval between animation frames, which a pipelined GPU process holds near a millisecond whatever a frame costs.

Anchor: the `[motion] live rAF` line in each CI browser shard's log, and the shard durations in `gh run view <id> --json jobs`.
