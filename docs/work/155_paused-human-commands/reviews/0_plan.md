# Paused human commands — plan review, round 0

## Target

AoE2 source tree `0aa2569211db3380074cd2126c99c49a02b57de2`, inspected in `C:\Users\38909\Documents\github\aoe2-worktrees\engine-pin-1107` with the retained civ-engine 2.9.0 installation. The investigation was read-only; root was running the existing delivery gates. Later task-record changes are outside the inspected source target. This file retains the reviewer's complete original design report and subsequent schema/recording addendum, authored on 2026-11-07.

## Reviewers and coverage

Reviewer: `/root/publisher_review`, native in-session Astra/xhigh under root's assigned review lane. No external reviewer CLI, source export, network request, browser, subagent, installation, test, or gate was used for this investigation. Coverage included the retained paused-save probe and constraints, human command facades and competing AI intentions, pending-command cloning, save schemas and hydration, snapshot flushing, recording and both replay paths, and relevant validator/handler semantics.

The original report recommended an additive schema-2 slot. The separately authored addendum below supersedes that recommendation: **use schema 3 so old save readers reject new saves instead of silently losing human intentions**. The original report is preserved rather than rewritten. Implementation and owner approval remain pending.

## Reports

### Original authored design report — /root/publisher_review

Recommended approval scope: **add a separate, persisted human-intent FIFO under schema 2, using `precheckCommand` for immediate feedback and actual engine submission immediately before each live tick.** Keep the existing AI/agent queue separate. This preserves human-before-AI execution and prevents auto-aggression pruning from deleting human orders.

This is a design report against frozen tree `0aa2569211db3380074cd2126c99c49a02b57de2`; read-only comparisons confirmed the index and tracked worktree matched it.

**Observed behavior and constraints**

The retained probe reproduces the loss through public bridge methods: an accepted move, zero paused ticks, and a tick-0 save containing an empty `aoe2.pendingCommands`. After resuming both branches for 20 ticks, the original villager moved and the loaded villager did not.

Human facades submit directly today. The bridge drains AI intentions immediately before `world.step()`, so already submitted human commands execute first. [Live tick boundary](C:/Users/38909/Documents/github/aoe2-worktrees/engine-pin-1107/src/game/simulation/createSimulationBridge.ts:319)

Combining the queues is unsafe. Accepted human orders remove competing entries from the existing queue, and that removal is by targeted unit, without an origin distinction. It would delete newly appended human orders and earlier shift-queued orders. [Supersession](C:/Users/38909/Documents/github/aoe2-worktrees/engine-pin-1107/src/game/simulation/bridge/humanInputOps.ts:102), [removal predicate](C:/Users/38909/Documents/github/aoe2-worktrees/engine-pin-1107/src/game/simulation/bridge/pendingCommandQuery.ts:74)

**Proposed persistent contract**

Add `worldSnapshot.state["aoe2.pendingHumanCommands"]`, containing an ordered JSON array of `{ type, data }`. Entries mean “passed the game’s immediate admission checks and await an actual submission attempt”; they do not mean “guaranteed to execute.”

Use the existing command payload shapes and detached cloning convention. Persist no engine sequence, callback, timestamp, or `agentIssued` flag. The current `clonePendingCommand` deliberately strips that runtime-only flag. [Pending-command contract](C:/Users/38909/Documents/github/aoe2-worktrees/engine-pin-1107/src/game/simulation/dispatcher.ts:23)

Keep `SaveBlob.schema = 2`. The existing schema explicitly permits additive fields when absence is tolerated; schema 2 already treats `worldSnapshot.state` as the authoritative game-state container. This still needs the requested owner approval because it changes persistent content. [Schema compatibility rule](C:/Users/38909/Documents/github/aoe2-worktrees/engine-pin-1107/src/game/simulation/saveSchema.ts:111)

An illustrative saved fragment changes from:

```json
{
  "schema": 2,
  "worldSnapshot": {
    "tick": 0,
    "state": {
      "aoe2.pendingCommands": []
    }
  }
}
```

to:

```json
{
  "schema": 2,
  "worldSnapshot": {
    "tick": 0,
    "state": {
      "aoe2.pendingCommands": [],
      "aoe2.pendingHumanCommands": [
        {
          "type": "unit.move",
          "data": {
            "unitId": 17,
            "target": { "x": 8, "y": 8 }
          }
        }
      ]
    }
  }
}
```

