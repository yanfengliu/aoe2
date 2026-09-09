# Narrow-choke queueing design

## Problem

Global A* correctly ignores units, but the movement executor enters an occupied corridor cell and the occupancy layer assigns another 4x4 subcell slot. In a one-cell passage this presents several villagers moving abreast and laterally wrapping around the leader.

## Contract

Permanent blockers remain the only blockers in the global route graph. Active same-owner units are temporary traffic: followers wait without clearing their task or cached route. A static one-cell choke is an immediate movement leg whose current or target cell has two perpendicular permanently impassable flank cells; checking both cells keeps the rule active through a one-cell bend. Arbitration starts from one tick-start snapshot, augments it with actual same-tick movement attempts, prefers the greatest fine-position projection along the caller's immediate step, then the lowest entity id, and admits only one co-located origin reservation. Any active friendly mover already occupying the next lane cell makes an acyclic follower wait, even while the leader turns. A directed occupied-cell dependency cycle admits only its lowest entity id, breaking both pairwise head-on and longer loop deadlocks. Explicit player orders, monk tasks, and villager resource/drop-off travel all count as active intent; explicit idle worker orders are included before their economy-system transition. The executor centers the lateral axis while inside the choke. Open-field subcell packing and stationary-unit sharing remain unchanged.

## State and determinism

The traffic snapshot and owner-scoped origin reservations are transient and rebuilt from serialized authoritative positions, transforms, task intent, and deterministic system execution. Every arbitration attempt refreshes four additive optional `UnitTransformComponent` provenance fields—direction X/Y, intent key, and attempt tick—including when it waits. A remembered leg is eligible only while its intent identity still matches and its attempt is at most one tick old; a legacy unit with no fields temporarily derives direction from its serialized target until its first attempt. Cycle release requires every occupied dependency branch to contain a current or previous-tick caller and close back to the mover, so stale, extra, or noncalling occupants remain conservative blockers rather than false winners. Arbitration never reads the unsaved route cache, and no save-schema version bump is required. Equal command streams therefore produce equal traces, and a turn or misleading final target can delay cycle recognition by at most one tick rather than deadlock.

## Non-goals

This slice does not add formation regrouping, a fair or persistent opposing-flow corridor token, a wait-age timeout for idle blockers, autonomous scout/herdable traffic, or unit types to the global A* blocked predicate. Directed cycles receive only the minimal stable-id yield needed to create an empty slot; broader fairness requires separate state and formation contracts rather than an opportunistic replan.
