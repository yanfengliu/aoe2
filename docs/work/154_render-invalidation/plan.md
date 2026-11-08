# Adopt selected render invalidation without changing game state

Status: active
Owner: Codex
Created: 2026-11-08
Updated: 2026-11-08

## Problem and outcome

AoE2 rebuilds every projected entity after a change to game state outside engine components. Engine 2.7 added selected-entity invalidation, now available through the verified retained 2.9.0 archive. Adopt that public API and measure the retained map-size workload, preserving the same world and full projected views.

## Scope

Owner-approved scoped AoE2 engine adoption, following work 153 at 0aa2569211db3380074cd2126c99c49a02b57de2. Root continues in the controller-created engine-pin-1107 tree with approved private dependencies. No map generation, AI policy, voxel, save schema, replay transport or shared-install changes. Foreign render-projection-cost-1106 work remains untouched; its uncommitted dynamic-candidate classification and oracle cases are reference inputs, not an accepted implementation.

## Approach

Keep civ-engine RenderAdapter and its JSON validation, generation tracking and transport. Track entities whose projection reads game-owned mutable state, plus previous/current selection; update membership from actual component/entity diffs. Register the invalidation listener before the adapter's diff listener so a tick's external state appears in that tick's projection, including several ticks with no read between them. Use the engine invalidate API, without a replacement adapter, equality suppression or validation opt-out. Retain immediate full-snapshot fallback for changes between ticks, especially paused selection, and preserve on-read connect/finally-disconnect behavior and render-store memo invalidation. Inspect tie ordering explicitly rather than normalizing an oracle to hide differences.

## Acceptance criteria

- [ ] TDD whole-view/frame equality against a full engine projection, equal serialized game state, real occurrences for combat, construction, conversion, healing, wildlife, regeneration and selection changes.
- [ ] Entity-generation/reclassification/destruction, old/new/cleared selection, paused reads and several ticks without reads retain current views.
- [ ] Independent projection counts prove untouched terrain/static resources avoid repeated projection; deliberate invalidation/order controls fail.
- [ ] Inclusive CPU profiling on retained late 120x120/168x168 saves and interleaved equal-work digest checks support any cost claim; do not substitute whole-game throughput for feature cost.
- [ ] Headless GPU fixed/random camera views, zooms, real controls and maintained before/after pixel captures; retained gallery, task-owned cleanup.
- [ ] Exact independent review, required local verify/receipt/audits, main/push and terminal hosted CI/corpus.

## Implementation steps

- [x] Inspect current bridge, engine invalidation semantics and the peer candidate without changing it.
- [ ] Add contract tests first, implement the narrow integration, measure and visually verify.
- [ ] Review, gate, land and record the observed result.

## Outcome

Preparation only. Work 153 source is on main and its exact clean gate passed 5,503 unit cases and 345 browser cases; hosted acceptance remains active. No game speedup is claimed.
