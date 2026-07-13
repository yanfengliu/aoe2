# AoE2 Implementation Plan

> Historical baseline: the original Phaser stack, directory, and bootstrap
> steps below describe the prototype's first implementation. KAD-0022 and
> `docs/threads/current/voxel-renderer-migration/PLAN.md` supersede those
> rendering steps as of 2026-07-13: AoE2 now ships only the standalone
> Three/`voxel` world path.

## Purpose

This document turns [spec-final.md](<C:/Users/38909/Documents/github/aoe2/design/spec-final.md>) into an execution plan.

It is not another gameplay spec. It defines:

- the recommended implementation stack
- the module boundaries
- the order of delivery
- the playable milestones
- the validation gates
- the major risks and how to contain them

The goal is to turn this repo into a playable `Age of Empires II: Definitive Edition` style single-player Random Map game against AI, while also serving as a practical proof that `civ-engine` can support that class of RTS.

## 1. Assumptions

### 1.1 Product Assumptions

- The canonical design is [spec-final.md](<C:/Users/38909/Documents/github/aoe2/design/spec-final.md>).
- The game scope is standard Random Map only.
- The game scope is single-player only: one human player, AI opponents, optional AI allies.
- The local CSVs under `design/stats/` remain the content source of truth.
- The current dataset is incomplete for later-expansion unique content, so the first playable release should ship only content that is fully backed by the local data.

### 1.2 Engine Assumptions

- `civ-engine` is the intended simulation foundation for this repo.
- This repo should validate that `civ-engine` can support an AoE2-style RTS with economy, age progression, production, combat, fog of war, AI, and saveable state.
- If `civ-engine` is not yet consumable as a package or submodule, the first implementation milestone must establish that integration boundary before gameplay work continues.

### 1.3 Delivery Assumptions

- This is a greenfield implementation.
- The first target is a working browser game, not native desktop packaging.
- We should optimize for fast playable slices, not giant subsystem branches that only integrate at the end.

## 2. Recommended Stack

### 2.1 Runtime Choice

Recommended runtime:

- `TypeScript`
- `Vite`
- `Phaser 3` for 2D rendering, camera, scene lifecycle, pointer input, and sprite orchestration
- `civ-engine` for authoritative simulation and rules state
- DOM-based HUD and menu overlays

Why this is the default:

- the target game is a 2D RTS, not a true 3D scene
- the simulation is more important than custom rendering tricks
- Phaser gives fast camera and sprite primitives
- DOM overlays are better than canvas UI for dense HUD, tooltips, settings, and debug views
- separating simulation from rendering matches the spec and keeps save/load feasible

### 2.2 Non-Negotiable Architecture Rules

- Simulation state must live outside Phaser scenes.
- `civ-engine` or the game simulation layer must own rules, timers, entities, visibility, resources, and AI state.
- Phaser scenes must never become the source of truth for gameplay.
- UI state must remain separate from simulation state.
- Content data must be normalized once, then consumed through typed internal models rather than ad hoc CSV parsing at runtime.

### 2.3 Test Stack

Recommended test stack:

- `Vitest` for unit and integration tests
- deterministic simulation tests for rules and serialization
- browser smoke tests once a playable shell exists

## 3. Proposed Repository Shape

```text
src/
  app/
    bootstrap/
    config/
  content/
    raw/
    normalized/
    manifests/
  game/
    simulation/
      core/
      commands/
      entities/
      systems/
      ai/
      saves/
    rules/
    services/
  phaser/
    boot/
    scenes/
    view/
    adapters/
  ui/
    hud/
    menus/
    overlays/
    debug/
  tools/
    content-build/
    validation/
tests/
  content/
  simulation/
  integration/
public/
  audio/
  sprites/
  tiles/
```

Principles:

- `content/raw` mirrors CSV and external authored inputs
- `content/normalized` contains generated machine-friendly JSON or equivalent
- `game/simulation` owns authoritative runtime state
- `phaser` is a renderer and input adapter layer
- `ui` is DOM-first
- `tools` contains importers and validation scripts

## 4. Delivery Strategy

Use playable vertical slices.

Each phase should end with:

- a working branch state
- explicit validation
- updated devlogs
- no hidden speculative systems that are not yet connected

The plan is deliberately front-loaded on content normalization and core simulation because almost every later milestone depends on them.

## 5. Phase Plan

### Phase 0: Project Bootstrap and Engine Contract

