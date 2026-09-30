# Unit Commands Accessor Migration Design

Date: 2026-05-04

## Goal

Move `unitCommands` from bridge-owned `BridgeState` into the existing Tier-1 `world.state.aoe2.unitCommands` slot using `unitCommandsCodec` and `BridgeStateAccessor`. This closes the last bridge-owned Tier-1 codec before Phase 2F can remove redundant schema-1 side-map projections.

## Pre-Migration State

`unitCommandsCodec` was already in `TIER_1_CODECS`, but the live command map was still `BridgeState.unitCommands`. Command handlers and deterministic systems read or mutated the raw map, while save/load mirrored it through `SaveBlob.sideMaps.unitCommands`. That meant active move/build/attack orders were not visible to `world.serialize()` snapshots unless they also passed through the schema-1 save projection.

## Decision

`unitCommands` becomes accessor-backed:

- `clearUnitCommand` and `setUnitCommand` are the mutation boundary and update `unitCommandsCodec`.
- Systems read `accessor.get(unitCommandsCodec)` inside `execute` so a post-load accessor reset cannot leave captured stale map references.
- Save/load keeps schema-1 compatibility by still emitting and consuming `sideMaps.unitCommands`, but the load path treats that side map as authoritative over any stale `worldSnapshot.state.aoe2.unitCommands`.
- `movePathCache` remains bridge-owned runtime cache state. Setting or clearing a command continues to clear the matching cached path.

## Invariants

- Active commands flush into `world.state.aoe2.unitCommands` before snapshots.
- Schema-1 `sideMaps.unitCommands` wins over stale world snapshot state until Phase 2F removes the duplicate projection.
- No-op command cleanup does not mark `aoe2.unitCommands` dirty.
- Retargeting or clearing commands during conversion marks the accessor-backed slot dirty.
- `BridgeState` owns runtime/cache maps only after this migration.