The entity ID is illustrative; unrelated snapshot fields are omitted.

Migration rules:

- Missing slot in schema-1 or schema-2 saves means an empty human queue. Previously lost commands cannot be reconstructed.
- Hydration clones entries without submitting, ticking, spending resources, or performing state-dependent admission again.
- Reject malformed containers, unknown command types, or invalid persisted payload structure explicitly; do not silently discard corrupt entries.
- New live worlds write the slot, including `[]`.
- Older game builds cannot be promised to preserve this new field’s meaning. If rejecting new saves in old builds is required, use schema 3 instead; that is the remaining compatibility choice.

**Admission, ordering, and coverage**

Introduce one internal human-command admission helper and route every current human-facing submission through it. Preserve existing ownership, selection, visibility, match-state checks, and immediate rejection translations.

On acceptance, retain a detached command, then perform existing AI-intention eviction. Publish the new human queue, any changed AI queue, and dirty accessor state before the public facade returns. Saving must only flush and serialize; it must never drain either queue or advance a tick. [Current save boundary](C:/Users/38909/Documents/github/aoe2-worktrees/engine-pin-1107/src/game/simulation/bridge/saveGameOps.ts:42)

At each eligible live tick:

1. Take the human FIFO in order and attempt each command once through `world.submitWithResult`.
2. Drain the existing AI/agent queue.
3. Call `world.step()`.

Preserve all human entries in their original order: plain orders, shift orders, repeated orders, and multi-unit expansion. Do not deduplicate or apply system-intention pruning to the human queue. Paused, halted, match-over, and insufficient-accumulator paths must leave it intact.

Cover all public command facades: movement/context including monk and sheep routing; attack-move, attack-ground and patrol; stance/formation; rally points; training/research; building placement/actions; market actions; tribute; single and multiple deletion. The direct-submission census spans `humanInputOps`, `unitCommandOps`, `gatherCommandOps`, `monkTaskOps`, `sheepCommandOps`, `placementOps`, `tributeOps`, and the delete methods in `createSimulationBridge`.

Exclude raw `bridge.world.submit*`, raw `world.step()`, transactions, and externally supplied validators from this new guarantee. Keep the exposed AI/agent `pendingCommands` surface and deterministic systems’ direct mutation helpers unchanged.

**Validation and execution limits**

Precheck does not enqueue, allocate an engine result sequence, or emit/record a submission. Actual submission revalidates later. This changes when engine observers and recordings see facade commands; synchronous facade booleans continue to report immediate admission.

Do not describe the whole operation as side-effect-free. Research validation calls a get-or-create function that inserts an empty runtime technology set; accessor reads populate caches. Separately, monk context fallback clears the current task before submitting its move. Preserve that existing behavior and flush it at the stable facade boundary. [Research cache mutation](C:/Users/38909/Documents/github/aoe2-worktrees/engine-pin-1107/src/game/simulation/bridge/bridgeHelpers.ts:117), [monk fallback](C:/Users/38909/Documents/github/aoe2-worktrees/engine-pin-1107/src/game/simulation/bridge/unitCommandOps.ts:406)

No resources or research slots are reserved. Two affordable-at-admission purchases can both enter the FIFO. Even actual submissions occur before handlers spend resources, so handler rechecks remain essential.

A later submission rejection should consume that intention once and enqueue one useful HUD rejection; it must not retry forever. Existing handler-level stale-state behavior remains unchanged: train/research helpers can return false while their handlers return normally, and the engine then reports handler completion. This fix must not claim to make every gameplay refusal an engine execution rejection. [Training handler](C:/Users/38909/Documents/github/aoe2-worktrees/engine-pin-1107/src/game/simulation/handlers/queue/queueTrainHandler.ts:24)

**Snapshots and recording without duplication**

Publish the queue when admission completes, not merely during `saveGame()`. Recording can start between input and execution, and `SessionRecorder.connect()` captures `world.serialize()` directly. The recorder then wraps actual `submitWithResult` calls. Deferred submission therefore records the command once at execution admission, even when recording starts after the click. Precheck-only rejected attempts will no longer appear as engine command records. [Recorder boundary](C:/Users/38909/Documents/github/aoe2-worktrees/engine-pin-1107/node_modules/civ-engine/dist/session-recorder.js:80)

