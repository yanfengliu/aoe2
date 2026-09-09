# Concurrent boar hunting

## Contract

A single context order to a living boar is broadcast to every selected villager. Each villager owns an independent attack command, approach path, and reload cooldown; the boar's current retaliation victim is not an exclusive claim on the target.

## Input boundary

Presented epoch/revision-bound voxel silhouettes remain the source of command hits for raised and moving entities. Their raw geometry and depth order do not change. When the selected group is uniformly villagers, a human-owned unit hit has no villager context action, so command arbitration may look farther down that same presented hit list for the first resource, building, or non-owned unit. If no such hit exists, the first raw hit remains the target. Other selection types retain raw ordering, including Monk healing.

## Non-goals

- Do not introduce boar-side attacker reservations or group combat state.
- Do not replace presented entity picking with dense terrain occupancy raycasts.
- Do not change save, replay, movement-slot, combat-damage, or wildlife-retaliation schemas.