Objective:

- create the runnable project shell and define how this repo talks to `civ-engine`

Tasks:

- initialize the TypeScript and Vite project
- install Phaser and test tooling
- decide how `civ-engine` is consumed:
  - package dependency
  - workspace dependency
  - local vendored package
- define the simulation adapter boundary
- create a minimal app shell with one Phaser scene and one DOM HUD overlay
- add lint, format, and test commands

Deliverables:

- app boots in browser
- blank map scene renders
- simulation tick runs independently of render loop
- CI-equivalent local commands exist for test and build

Exit criteria:

- a stub simulation object can tick without Phaser owning any game state
- browser boot path is stable

### Phase 1: Content Pipeline and Data Validation

Objective:

- turn `design/stats/*.csv` into reliable internal content data

Tasks:

- write CSV importers for structures, units, technologies, and civilizations
- normalize semicolon-delimited lists into arrays
- parse cost blobs into typed resource objects
- derive canonical IDs
- derive producer-to-unit and producer-to-tech mappings
- derive upgrade chains
- implement validation failures for:
  - unknown producers
  - missing upgrade targets
  - missing civ unique-unit references
  - missing civ unique-tech references
- generate normalized JSON artifacts

Important scope rule:

- do not invent missing later-expansion rows during this phase
- record the missing-content report and gate shipping content accordingly

Deliverables:

- repeatable `content build` command
- repeatable `content validate` command
- normalized content artifacts checked into or generated for the runtime

Exit criteria:

- the game can load normalized data without raw CSV parsing in the hot path
- the missing-content report clearly identifies unsupported civ content

### Phase 2: Map, Camera, and Visibility Slice

Objective:

- get a navigable playable map with fog of war and resource placement

Tasks:

- implement tile-grid world representation
- implement one standard land map generator first, likely `Arabia`
- add terrain classes, elevation, passability, and buildability
- place Town Centers, starting villagers, scout, and standard nearby resources
- add minimap
- add fog of war states
- add line of sight reveal
- add camera pan and zoom

Deliverables:

- player can boot into a generated map
- camera and minimap work
- fog of war reveals around starting units

Exit criteria:

- world generation is deterministic from a seed
- map state is simulation-owned, not scene-owned

### Phase 3: Dark Age Economy Slice

Objective:

- make the game economically playable before military depth

Tasks:

- implement Villagers
- implement resource gathering loops
- implement carry and drop-off behavior
- implement construction for House, Mill, Lumber Camp, Mining Camp, Barracks, Farm
- implement population cap and House support
- implement Town Center villager queue
- implement basic command panel for gather, build, and train actions
- implement dead animal decay and basic herdable ownership rules

Deliverables:

- player can run a Dark Age economy
- villager production, housing, and resource collection all work
- buildings are placeable and complete correctly

Exit criteria:

- a player can sustain economy without debug cheats
- the simulation can run the full dark-age loop from the spec

### Phase 4: Feudal Core and Production Slice

Objective:

- unlock the first real skirmish loop

Tasks:

- implement age-up to Feudal
- implement Archery Range, Stable, Blacksmith, Market, walls, and towers
- implement Militia line, Spearman line, Archer line, Skirmisher line, Scout Cavalry line
- implement production queues and rally points
- implement first military upgrades
- implement basic attack, patrol, attack-move, and garrison
- implement simple tower fire

Deliverables:

- Feudal Age skirmishes are playable
- player can rush, defend, and scout

Exit criteria:

- one human player can defeat a scripted or minimal AI using Feudal units

### Phase 5: Castle Age Systems Slice

Objective:

- deliver the first recognizably AoE2 midgame

Tasks:

- implement Castle Age
- implement second and third Town Centers
- implement Monastery, Siege Workshop, University, Castle
- implement Monk behavior: heal, convert, relic pickup
- implement Knight, Camel, Cavalry Archer, Crossbowman, Pikeman, Light Cavalry, Mangonel, Scorpion, Battering Ram
- implement unique-unit production for civs fully backed by local data
- implement economy technologies and blacksmith progression through Castle Age
- implement Market exchange and tribute
- implement relic gold income

Deliverables:

- booming, relic play, siege, and Castle production all work

Exit criteria:

- a full Castle Age teamless skirmish is playable from start to finish with placeholder AI if needed

### Phase 6: Imperial Age and Win Conditions

Objective:

- complete the standard Random Map ruleset

Tasks:

