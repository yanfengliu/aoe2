# Paused human commands: approval proposal

Prepared 2026-11-08 against AoE2 commit0aa2569211db3380074cd2126c99c49a02b57de2 and its retained civ-engine 2.9.0 installation. This is a proposal, not implemented behavior. [Independent investigation and superseding compatibility review](reviews/0_plan.md).

## Owner decision

Approved by the owner on 2026-11-07: a game-owned human-command queue, deferred engine submission at the next eligible live tick, and AoE2 save schema 3. New readers continue loading schemas 1/2; older builds reject new saves rather than silently discarding pending commands. This explicit decision supplies the persistent-format authorization required by AGENTS R8 and supplements the earlier scoped engine-adoption approval.

## Observable result

Today a human move can return accepted while paused, but save/load loses it because the engine's command queue is not serialized. The retained public-API probe accepts a move at tick 0, saves without advancing, and shows the continued and loaded game diverging after 20 ticks. After this change the loaded game retains the same admitted human intentions, in the same order, without advancing time merely to save.

## Persistent contract and compatibility

New saves write schema 3 and require worldSnapshot.state["aoe2.pendingHumanCommands"], an ordered JSON array of existing {type,data} command payloads, including an empty array when no human intent remains. The separate existing aoe2.pendingCommands slot continues holding AI/agent intentions. There are no engine sequence numbers, callbacks, wall-clock timestamps or runtime-only agentIssued flags in the human slot.

For example, an accepted unit.move before the next tick is saved as {"schema":3,"worldSnapshot":{"tick":0,"state":{"aoe2.pendingCommands":[],"aoe2.pendingHumanCommands":[{"type":"unit.move","data":{"unitId":17,"target":{"x":8,"y":8}}}]}}}; unrelated existing snapshot fields are omitted and the ID is illustrative.

New readers accept schemas 1, 2 and 3. Schemas1/2 default the human queue to empty; schema 3 requires and validates it. Hydration clones payloads without resubmission, resource spending, or ticks. Malformed containers, unknown command types or structurally invalid payloads are explicit load errors. Already lost commands cannot be recovered. Keep the existing SaveBlobV2 type explicitly bound to2 and add a separate SaveBlobV3 type; do not relabel legacy snapshot wrappers.

Older game builds reject schema 3 at their existing unsupported-schema boundary. No downgrade conversion is proposed. The engine's WorldSnapshot and session-bundle formats remain unchanged. New recording bundles require the updated game replay implementation because those bundles do not contain the outer save schema; backwards replay of older recordings is required, forwards replay in older game builds is not promised.

## Admission and execution

One internal admission helper serves every human command facade: movement/context including monk/sheep routes, attack-move/attack-ground/patrol, stance/formation, rally points, training/research, placement/actions, markets, tribute and deletion. Existing ownership, visibility, selection and match-state checks remain.

Immediate acceptance means admission to the human FIFO, not guaranteed gameplay execution. The helper uses engine precheck, clones accepted payloads, retains each intent exactly once, performs existing competing-AI eviction and publishes stable queue/accessor state before returning. Human orders are never removed by AI-intention pruning, combined with the AI queue or deduplicated; plain and shift orders retain their original order.

Before each eligible live tick, attempt human intents FIFO through submitWithResult, then drain AI/agent intentions, then step the engine. Paused, halted, match-over and insufficient-accumulator paths retain the queue. Each attempted human intent is retired once. A later submission rejection produces one useful existing HUD rejection and does not retry indefinitely.

Resources and research slots are not reserved at admission. Handlers retain their current stale-state checks; an engine handler-completion report is not a promise that every requested purchase or action succeeded. Precheck is not globally side-effect-free: existing game validators can populate runtime caches, and existing facade side effects are preserved and flushed at stable boundaries.

The facade's immediate boolean remains an admission result. Engine submission observers and command recordings now see the actual attempt immediately before execution, not at the original click. Precheck-only rejected attempts do not become engine command records. Raw bridge.world.submit*, direct world.step(), transactions and arbitrary external validators are outside the new facade persistence guarantee.

## Saving and recording

Saving flushes and serializes only. It never drains queues or advances a tick. Publish human intent state when admission completes so a recorder started between input and execution captures the pending intent in its initial snapshot.

At observable tick K: input admits an intent without an engine submission; recorder connection captures that intent; the next eligible live step submits it once at K, retires/publishes the queue, submits AI intents and steps. The recorder captures the actual submission result once.

Replay hydrates snapshots without submitting human intentions. Recorded command payloads are its only submission source. Its existing update-phase queue-clear mechanism also clears the human shadow before AI update work; command handlers run earlier, so this is not described as before all systems. Output publishes the cleared slot. Opening an exact snapshot without stepping retains its pending queue, and no-step recordings retain pending intentions without inventing an execution beyond the recorded horizon.

For legacy recordings lacking the slot, replay must omit the new key at bootstrap and output to preserve snapshot equivalence. Both UI replay and engine replay/fork/corpus paths need explicit parity. Reentrant save, recording or facade admission during the synchronous drain is rejected by a boundary guard rather than exposing a half-transferred queue.

## Proof required before delivery

- Every covered facade survives paused save/load when admitted and adds no intent when rejected.
- Same-unit plain/shift orders, multiple units and human-before-AI execution retain order; auto-attack/auto-gather eviction cannot delete human intentions.
- Training/research/market/tribute/placement races and deleted or newly ineligible targets compare actual resources and actions, not only acceptance booleans.
- Input/save/load payloads are detached; repeated save/load before the first tick does not duplicate or lose intent; saving and recording leave the tick unchanged.
- Recorder start before input, between input and execution, and after execution; periodic/terminal snapshots; submission rejection; one recorded submission and one execution attempt; both replay paths and scrubbing.
- Legacy schemas and recording slots, malformed schema 3 payloads, old-reader rejection and guarded reentrancy have direct checks.
- A facade census prevents future human submissions from bypassing the common admission helper. Exact independent implementation review, all required gates, main/push and hosted CI/corpus follow.

## Current status

No persistence implementation or format change has been made. The read-only review originally suggested an optional schema 2 slot; its addendum supersedes that with schema 3 after identifying silent command loss in older readers. The owner approved this design on 2026-11-07; implementation now proceeds separately from rendering adoption.
