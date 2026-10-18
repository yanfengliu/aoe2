# Actual isolated-ground outcome — 2026-10-17

One authorized SwiftShader execution completed with native exit 0. No retry, instrument/source/pin change or product prototype was made. The heavy lane is released. This result does not justify implementing the high-dirt shortcut or closing the original software frame-rate criterion.

## Observed result

Each number is the median of eight row lower quartiles, each row containing twelve synchronized, actually committed runtime frames. Ranges below are the eight row quartiles, not per-frame extrema.

| View/control | Opening ms (range) | Late ms (range) | Late/opening |
| --- | --- | --- | ---: |
| Base/actual | 7.10 (6.90–7.50) | 7.45 (7.20–7.70) | 1.0493 |
| Base/unexplored | 5.75 (5.40–6.40) | 5.65 (5.20–6.20) | 0.9826 |
| Corner/actual | 4.90 (4.60–5.30) | 4.80 (4.70–5.50) | 0.9796 |
| Corner/unexplored | 4.90 (4.70–5.10) | 5.00 (4.60–5.60) | 1.0204 |
| Held-out/actual | 5.85 (5.40–6.40) | 7.90 (7.30–8.40) | 1.3504 |
| Held-out/unexplored | 5.95 (5.70–6.40) | 6.00 (5.60–6.10) | 1.0084 |

The held-out actual-layer ranges separate while its unexplored control stays approximately flat. Its actual picture changes from entirely black to 339,787 non-black pixels of known ground. This establishes sensitivity to the newly explored ground on this fixed layer. Base actual versus unexplored controls also separate, but base opening/late ranges overlap: its 0.35 ms median increase is not a demonstrated large growth mechanism. Both corner actual pictures are black and their timing remains flat. Corner and opening-held-out actual/unexplored overlap is the expected negative result for those black views, not a failed visual control.

All 24 native PNGs were opened individually at original resolution. Actual/repeat pairs have equal raw pixel hashes and equal PNG hashes. Base actual images show ground and the larger late dirt area; unexplored controls are black but cover the ground; hidden controls have zero covered pixels and zero draws. Actual non-black counts: base 301,375→375,387; corner 0→0; held-out 0→339,787. Both states have the same map and geometry. Known map cells rise 218→789; packed high-dirt cell centres rise 16→65, which is not a measured high-dirt fragment count.

## Validity and retained evidence

All six full-world/projected identities and exact cameras matched the retained final-B round-0 records. The actual context named SwiftShader, selected single-sample, used DPR 1 and 800×480 buffers at zoom 1.2. Real AoE daylight and ACES exposure 1.5 were used. The layer accepted/presented its empty voxel snapshot revision 1. All 96 scored rows completed: 1,152 scored frames, every runtime frame delta exactly one, every actual draw one call/ten triangles, zero voxel content. The prepared checks rejected lost/non-running contexts, wrong framebuffers, GL errors, draw discrepancies, resource requests or shader compilation during timing; none rejected this run. These observations use public runtime metrics and committed counters; no synthetic RAF count substitutes for a draw.

All 902 prepared file pins matched before and after; every esbuild input and the browser-loaded layer bundle was bound. Diagnostic bundle SHA-256: `e0df67c6c8b2ce7b3c9066cafc454f24aa7ab4d54be3a5d8c5d0a4089cc7e7b6`. Runner/client/prepared-pin hashes remain respectively `f1f27dd6544921cc352d5aa80ae9f39251f331cb4b13787aaad9e1cdfde324a1`, `26e1b4fc666ee7073bdf2c925cea5fa14e96a84340083c380e148c5d0383e9df`, and `fccb3b4a0e29b66adf7834c79a77adfac94f6661c059f6f6386578024cff12a5`.

Raw inputs, native PNGs and capture metadata, compiled vertex/fragment shaders, runtime/camera/context configuration, build/metafile/source pins, all per-frame costs and counters, and summary are in `output-swiftshader/`. `capture-sheet.md` / `.json` list every inspected path and PNG/raw-pixel digest. `controller-start.json`, `native-exit.json`, and native stdout/stderr preserve execution; stderr is empty. Native run: PID 47996, creation `2026-10-17T23:54:44.4321476Z`, exit 0 at `23:56:05.6431536Z`. `final-process-audit.json` independently found zero of nine recorded PID/creation identities alive, the controller root gone, zero tagged browsers and no listener on 4833. Runner cleanup also reports no remaining process, no listener and no error.

## Bound and disposition

This is the static actual ground layer without entities, entity depth occlusion, HUD, simulation, or timed packing/uploads. It is not an additive whole-frame causal decomposition, a Normal-FPS result, a four-vCPU CI measurement, or an estimate of shortcut savings. The compiled installed voxel JavaScript is pinned; local source HEAD is `5d6d4c911c6d05b62a5a81ad62f05993cf44e9de`. CI pin `08398b573ad54bcb5c764ad0c2ef3cedc3cce33f` was not executed. No GPU repetition occurred. Foreign host load was not measured.

The clear held-out increase accompanies newly explored grass/water rather than a broad high-dirt region. Base ground growth is small relative to its observed spread. These data do not establish the required roughly 17% whole-late-frame improvement or useful high-dirt savings. Root independently inspected base/held-out images and rejected a shader product prototype on this evidence. Preserve this diagnostic as bounded evidence; keep the original software criterion open.
