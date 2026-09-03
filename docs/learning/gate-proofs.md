# Gate proofs

The standing answer to "did the gates actually do their job".

A lesson leaves [lessons.md](lessons.md) only when it becomes a gate, and a gate counts only once it has been made to go RED by reintroducing the defect. This file records the mutation, the failure it produced, and the bound the gate does not reach past. Without it, "this became a gate" is an unverified claim and the deletion it justifies is unearned.

## If a gate here is wrong

A gate and the claim in its header can be wrong together, and when they are they look exactly like a gate that is right. Auditing one means reaching what was believed, measured and abandoned at the time — never the sentence the gate carries about itself. The evidence deleted in a retirement commit is not lost; this repository's evidence file as it stood immediately before the first retirement reads back out of:

    git show 96ed269d:docs/learning/lessons-evidence.md

`git log -- docs/learning/lessons-evidence.md` lists every earlier revision, and `git log -S'<phrase from the gate header>' -- docs/learning/` finds the entry a particular gate retired.

## An arithmetic claim about hardware is not a measurement, and the gate that measures it must read the buffer the work actually lands in

- **Gate:** `tests/browser/shadow-depth-precision.spec.ts` :: `every buffer the scene draws into resolves the shadow level step` — run by `npm run test:browser`, and so by `npm run verify`.
- **Claim it carries:** `SHADOW_LEVEL_STEP = 0.002` world units separates two casters' shadows in depth. That is derived arithmetically as about four depth quanta from the orthographic camera's 4000-unit range on a 24-BIT buffer, and nothing in the renderer requests 24 bits — the context asks for `{alpha, antialias, powerPreference}` and takes whatever the device gives. At 16 bits one quantum is 0.061 world units, thirty times the separation, and every shadow lands in one bucket: the level scheme degrades silently into the z-fighting stripes it exists to prevent.
- **Mutation:** in the spec's own `depthOf`, `return 16;` for every non-default framebuffer — a device whose offscreen targets are allocated `DEPTH_COMPONENT16`, which is Three's default internal format for a depth-only renderbuffer and therefore the realistic form of this defect rather than a synthetic one.
- **Red:** `the scene draws into a offscreen buffer with 16 depth bits; SHADOW_LEVEL_STEP = 0.002 needs at least 24 to separate two shadows (measured: {"drewAnything":true,"frames":13,"canvasSize":{"width":800,"height":480},"buffers":[{"target":"offscreen","depthBits":16},{"target":"offscreen","depthBits":16},{"target":"default","depthBits":24}]})`.
- **Green after revert:** yes, 1 passed in 2.7s.

**The finding that changed the gate, and the reason this entry is worth reading.** The lesson specified the gate as "a browser spec reading `gl.getParameter(gl.DEPTH_BITS)` off the live world canvas and asserting >= 24". **That gate would have measured the wrong buffer.** The default art style, Moebius, resolves the frame through a stylized pass, so the scene is rendered into offscreen targets first — and a Three render target's depth attachment is allocated independently of the canvas's. Instrumenting `bindFramebuffer` and the four draw entry points for twelve real animation frames shows the scene's draws landing in **three** buffers on this machine: two offscreen and one default. The canvas-only reading would have covered one of the three, and NOT the ones the shadow depth test actually runs in under the shipped default style. It would have been green for the same reason the defect is invisible.

Measured here, all three report 24. The specified gate would also have passed. That is precisely the problem with it: a gate that is right by luck is indistinguishable from a gate that is right, until the day the luck changes.

- **Bound.** ONE machine, ONE art style, ONE scene, ONE moment. It asserts what this device hands back when `aoe2-prototype` is drawn under the default style; a device that allocates 16-bit targets fails it, which is the point, but only if the suite is ever run there. It also only sees framebuffers that receive a draw call in the twelve frames it samples — a lane that draws rarely (a resize path, a picking pass) is outside it. It does not check that 0.002 is ENOUGH at 24 bits; that arithmetic is still arithmetic, and the thing that tests it empirically is the overlapping-shadow gate in `tests/rendering/aoeVoxelShadowLayering.test.ts`.
- **Guard against a false green:** the spec fails if the canvas is 1x1 or nothing drew. That is not hypothetical — measuring this by hand first, through a hidden browser pane, returned a 1x1 canvas, zero animation frames and zero draw calls, and every depth assertion would have passed vacuously because there was no buffer to fault.