- implement Imperial Age
- implement final tech tiers
- implement Trebuchets, Bombard units, and final naval or siege units that are data-backed
- implement Wonder construction and countdown
- implement relic victory countdown
- implement score timer
- implement defeat detection for conquest
- implement game-end presentation and post-game summary

Deliverables:

- all standard Random Map victory conditions work
- full match loop exists from Dark Age start to game over

Exit criteria:

- one complete skirmish can be played without debug intervention

### Phase 7: AI Baseline

Objective:

- replace scripted opponents with an actual playable AI

Tasks:

- create an AI blackboard or planner interface over simulation state
- implement opening plans
- implement villager assignment and rebalance
- implement house timing and age-up logic
- implement military production logic
- implement attack-group formation
- implement basic scouting response
- implement late-game trade behavior for allied AI
- implement difficulty modifiers

Deliverables:

- AI can gather, age up, produce units, attack, defend, and lose or win under real rules

Exit criteria:

- AI can finish a complete standard match without deadlocking

### Phase 8: UX, Save/Load, and Stability

Objective:

- make the game reliable enough to serve as a true engine proof

Tasks:

- add save/load serialization
- add tooltips, queue feedback, and better HUD polish
- add debug overlays for:
  - entity selection
  - pathing
  - fog
  - AI state
  - performance
- optimize hot systems
- add additional map scripts after Arabia
- improve unit responsiveness and presentation

Deliverables:

- stable playable build
- save and load works for in-progress skirmishes
- debugging tools make engine limits visible

Exit criteria:

- the project can be used to judge whether `civ-engine` supports this RTS class well enough

## 6. Content Shipping Strategy

Because the local dataset is incomplete, content should ship in tiers.

### Tier 1: Fully Backed Generic Core

Ship first:

- generic buildings
- generic eco units
- generic infantry, archer, cavalry, monk, siege, and naval lines that are fully backed by local data

### Tier 2: Fully Backed Classic Civ Content

Enable civ-specific content only where:

- the civ row exists
- the unique unit exists
- the unique tech exists
- the elite upgrade exists if the unit line needs it

### Tier 3: Later-Expansion Data Completion

After the game loop is stable:

- extend `design/stats`
- re-run normalization
- enable additional civ content

Do not block the first playable build on full DE content parity.

## 7. Technical Risk Register

### 7.1 Biggest Risks

- `civ-engine` may not yet support the entity count, visibility model, or deterministic update needs of an RTS.
- The local content bundle is incomplete for later-expansion civs.
- Pathfinding and group movement may dominate complexity early.
- AI can sprawl if introduced before the economy and combat loops stabilize.
- UI complexity can explode if dense RTS controls are forced into the canvas layer.

### 7.2 Risk Mitigations

- prove simulation tick ownership in Phase 0 before adding content
- finish content normalization before adding late-game systems
- keep renderer and simulation boundaries strict
- delay advanced AI until a human-playable match exists
- build debug surfaces early
- treat unsupported civ content as validation failures, not runtime surprises

## 8. Testing and Acceptance Plan

### 8.1 Automated Tests

Add tests for:

- CSV normalization
- upgrade-chain derivation
- producer-to-output mapping
- combat formula correctness
- gather-rate and drop-off rules
- age-up prerequisites
- save/load round trips
- deterministic tick replay for fixed command sequences

### 8.2 Manual Playtest Gates

Each major phase should end with a short human playtest checklist:

- camera and selection feel sane
- units obey commands predictably
- resources change for the right reasons
- tech unlocks appear when expected
- AI takes plausible actions
- victory and defeat conditions trigger correctly

### 8.3 Definition of Done

The project is implementation-complete for this revision when:

- it satisfies the acceptance criteria in [spec-final.md](<C:/Users/38909/Documents/github/aoe2/design/spec-final.md>)
- a human can start a standard Random Map skirmish, play through all ages, fight AI, and finish the match
- the game is driven by normalized content data rather than hard-coded gameplay tables
- the remaining unsupported civ content is explicit and measurable

## 9. Recommended Immediate Actions

1. Bootstrap the TypeScript, Vite, Phaser, and test shell.
2. Define the `civ-engine` integration contract and prove the simulation can tick independently.
3. Build the content normalization and validation pipeline before any major gameplay UI.
4. Target `Arabia` as the first fully playable map script.
5. Ship a Dark Age economy slice before implementing broad military or AI behavior.
