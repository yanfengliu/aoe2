# Full-world transparent compactor feasibility — actual result

Executed 2026-10-17 America/Los_Angeles (2026-10-18 00:26:38–00:27:11 UTC). Owner: software_ground_audit. Base aoe2: `63443d0dfe9eaefe900be02b10f0e46e94235dbc`.

The single authorized SwiftShader run is valid within the prepared static diagnostic bound and **fails the predeclared triage rule**. Late base improves only 1.906% against the faster unchanged control and loses to both controls in one round. Late held-out improves 46.837%, but the rule requires both views. This result authorizes no actual-host or product implementation. No source/helper change, repair, repeat or GPU run occurred. The original Normal late/opening <=1.25 and GPU >=55 with actual tick-work acceptance remains unmet by this diagnostic. A missed static triage rule does not prove the strategy impossible.

## Execution and provenance

The reviewed four files are unchanged: client `f6dd85466267f0be4d9bedd1949753817a7c6a478431818ca7a22ef24e8d3f65`, runner `4736cb898d9fb5c8910cfa41cb9ad5a5363d1db0bf41b57336806b606d8e7815`, README `b779df3ea9afced31375d089bb8aba962879a231fd96eaae8827fea8c0c35444`, prepared pins `3b27b352071d1d742cf93ee45d06a271f736de7ff7b2e07b510f00916d21fcc7`. The imported helper remains exact `c56cbf5647f5e8e9e08f6f95496f9243d9edbc9a943a9924fbfaee0faa11e5f5` from the separate culling worktree; it was neither copied nor edited.

The hidden controller imposed a 300000 ms whole-run deadline. Native Node PID 26588, creation `2026-10-18T00:26:38.1669290Z`, exited 0 after 33619 ms without timeout. Direct native stdout/stderr are empty. Node v24.12.0 and Chromium 147.0.7727.15 exercised actual SwiftShader, AA requested and single-sample tier, DPR 1, 800x480 default framebuffer, Natural grade, ACES exposure 1.5 and the six exact retained input/camera identities. `build.json` pins 678 actual compiled inputs; browser-loaded bundle SHA-256 is `40fe2897d2f7466865ce7f795d2193e4a543f25a3021d4ca095763cef3f33794`. The runner checked all 1631 prepared pins before and after and compiled inputs after; an independent post-run hash audit also found zero differences. Source HEAD alone is not used as a dist freshness proof. This executed the installed voxel bytes described in README, not a new shipping-pin run.

All 228 shared source steps and 684 actual arm draws completed, including 192 scored shared steps / 576 scored draws. Every input reached initial-full, first-compact, four warm steps, all four rounds of eight scores and final capture; no selected case or phase was unreached. Each of 684 records advanced actual public metrics.frames by one with matching source/accepted/presented identity and running runtime status. All 228 candidate commits matched the source epoch/revision. Every input retained a single static visual-body digest across its 38 source revisions; arms consumed the same canonical object and its post-arm digest remained unchanged. Camera matrices, capacities and true bounds matched baseline after every step. No page error, scoring resource request, context transition or scoring shader-program change occurred. The only network responses were the owned HTML and bundle.

## Pixel and draw-work controls

Every one of the 18 produced native PNGs was inspected individually at original 800x480 resolution before timing assessment; `capture-sheet.md/json` binds each path, hash and observation. All 18 checkpoints (initial-full, first-compact and final across six inputs) have candidate-vs-B 0 changed RGBA pixels, repeat-vs-B 0, and stable raw pixel hashes over time. Final PNG files also match byte-for-byte among the three arms for each input. Opening base shows the town centre/units; late base the expanded settlement; late held-out transparent remembered objects over explored terrain. Both corner views and opening held-out are black unexplored views, so those pictures alone are weak positive visual witnesses; the actual draw and lane counters remain recorded. Base non-black counts are 307325 opening and 377988 late; late held-out is 340587.

| Input | Shadow slots full -> compact | Memory slots full -> compact | Actual triangles B -> C | Draw calls B / C |
|---|---:|---:|---:|---:|
| opening-base | 774 -> 771 | 28 -> 28 | 10426 -> 10420 | 13 / 13 |
| opening-corner | 774 -> 4 | 28 -> 4 | 10 -> 10 | 1 / 1 |
| opening-heldout | 774 -> 13 | 28 -> 4 | 9082 -> 7560 | 7 / 7 |
| late-base | 1260 -> 1239 | 466 -> 94 | 22582 -> 18076 | 14 / 14 |
| late-corner | 1260 -> 5 | 466 -> 5 | 5602 -> 70 | 2 / 2 |
| late-heldout | 1260 -> 48 | 466 -> 186 | 22534 -> 16750 | 12 / 12 |

