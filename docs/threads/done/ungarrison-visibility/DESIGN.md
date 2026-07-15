# Ungarrison visibility design

## Problem

Ungarrisoned units remained authoritative and rendered but ordinary Town Center releases were fully depth-occluded behind the voxel building. At Castle capacity, four of 20 released villagers additionally shared presentation roots because every unit requested one cell and ordinary movement occupancy accepted overflow after 16 slots.

## Decision

Ungarrison requests a deterministic authored south/east exit while trained-unit spawn ordering remains unchanged. Ungarrison is a fresh placement, not movement: it calls the bounded spiral occupancy API, writes the returned cell and slot metadata into ECS state, then snaps the fine root once. If no free slot exists in the search bound, placement returns no result and the caller retains the unit in the garrison. The helper is bound to the bridge world whose occupancy instance it mutates.

## Boundaries

Simulation remains authoritative for positions and slots. Projection, fog filtering, entity identity, selection silhouettes, garrison capacity, and the Voxel renderer are unchanged. Ordinary moving-unit synchronization retains its non-redirecting overflow contract, and scenario fixtures retain their existing spawn behavior. No x-ray overlay or save-schema field is introduced.
