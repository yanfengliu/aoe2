# Review 4: integration — final performance evidence and actual-draw guard

## Target

2026-10-17 focused independent verification review by collaboration worker `integration_review`, gpt-6-astra at xhigh under the fleet reviewer pin. This round follows the broad implementation review in round 2 and the IR3/census review in round 3. It reviews the final B absolute-performance matrix and the subsequent one-file browser-test guard. It does not replace final integrated gates or convert an unmet acceptance criterion into completion.

The measured build records index tree `8a20dae29982e9b01388e3f5acebcf24f1555c61`, source manifest SHA-256 `e461470ac2b4b23cc44f3ec9b093017577fec66ff081cd2ae9803b58e7f2ea84` (721 pinned files), bundle manifest `7cc0ca83977cecf6c0cbac03771094763509f0426727110e79d4bedad1d098a5` (10 files), and built index HTML `90aaeb9797a05df11cac55bf0937405c046c3674b0c1eac5288ed07b742db0e9`. The retained fixed tick-11,700 save is `314ca31ad1eaf78aabf1f081e18125cecf2164165be74dc991af621eb9c62da9`. Evidence is under `tmp/work133-ground/` in the integration tree; `final-b-dist/` preserves the measured bundle.

The final shipping test `tests/browser/presentation-keeps-still-world.spec.ts` has SHA-256 `021018317503088C9D45B6EF49613019EB82D2AA3DDC7C4C09C4E5183257D243`. Its incremental patch is retained at `C:/Users/38909/Documents/github/aoe2-worktrees/frame-rate/tmp/work133-br4/br4.patch`, SHA-256 `75558F9A531F995949B36251D2752CB4537973358B4237D299C95806028C07F7`. The evidence there is promoted in authored form to `docs/work/133_branch-completion/renderer-draw-proof-2026-10-17.md`.

## Reviewers and coverage

I read the corrected and cloned instruments, aggregation implementation, raw matrix rows including per-frame records, manifests, preflight/run-start/post-run records, bundle archive and cleanup records; independently recomputed all twelve groups and six opening/late comparisons; and independently rehashed all 721 source files and ten archive files. I then read the guard implementation, actual context-loss injection, all four proof logs, evidence JSON and cleanup record, plus surrounding AoE2 wrapper and linked voxel runtime code.

No benchmark, test, build, browser, server, product edit, expectation edit or Git mutation was performed by this reviewer. Offline read-only parsing/aggregation and hashing were the only executable work. Only this report is written. Claude still abstains because automatic approval review rejected its source export destination; the unavailable lane supplies no approval.

## Reports

### Independent Astra reviewer: matrix validity

**The final B matrix is valid within its declared bounds. It supports a bounded GPU pass and a failure of the stronger software criterion.** All 48 raw records are present, with four arms in each of twelve rasteriser/view/state groups. Every group has the predeclared baseline/candidate/candidate/baseline order, four equal starting identities, and zero discarded rows. The arm names label repetitions of the identical build; they do not identify two product versions.

I compared the accepted `liveComparison.mjs`, SHA-256 `5DD829A7D2EA54C74817D221FF73ED0CB90780F92BA2AEE04D69908802191EEC`, with `finalBComparison.mjs`, SHA-256 `2A5CDC89E7578618373190AD61B15C0DC870739E5CF9FAEC6BD949169874D4D1`. There are exactly two changed lines: line 19 serves `dist` for both arms; line 126 reads `final-b-build.json` instead of `baseline.json` for metadata. The measurement, counters, identity, runtime-state and simulated-work checks are unchanged. This preserves the corrected absolute opening/late question; it cannot attribute improvement to the rejected ground experiment or quantify B's gain over an earlier build.

The source and archive checks matched every individual pinned digest, and I independently reproduced the canonical aggregate hashes stated above. The build, preflight, run-start, post-run summary and archive pin chain agree. The saved input hash also matches. At the final focused source comparison, no `src` change appeared against the measured tree; the changed browser test is the sole relevant new executable path. The accepted census expectation now hashes exactly to the raw census accepted in review 3 (`269A2E5B064905D7AE9EF2C438E2CD57F170EF4AECE69ECC413699767B267DC2`).

Actual rasteriser strings are RTX 4090 ANGLE Direct3D11 for all 24 GPU records and ANGLE Vulkan SwiftShader for all 24 software records. GPU uses the blend ground tier and 1600×900 viewport; software uses single-sample and 800×600. Every arm records Natural (`de`), zoom 1.2, DPR 1, no tier override, no reduced-transparency preference, the same glass blur/background CSS, and no toast. The actual camera, not merely a requested camera label, is equal across opening and late for each rasteriser/view and equal across its repetitions. The three views are base, corner `(55,3)` and held-out `(30,18)`. This is a within-rasteriser comparison, not a claim that software and GPU render identical workloads at different viewport/tier settings.

