# Isometric voxel renderer migration — design

Status: opt-in vertical slice implemented from 2026-07-11; default promotion remains deferred. User direction: co-edit AoE2 into an isometric voxel presentation while building the graphics code in the sibling `voxel` repository for reuse by City and Townscaper. The prior AoE2 worktree was confirmed clean, fetched, and exactly synchronized with `origin/main` at `23f99b7` before this thread was created.

## Product outcome

AoE2 now has an explicitly selected proving path that presents its playable world as real lit 3D, with voxel terrain and deterministic blocky procedural units, buildings, and resources. The established Phaser renderer remains the default while elevation-aware interaction and the complete parity matrix are unfinished. Both modes preserve the authoritative simulation, saves, replays, DOM HUD, fog semantics, command behavior, selection behavior, and automated playtest surface.

The migration must remain original/procedural art. It may evoke the readability and 2:1 presentation of Age of Empires II but may not copy its assets.

## Cross-game boundary

AoE2 is the first proving consumer, not the owner of the reusable API. The sibling package exposes three independent data lanes:

1. `VoxelChunkV1` for palette-indexed terrain or occupancy volumes.
2. `GeometryResourceV1` for deterministic consumer-authored meshes, including Townscaper's irregular connected shells.
3. `InstanceBatchV1` for repeated rigid objects, including AoE units/buildings/resources and City buildings/vehicles/trees.

The package owns validation, copied ingest, epochs, accepted/presented revisions, mesh presentation, instance allocation, camera math, capture, metrics, and disposal. AoE2 owns unit/building/resource visual roles, player palettes, fog memory, selection priority, health, placement, commands, animation meaning, and translation from `ProjectedEntityView`.

No shared type may contain AoE terms such as unit, building, owner, fog, health, construction, command, or civilization. City roads/zones and Townscaper facades/stories/massing rules are equally excluded.

## Why the first slice is composed, not a big-bang host replacement

The existing simulation seam is already favorable:

```text
SimulationBridge.getRenderState()
  -> ProjectedEntityView[] keyed by id:generation
  -> renderer-owned interpolation
  -> view only; no simulation mutation
```

However, `GameScene` currently owns simulation stepping, camera update, input, bridge replacement, render synchronization, and several browser-test hooks. Phaser also already has separated fog, selection, placement, health, marquee, debug, and HUD-compatible camera layers.

The first slice therefore uses deterministic composition:

```text
#game-root
  Three WebGL canvas       z=0, pointer-events:none, opaque world
  Phaser canvas            z=1, transparent, input + 2D overlays
  DOM HUD                  separate fixed overlay
```

In voxel mode Phaser's terrain, entity, and old occlusion layers are hidden, while its input and overlay layers remain live. Three renders the world and receives an explicit frame after the Phaser camera and interpolated display state are current. This gives a playable 3D result without weakening replay, interaction, or test contracts.

The mode is enabled only by `?renderer=voxel`. An absent or empty value, `?renderer=phaser`, and an unsupported value all select Phaser; failed Three initialization also falls back to Phaser with a warning. Voxel can become the default only after the promotion gate passes.

## Camera and coordinate contract

AoE simulation stays in cell coordinates. The reusable world uses right-handed `+Y` up with AoE cell `x -> +X` and cell `y -> +Z`.

The current 2:1 projection is:

```text
screenX = (cellX - cellY) * 32
screenY = (cellX + cellY) * 16
```

A Three orthographic camera at 45-degree azimuth and 30-degree elevation produces the same ground-plane basis. The adapter synchronizes it from Phaser's visible iso-pixel rectangle, not from implicit camera internals. Ground points agree with `worldToIso` through the tested camera-sync seam at the fixed viewport. Terrain elevation is an explicit projected field; it is never inferred from terrain tint or kind.

Pointer and game-command semantics remain AoE-owned. During composition, Phaser continues to convert screen points to the ground plane and to apply the established selection rules. Three raycasting cannot silently replace rules such as units taking priority over overlapping buildings, cycling stacked entities, or excluding memory ghosts.

The implemented composed adapter validates projected elevation but emits terrain columns and entity parts on elevation zero. This is deliberate: showing raised Three geometry while selection, placement, fog, health, and building-hit proxies remain on Phaser's ground plane would make the visible target disagree with interaction. The projected field remains available for a future standalone/elevation-aware host; flattening is a compatibility policy in AoE's adapter, not a limitation of the reusable package.

## Render projection corrections shipped for the slice

- `ProjectedEntityView.elevation` is populated from `TerrainComponent.elevation`; non-terrain entities default to their ground elevation until a later heightfield query is introduced.
- Fog-memory projected views retain their stored generation so a recycled live ID cannot collide with an old memory resource.
- The AoE adapter owns a monotonic render revision and renderer epoch. Simulation tick is evidence for interpolation, not the reusable package revision. Bridge replacement or replay reconstruction starts a new epoch and applies a full snapshot.

