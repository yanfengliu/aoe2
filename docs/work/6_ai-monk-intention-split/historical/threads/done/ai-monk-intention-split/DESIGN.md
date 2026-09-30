# AI monk intention split design

Status: Accepted for v0.1.6 roadmap continuation.

## Goal

Remove the last AI-side direct `monkTasks` mutation from `aiSystem` so the remaining Phase 2D `monkTasks` migration can proceed through the same command boundary as other AI decisions.

## Shape

- Keep `monk.contextAtEntity` as the command surface. It already revalidates monk plus target state in the validator and delegates to the same heal, convert, pickup, deposit routing helper in the handler.
- Add `pushAiMonkTaskIntentions(owner, pushMonkContextAtEntityIntention)` beside the existing direct `assignAiMonkTasks(owner)` helper. Both use the same target-selection helper so priority stays deposit, then pickup, then heal.
- Thread `pushMonkContextAtEntityIntention` from `wireBridgeOps` to `aiSystem`; it appends `{ type: 'monk.contextAtEntity', data: { unitId, targetEntityId, expectedOwner, intendedTaskKind } }` to `state.pendingCommands`.
- Carry `expectedOwner` and `intendedTaskKind` through the command so stale AI intentions no-op if the monk changed owner or the target no longer maps to the task the AI chose.
- Persist `state.pendingCommands` in the save blob and drain it immediately before the next tick, so saving after an AI decision but before the handler tick preserves the queued assignment.
- Update `aiSystem` to queue monk context intentions instead of calling `assignAiMonkTasks(owner)` directly. The dispatcher submits them between ticks and the command handler applies the task at the next `processCommands` phase.
- Prove the boundary with an AI relic fixture regression: after one step the AI has queued the pickup but has not carried the relic yet; after the next step the handler plus monk behavior complete the pickup.
