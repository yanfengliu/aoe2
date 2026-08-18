# Multi-CLI review — Moebius art style (voxel 1.2.0 + aoe2 0.3.10)

**Date:** 2026-08-17 · **Objective:** `moebius-art-style` · **Iteration:** 1

Escalated under the fleet rule that edits reaching a sibling repo are high-risk. The change spans `voxel` (new `StylizedResolvePass`, runtime wiring, public API) and `aoe2` (art-style layer, menu row, persistence).

## Reviewers

| CLI | Model | Lens | Outcome |
|---|---|---|---|
| Claude | `claude-fable-5[1m]`, effort max | Public API contract, consumer impact, test honesty, TS/GLSL parity, persistence | 8 findings |
| Claude | `claude-fable-5[1m]`, effort max | GPU resource lifecycle, context loss, host protocols, capture path, depth maths | 8 findings |
| Codex | `gpt-5.6-sol` | GPU lifecycle (intended) | **Unreachable** |

**Codex was down.** First attempt failed the trust check (`--cd` pointed at the non-repo parent; fixed with `--skip-git-repo-check`). The retry returned `You've hit your usage limit … try again at Aug 19th, 2026`. Per the runbook, the review proceeded on the reachable CLI and compensated for reviewer *count* by running a second Claude instance carrying Codex's intended lens rather than dropping it. **Retry Codex next session** — this change has had no independent second-engine read.

Post-review audit of both repos' `git status` found no reviewer writes: the changed set is exactly the authored one.

## Findings acted on

| # | Severity | Finding | Resolution |
|---|---|---|---|
| 1 | High | `render()` captured the previously bound render target but restored it only on the straight-line path. Any throw in either scene render left an offscreen target bound; on a borrowed renderer every later host draw would land invisibly in a buffer the pass later deallocates. | Both scene renders moved inside the `try`; the `finally` now restores the bound target alongside the three scene/camera states. Two tests, both confirmed to fail on the neutralized ordering. |
| 2 | Medium | `renderer.info` is reset by Three at the start of every render, so a three-render frame reported the cost of one fullscreen quad — `drawCalls: 1` regardless of scene content. No gate caught it (browser specs assert only `drawCalls > 0`). | `autoReset` held off and `reset()` called once before the colour render, restored in the `finally`. Test asserts one reset and restoration. |
| 3 | Medium | `stylizedResolve` was accepted on embedded-host runtimes but completely inert — an embedded host's draw never crosses the runtime's seam. Contradicted ADR-0010's own stated mechanism. | Refused at wire-up with a message naming the remedy. Test pins it. |
| 4 | Medium | `steppedLuminance` diverged between TypeScript and GLSL: the TS floors the band count, the GLSL did not, so a fractional count returned tones **past** the range ceiling in the shader. | Found independently by hand-diffing the two bodies before the review returned; GLSL now floors. Two tests, including a sweep asserting no tone ever leaves its range. |
| 5 | Medium | The `stylizedToneBands.ts` comment claimed a browser gate compared the GLSL against the TS. No such test exists — the devlog correctly called it a follow-up while the source claimed it was done. | Comment rewritten to state plainly that nothing checks the bodies. Finding 4 is what that gap let through. |
| 6 | Medium | The refused-swap test passed with its fix neutralized: it asserted only the *identity* of the stored pass, which cannot distinguish "incumbent alive" from "incumbent disposed". | Test now restores the renderer capability and renders a frame, proving the incumbent still draws. Fails on the release-then-build ordering. |
| 7 | Low-med | Ink was uploaded linear (Three converts authored sRGB) but blended against a display-encoded frame, drawing `#2b3a45` at roughly `#0a0e12`. Hidden by the near-black default; would be glaring for a light-ink style. | Encoded in the shader. Shifts the shipped frame from L=96.9 to L=100.8; re-inspected at 3x and `inkStrength` left at 0.85 rather than raised to chase the accidentally darker line. |
| 8 | Low-med | The resolve wrote alpha 1.0 over a canvas created with `alpha: true`, so switching style changed canvas compositing at the map edge. | Alpha carried from the colour target. |
| 9 | Low | The shadow-map suppression was inert: Three early-outs only when `autoUpdate` **and** `needsUpdate` are false, so a borrowed renderer with shadows on drew them twice per stylized frame. | Both flags saved, cleared, restored. Test asserts both. |
| 10 | Low | `DEFAULT_NO_INK_LAYER`'s doc claimed "no contour lines"; the layer is excluded only from the normal render, so a depth-writing object still takes a silhouette. | Documented accurately, including the occlusion consequence when `normalEdgeScale > 0`. |
| 11 | Low | A perspective view was constructible with `stylizedResolve` and silently degraded the contour. | Refused at wire-up. Test pins it. |
| 12 | Low | `TONE_BAND_GLSL` and `TONE_BAND_UNIFORM_NAMES` entered the hash-pinned public API un-changelogged; the second is test plumbing. | Both unexported from `voxel/three`; still reachable from the module for this package's tests. |
| 13 | Low | aoe2 `setArtStyle` recorded the new id *before* the swap that can throw, so a refused switch left `artStyleId()` and the menu label naming a style the canvas was not in, and the next cycle skipped a style. | Assignment moved after the runtime accepts. |
| 14 | Low | The aoe2 menu row was entirely untested — initial label, click-to-cycle, `aria-label` update, teardown. | New `tests/ui/gameMenuArtStyle.test.ts`, 5 tests; the initial-label test confirmed to fail on the neutralized render. |
| 15 | Nit | Weak assertion: the no-ink-layer test asserted only that the mask *differed*, so disabling an unrelated layer would pass. | Asserts the exact bit. |
| 16 | Nit | A preference test repeated its predecessor's assertion with a different id while claiming application semantics. | Replaced with one asserting a failed write does not poison the next read. |
| 17 | Nit | The depth kernel is a two-tap central difference, called a Sobel throughout. | Renamed in the source, with the reason the extra ring is not wanted. |

## Findings noted and not acted on

Both reviewers independently confirmed, with citations, that these are clean: resource leaks across construct/resize/swap/dispose cycles; context loss and restoration; the runtime-owned capture path (right pixels, size, and colour space); the "omission costs exactly nothing" claim; save-format and replay isolation; and `gamutSafeToneScale` TS/GLSL parity.

One divergence is accepted and documented rather than fixed: the TS `steppedLuminance` clamps its input to 0..1 and the GLSL does not. Unreachable in the shader — its colour target is 8-bit — and the doc now says so.

## Standing gap

Nothing executes the GLSL in any gate. The uniform *interface* is pinned on both sides; the function **bodies** are hand-transliterated and unguarded, which is exactly what finding 4 slipped through. A browser-gate test rendering a known ramp through the real shader and comparing it against `steppedLuminance` is the missing half. Carried as a follow-up in both repos' devlogs.
