# Lessons — evidence

The war story and the anchor behind each line in [lessons.md](lessons.md). Not session-start reading: open an entry when its rule is in doubt, or when the work is in that area.

## A rendering trick calibrated against a hardware limit is only as good as the limit you MEASURED (2026-09-02)

**Anchor:** v0.3.193, `src/rendering/voxel/aoeVoxelCastShadows.ts` — `SHADOW_LEVEL_STEP = 0.002`, whose comment derives it as "roughly four depth steps" from a 4000-unit orthographic range on a 24-bit buffer (`voxel/src/three/orthographicView.ts`, `DEFAULT_NEAR` 0.1 / `DEFAULT_FAR` 4000). `AoeVoxelWorldRenderer.ts` requests `{alpha, antialias, powerPreference}` and nothing else, so the context's depth size is whatever the device gives.

**Gate:** a browser spec that reads `gl.getParameter(gl.DEPTH_BITS)` from the live world canvas and asserts at least 24. Not landed here: this change had already been through two review rounds and the assertion belongs in the browser suite, not in a unit test that cannot see a GL context.

Sun-cast ground shadows keep overlapping casters off one another by drawing them 0.002 world units apart and letting the depth test discard the lower one. The separation was derived arithmetically and never measured against a real context. On a device that hands back a 16-bit depth buffer one quantum is 0.061 world units — thirty times the separation — every shadow lands in the same depth bucket, and overlapping shadows z-fight into stripes. There is no error, no warning and no failing test: the scheme degrades into exactly the artifact it was built to prevent, on that device only.

What makes it a lesson rather than a note is the shape, which this fleet has already paid for once: the browser suite that was green on its author's machine and red on every slower CI machine for 131 pushes. A calibration constant is a claim about hardware, and a claim about hardware that only one machine has ever seen is not evidence.

What was tried, so the next attempt starts past it: forcing the step to 0 and re-capturing DOES prove the mechanism is doing something on this machine — the boot view came back with shredded shadows and 19,891 pixels reverting from shadowed to lit — but that is a test of "0.002 > the quantum here", not of what the quantum is. The direct read is one line and is the only thing that answers it.