Starts are exactly tick 0 or 11,700. Across all views and rasterisers, each state has one full-world starting digest and one projected starting digest: opening full world `b9178ac314dc8872fd696a764aa4f04333922d56ac41fe22c4a27d004a85defb`, late full world `c773fbc55eb54a62ca05356e3d9faf720e232823dd38202b6b103e895f224dc3`; opening projection `63d524a8c30f82dc44c670b589dd1b5f9f4a41ce2d253ce69eb1fdfcfc64f04a`, late projection `a8080360114b42cf4eccbd27ecfb1c4440722d3d54239906979c337ae75b12d2`. Group identity additionally covers actual camera, rasteriser/tier/style, preferences and workload counts. The full-world digest is generated through the Save control before live measurement; the projected digest alone is not used as world identity.

Every arm contains at least 75 actual runtime frames, exceeding the required 60, and at least 4,001.4 ms, exceeding the four-second minimum. Runtime-frame deltas, wrapper deltas and counted records agree; every counted callback reports one draw. Worlds are running before and after, with no engine halt, context transition/loss or draw mismatch. Counters and wall time are taken at the same browser-side measurement boundaries (`finalBComparison.mjs:55–69,93–96`), not across separate polling windows. FPS and interval statistics come from frame timestamps rather than callback CPU time.

I recomputed Normal-speed work from raw frame deltas with the game's 250-ms clamp and 1.5× multiplier. There is zero clamped-away time across the matrix. Recomputed expected ticks match the recorded values to floating-point precision, and the maximum difference from actual integer ticks is 0.9985, below the instrument's 1.05-tick tolerance. Observed simulation rates span 14.71065–15.03468 ticks per wall second. All URLs explicitly request `speed=normal`; the measured work confirms that this is not the earlier Slow comparison. No row gains a result by pausing or reducing simulated work.

### Independent Astra reviewer: recomputed result and interpretation

I independently calculated interval differences from each row's raw timestamps, checked its stored median/p90/FPS values, then took the predeclared median of four arm median intervals per state/view. The six ratios agree with `final-b-summary.json`. Using the ordinary average of the two middle intervals instead of the probe's upper quantile for an even-sized arm changes only floating-point noise and no verdict.

| Rasteriser / view | Opening → late median arm interval | Late/opening ratio | Opening → late median arm FPS | Late p90 maximum / maximum interval | Declared result |
| --- | --- | ---: | --- | --- | --- |
| SwiftShader / base | 33.30 → 50.00 ms | 1.5015015 | 29.19 → 19.25 | 100.00 / 200.00 ms | Fails ≤1.25 |
| SwiftShader / corner | 16.70 → 16.70 ms | 1.0000000 | 59.75 → 46.88 | 33.40 / 66.70 ms | Median-interval statistic passes only |
| SwiftShader / held-out | 33.30 → 50.00 ms | 1.5015015 | 35.00 → 20.08 | 100.00 / 166.60 ms | Fails ≤1.25 |
| GPU / base | 16.70 → 16.70 ms | ≈1.0000000 | 59.75 → 59.75 | 16.70 / 49.90 ms | Passes ratio and ≥55 FPS |
| GPU / corner | 16.70 → 16.70 ms | ≈1.0000000 | 59.88 → 59.75 | 16.70 / 33.40 ms | Passes ratio and ≥55 FPS |
| GPU / held-out | 16.70 → 16.70 ms | ≈1.0000000 | 59.88 → 59.75 | 16.70 / 33.40 ms | Passes ratio and ≥55 FPS |

The GPU group medians range from 59.75149 to 59.87724 FPS; its lowest individual arm is 59.50298 FPS. This supports the measured GPU configuration's pass, bounded to this saved seed, these views and this host. It does not prove maximum-population, four-vCPU CI, other graphics cards, arbitrary scenes or every player's late match.

The software corner is a useful warning against substituting one statistic for another: its median interval stays 16.7 ms, while the median arm mean FPS retains only about 78.45% of opening rate and its p90 interval doubles. It is not steady-rate parity. The published `performance-results-2026-10-17.md` retains that distinction, ranges and tails. Both base and held-out views independently fail the unchanged 1.25 criterion, so the stronger software requirement is unambiguously UNMET. This result must stay open in the work outcome even if the verified M1/B increment and other branches land.

These observations do not rehabilitate the invalid earlier toast-tail/Slow comparisons and do not show a benefit from the rejected ground draw-order candidate. Both arms use final B; the candidate remains rejected for changed pixels and is not part of the measured product. No new visual trade, reduced-detail mode or production HUD fallback is supplied by this measurement.

The host was shared. The retained between-run audit lists unrelated processes but does not measure their CPU shares; no conclusion attributes software cost to them. They were left untouched. Matrix cleanup records zero owned leftovers and no preview listeners on 4807/4808 at the recorded audit time. This reviewer launched no process requiring cleanup.

### Independent Astra reviewer: shipping guard BR4