The first actual draw was full in all arms; merely accepting a payload was not treated as allocation. Opening actual shadow/memory capacities were 1024/32, late 2048/512, and remained unchanged after compaction. Each target lane removed more than 32 slots in a late view (maxima 1255 shadow and 461 memory). Actual triangles also fell, satisfying the nonvacuity guard. Opaque, animated and other batch objects and resources were unchanged. Initial and first-compact costs are retained in every raw row and `actual-analysis.json`; they are not hidden warmup or included in steady medians.

## Exact predeclared triage

The scored cost includes candidate preparation, actual B delta/admission, actual draw/readPixels synchronization and common commit audit. Adapter construction/snapshot work, simulation, ground packing, full checkpoint capture, HUD and compositor are excluded. Each round reports the lower quartile (sorted index floor(8/4)=2) of its eight total costs. The following medians are medians of those four **costs**, never medians of ratios. `actual-analysis.json` independently recomputes them from `steps.jsonl` and retains exact numbers; table rounding does not drive verdicts.

| Input | B median ms | C median ms | Repeat median ms | C / faster control |
|---|---:|---:|---:|---:|
| opening-base | 24.400 | 25.250 | 24.900 | 1.034836 |
| opening-corner | 6.200 | 7.350 | 7.250 | 1.185484 |
| opening-heldout | 19.250 | 10.650 | 19.450 | 0.553247 |
| late-base | 39.350 | 38.600 | 39.600 | 0.980940 |
| late-corner | 7.900 | 8.750 | 7.800 | 1.121795 |
| late-heldout | 33.200 | 17.650 | 33.400 | 0.531627 |

For both late-base and late-heldout the rule requires Cmedian <= 0.80 * min(Bmedian, repeatMedian), C below both corresponding controls in all four round quartiles, and symmetric control ratio max(Bmedian, repeatMedian)/min(...) <=1.05. Opening base requires Cmedian <=1.05 * max(Bmedian, repeatMedian). All validity, pixel, temporal and nonvacuity controls must also pass.

Late base: C `38.600000001490116` exceeds threshold `31.479999999701977`; FAIL. Its symmetric control ratio is `1.0063532401998732`, which passes noise control. Round quartiles (B, C, repeat) are `(39.5,39.20000000298023,39.70000000298023)`, `(39.30000000074506,37,40.100000001490116)`, `(39.399999998509884,40.099999997764826,39.5)`, `(39.100000001490116,38,38.5)`. The third round loses to both controls, independently failing the all-four rule.

Late held-out: C `17.649999998509884` <= threshold `26.559999999403956`; PASS. Symmetric control ratio `1.0060240964193397` passes. All four round quartiles beat both controls: `(33.899999998509884,18.200000002980232,35.899999998509884)`, `(31,16.599999997764826,32.69999999925494)`, `(33.30000000074506,17.299999997019768,32.69999999925494)`, `(33.099999997764826,18,34.100000001490116)`.

Opening base: C `25.25` <= limit `26.145000000391157`; PASS. Overall triage is FAIL because late base fails two requirements. The corner observations are reported fully rather than promoted into a different acceptance rule; late corner is slower despite its large triangle reduction.

Candidate prepare sub-time medians of round quartiles were 1.55 ms at late base and 1.20 ms at late held-out. Corresponding synchronized draw sub-times were 36.00 vs B 38.75 ms and 15.95 vs B 32.85 ms. These independently selected sub-time quartiles need not sum to total quartiles. They describe this static experiment and do not establish a general causal cost decomposition.

## Bounds, cleanup and disposition

This is static, uncomposited full-world render feasibility with fixed `tick*100` display/runtime clock and deltaMs 0, not the app's bridge-rebased clock or its frozen screenshot. The unchanged helper still maps to 320x200 with a four-unit margin (10x9.6 pixels at this fixed target); six-view zero differences do not prove general AA/outline/viewport conservatism. No simulation work, live Normal FPS, GPU, CI-runner timing, actual-host camera/paused refresh, bridge rollback, context recovery or maintained product capture verification was run or claimed. The real synchronous undrawn-admission rollback contract remains separate; no capacity inference is made from admission alone. A successful feasibility result would still have required those proofs.

Inner finally cleanup recorded eight owned identities, zero remaining, auditAvailable true, no cleanup error and serverListening false. The independent outer controller recorded seven owned identities (different sampling includes the native root), zero remaining, zero tagged browsers, zero port4834 listeners and no controller/cleanup error. `final-process-audit.json` binds the root creation identity and timeout result. All outputs are intentionally retained ignored evidence for root handoff; no source export or tracked edit was made. The heavy lane was released to root after inspection and verdict. Stop here for root reassessment; no host/product work is authorized by this negative run.
