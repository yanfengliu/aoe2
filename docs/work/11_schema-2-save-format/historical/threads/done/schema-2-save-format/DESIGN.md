# Schema-2 Save Format Design

Date: 2026-05-05

## Goal

Ship the Phase 2F save format now that all Tier-1 bridge state lives in `world.state.aoe2.*`. New saves should stop duplicating every migrated slot through top-level `sideMaps`, while legacy schema-1 saves must still load.

## Current State

Schema-1 saves contain `seed`, `worldSnapshot`, `visibility`, `matchState`, and `sideMaps`. The `worldSnapshot` now already contains the authoritative Tier-1 slots plus Tier-3 `visibility` and `matchState`, so schema-1's top-level fields are redundant for new saves. The exception is the AI pending-command queue: it is bridge-owned runtime state rather than a Tier-1 codec, but it must survive a save taken between an AI decision tick and the dispatcher drain before the next engine tick.

## Decision

`SaveBlob` becomes a discriminated union:

- schema 1: legacy shape with top-level `visibility`, `matchState`, and `sideMaps`.
- schema 2: current shape with only `seed` and `worldSnapshot`.

New `saveGame()` calls flush Tier-1 accessors, Tier-3 visibility/match state, and the pending-command queue into `world.state` before serializing, then emit schema 2 only. Bootstrap and the output tail also publish a cloned pending-command snapshot so recorder-visible `world.serialize()` calls do not miss just-loaded legacy queues, retain drained commands, or miss newly queued AI intentions.

Schema-2 load reads `visibility`, `matchState`, and pending commands from `worldSnapshot.state`. Schema-1 load keeps the existing side-map hydration path and treats legacy `sideMaps.*` as authoritative over any stale duplicate `worldSnapshot.state` values by clearing migrated map slots before applying the side-map payload.

## Invariants

- New save JSON has no top-level `sideMaps`, `visibility`, or `matchState`.
- Schema-2 save/load round-trips active commands, persisted match state, visibility, and pending AI intentions through `worldSnapshot.state`.
- Schema-1 blobs continue to load, including corruption/invariant tests that intentionally mutate legacy `sideMaps`.
- `saveGame()` returns clones of pending commands, so mutating a saved blob cannot mutate the live bridge queue.
- Bootstrap and save-time flushes clear stale pending-command state when the queue is empty.