**Accept the actual-draw guard. The preserved four-run proof demonstrates a real false-green before the repair and rejection afterward.** The existing AoE2 wrapper increments its own `frameIndex` after every `runtime.frame()` return (`src/rendering/voxel/AoeVoxelWorldRenderer.ts:319–324`) and exposes that count as `framesDrawn` (`:377–383`). These lines are outside the test increment. The linked runtime returns without drawing while its context is lost (`node_modules/voxel/src/three/ThreeRenderRuntime.ts:398–400`); ordinary rendering precedes commit at `:440–453`. Accepted revision advancement therefore does not establish a committed draw.

I read the actual mutation in `frame-rate/tmp/work133-br4/run-proof.mjs:28–40`: after the test's warmup it obtains `WEBGL_lose_context` from the real world canvas, calls `loseContext()`, waits for the actual context-loss event, and requires both `gl.isContextLost()` and runtime state `lost`. It does not mock a frame return or emit a synthetic event. The temporary configuration runs only the existing shipping case, headlessly, against the frozen integrated dist on owned port 4812, with no retries. The recorded index/served assets match the measured B bundle.

The four raw logs substantiate the reported sequence:

| Run | Actual observation | Result |
| --- | --- | --- |
| Old guard, healthy | Existing case executes normally. | One pass, exit 0. |
| Old guard, real context loss | Wrapper +90, accepted revision +90, runtime commits +0, matrix writes +0, 1,513 instances; state remains lost. | False green: one pass, exit 0. |
| New guard, same real context loss | Wrapper +90, accepted revision +90, runtime commits +0, writes +0. | One failure, exit 1, specifically `runtime frames committed over the window`, expected >0, received 0. |
| New guard, restored healthy source | Mutation and temporary logging removed, final test digest verified. | One pass, exit 0. |

The final test reads committed `metrics.frames` at line 33, requires a positive committed delta and equality with wrapper delta at lines 54–56, and divides matrix writes by committed frames at line 59. The 20-frame warmup, 90-frame window, minimum wrapper count, accepted-revision requirement and <25% write ratio remain unchanged. The positive guard closes the proved zero-draw loophole; equality also rejects a partially lost window. The final file contains no context-loss injection or temporary logging. The proof controller restores each temporary mutation in `finally` and checks restoration hashes; its retained cleanup audit records no owned runner/server/browser leftovers or listener on 4812.

This is a bounded strengthening of a mechanism test, not a product fix or new FPS benchmark. The four runs used the actual integrated bundle but were executed by the assigned worker; this reviewer inspected their artifacts and did not rerun them. The final full browser suite and integrated gate remain separate checks.

## Findings and disposition

| Item | Disposition | Bound / remaining work |
| --- | --- | --- |
| Final B matrix instrument and inputs | Accepted. | 48/48 complete valid rows; zero discarded; all group statistics, identities, work and pin chain independently checked. |
| GPU late/opening requirement | Bounded pass for the measured configuration. | Three views, one saved seed, RTX 4090 at 1600×900; no universal hardware/scene claim. |
| Stronger software late/opening requirement | UNMET. | Base and held-out ratios 1.5015 exceed 1.25; corner median statistic does not establish steady-rate parity. Keep this acceptance criterion open. |
| Ground draw-order candidate | Remains rejected. | No product change and no attributed timing improvement in this matrix. |
| BR4 shipping-test actual-draw denominator | Repair accepted on pinned test hash. | Real lost-context old-green/new-red and restored healthy-green proof inspected; full integrated gate pending. |
| IR1–IR3 and census | Prior dispositions retained. | No new product-source delta; expectation exactly matches the measured JSON accepted in round 3. Final integrated census/gates still required. |

## Verification provenance

Additional independently checked SHA-256 values: raw GPU JSONL `910172438af1d2a66f52c67ea60289a3f4690325e4ca54b160c854a0843cdc8e`; raw software JSONL `7c99fd6f570e7c121b469e247ffd5ac377aab27dc9afefb6662159e3f32c5f89`; `final-b-build.json` `7deecac0e6e34cfdae048d1f028d36bc5cf5c6d6aeaf5608d5b5a52d050d8942`; `final-b-summary.json` `49720201725eac6a1952e23ed1709e87be8675e334938db20160c40c8a79fa4c`; BR4 `evidence.json` `B9CD3D7AD9C3740C8E9F62CB25D8DEDCEC81CCAEEFC9E72E8DCD333CF6E4EE76`. The authored performance and draw-proof documents describe these retained inputs; raw runs remain ignored evidence.

## Round outcome

No new material implementation finding from this focused round. Accept BR4 and the measured GPU result within their stated bounds. The stronger software criterion remains unmet and must not be reported as complete. Landing the verified increments, if the remaining integrated gates and controls pass, does not itself complete that original performance objective. No blanket final integration approval, full-gate result, hosted result, merge or push is supplied by this review.
