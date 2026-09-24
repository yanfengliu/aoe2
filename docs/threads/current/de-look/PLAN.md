# A Definitive Edition art style, with Moebius kept — plan

Status (2026-09-24): found-in-passing item 1 (the ally's base not drawn under shared sight) is fixed and gated in v0.3.230, and the capture script now takes `TEAMS`; the late-game allied base capture it blocked can be taken. Item 2 shipped in v0.3.227. Nothing else in this plan moved.

Status (2026-09-23, later): step 1 shipped in v0.3.227. The DE style (menu label "Natural") ships beside Moebius, and Moebius stays the default. The coordinator decided D1 (the default flips when step 2's textured terrain lands, not at step 1) and D2 (Moebius is a treatment over the same models). The DE constants were measured on this build: ACES at exposure 1.5 kept (L=127.3, saturation 0.513), and explored ground at 0.6 rather than section 6's 0.5, which drew it at 0.383 of visible brightness through ACES. Section 9's finding 2 is fixed in BOTH styles, as the coordinator directed: unexplored ground is black, the fog edge no longer blends toward unexplored cells, and the minimap no longer shows them (defect register, 2026-09-23). So section 6's "Moebius stays today's frame, pixel for pixel" does not hold, and every Moebius pixel that moved is accounted for. Open: D3 (the HUD) is the owner's; section 9's finding 1 (allied bases not drawn under shared sight) and finding 3 (the camera cannot centre on the Town Center at 1920x1080) are untouched; step 2 is next.

Status (2026-09-23): scoped, nothing built. Step 1 is specified as a lane and ready to dispatch. Two owner questions are open: whether the DE target covers the HUD, and whether Moebius is a frozen frame or a treatment over the same models (section 8).

Written by the de-look scoping worker from main `9d660210`. Captures and experiments were taken on that revision. Evidence lives under the main checkout's ignored `tmp/`: captures in `tmp/captures/de-look/`, and the step log, measurement script, probes and experiment source in `tmp/de-look/`.

## The decision this plan serves

The owner said on 2026-09-23: *"try to make it look as close to DE as possible, which preserve the other option of moebius"*. The coordinator reads this as follows: a Definitive Edition art style becomes the default once it exists, and Moebius, today's only style, stays selectable (spec §14.5, north-star paragraph and art-style bullet). All art stays original or procedural; no Age of Empires asset is reproduced (local rules, "What done means"). The owner has not said whether the DE target reaches the HUD, so the game world is scoped first and HUD gaps are listed apart (section 7).

## Ranked summary

Ranked by visual impact per unit of work. Sizes: S is about one worker session, M is two to four, L is a week of lanes, XL is several weeks. "Voxel change" means an edit to the sibling `../voxel` repo.

| # | Gap closed | Where it lives | Approach | Size | Impact | Voxel change |
|---|---|---|---|---|---|---|
| 1 | Ink contours, tone bands and 1.4x chroma on every pixel; fog too dark or leaky | `src/rendering/` (styles, renderer, adapter), game menu, capture script | A DE style: no resolve pass, ACES tone mapping, DE fog levels. A style roster with DE the default and Moebius one menu row away | S–M | Whole frame | None |
| 2 | Terrain is one flat colour per tile, with tile-aligned seams and fog edges | `src/rendering/` (new DE terrain module), adapter | An AoE-owned shader terrain in a borrowed Three scene. It replaces the voxel terrain chunks in the DE style only | M–L | About two thirds of the frame | None (measured, E3) |
| 3 | Units are coloured by type, not by owner; chunky proportions | Owner palette (`playerColors.ts`, unit tint tables), unit recipes | One saturated colour per player on every unit's cloth at every tier, in AoE2's order; realistic proportions. Changes the spec's v0.3.60 player-colour rule | S–M | Armies, readability | None |
| 4 | Every model is built from axis-aligned cubes; trees are short blocks | Shared geometries, part type, resource recipes | Add round and sloped part shapes, then DE-proportioned trees and dense forests | M | Every base and map edge | None |
| 5 | Water is flat tiles with foam drawn along tile edges | DE terrain shader (step 2) | Depth gradient, animated ripples and glint, beaches, rolling shore foam | M | Water maps, shores | None |
| 6 | Shadows are hard 22%-opacity slabs; no ambient occlusion | Renderer | Shadow maps with AoE-owned lights. AO needs a post pass: AoE owns the draw (embedded mode) or voxel gains a pass | M–L | Depth on everything | Only for the voxel AO route |
| 7 | Buildings are squat boxes with stepped roofs and flat colour | Building recipes (after step 4); texture lane | Sloped roofs, taller walls, round towers, props, per-age versions. Surface texture needs a decision (section 5) | L–XL | Bases | Maybe (texture lane) |
| 8 | Unit bodies are box stacks | Unit recipes (after step 4) | Rounded limbs and torsos, family by family | L | Armies | None |
| 9 | No ambient life | New effect recipes | Birds with shadows, collapse dust, smoke on damaged buildings | M | Low | None |

Deferred, each XL: raised terrain (the sim, render, picking, pathing and line of sight all change; spec §14.5 keeps it deferred), DE-grade animation, and per-civilization facade geometry (spec §14.5 lists it as deferred).

## 1. What the game looks like today (measured)

All captures come from the maintained `scripts/captureMapScreenshot.mjs` against a `vite preview` of this revision on port 4614, and each was looked at at native size. Paths are relative to `tmp/captures/de-look/` in the main checkout.

| Capture | What it shows |
|---|---|
| `01-default-1920.png`, `01-default-1920-world-1x.png` | `aoe2-prototype`, fog on, default zoom 1.2, 1920x1080; the world crop is at native size |
| `02-default-800.png`, `03-default-1280.png` | The same frame at 800x600 and 1280x720 |
| `04-default-zoom24.png`, `05-default-zoom07.png` | Zoom 2.4 and zoom 0.7 |
| `06-buildings.png`, `06-buildings-center-1x.png` | `building-showcase-fixture`: every building, Imperial Age. Stands in for the late-game base (section 9, finding 1) |
| `07-units.png`, `07-units-army-2x.png`, `13-army-crowd.png`, `13-army-crowd-1x.png` | `unit-showcase-fixture`, loose and gathered into a crowd (`GATHER=22,14 TICKS=120`) |
| `08-default-t12000.png` | The default map at 20:00. The human base is idle and no AI army has arrived |
| `09-terrain-patchwork.png` | `terrain-showcase-fixture` at `FOCUS=12,10`: grass, forest, water and hill side by side |
| `01-villagers-4x.png`, `fogedge-moebius-3x.png`, `05-unexplored-x8.png` | Close crops: villagers at 4x, the fog edge at 3x, and unexplored ground with its contrast stretched 8x |

What they show:

- **The frame is Moebius.** `StylizedResolvePass` flattens tone into 4 bands (`flatten` 0.85), inks silhouettes where depth breaks, and lifts chroma 1.4x and gain 1.12x (`src/rendering/artStyles.ts`). Every unit, tree and building has a dark contour, and the grass is lime.
- **Terrain is one voxel per tile, one flat colour per tile** (`aoeVoxelTerrain.ts`, `aoeVoxelTerrainColor.ts`). Colour varies by smooth patch fields plus a per-cell grain of about ±1.6%, so the tile grid reads as a faint diamond checker. There are four kinds: grass, forest, water and hill (`src/game/simulation/terrainTints.ts`). Kind boundaries follow tile edges, softened only by a colour pull on the border cell. The world is flat: elevation is projected but drawn at zero.
- **Forest ground has no trees of its own.** In `09-terrain-patchwork.png` a forest block is a dark-green diamond with log props; the trees are separate resource entities.
- **Fog is per tile.** The adapter shades explored terrain to 0.32 and unexplored to 0.12 (`aoeVoxelAdapter.ts:111`). The visible/explored boundary is a staircase of tile diamonds (`fogedge-moebius-3x.png`). Unexplored ground is not black: stretched 8x, `05-unexplored-x8.png` shows the unexplored lakes as blue patches.
- **Every model part is one centred unit cube**, instanced per surface (`aoeVoxelResources.ts`: matte and UI parts are Lambert, metal and water are standard; only the shadow lane uses a wedge). Buildings are boxes with stepped-pyramid roofs and stripe lines (`06-buildings-center-1x.png`).
- **Proportions.** At default zoom and 1920x1080, a tile is 76.8 px wide (64 px at zoom 1, times 1.2). A villager stands about 40 px tall (`01-villagers-4x.png`). The tallest pine is about 90 px, so about 2.2 villagers. The Town Center's plinth is about 260 px wide.
- **Units are coloured by type, not by owner.** The recipes' "team" colour is `entity.tint`, which comes from `UNIT_TINTS` in `src/game/simulation/prototypeUnitRules/presentationTables.ts`. That is a pale per-type "material identity" shade: owner 1's villagers are cream, scouts yellow, spearmen green and archers light blue. Owner 2 gets each type's red-family "enemy" shade, and owners 3 to 8 rotate that hue (spec, "Player colours (implemented v0.3.60)"). At 4x the villagers read tan, because the cream tunic gets only fill light and a cloth apron covers its front (`01-villagers-4x.png`). The solid blue figure beside the Town Center is the occlusion silhouette of a villager behind it. Armour tiers also cover the tunic in steel, so the Imperial crowd in `13-army-crowd-1x.png` reads grey and brown.
- **Lighting.** Voxel's `DaylightRig` provides a hemisphere fill of 1.45 and a directional sun of 2.65 (`aoeVoxelDaylight.ts`). The sun sits high and behind the scene (`sunOffset` -22, 36, -18), so roofs are sunlit, both visible walls take only fill light, and shadows fall toward the viewer. Where a building's right face looks lighter, that is its material. Cast shadows are geometry on a 22%-opacity unlit lane, hard-edged (`aoeVoxelCastShadows.ts`). There is no ambient occlusion.
- **Water** is flat teal tiles with white foam strokes along tile edges and one lighter shore band (`aoeVoxelTerrainWaterDetail.ts`). The pools are exact tile shapes.

## 2. What Definitive Edition looks like (knowledge, not measurement)

Nothing in this section was measured: no DE install or reference image was used. Confidence is high unless marked.

- **How it is drawn.** 2D sprites pre-rendered from detailed 3D models on a fixed 2:1 isometric terrain. DE ships a 4K ("UHD") sprite set and has more facing directions and animation frames than the 1999 original. The pre-render bakes in soft form shading and ambient occlusion, so every object looks like a lit, rounded, textured miniature. No world object has an outline. The one exception is a unit behind a building, which shows a player-colour silhouette; this game already has that.
- **Terrain.** Painted, high-resolution ground textures that tile over large patterns, so no repetition or tile grid is visible. There are many kinds: several grasses, dirt, beach sand, forest floor, snow, shallows, roads and farm soil. Transitions between kinds are soft, irregular blends that do not follow tile edges. Dirt collects around buildings. Hills are smooth rolling elevation with lit and shaded slopes.
- **Light and shadow.** One warm sun is baked into all sprites. Every tree, unit and building casts a soft, semi-transparent shadow onto the ground. The light comes from the upper left and shadows fall to the lower right (medium confidence; check against a DE screenshot before moving this game's sun).
- **Units.** Near-realistic proportions and detailed armour and cloth. Player colour is strong and saturated on the largest cloth surfaces (villager shirts, tabards, shields, banners, horse caparisons), so an army reads by colour at a glance. Selection is a thin ground ring plus a slim health bar (low confidence on the exact styling).
- **Buildings.** Detailed masonry, timber framing, tiled or thatched roofs, windows, doors and props (barrels, crates, carts, hay, flags) on a dirt foundation. Each civilization group has its own architecture set, and building art changes with each age. Construction shows scaffolding stages; damage shows fire and smoke; destruction leaves rubble. Buildings stand tall over their footprints.
- **Water.** Animated ripples and moving highlights. Deep water is darker and shallows lighter. Most shores are sand beaches with foam that breaks along them.
- **Fog of war.** Unexplored is black. Explored-but-not-visible ground and last-seen buildings are darkened to roughly half brightness. The edge between states is a soft gradient, not a tile staircase.
- **Palette.** Naturalistic and warm: mid greens with olive and yellow variation, earthy browns, warm highlights and slightly cool shadows. Richer than the 1999 palette, far less saturated than Moebius, and with smooth gradients everywhere.
- **Scale (low confidence).** At 1920x1080 and default zoom, a DE tile is about 96 px wide. That would be zoom 1.5 here, but `src/input/voxelCameraController.ts` claims its 1.2 matches DE's default framing. This plan does not rank a camera change; a single DE screenshot would settle it (a measurement only, so no asset enters the repo). Trees stand three to four villagers tall (medium confidence), against 2.2 here.

## 3. The gaps, largest first

1. **Frame treatment** (whole frame; this repo). DE has no contours, smooth gradients and a natural palette. Moebius inks, bands and boosts chroma on every pixel. Lives in `src/rendering/artStyles.ts` and `AoeVoxelWorldRenderer.ts`; the pass itself is voxel's, and turning it off needs no voxel change.
2. **Terrain surface** (about two thirds of the frame; this repo). DE has painted, varied, softly blended ground with no grid. Here each tile is one flat colour, seams follow tile edges and there are four kinds. Lives in `src/rendering/voxel/aoeVoxelTerrain*.ts` and the adapter.
3. **Fog of war** (every frame edge; this repo). Here the fog edge is a tile staircase, explored ground goes near-black once the Moebius gain is removed, and unexplored ground is 12% bright rather than black. Lives in the adapter's fog factors. Soft edges come with gap 2's terrain shader.
4. **Model shapes** (every object; this repo). Everything here is cube stacks; DE shows rounded, textured models. Lives in the part vocabulary (`aoeVoxelRecipeTypes.ts`, `aoeVoxelResources.ts`) and every recipe. The voxel geometry lane already takes arbitrary triangles.
5. **Proportions and scale** (every object; this repo). Trees are short, buildings squat, units chunky. Lives in the recipes.
6. **Player colour on units** (armies; this repo). DE gives each player one colour on every unit. Here each unit type has its own tint, with one human and one enemy shade. Lives in `src/game/simulation/playerColors.ts`, the unit tint tables and the unit recipes. The spec's v0.3.60 player-colour rule describes the current model.
7. **Light depth** (every object; this repo, possibly voxel). DE has soft shadows and baked occlusion; here shadows are hard slabs and there is no occlusion. Lives in the renderer, with a voxel pass as one of the routes.
8. **Water** (water maps; this repo). Lives in terrain colour and water detail, and later in the DE terrain shader.
9. **Surface texture on models** (bases; this repo plus a texture lane). Voxel materials take no texture maps or custom shaders today.
10. **Terrain variety, elevation, animation fidelity and ambient life** (this repo; elevation also touches the simulation).

## 4. What `../voxel` can and cannot do — this decides the approach

Read from `../voxel/src/three` at its HEAD `0f8dc11`, then tested by three experiments in this worktree. None of the experiments was merged; their source is kept at `tmp/de-look/AoeVoxelWorldRenderer.experiments-E1-E3.ts`.

**Can, with no voxel change:**

- Draw any triangle geometry with per-vertex normals, colours and UVs through the geometry lane. Materials are basic, Lambert or standard, with colour, opacity, roughness, metalness, vertex colours and double-siding (`materialPresenter.ts`).
- Take a **borrowed `Scene`** in its normal runtime-rendered mode (`ThreeRenderRuntimeOptions.scene`). The runtime adds only its own root group and renders the whole scene. **E3 measured it:** an AoE-owned `ShaderMaterial` mesh in a borrowed scene was drawn, depth-composed with voxel instances and included in capture (`e3-borrowed-scene.png`). One lesson: that mesh laid 0.0005 world units over the voxel terrain's top z-fought in horizontal bands. A DE terrain must replace the terrain chunks, not overlay them.
- Take a **`rendererFactory`**, so AoE holds the `WebGLRenderer` and can set tone mapping or shadow maps on it. **E2 measured it:** ACES filmic at exposure 1.5 through the factory (`e2-v5.png`). three 0.185 switches shader programs itself when `toneMapping` changes (`WebGLRenderer.js:2482`), and tone-maps only draws to the screen. A live style switch therefore needs no runtime rebuild, and a frame drawn through an offscreen target (Moebius) is not tone-mapped.
- Switch the resolve pass live: `setStylizedResolve(options | null)`. `StylizedResolvePass` and `MOEBIUS_RESOLVE_PRESET` are exported.
- Run in **embedded host mode** (capabilities `hostModes: ['runtime-rendered', 'embedded']`). The host owns renderer, scene, camera, draw and capture, and uses frame tickets (`prepareFrame`/`commitFrame`). This is the route to custom post passes such as ambient occlusion without a voxel change, at the price of AoE owning capture and draw.
- Accept `daylight: false`, which leaves the lights to the host.

**Cannot, without a voxel change:**

- Put texture maps or custom shader code on voxel materials or instances. `MaterialPresentation` has no map or shader field. An internal material decorator exists for clustered point lights, but it is not public.
- Cast shadow maps from its own `DaylightRig`. Instance batches forward `castShadow`/`receiveShadow` to meshes, but the runtime never sets `renderer.shadowMap.enabled` or `light.castShadow`. AoE's batches do not set the flags either.
- Run any post pass except the stylized resolve in runtime-rendered mode.
- Change daylight after construction: there is no setter.

**E1: the resolve pass removed.** Measured over the 236,681 pixels lit in the Moebius frame, inside an 800x420 region of the 1920x1080 default view (method in the appendix):

| Frame | Mean L | Mean saturation |
|---|---|---|
| Moebius, today (`e1-nopass-before.png`) | 113.0 | 0.610 |
| No pass (`e1-nopass-after.png`; the old Painted) | 98.6 | 0.475 |
| No pass, ACES, exposure 1.35, sun 3.1 (`e2-v4.png`) | 124.4 | 0.524 |
| No pass, ACES, exposure 1.5 (`e2-v5.png`) | 126.1 | 0.516 |
| No pass, AgX, exposure 1.3 (`e2-v2.png`) | 117.1 | 0.391 (washed out) |
| No pass, Khronos Neutral, exposure 1.1 (`e2-v3.png`) | 90.6 | 0.701 (darker, deeper greens) |

Removing the pass changed 72.63% of the 1920x1080 frame (`e1-nopass-diff.png`). The contours and bands go and the grass turns olive; on its own the frame is dull (`e1-nopass-after-world-1x.png`). ACES at exposure 1.5 gives a sunlit, natural frame (`e2-v5-world-1x.png`), and exposure alone matches a brighter sun, so the DE style needs no daylight setter. The fog staircase is per tile in both styles (`fogedge-moebius-3x.png` and `fogedge-de-v5-3x.png` at 3x). Without Moebius's gain, explored ground at 0.32 reads near-black.

## 5. Ways to close each gap: cost and risk

Every step is its own lane in its own worktree, made by `scripts/controlWorktree.mjs`. Each proves itself with before and after captures, a pixel diff, and a `STYLE=moebius` control diff of zero where Moebius should not move.

**Step 1 — the DE grade and the style roster.** Specified in full in section 6.

**Step 2 — DE terrain surface.** In the DE style the adapter leaves the terrain chunks out of the voxel snapshot, and the renderer draws an AoE-owned terrain mesh in a borrowed scene. The mesh is one quad per tile, grouped by 16x16 chunk to match invalidation, with a `ShaderMaterial`:

- A per-cell data texture (RGBA8, map width x height: kind, visual sub-kind, seed) and a per-cell fog texture. The fog texture uses linear filtering, which gives soft edges.
- Procedural world-space textures per kind, from a few octaves of value noise: grass with cool and warm patches, specks and blades; darker forest floor with leaf litter; drier hill grass; beach sand. No image files. E3's 15-line version already removed the tile grid.
- Soft, irregular transitions: the neighbour kind blends across each cell border through a noise-warped smoothstep.
- Visual-only variety derived from entity footprints: dirt under and around buildings and on worn paths. Nothing is written back to the simulation.
- Fog: unexplored black, explored at about half brightness. The soft edge reaches at most half a tile into non-visible cells. Entity fog rules are untouched; this shades ground only.
- The same sun and hemisphere as the models, fed from `AOE_DAYLIGHT` as uniforms.
- Any animation reads the renderer's animation clock (simulation display time), never wall-clock time, so a paused frame stays byte-identical.

Cost M–L: a module family of about 400–600 lines plus tests, split to stay under the 500-line cap. Risks and their gates:

- **Fog honesty.** Assert a luma ceiling on every unexplored cell, and bound the soft margin.
- **CPU capture cost.** The capture script runs Chromium on SwiftShader, so a per-pixel noise shader costs more there. Time the captures before and after.
- **Context loss.** Three.js rebuilds its own objects, but add a browser check that the terrain survives `WEBGL_lose_context`.
- **Z-fighting.** Replace the voxel terrain rather than overlay it (E3).

Picking is unaffected, because ground picks are analytic. Moebius keeps the voxel terrain.

Fallback: a vertex-coloured, subdivided terrain through voxel's geometry lane. It needs no borrowed scene and still smooths seams, but it cannot reach pixel-level texture, and every fog change re-uploads colour arrays. Use it only if the borrowed-scene route fails the context-loss or capture gate.

**Step 3 — DE player colours and proportions on units.** Today a unit's cloth colour is its type's pale tint, so one player's army reads as a mix of type colours (`07-units-army-2x.png`). DE gives each player one saturated colour on every unit's cloth, with natural materials everywhere else. The colours follow AoE2's player order: blue, red, green, yellow, cyan, purple, grey, orange.

The approach:

- An owner palette in that order.
- The recipes put it on cloth parts at every tier: villager shirts, a tabard or surcoat over armour, shields, caparisons and banners.
- Type identity moves to shape and equipment. The spec already gives each of the 34 types its own equipment profile.
- Buildings' owner roof blend (v0.3.83) and flags take the same palette. The minimap draws each entity with its tint, so it follows.
- Lengthen legs and shrink heads toward realistic proportions.

Measure the share of each unit's pixels in its owner's hue at default zoom, before and after.

This changes the spec's "Player colours (implemented v0.3.60)" rule, and with it every screenshot and characterization hash of a 1v1. Those updates are deliberate and must be named in the change. The tint is simulation-seeded today. A DE-only palette (decision D2) would therefore mean resolving colour on the render side, from owner and part role.

Cost S–M, in `playerColors.ts`, `prototypeUnitRules/presentationTables.ts`, `aoeVoxelUnitHumanoidRecipes.ts`, `aoeVoxelUnitMountedRecipes.ts` and `aoeVoxelUnitVisualProfiles.ts`. Risk: the spec's "every tier is visually distinguishable" rule (v0.3.46) must still hold. Hit proxies and occlusion silhouettes derive from the same recipes, so they follow.

**Step 4 — round shapes, then DE trees and forests.** Add shared geometries to `aoeVoxelResources.ts`: a cylinder or frustum, a cone, a low-poly ellipsoid, a wedge or prism, and a bevelled box. Add `VoxelPart.shape`, defaulting to the cube, and key batches by shape and surface. The hit proxy keeps box bounds, which are conservative; shadow profiles use part bounds. Then rebuild trees at 2.5–3 tiles tall, with lobed round canopies, darker greens and visible trunks, packed into dense forests. Cost M. Risks: draw calls grow with the number of shapes (watch `metrics().drawCalls`), shadows of round parts are approximate, and the change reaches Moebius too (decision D2).

**Step 5 — water.** Inside the DE terrain shader:

- a depth gradient from a CPU distance-to-shore field packed into the data texture
- animated ripples and sun glint, driven by the animation clock
- sand beaches on land cells that touch water
- a foam line rolling along the shore

In the DE style this replaces the water-detail props. Cost M. Risk: animation determinism, for the same reason as step 2.

**Step 6 — soft shadows and ambient occlusion.** Shadow maps need no voxel change:

- Construct with `daylight: false`, and let AoE add its own hemisphere and directional lights to the borrowed scene. The directional light casts shadows through an orthographic shadow camera fitted to the view.
- `rendererFactory` turns on `shadowMap` with PCF soft filtering.
- AoE's batches set `castShadow` and `receiveShadow`.
- The DE style drops the geometric shadow lane.

Because daylight is fixed at construction, AoE should own the lights for both styles and reproduce `DaylightRig` exactly, with a zero-pixel Moebius diff as the gate. The alternative is recreating the runtime on every style switch.

Ambient occlusion needs a post pass. There are two routes: embedded host mode, where AoE owns draw and capture, or an opt-in AO pass in voxel next to `StylizedResolvePass`. The voxel pass would be game-neutral and useful to City and Townscaper. It is a sibling-repo change and needs independent review. Cost M–L. Risks: shadow acne and peter-panning with an orthographic camera, shadow-map resolution over the whole visible map, and CPU-render cost.

**Step 7 — buildings.** Using step 4's shapes: sloped roofs instead of stepped pyramids, taller walls, round towers, timber framing, props and dirt foundations, then DE's per-age versions. Surface texture has three routes, and the choice should come from a prototype after steps 4 and 6:

- vertex-colour noise baked into shared geometries: cheap and coarse
- a public shader or texture lane on voxel materials: a voxel change
- AoE-owned instanced meshes in the borrowed scene for DE buildings: AoE then also owns their fog-memory material, occlusion silhouettes and draw order

Cost L–XL.

**Step 8 — unit shapes and detail.** Work family by family (humanoid, mounted, siege, ship, monk): rounded limbs and torsos, better heads, horse anatomy. Cost L.

**Step 9 — ambient life and effects.** Birds with shadows over the map, dust when a building falls, smoke and fire on damaged buildings, and corpses that decay. Check what the damage states already draw first. Cost M; low impact.

## 6. Step 1, specified as a lane

**Lane DE-1: a Definitive Edition style, made the default, with Moebius one menu row away.**

- **Owner:** one implementer. The coordinator integrates.
- **Workspace:** `node scripts/controlWorktree.mjs create de-style` from the main checkout. Never the harness's worktree isolation. Use `npx`/`node` directly, since npm scripts exit 127 in a worktree, and a `PREVIEW_PORT` of its own.
- **Base:** main at dispatch.
- **Kind:** implementation. TDD: contract tests first.

**Outcome.**

1. Two art styles ship, `de` (the default) and `moebius`.
2. The DE style draws the frame without the stylized resolve pass. It tone-maps with ACES filmic at an exposure tuned against frames; start at 1.5, where E2 measured L=126.1 and saturation 0.516 on the lit default-view mask.
3. The DE style draws fog at DE levels: explored ground at about half brightness (start at 0.5) and unexplored ground black (0).
4. Moebius stays today's frame, pixel for pixel.
5. A row in the game menu switches styles live, without a reload. The choice persists in `localStorage` under `aoe2:art-style` and fails soft: an unknown or unreadable value falls back to the default. That includes a `painted` stored before v0.3.196.
6. `scripts/captureMapScreenshot.mjs` takes `STYLE=de|moebius` again.
7. The style never enters saves or replays, as before.

**Contracts.**

- `src/rendering/artStyles.ts` owns the roster:
  - `ArtStyleId = 'de' | 'moebius'` and `DEFAULT_ART_STYLE_ID = 'de'`.
  - Each style is `{ id, label, resolve: StylizedResolveOptions | null, toneMapping: 'none' | 'aces-filmic', exposure, fog: { explored, unexplored } }`.
  - Moebius keeps `MOEBIUS_RESOLVE` with `'none'`, exposure 1 and fog 0.32/0.12 (today's literals).
  - Every DE constant records the frame measurement it was chosen against, as the Moebius comment does now. Keep the Painted baseline in that comment.
- `AoeVoxelWorldRenderer`:
  - Constructs the runtime with a `rendererFactory` that keeps its `WebGLRenderer` and applies the style's tone mapping and exposure, plus the style's `stylizedResolve`.
  - `setArtStyle(id)` calls `runtime.setStylizedResolve(style.resolve)` and sets `renderer.toneMapping` and `toneMappingExposure`. It then hands the fog factors to the adapter, which uses them from the next snapshot on.
  - Daylight is unchanged: E2 showed exposure alone gives the brighter frame.
- The adapter reads its fog factors from the style instead of the literals at `aoeVoxelAdapter.ts:111`.

**Files.** Most of the machinery existed. It was added in `578559cf` and removed in `0ab55126`, so `git show 0ab55126^:<path>` recovers each piece.

- `src/rendering/artStyles.ts`
- `src/rendering/artStylePreference.ts` (restored)
- `src/rendering/voxel/AoeVoxelWorldRenderer.ts`
- `src/rendering/voxel/aoeVoxelAdapter.ts`
- `src/app/AoeVoxelGameView.ts`
- `src/app/bootstrap/createApp.ts`
- `src/ui/hud/gameMenu.ts`, `hudTemplate.ts`, `createHudController.ts` and `icons/menuGlyphs.ts` (the menu row and its glyph)
- `scripts/captureMapScreenshot.mjs`

Tests:

- `tests/rendering/artStyles.test.ts`: the roster and its default; Moebius's four measured departures still gated; the DE values gated.
- A preference test: read and write, an unknown id, a storage that throws.
- `tests/rendering/AoeVoxelWorldRenderer.test.ts`: construction per style, and `setArtStyle` switching the resolve, the tone mapping and the fog factors. Moebius gets no tone mapping and exposure 1.
- An adapter fog test covering both styles, with the overlays suite's near-black assertion still holding.
- `tests/ui/gameMenuArtStyle.test.ts` (restored) and `tests/ui/gameMenuIcons.test.ts`.
- A browser test that clicks the real menu row, sees the style change, reloads, and sees it persist. Extend `tests/browser/game-hud-and-camera-hud.spec.ts` or add a spec.

Docs:

- `design/spec-final.md` §14.5 art-style bullet: two styles ship, DE is the default, what DE is, and its gates.
- `docs/policies/local-rules.md`: the capture script's list of variables gains `STYLE`.
- `docs/changelog.md`, a `c` version bump (the change is user-visible), and the devlog.
- `docs/architecture/ARCHITECTURE.md`, only if it describes the single-style renderer.

**Excluded.** No voxel change, no palette or recipe change, no terrain change, no daylight change, no HUD chrome change.

**Visual proof.** Use the maintained pair (`captureMapScreenshot.mjs` and `diffMapScreenshots.mjs`) with `TICKS=1` on both sides at 1920x1080 unless noted.

1. **Before, on the base build.**
   - `LABEL=de1-moebius-before` and `LABEL=de1-default-before`: the same `aoe2-prototype` frame, taken twice so each diff has its own stem.
   - `SEED=building-showcase-fixture LABEL=de1-buildings-before`.
   - `SEED=unit-showcase-fixture LABEL=de1-units-before`.
2. **Moebius is preserved.** Capture `STYLE=moebius LABEL=de1-moebius-after`, then diff with `LABEL=de1-moebius`. The diff must report **0 changed pixels**. `TICKS=1` pairs measured exact on 2026-09-02 (local rules, "Rendering is inspected from several angles"), so any count above zero is a defect to explain, not noise.
3. **DE is the default.** Capture with no `STYLE` as `LABEL=de1-default-after`, then diff with `LABEL=de1-default`. Expect the world canvas to change, and the translucent HUD panels over it, whose glass shows the world. E1 measured 72.63% for removing the pass alone. The HUD's own text and controls must not change: crop the resource bar at 2x on both sides.
4. **Measure the grade.** Use the appendix method on the default frame and both showcases. Record the DE numbers in `artStyles.ts`. E2's v5 gives the expected neighbourhood: L about 126, saturation about 0.52.
5. **Inspect at native size.** The world crop at 1x, and villagers at 4x with no contour. The fog edge at 3x: explored ground reads as dimmed ground, unexplored as black. An 8x stretch of an unexplored region shows no terrain pattern (compare `05-unexplored-x8.png`).
6. **Sweep.**
   - 800x600 and 1280x720 at default zoom; `ZOOM=0.7`.
   - `ZOOM=2.4 FOCUS=10,10` at 800x600. At 1920x1080 the camera will not centre there (section 9, finding 3).
   - Both showcases, and a `TICKS=12000` frame.
   - `STYLE=moebius` of each as the control.
   - Then a whole-frame look for anything wrong.
7. **Live switch.** The browser test above.

**Verification.** In the worktree: `npx vitest run <affected files>`, `npx tsc --noEmit` and `npx eslint <paths>`. The integrator runs `npm run verify` on main after the merge.

**Handoff.** The branch, the capture set with its diff counts, the measured DE constants, and anything that moved in Moebius.

**Size and risk.** Size S–M. Low technical risk. The main risk is the owner reading DE v0 as the Painted style withdrawn on 2026-09-03. DE v0 differs from Painted in tone mapping, exposure and fog levels, but it keeps the same models and flat terrain (decision D1).

## 7. HUD gaps (pending the owner's answer)

The owner set a modern HUD on 2026-08-18 (spec §14.1, local rules "HUD styling: modern, not medieval"), and the 2026-09-23 decision does not mention it. DE's HUD art is copyrighted, so a DE-like HUD would still have to be original.

- **H1 chrome.** Ours is dark glass with one hairline border. DE uses themed panels per civilization, in stone, wood or metal, with emblems.
- **H2 layout.** DE has a full-width bottom panel (command grid left, selection in the centre, minimap right) and a resource strip at the top left. Ours has floating panels: selection and commands at the bottom left, the minimap at the bottom right, and a full-width top bar.
- **H3 icons.** DE uses painted portraits for units, buildings and technologies. Ours are procedural SVG glyphs, with letters in circles for units in the command deck (`13-army-crowd.png`). Original painted-style portraits would be a large procedural-art job.
- **H4 resource bar.** DE shows villagers per resource beside each stockpile. Ours shows totals, age, population and time.
- **H5 type.** DE uses a display serif; ours uses IBM Plex Sans.
- **H6 minimap.** DE's minimap has terrain colours and normal, combat and economy modes. Ours is a diamond in a sunken well. Not compared in detail.
- **H7 cursors and in-world UI.** DE has themed cursors and slim selection rings. Ours marks selection with thick yellow cell diamonds and green bars (`13-army-crowd-1x.png`). Low confidence on DE's exact styling.

## 8. Decisions for the coordinator and the owner

- **D1: when the default flips.** Recommend flipping at step 1, as the coordinator reads the owner's words. The DE frame is closer to DE on contours, palette and fog. The risk is named in section 6, and the fallback is one constant, `DEFAULT_ART_STYLE_ID`. The alternative is to hold the flip until step 2 lands, when the terrain first looks DE-specific.
- **D2: is Moebius a frozen frame, or a treatment over the same models?** Recommend a treatment. There would be one set of recipes and colours and two frame treatments: steps 3, 4, 7 and 8 change both styles, and steps 1, 2, 5 and 6 are DE-only. Freezing Moebius instead would fork every recipe and the owner palette by style and double their upkeep. Step 3 also rewrites the spec's v0.3.60 player-colour rule, whichever way this goes.
- **D3: HUD** in or out of the DE target. This is the owner's question.
- **D4: ambient occlusion and model texture.** Choose between a voxel feature and AoE owning the draw (embedded mode). Needed only at steps 6 and 7.

## 9. Found in passing

1. **Allied units, buildings and base resources are not drawn under DE shared sight (defect).**
   - How it was seen: with `?players=3&teams=1,1,2`, the ally's ground is lit but its base is empty. Captures `10-allied-t18000-zoomout.png`, `11-allied-t18000-allybase.png` (30:00) and `12-allied-t3000-allybase.png` (5:00). The trees and mines around the ally's base are missing too.
   - The probe, `tmp/de-look/alliedEntitiesProbe.mjs` (browser test API, tick 3000): owner 2 has a Town Center at (62, 9), 3 buildings and 7 units. `getDisplayedEntities()` holds 0 owner-2 entities, against 9 for owner 1 and 3,198 unowned.
   - Why it is wrong: the spec's "Cartography (implemented v0.3.63, RETIRED v0.3.140)" paragraph, filed under §10.9, makes allied shared sight the default, with allies' visible cells unioned into the projected frame.
   - Not investigated further. It also blocked the honest late-game-base capture, so the building showcase stands in. Because the user did not report it, whether it gets a register entry and a gate is the coordinator's call.
2. **Unexplored ground leaks the map.** It is drawn at 12% brightness, and an 8x stretch of `05-default-zoom07.png` shows the unexplored lakes (`05-unexplored-x8.png`). DE draws unexplored as black. Step 1 fixes the DE style only; Moebius keeps 0.12 unless the coordinator decides otherwise.
3. **The camera cannot centre on the home Town Center at 1920x1080.** The Town Center (cells 8–11) opens about 180 px above centre at zoom 1.2. With `FOCUS=10,10 ZOOM=2.4` it sits at the top edge under the HUD (`04b-default-zoom24-tc.png`). The hypothesis, not tested, is the clamp that keeps the map's top corner on screen. DE lets the view go past the map edge.

## 10. What this plan did not check

- DE itself. Every DE statement is knowledge. The sun direction, the default scale and the selection styling are low or medium confidence.
- A real late-game base (blocked by finding 1) and a real AI army at the human base. At 20:00 on the default map none had arrived (`08-default-t12000.png`).
- GPU rendering. Every capture is SwiftShader, as the capture script launches Chromium. Colours should hold on a GPU; costs will not.
- Motion. Stills only: no animation, water motion or live style switch was watched.
- Performance of any approach: frame time, draw calls and capture time.
- Other maps (Arena, Black Forest, islands) and high-DPI rendering at pixel ratio 2.
- The minimap and the HUD beyond the default captures.
- Context loss with a borrowed-scene mesh. E3 proved draw, depth and capture, not restoration.
- Whether the explored-fog level and the ACES exposure look right on the owner's display.

## Appendix: how the evidence was taken

A worktree build (`npx vite build`) served by `npx vite preview --host 127.0.0.1 --port 4614 --strictPort`, captured with the maintained script, for example:

    PREVIEW_PORT=4614 LABEL=de-look/01-default-1920 SIZE=1920x1080 node scripts/captureMapScreenshot.mjs
    PREVIEW_PORT=4614 LABEL=de-look/e1-nopass-before SIZE=1920x1080 TICKS=1 node scripts/captureMapScreenshot.mjs
    OUT_DIR=tmp/captures LABEL=de-look/e1-nopass node scripts/diffMapScreenshots.mjs

The allied captures passed `teams` through the script's query string with `SEED='aoe2-prototype&teams=1,1,2' PLAYERS=3`. The capture script has no `TEAMS` variable.

Frame measurement (`tmp/de-look/frameStats.mjs`):

1. Take a reference frame, here the Moebius default view.
2. Build a mask of the pixels whose luma (0.2126 R + 0.7152 G + 0.0722 B) exceeds 40 inside 800x420 at (600, 100) of the 1920x1080 frame. That is 236,681 pixels.
3. Over that same mask, report each frame's mean R, G, B and luma, and its mean saturation, (max - min) / max.

Fixing the mask keeps every variant measured over the same pixels, so unexplored black does not dilute them. Promote the script to `scripts/` if later lanes tune against it.
