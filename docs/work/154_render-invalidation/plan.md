# Adopt selected render invalidation without changing game state

Status: active
Owner: Codex
Created: 2026-11-08
Updated: 2026-11-08

## Problem and outcome

AoE2 rebuilds every projected entity after a change to game state outside engine components. Engine 2.7 added selected-entity invalidation, now available through the verified retained 2.9.0 archive. Adopt that public API and measure the retained map-size workload, preserving the same world and full projected views.

## Scope

Owner-approved scoped AoE2 engine adoption, following work153 at a0e10435912d97078ee033112d49926a36807fde. Root continues in the controller-created engine-pin-1107 tree with approved private dependencies. No map generation, AI policy, voxel, save schema, replay transport or shared-install changes. Foreign render-projection-cost-1106 work remains untouched; its uncommitted dynamic-candidate classification and oracle cases are reference inputs, not an accepted implementation.

## Approach

Keep civ-engine RenderAdapter and its JSON validation, generation tracking and transport. Track entities whose projection reads game-owned mutable state, plus previous/current selection; update membership from actual component/entity diffs. Register the invalidation listener before the adapter's diff listener so a tick's external state appears in that tick's projection, including several ticks with no read between them. Use the engine invalidate API, without a replacement adapter, equality suppression or validation opt-out. Retain immediate full-snapshot fallback for changes between ticks, especially paused selection, and preserve on-read connect/finally-disconnect behavior and render-store memo invalidation. Inspect tie ordering explicitly rather than normalizing an oracle to hide differences.

## Acceptance criteria

- [x] TDD whole-view/frame equality against a full engine projection, equal serialized game state, real occurrences for combat, construction, conversion, healing, wildlife, regeneration and selection changes.
- [x] Entity-generation/reclassification/destruction, old/new/cleared selection, paused reads and several ticks without reads retain current views.
- [x] Independent projection counts prove untouched terrain/static resources avoid repeated projection; deliberate invalidation/order controls fail.
- [x] Inclusive CPU profiling on retained late 120x120/168x168 saves and interleaved equal-work digest checks support any cost claim; do not substitute whole-game throughput for feature cost.
- [x] Headless GPU fixed/random camera views, zooms, real controls and maintained before/after pixel captures; retained gallery, task-owned cleanup.
- [ ] Exact independent review, required local verify/receipt/audits, main/push and terminal hosted CI/corpus.

## Implementation steps

- [x] Inspect current bridge, engine invalidation semantics and the peer candidate without changing it.
- [x] Add contract tests first, implement the narrow integration, measure and visually verify.
- [ ] Review, gate, land and record the observed result.

## Outcome

Implementation, bounded contracts, independent source/performance review, matching-state retained-map profiles and native GPU comparisons pass. Version0.3.278 passed the complete precommit verify; clean committed verification and hosted delivery remain pending. Work153 canonical-path correction is delivered at main a0e10435912d97078ee033112d49926a36807fde. Clean verify on tree3cc8351b01dc04fe07dc971a02946467eed7cc0c passed5,504 unit tests/3 existing skips and345 browser tests/2 existing skips, all stages and receipt check, from2026-11-08 02:39:00–02:53:35 UTC;400 tracked owned processes,0 cleanup stops/leftovers. CI42440504621 finished successfully in all10 jobs, including Windows, and corpus42440504564 succeeded. Actual physical runtime remains engine2.9.0. No work154/155 gameplay change was included.

## Contract evidence before measurement

The complete projection/lifecycle suite passes16 cases in37.12s on engine2.9.0: existing combat/opening/healing/conversion/wildlife/paused-input oracles plus actual Berserk regeneration, repair across the damage threshold and Loom max-HP completion. Every tick compares exact entity ordering, fields and frame against a fresh engine projection; final serialized game digests match. Five small real-adapter cases cover creation/destruction/reused generations, resource reclassification and unit overrides, old/new/cleared static selections without reads, and reconnect ordering. Valid source controls omitting external candidates, omitting old selections, and registering the listener after the adapter each failed the intended assertion; exact source bytes were restored in finally. A first typecheck found only two new fixtures reading a legacy-capable WorldSnapshot union directly; using the existing worldStateOf helper preserves both assertions and types. Corrected typecheck and affected-file lint pass. Raw logs/control hashes stay in tmp/render-invalidation/. Earlier8-case fixture evidence and its explicitly unproven worker-exit cause remain in the retained resume record; no failed run is counted as acceptance.

## Measurement and visual acceptance

Independent evidence review1 records the exact profile populations, per-function/file inclusive shares, interleaved checkpoint equality, A/A noise and foreign-load limitations. The three loaded windows show adapter inclusive shares54.0→23.2%,74.8→24.9%,66.8→22.9%; total process CPU per tick is45.4%,71.6%,56.4% lower as a sanity check only. The full-refresh path has zero observed candidate samples. No zero-cost, whole-game, FPS or visibility-specific claim follows.

Maintained captureMapScreenshot/diffMapScreenshots ran headlessly on the actual RTX4090/D3D11. Twelve pairs at1280x800 are pixel-identical; ten useful pairs span two art styles, default/close/wide and retained24k/36k views, with seeded random focus/zoom. The first wide framing was fog-only and is explicitly excluded from useful coverage; its replacement uses native H at0.7 zoom. H/Q queues a villager and visibly changes food/production in both builds; retained saves load through real HUD controls. Root inspected all ten useful candidate images at native resolution and a before partner. An existing late Castle-Age HUD label/card overlap is identical in both builds and remains outside this renderer change. Process receipts track149+36 owned descendants,0 stopped/leftovers. Evidence and source/build hashes remain in tmp/render-invalidation/measurement and output/playwright/work154*.

Final integration review2 accepted prepared tree8785d2c40db93c9448afd8c69c53c9e830eb6517 with no material findings. Runtime/tests match source review3de9 except the documented options comment; package/lock change only the root patch version. The reviewer independently inspected16 native images (10 useful after,5 before,1 excluded fog-only), verified all12 before/after PNG pairs are byte-identical, checked all116 retained artifacts (9,424,130 bytes) and30 gallery links, and read actual GPU/process receipts. Raw visuals now survive worktree cleanup at primary aoe2/tmp/work154-retained/visual; its retention-manifest.json binds every file. Primary tmp/visual-gallery/index.md links the ten useful pairs. Work-record/line-ending content checks pass9 cases. Full verify, audits, clean-commit receipt and hosted delivery remain.

## Precommit gate

Full npm run verify passed on staged tree3c74556038f76648c8382b4be5bc0169ac40a6df from2026-11-08 03:37:32–03:52:40 UTC:5,520 unit passes/3 existing skips,345 browser passes/2 existing skips, content/type/lint/final build green. Node24.22.1, root npm11.6.2 and PATH npm11.7.0;699 tracked owned processes,0 forced stops/leftovers. Both audits pass:7 moderate development findings,0 production. The dirty-tree receipt correctly refuses landing; a second complete run on the committed tree must certify the source before main moves. Raw logs and copied receipt are retained under tmp/engine-pin/verify-render-dirty.*.