Replay must never drain the persisted human queue into the engine. Recorded submissions are its sole command source. Extend the existing replay queue-clear mechanism to clear human runtime intentions before update systems; publish the cleared slot afterward. Retain snapshot contents when merely opening an exact snapshot without stepping.

For legacy recordings, **do not introduce the new state key at bootstrap or during output**. Gate publishing on “live mode or slot already present,” matching the existing optional-slot compatibility mechanism. Otherwise old recordings fail engine snapshot-equivalence checks. [Existing compatibility mechanism](C:/Users/38909/Documents/github/aoe2-worktrees/engine-pin-1107/src/game/simulation/bridge/initializeBridgeOutput.ts:10)

Treat admission/drain as synchronous bridge boundaries. Reentrant saves or human submissions from raw engine callbacks during draining should be explicitly rejected or otherwise guarded, rather than exposing a half-transferred queue. No second persistent “already submitted” state is needed.

**Required whole-class proof**

- Every covered facade: accepted command survives paused save/load; immediate rejection adds nothing.
- Same-unit plain plus multiple shift orders; multiple units; exact human-before-AI order.
- Auto-attack and auto-gather eviction without deleting human intentions.
- Training/research/market/tribute/placement races, target deletion, and changed eligibility; compare resulting resources and actions, not only admission results.
- Detached input/save/load payloads; repeated saves and repeated load/save before the first tick.
- Save and recorder operations leave the tick unchanged.
- Recording starts before input, between input and execution, and after execution; periodic and terminal snapshots; exactly one recorded submission and one execution attempt.
- Both replay paths, checkpoint scrubbing, byte-for-byte validation/execution results, and legacy recordings without the slot.
- Schema-1/schema-2 legacy defaults, malformed-slot rejection, and guarded reentrancy.
- Architecture census preventing a new human facade from bypassing the admission helper.

No files were changed and no tests, installs, gates, browser sessions, or network operations were run. The retained reproduction was inspected, not rerun. This proposal needs implementation, exact-revision review, and the listed behavioral proofs after persistent-contract approval.

### Superseding authored schema-3 and recording addendum — /root/publisher_review

**Addendum: recommend schema 3.** This supersedes my earlier schema-2 recommendation.

Schema 2 with an optional slot provides **backward readability only**: new code can load old saves by treating the missing human queue as empty. It does not provide safe forward readability. An old build accepts schema 2, ignores the new queue’s meaning, and silently loses those commands.

Schema 3 makes that incompatibility explicit. The current public loader rejects any schema other than 1 or 2 before constructing the simulation, so it will reject a schema-3 save instead of silently loading an incomplete game. [Existing rejection boundary](C:/Users/38909/Documents/github/aoe2-worktrees/engine-pin-1107/src/game/simulation/createSimulationBridge.ts:72)

The concrete contract should be:

- New writers always produce schema 3, with `aoe2.pendingHumanCommands` present, including `[]`.
- New readers accept schemas 1, 2, and 3. Schemas 1/2 supply an empty human queue; schema 3 requires and validates the new slot.
- Previously lost commands remain unrecoverable.
- Older builds reject new saves. No downgrade conversion or forward-read guarantee is offered.
- Keep `SaveBlobV2.schema` explicitly `2`; add `SaveBlobV3.schema: 3`. Merely changing `SAVE_SCHEMA_VERSION` currently changes the meaning of the existing V2 type. [Current type binding](C:/Users/38909/Documents/github/aoe2-worktrees/engine-pin-1107/src/game/simulation/saveSchema.ts:296)

Recording bundles do not carry the outer SaveBlob schema. New recordings therefore require the updated AoE2 replay implementation; schema 3 alone cannot make old recording readers reject them. Preserve the engine’s recording format, and claim backward replay support for old recordings—not forward replay support in old game builds. The replay factory currently fabricates a V2 save wrapper around snapshots, so its compatibility routing must be updated explicitly rather than relabeling every historical snapshot as schema 3. [Replay wrapper](C:/Users/38909/Documents/github/aoe2-worktrees/engine-pin-1107/src/game/simulation/replay/createReplayWorldOnly.ts:19)

**Exact recording-start-between-input-and-execution contract**

Assume observable tick `K`:

