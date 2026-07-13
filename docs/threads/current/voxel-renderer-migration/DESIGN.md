# Isometric voxel renderer migration — design

Status: voxel-only runtime implemented, verified, and locally approved on 2026-07-13. Three/`voxel` is the only source of world and world-overlay pixels, with one interactive canvas, no renderer flag, no fallback renderer, and no Phaser dependency. The DOM HUD and minimap remain product UI rather than a second world renderer. User direction: co-edit AoE2 into an isometric voxel presentation while building reusable graphics code in the sibling `voxel` repository for City and Townscaper.

## Voxel-only graphics decision

The promotion gate is no longer a future option. AoE2 has one graphics direction going forward:

- terrain, resources, buildings, units, fog, selection, placement, health, and hit/death feedback are emitted through AoE-owned voxel snapshot data and presented by the reusable Three runtime; debug summaries remain DOM text rather than a second world-paint path;
- no URL parameter, initialization error, or compatibility branch may reactivate the Phaser world renderer;
- voxel initialization failure is terminal and visible instead of silently changing art and interaction semantics;
- legacy Phaser painters, hidden render layers, their painter-only diagnostics, and two-canvas composite capture are removed;
- `AoeVoxelGameView` owns the browser frame loop and composes renderer-neutral camera, pointer, selection, and presentation controllers around the sole voxel canvas;
- the DOM HUD, dialogs, timeline, and minimap remain normal UI. They do not duplicate the playable world renderer and are outside the voxel-art contract.

The standalone host preserves the existing bridge, replay, HUD, annotation, and browser-test seams while removing the obsolete renderer and its second canvas. Input hit rules remain AoE-owned: exact targets come from recipe-projected silhouettes plus the established ground fallback, are promoted only with the matching presented epoch/revision, and are fenced while the renderer is lost or presentation is stale. Repeated exact clicks cycle distinct current semantic groups; prior hits are an ordering hint only, never a selectable cache. Reusable snapshot, recipe, capture, and presentation contracts do not gain game semantics.

Increment 9 deletes the legacy painter tree and painter-only tests, removes renderer selection and composite capture, removes Phaser from the dependency graph and production bundle, and replaces hidden-painter diagnostics with voxel snapshot/metrics plus one-canvas browser assertions.

## Product outcome

AoE2 now always presents its playable world as real lit 3D, with voxel terrain and deterministic procedural units, buildings, resources, fog shading, and world feedback. The sole path preserves the authoritative simulation, saves, replays, DOM HUD, fog semantics, command behavior, selection behavior, and automated playtest surface. An AoE-owned CPU hit proxy projects the same rigid-part recipes as the adapter, so raised entity silhouettes are interactive without coupling renderer-neutral input to Three.js. Raised terrain/cliffs and a generic presented-state ray query remain future reusable work rather than a reason to retain a second renderer.

The migration must remain original/procedural art. It may evoke the readability and 2:1 presentation of Age of Empires II but may not copy its assets.

## Cross-game boundary

AoE2 is the first proving consumer, not the owner of the reusable API. The sibling package exposes three independent data lanes:

1. `VoxelChunkV1` for palette-indexed terrain or occupancy volumes.
2. `GeometryResourceV1` for deterministic consumer-authored meshes, including Townscaper's irregular connected shells.
3. `InstanceBatchV1` for repeated rigid objects, including AoE units/buildings/resources and City buildings/vehicles/trees.

The package owns validation, copied ingest, epochs, accepted/presented revisions, mesh presentation, instance allocation, camera math, capture, metrics, and disposal. AoE2 owns unit/building/resource visual roles, player palettes, fog memory, selection priority, health, placement, commands, animation meaning, and translation from `ProjectedEntityView`.

No shared type may contain AoE terms such as unit, building, owner, fog, health, construction, command, or civilization. City roads/zones and Townscaper facades/stories/massing rules are equally excluded.

## Historical composed-slice rationale (superseded by Increment 9)

The sections below preserve the decisions and evidence that led from an opt-in composed proof to the mandatory standalone renderer. Any statement below that Phaser is the default, that `?renderer=voxel` is required, or that two canvases compose the world is historical and superseded by the voxel-only decision above. The reusable boundary, recipe ownership, animation, revision, lifecycle, and performance contracts remain current unless explicitly superseded.

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

The opt-in slice still accepts whole-snapshot CPU churn, but the animation workload now uses six stable lanes: static and animated matte, static and animated metal, contact shadow, and memory. The split is required by the reusable engine's 16,384-total-slot ceiling for any batch containing active motion; static scenery can now grow to the ordinary declared batch limit without one animated unit lowering that ceiling. Active ambient identities are admitted deterministically up to the engine's 8,192-slot snapshot budget and overflow identities retain their baked static pose. The controlled browser frame remains 1,000 instances and 16,632 triangles; the gait proof records six batches, two animated batches, ten draw calls, five materials, and one geometry resource. Independent content revisions and spatial/archetype sharding remain later optimizations if representative adapter updates exceed the documented 4 ms local budget or browser resource ceilings.

