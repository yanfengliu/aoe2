# Standalone voxel-only renderer - adversarial review

Date: 2026-07-13

Scope: AoE2 v0.2.0 removal of the Phaser graphics path, standalone Three/`voxel` host, renderer-neutral input/camera/presentation, voxel world feedback, presented-state picking, lifecycle ownership, animation continuity, browser evidence, and the unchanged reusable-engine boundary

Verdict: approved locally; all substantive findings are closed and the complete gates are green

## Findings and dispositions

- **Prepared versus visible hit state:** an accepted snapshot could make input target geometry before the canvas presented it. The coordinator now prepares hit data separately and promotes it only when runtime epoch/revision match; context loss and stale presentation fence world interaction.
- **Exact-click cache could preserve obsolete targets:** cycling now recomputes the current hit set for every click and uses prior semantic group order only as an ordering hint. Moved, hidden, destroyed, or otherwise absent entities cannot be selected from history; changing the exact projected subpoint resets the cycle, while equivalent same-type units retain double-click selection.
- **Moving-unit proof initially sampled an occluded body:** the browser regression now pauses deterministic simulation, scans the exposed currently presented body, resets click-cycle state between probes, and requires a real canvas click to select the moving unit without treating occluded pixels as interactive evidence.
- **Lifecycle and ownership edges:** transactional startup unwinds partial construction; capture failure preserves the annotation marker; resize observes the view's own bounding box; public browser API installation/restoration, listeners, animation frames, contexts, resources, and controllers all have idempotent teardown.
- **Marquee and transient feedback depth:** drag marquee segments are screen-locked above scene geometry, including empty selections, while hit sparks clear the authored transformed visual top rather than a footprint estimate.
- **Animation and reusable-engine boundary:** speed-matched roots, feet, limbs, cavalry, and siege motion remain AoE-owned displayed-distance policy. The sibling package keeps only the game-neutral bounded transform/presentation contract. The engine reviewer found no new schema, public-contract, bounds, disposal, or City/Townscaper ownership defect.

The AoE animation reviewer, AoE voxel reviewer, and shared-engine boundary reviewer each inspected the final live code after repairs. Their final verdicts report no remaining substantive correctness, picking-parity, lifecycle, bounding-box, animation, file-size, public-contract, resource-growth, or cross-game ownership issue.

## Visual and structural evidence

`docs/devlog/artifacts/2026-07-13-voxel-only-{before,after,diff}.png` uses a fixed 1280x720 viewport and DPR 1. Pixelmatch changes 106,615/921,600 pixels (11.57%). The after frame has accepted/presented revision 80/80, 12 chunks, six materials, one geometry resource, seven batches, 365 instances, two animated batches/26 animated instances, 12 draw calls, 10,336 triangles, seven renderer geometries, one texture, and no context loss.

Source and generated-bundle scans contain no legacy graphics matches. `src/phaser/` is absent. `npm ls phaser` is empty, and the dependency tree resolves a single `three@0.185.1` shared by AoE and `voxel`.

## Final gates

- AoE `npm.cmd run verify`: content validation; 1,905 unit tests passed and two skipped; 104 browser tests passed and two intentional visual-baseline tests skipped; zero-error lint; typecheck; 442-module production build.
- The production application chunk is 1,275.74 kB (322.26 kB gzip), with no Phaser chunk.
- Shared engine `npm.cmd run verify`: 80/80 tests, typecheck, lint, and build.
- AoE `npm audit --omit=dev` and full `npm audit`: zero vulnerabilities.
- Repeated source, package, and bundle audits found no Phaser, legacy painter, or EventEmitter renderer path.

The complete gate exposed two deterministic multi-thousand-tick scenarios whose explicit 30-second limits were too tight only under full-suite contention. Isolated runs completed in 22.6 and 24.5 seconds; the final tests document those measurements and grant only those scenarios 60 seconds of headroom. No behavior or correctness expectation was weakened.

No reusable-engine source, package contract, third-party version, shader, texture, model, or imported asset changed in this increment. The final AoE migration is prepared as one coherent local commit and is not pushed without fresh publication approval.