These are additive render-projection changes; they do not change gameplay or save schemas.

## First visual vocabulary

The first slice represents the complete visible world with deterministic fallback geometry, then improves named archetypes without changing the engine contract:

- terrain: shallow palette-indexed voxel columns, including explicit height where projected;
- units: block body/head compositions, scaled and colored by AoE-owned visual role and player palette;
- buildings: multi-cell block volumes with construction-height variation and roof/crown geometry owned by AoE recipes;
- trees: trunk and canopy batches;
- gold/stone/berries/relics/wildlife/farms: bounded blocky resource recipes;
- memory entities: reduced-opacity or desaturated instances, still excluded from interaction;
- selection, placement, health, fog, death/debug feedback: Phaser overlays during the composed phase.

Rigid transforms and deterministic primitive meshes are sufficient for the first slice. General skeletal crowd animation is deferred.

## Visual-quality increment: an original voxel Age-of-Empires vocabulary

The next increment replaces the two-box fallback look without turning the shared renderer into an AoE asset library. The target is immediate RTS readability at the established camera: players should distinguish a Town Center, house, farm, military hall, tower, villager, infantry, archer, cavalry, siege unit, tree, mine, forage bush, and herd animal by silhouette and material breakup before reading a label.

AoE owns deterministic procedural recipes split by visual domain. Buildings use neutral plaster, stone, timber, thatch/tile, doors, windows, beams, stepped roofs, towers, merlons, banners, market awnings, mill blades, crop rows, and construction scaffolds; faction color appears on deliberate accents instead of tinting an entire structure. Units use feet, limbs, skin, clothing, helmets, shields, weapons, mounts, wheels, and role-specific proportions; faction color stays on tunics, shields, saddle cloth, or banners. Resources use clustered canopies, irregular mineral facets, berry dots, animal bodies, and relic ornament. Sparse deterministic terrain props break up broad flat areas without changing collision, height, or picking.

All parts remain bounded rigid instances of game-owned recipes. A centred group-less cube geometry allows several material batches and rotated thin blocks while still avoiding one Three object or draw call per part. Matte, metal, shadow, and fog-memory batches provide a small material vocabulary; fixed material keys and canonical key ordering preserve deterministic snapshots. Contact shadows are procedural ground parts, not shadow-map claims. The adapter stays orchestration-only and recipe modules remain below the repository file-size ceiling.

The reusable package contributes only a configurable daylight rig: sky/ground hemisphere fill plus a target-tracked directional key light. AoE selects the warm daylight values and antialiased context; City and Townscaper may select different values without inheriting AoE palettes or recipes. True shadow maps, ambient occlusion, skeletal animation, per-civilization architecture, raised terrain, and a standalone Three overlay/input host remain later measured increments.

Acceptance requires pure recipe tests for deterministic keys, finite transforms, representative silhouettes, neutral-versus-faction color use, construction and memory treatment, and bounded part counts; adapter tests for multiple material batches and copied output; engine tests for daylight validation, tracking, borrowed-scene behavior, and disposal; then a fixed-view before/after/diff plus structural browser metrics. A pleasing image alone is not sufficient, and exact PNG hashes are not portable correctness gates.

The opt-in slice consciously accepts whole-snapshot CPU churn for this art increment rather than mixing a batching migration into the same visual change. The controlled tick-zero browser frame is bounded at 1,000 instances, four batches, eight draw calls, 16,632 triangles, five materials, and one geometry resource. Adversarial review also measured a synthetic 2,261-entity/1,436-instance adapter build at about 2.86 ms and 97.6 KiB of emitted typed arrays on that review machine, before reusable validation/copy/reconcile; this is a local reference, not a cross-machine promise. If representative browser profiling exceeds a 4 ms adapter-update budget or frame/resource counts cross the checked browser ceilings, the next optimization is static terrain/building/resource versus dynamic unit batches with independent content revisions. Until then, four whole-snapshot batches keep the contract simple and the rendering visibly within the opt-in path's budget.

## Rigid unit-animation increment

The first animation increment targets the procedural voxel parts that already exist. It does not introduce skeletons, imported character clips, or simulation-owned animation timers. The reusable `voxel` contract gains an optional per-instance harmonic transform lane: finite period and phase plus translation, Euler-rotation, and fractional-scale amplitudes. The Three presenter samples accepted affine base matrices from the injected frame clock, updates only animated slots, computes conservative motion bounds once per accepted version, coalesces partial GPU uploads to at most 64 ranges, and reports animation metrics. V1 caps one snapshot at 8,192 active slots and an active batch at 16,384 total slots, requiring larger crowds to shard. Static snapshots remain source-compatible, and an idle scene can animate without accepting or copying a new world snapshot every frame.