## Rigid unit-animation increment

The first animation increment targets the procedural voxel parts that already exist. It does not introduce skeletons, imported character clips, or simulation-owned animation timers. The reusable `voxel` contract gains an optional per-instance harmonic transform lane: finite period and phase plus translation, Euler-rotation, and fractional-scale amplitudes. The Three presenter samples accepted affine base matrices from the injected frame clock, updates only animated slots, computes conservative motion bounds once per accepted version, coalesces partial GPU uploads to at most 64 ranges, and reports animation metrics. V1 caps one snapshot at 8,192 active slots and an active batch at 16,384 total slots, requiring larger crowds to shard. Static snapshots remain source-compatible, and an idle scene can animate without accepting or copying a new world snapshot every frame.

AoE owns the profiles. `aoeVoxelUnitAnimation.ts` maps stable part-name suffixes and the existing AoE unit role onto subtle idle breathing/bobbing, opposing humanoid arm/leg gait, horse-leg/tail and rider motion, monk sleeve/staff motion, and siege arm/wheel motion. Stable `id:generation` identity contributes a deterministic phase offset so crowds do not move in lockstep. Fog-memory ghosts, contact shadows, buildings, resources, and terrain remain static. The first slice uses renderer-side motion only; it does not claim that a swing corresponds to an authoritative attack, gather, reload, projectile, or damage tick.

The engine owns no `villager`, `archer`, `cavalry`, `idle`, `walk`, or `attack` enum. That keeps the same harmonic mechanism usable for City pedestrians/props and Townscaper wildlife/ornaments while leaving each game's state machine local. General skeletal animation, animation textures, root motion, clip blending, event markers, attack/gather synchronization, and imported assets require later contracts proven by a real consumer.

Acceptance combines pure contract and profile tests with browser evidence. With the simulation paused at one revision and camera fixed, two world captures separated in renderer time must change visible pixels while accepted/presented revisions, draw calls, instance counts, resource counts, and simulation tick stay stable. Metrics must expose animated batches, animated instances, and animation matrix updates; context loss must fence updates and restoration must sample the current injected time without an animation-time jump accumulator.

## Speed-matched gait increment

Locomotion follows the interpolated position that AoE actually presents, not an authoritative intent flag. `sceneRenderer` emits that displayed position with simulation display time, `(tick + interpolationAlpha) * 1000 / TPS`, so manual/replay pause freezes samples even though Phaser's renderer clock and selection feedback continue. Replay pause preserves its current accumulator and interpolation alpha, and its first resumed frame contributes zero elapsed time; only genuinely fresh playback receives the established immediate first tick. The AoE adapter retains bounded gait history per `id:generation`: the last displayed position and sample time, a wrapped gait phase, locomotion weight, and eased movement direction. Bridge replacement, generation replacement, disappearance, memory projection, or a rewound clock starts fresh history rather than inheriting motion. There is no guessed teleport-distance threshold; a future true teleport must carry an explicit discontinuity through generation or epoch rather than risking misclassification of legitimate fast or catch-up movement.

Each accepted render sample advances gait phase by displayed distance divided by an AoE-owned stride length. That phase is baked into AoE's ordinary rigid-part transforms: it does not become a clock-driven locomotion period. Consequently two half-distance samples equal one full-distance sample, a paused or stopped root cannot keep walking in place, and faster displayed motion traverses more gait phase in the same time. Injected sample time is used only to derive displayed speed and a short bounded locomotion-weight ramp that softens starts and stops; it never advances phase or changes authoritative position.

Feet become visible moving parts rather than cubes that only rotate around their own centres. Humanoid boots translate fore/aft along the eased displayed movement direction and lift above their authored ground contact with opposing phases. Direction-aligned pitch rotates the pose around the horizontal axis perpendicular to travel, and transformed-corner clearance keeps boots and horse legs above ground for X, Z, and diagonal movement. Legs and arms remain paired half a cycle apart, body bob is restrained, cavalry legs use the same distance-driven cadence with a longer role stride, and ambient tail/staff motion keeps independent identity-phased timing. Memory ghosts and contact shadows stay static. Slow movement produces proportionally slower and smaller steps; faster displayed movement produces faster cadence without changing root position.

