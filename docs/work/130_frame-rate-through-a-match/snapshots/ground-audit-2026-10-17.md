# Software ground audit — 2026-10-17

Read-only investigation by collaboration worker `software_ground_audit`, targeting committed integration `63443d0dfe9eaefe900be02b10f0e46e94235dbc`. Prepared for promotion into work 130 after current clean-tree verification. This is an authored feasibility report, not executed candidate evidence.

Ground audit found one exact-semantics prototype worth considering, but no evidence that it can supply the required ~16.75% late-frame reduction.

The existing instruments are `tests/browser/de-ground-frame-cost.spec.ts` for synchronized rendering cost, the retained final-B Normal matrix for acceptance, and `captureMapScreenshot.mjs` / `diffMapScreenshots.mjs` for pixels. I inspected their contracts and existing results; ran no browser, test, build, profile, or mutation.

Measured growth from retained software rows:

| View | Opening→late triangles | Draw calls |
| --- | --- | --- |
| Base | 10,426→22,582 | 13→14 |
| Corner | 10→5,602 | 1→2 |
| Held-out | 9,082→22,534 | 7→12 |

Animated instances rise 40→119, buildings 1→13, and remembered entities 0→55. Ground geometry itself remains ten triangles (`aoeDeGround.ts:44`), rebuilt only when map dimensions change (`:245`). Both states contain 2,160 terrain cells. Detail/macro textures bake once; unchanged cell/field bytes already avoid uploads (`:120`, `:259`). Together those two map textures contain only 17,280 bytes. No retained counter measures their dirty frequency, ground fragment coverage, or ground-stage time. Constant geometry does **not** prove constant fragment cost: more explored ground can enter the existing surface-sampling loop.

The candidate is a **high-dirt shortcut in the single-sample shader**, at `aoeDeGroundShader.ts:123–147`.

- For a known non-water fragment with `field.b >= 0.75`, the existing dirt predicate is necessarily true: its minimum is `0.75 + (0 − 0.5) × 0.3 = 0.60 > 0.5`. The unsigned-byte macro texture and linear filtering constrain `macro.a` to `[0,1]`.
- Such a fragment’s existing output is exactly its dirt surface texel, multiplied by the existing fog level/fade. It needs no macro sample, sand calculation, or terrain tint calculation.
- A one-iteration loop for that case, with a complementary loop containing the unchanged fallback, could let SwiftShader skip that work for uniformly qualifying quads. Keep all existing derivative/LOD calculations outside both loops and preserve their arithmetic order. Restrict the change to `DE_GROUND_SINGLE_SAMPLE`; leave full blend untouched.
- Late screenshots visibly contain more building dirt, consistent with 1→13 buildings. Its qualifying pixel fraction and actual cost remain **unmeasured**. It retains the expensive surface sample and may save too little; I would not predict the required gain.

Minimum acceptance: exact before/after pixels on both rasterisers across opening, late base, corner, held-out, plus a focused fixture covering dirt boundaries, water, unexplored cells, and several zooms. A meaningful negative control widens the shortcut to ordinary known land; the comparison must then detect changed grass/sand pixels. A same-baseline control must remain zero. Only after that passes should synchronized cost and the identical-work Normal matrix score it.

Disqualify it for any pixel change, derivative movement, missing fallback work, absent qualifying coverage, or insufficient Normal improvement. Dirty-row uploads and hoisting LOD/fog arithmetic are weaker routes here: the former lacks measured material cost; the latter lacks an exact floating-point equivalence argument.

No files or Git state changed; no processes created.