| Boundary | Live behavior | Recorded/replayed representation |
|---|---|---|
| Human input | Precheck accepts; detached intent enters the game-owned human queue. No engine submission occurs. The persisted slot is updated before the facade returns. | No command record yet. |
| Recording starts | Recorder synchronously captures the world snapshot, including the pending human intent, then installs its submission wrapper. | Initial snapshot at `K` contains the intent. |
| Next eligible live tick | Drain the human queue FIFO once through `submitWithResult`, then drain AI intentions. Retire each attempted human intent; publish the emptied human slot before stepping. | Recorder captures each actual submission once at `K`, including rejection results. |
| Replay opens at `K` | Hydrate the snapshot without submitting its human intents. | Exact snapshot retains the queue. Opening alone executes nothing. |
| Replay advances | Submit only recorded command payloads for `K`, then step the replay world. Never invoke the live human-intent drain. | Each accepted recorded command executes once. The replay clear system empties the hydrated human queue, and output publishes `[]`. |

The recorder’s snapshot-before-wrapper ordering and both replay submission loops support this design. [Recorder connection](C:/Users/38909/Documents/github/aoe2-worktrees/engine-pin-1107/node_modules/civ-engine/dist/session-recorder.js:80), [UI replay](C:/Users/38909/Documents/github/aoe2-worktrees/engine-pin-1107/src/game/replay/ReplayController.ts:272), [engine replay](C:/Users/38909/Documents/github/aoe2-worktrees/engine-pin-1107/node_modules/civ-engine/dist/session-replayer.js:153)

**Do not strip the queue from recorded snapshots.** The protection against duplication is that replay never submits snapshot intentions; recorded commands alone drive execution. Clearing removes the runtime shadow after its snapshot boundary.

One precision correction: the existing replay clear system runs in `update`, before `prototypeAi`; engine command handlers run earlier. Extend that clear mechanism for the human queue. It is not “before all systems.” This still prevents duplication because the human shadow has no replay submission path. [Existing clear system](C:/Users/38909/Documents/github/aoe2-worktrees/engine-pin-1107/src/game/simulation/bridge/systems/replayPendingCommandDrainSystem.ts:12)

If recording stops before the next tick, the terminal snapshot retains the unsubmitted intention and there is no command record. Replay displays that recorded boundary and cannot advance beyond its recorded horizon; it must not invent execution. Normal save/load resumes the intent through the live drain. Reentrant recording/save operations during the drain remain excluded by the proposed boundary guard.

For old recordings lacking the slot, replay must continue omitting it at bootstrap and output. Tests must demonstrate this lifecycle through both replay paths, including no-step recording, submission rejection, repeated save/load, and one—and only one—execution after recording starts between input and execution.

These are proposed guarantees requiring implementation tests, not results demonstrated on the current tree. This addendum used targeted read-only source inspection; no files, gates, or running verification were changed.

## Findings and disposition

- Persistent compatibility: the original schema-2 option permits silent command loss in old readers. Superseded by the explicit schema-3 recommendation; new readers retain schema-1/schema-2 loading, while old readers reject new saves. Owner approval is pending.
- Ordering and eviction: a separate human FIFO preserves existing human-before-AI submission order and keeps system-intention pruning from deleting accepted human orders. Implementation is pending.
- Recording and replay: retain the queue in snapshots, record only actual submissions, and never submit the snapshot queue during replay. The addendum corrects the original timing wording: the existing replay clear system runs in update before prototypeAi, after engine command handling. Implementation and duplication proofs are pending.
- Validation honesty: admission is not a reservation or execution guarantee. Runtime cache effects, existing monk fallback mutation, deferred engine observer results, and existing handler-level silent no-ops are explicitly bounded. No claim of globally pure validation or new authoritative execution-rejection reporting is made.
- Scope: raw world submissions/steps, transactions, external validators, downgrade conversion, and forward replay compatibility in old game builds are outside the proposed guarantee.

## Verification

The reviewer read the retained constraints and paused-save probe source/result, inspected the source anchors reproduced above, and used read-only Git comparisons to verify the source target. The retained reproduction was not rerun. No tests, installs, gates, browser sessions, network operations, external reviewer exports, or source edits were performed during the investigation. The only subsequent authorized write is this retained review file; no staging or commit is included. Root owns implementation approval, the separate design document, integration, and all required checks.

## Round outcome

Plan investigation complete and retained for the owner's persistent-format decision. **Recommend schema 3 with a separate persisted human-intent FIFO and the exact recording/replay lifecycle in the superseding addendum.** No implementation approval or implementation correctness is implied. After owner approval, implementation requires whole-class tests, exact-revision independent review, and the repo's complete gates.