No reusable snapshot schema changes. The shared engine remains a pure, history-free sampler of `snapshot + injected nowMs`; stride length, distance accumulation, speed estimation, foot planting, role profiles, and transition policy are game semantics. Its existing harmonic lane continues to own ambient breathing, tails, staffs, and machinery that may move without root displacement. City vehicles and Townscaper route animation can use different continuity rules. A reusable externally sampled pose lane should be considered only after another consumer proves the same data contract, not in anticipation of one.

Acceptance requires tests for cadence versus displayed speed, split-distance phase invariance, opposing feet, X/Z/diagonal pitch alignment, positive transformed-corner clearance, eased corners, pause-redraw invariance, deterministic identical input/time sequences, active/static batch ceilings, all-or-none canonical identity admission, static fallback for unsupported animated surfaces, and generation/disappearance/bridge/clock-rewind reset semantics. Browser evidence must command a live unit, inspect its distance phase/speed/weight/sample time through a bounded data-only seam, prove a half-tick root, freeze that state across selection-forced pause redraws, resume it, and wait for accepted/presented parity before capture while draw calls, resources, and simulation authority remain bounded.

## State, ordering, and ownership

- Ordinary adapter snapshots are borrowed; the reusable runtime copies every typed array it retains.
- `applySnapshot` advances accepted state only after whole-transaction validation. Visible state changes only on `frame()`.
- Stable external identity is `id:generation` plus renderer epoch. Instance slots remain private and may move.
- A newer accepted snapshot supersedes an unpresented one. Results from a prior epoch or resource incarnation are discarded.
- Three resources, canvas listeners/observers, render targets, geometries, materials, and batches have idempotent disposal.
- `AoeVoxelGameView.setBridge()` starts a new renderer epoch and forces a complete adapter snapshot without recentering the established voxel camera.
- Shutdown removes the Three canvas and disposes the runtime exactly once.

## Capture and observability

The sole world canvas is captured directly through `ThreeRenderRuntime.capture()` with `preserveDrawingBuffer:false`. `AoeVoxelGameView.getWorldCapture()` first drives a frame, so an accepted pending snapshot is reconciled and the returned manifest identifies the epoch and presented revision that produced the pixels. Annotation capture consumes that direct data URL; page screenshots separately include the DOM HUD and minimap.

The browser-test surface gains data-only diagnostics:

- renderer kind;
- accepted and presented revisions;
- chunk, geometry, batch, instance, draw-call, and triangle counts;
- live geometry/material/texture counts;
- discarded stale results and disposal state.

No Three.js object escapes through the test API.

## Mandatory-path gate status

The user superseded the optional promotion decision: voxel is now the only world graphics path. The migration is acceptable only when all of the following pass on the named default seed and targeted showcase seeds:

- fixed 800x600, fixed-DPR after screenshot is nonblank, aligned, and deliberately accepted against the preserved before capture;
- terrain, a rigid unit, a multi-cell building, and resources are visibly 3D and use the three separate shared data lanes as designed;
- left-click selection, right-click ground/entity commands, marquee selection, WASD/arrow pan, middle-drag pan, and wheel zoom retain behavior;
- fog, exploration memory, selection, placement preview, health bars, minimap, HUD, save/load, replay scrubbing, and annotation capture still work;
- bridge replacement creates a new renderer epoch and cannot show stale resources;
- repeated snapshot/frame/rebuild cycles keep resource counts bounded and disposal remains idempotent;
- voxel verification, AoE's four mandatory gates, dependency audits, targeted browser tests, and adversarial review are green.

The implementation removes the fallback instead of hiding its limitations. Terrain remains elevation-zero; entity picking follows the current presented recipe-derived silhouettes, while geometry-aware raised-terrain picking is a named future voxel feature. Selection and death cues are currently static rigid parts, and the old white behind-building x-ray is intentionally absent until a depth-aware voxel pass exists. There is no hidden painter or alternate renderer masking those boundaries. Exact final gate, visual, and review evidence lives in `PLAN.md`, the linked detailed devlog, and `2026-07-13/7/REVIEW.md`.

## Explicit non-goals for the standalone slice

- Preserving pixel parity with the deleted 2D procedural painter.
- General skeletal animation, event-synchronized attacks, projectile clips, or depth-aware x-ray silhouettes in Three.
- Greedy/WASM/worker meshing, AO, propagated voxel light, transparent voxel merging, liquids, LOD, streaming, WebGPU, or smooth terrain.
- Migrating City or Townscaper in the same commit.

## Follow-on direction

Add elevation-aware terrain presentation and a generic presented-state query together, then consider depth-aware unit visibility and richer event-synchronized animation from measured gameplay needs. Split static world data from interpolated unit/interaction deltas before scaling scene size. Prove reuse with one City instance-batch consumer and one Townscaper geometry-resource consumer before generalizing the AoE host. Advanced meshing begins only after the documented Voxelize versus `block-mesh-rs` bake-off.
