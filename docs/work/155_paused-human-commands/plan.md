# Preserve admitted human commands across paused saves

Status: active
Owner: Codex
Created: 2026-11-08
Updated: 2026-11-08

## Problem and outcome

A fresh engine 2.9.0 probe confirms an accepted human move is held only in the engine's nonpersistent queue: pause/save/load loses it without advancing tick 0. Preserve admitted human intentions across saves and recording boundaries while maintaining FIFO human-before-AI ordering.

## Scope

The owner explicitly approved schema 3 and queued human commands on 2026-11-07, accepting the concrete design and its compatibility/submission-timing bounds. This supplements the earlier scoped AoE2 approval; permanent policy remains unchanged. No persistence code has changed yet. Root prepares this in the controller-created engine-pin-1107 tree at 0aa2569211db3380074cd2126c99c49a02b57de2. Raw bridge.world submissions/steps and transactions are outside the proposed facade guarantee.

## Approach

Use a separately persisted human FIFO of detached existing command payloads, immediate engine precheck for facade admission, and actual engine submission immediately before each eligible live tick, before the existing AI/agent queue. Keep AI supersession out of the human queue. Save only flushes/serializes; it never drains or ticks. Missing legacy human queues default empty. Recording captures actual submission once; replay consumes recorded submissions and clears the persisted human shadow without submitting it again. The proposed compatibility/version decision and exact lifecycle bounds are in design.md; an independent read-only investigation is retained in reviews/0_plan.md.

## Acceptance criteria

- [x] Owner approved schema 3 and queued human commands on 2026-11-07.
- [ ] Every human command facade covered; accepted/rejected intent, ordering, shift queues, AI eviction, races, payload isolation and repeated paused save/load are tested.
- [ ] Recorder start before/between/after admission and execution, snapshots, replay/scrub and legacy recording state are equivalent without duplicate commands.
- [ ] Fresh malformed-save, old-schema and reentrant-boundary checks prove the documented limits.
- [ ] Exact independent review, full verify/receipt/audits, main/push and terminal hosted CI/corpus.

## Implementation steps

- [x] Reproduce the defect through public bridge methods and inspect all command/recording boundaries.
- [x] Complete the compatibility proposal and obtain the owner's persistent-format decision.
- [ ] Implement with tests first, review, gate and deliver.

## Outcome

Preparation only. The retained tick 0 public-API probe and constraints are in ignored tmp/engine-pin/paused-save-probe.{ts,json} and paused-save-adoption-constraints.md. No new format or behavioral fix is claimed.