AoE owns the profiles. `aoeVoxelUnitAnimation.ts` maps stable part-name suffixes and the existing AoE unit role onto subtle idle breathing/bobbing, opposing humanoid arm/leg gait, horse-leg/tail and rider motion, monk sleeve/staff motion, and siege arm/wheel motion. Stable `id:generation` identity contributes a deterministic phase offset so crowds do not move in lockstep. Fog-memory ghosts, contact shadows, buildings, resources, and terrain remain static. The first slice uses renderer-side motion only; it does not claim that a swing corresponds to an authoritative attack, gather, reload, projectile, or damage tick.

The engine owns no `villager`, `archer`, `cavalry`, `idle`, `walk`, or `attack` enum. That keeps the same harmonic mechanism usable for City pedestrians/props and Townscaper wildlife/ornaments while leaving each game's state machine local. General skeletal animation, animation textures, root motion, clip blending, event markers, attack/gather synchronization, and imported assets require later contracts proven by a real consumer.

Acceptance combines pure contract and profile tests with browser evidence. With the simulation paused at one revision and camera fixed, two world captures separated in renderer time must change visible pixels while accepted/presented revisions, draw calls, instance counts, resource counts, and simulation tick stay stable. Metrics must expose animated batches, animated instances, and animation matrix updates; context loss must fence updates and restoration must sample the current injected time without an animation-time jump accumulator.

## State, ordering, and ownership

- Ordinary adapter snapshots are borrowed; the reusable runtime copies every typed array it retains.
- `applySnapshot` advances accepted state only after whole-transaction validation. Visible state changes only on `frame()`.
- Stable external identity is `id:generation` plus renderer epoch. Instance slots remain private and may move.
- A newer accepted snapshot supersedes an unpresented one. Results from a prior epoch or resource incarnation are discarded.
- Three resources, canvas listeners/observers, render targets, geometries, materials, and batches have idempotent disposal.
- `GameScene.setBridge()` starts a new renderer epoch and forces a complete adapter snapshot without recentering the established Phaser camera.
- Shutdown removes the Three canvas and disposes the runtime exactly once.

## Capture and observability

Page screenshots naturally composite the two canvases, but annotation capture currently selects one canvas. Voxel mode must provide an explicit composite capture: render Three, draw the Three canvas into an owned capture canvas, then draw the transparent Phaser overlay on top. Capture must not depend on globally enabling `preserveDrawingBuffer`.

The browser-test surface gains data-only diagnostics:

- renderer kind;
- accepted and presented revisions;
- chunk, geometry, batch, instance, draw-call, and triangle counts;
- live geometry/material/texture counts;
- discarded stale results and disposal state.

No Three.js object escapes through the test API.

## Promotion gate status

The opt-in proving slice has fixed-view before/after/diff evidence, nonblank composite and world capture, bounded renderer metrics, one runtime Three identity, bridge-epoch replacement, replay pixel changes across a revision-one epoch swap, context-loss recovery, and a browser assertion that the safe default creates no Three canvas. Those results prove the architecture, not default parity.

Voxel may become the default only when all of the following pass on the named default seed and targeted showcase seeds:

- fixed 800x600, fixed-DPR after screenshot is nonblank, aligned, and deliberately accepted against the preserved before capture;
- terrain, a rigid unit, a multi-cell building, and resources are visibly 3D and use the three separate shared data lanes as designed;
- left-click selection, right-click ground/entity commands, marquee selection, WASD/arrow pan, middle-drag pan, and wheel zoom retain behavior;
- fog, exploration memory, selection, placement preview, health bars, minimap, HUD, save/load, replay scrubbing, and annotation capture still work;
- bridge replacement creates a new renderer epoch and cannot show stale resources;
- repeated create/snapshot/frame/dispose cycles keep resource counts stable;
- voxel verification, AoE's four mandatory gates, dependency audits, targeted browser tests, and adversarial review are green.

The gate is currently unmet. In particular, elevation-aware overlay/input hit geometry is not implemented, raised-building hit proxies still derive from the hidden Phaser presentation, voxel-specific coverage has not exercised the full interaction/fog/save/replay matrix, and the composed path still computes some hidden legacy drawing work. Keeping Phaser as the default contains those limitations while the reusable renderer and opt-in path remain available for iteration.

## Explicit non-goals for the first slice

- Removing Phaser or replacing its input/overlay host.
- Perfect parity with every existing 2D procedural art detail.
- General skeletal animation, attacks, death particles, or depth-aware x-ray silhouettes in Three.
- Greedy/WASM/worker meshing, AO, propagated voxel light, transparent voxel merging, liquids, LOD, streaming, WebGPU, or smooth terrain.
- Migrating City or Townscaper in the same commit.

## Follow-on direction

Before promotion, add an elevation-aware presentation/input contract, replace raised-building hit proxies with geometry that matches the visible voxel shell, eliminate hidden legacy draw work, and run the complete voxel-specific parity matrix. After those gates pass, extract a renderer-host interface and migrate Phaser-owned overlays one behavior at a time. In parallel, prove reuse with one City instance batch and one Townscaper geometry-resource slice. Advanced meshing begins only after the documented Voxelize versus `block-mesh-rs` bake-off.
