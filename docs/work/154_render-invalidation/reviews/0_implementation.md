# Review 0: implementation

## Target

Independent read-only review of AoE2 work 154 in `C:/Users/38909/Documents/github/aoe2-worktrees/engine-pin-1107`.

- Base: `a0e10435912d97078ee033112d49926a36807fde`
- Frozen staged tree: `3de9f60dc0b0a5f2338aa8633dfb2966fa63002d`
- Scope: six paths—the invalidation helper, bridge integration, RenderStore ordering, two test files, and work plan.

Both the index and tracked worktree matched the supplied tree at the beginning and final verification. No work 155 implementation is present.

## Reviewers and coverage

Authored by `publisher_review`, the assigned independent native Astra/xhigh review lane.

I inspected the exact diff, complete new tests, actual projector callbacks and their backing reads, out-of-band marking and consumption, selection pruning, adapter connection ordering, render-state caching, and the installed engine adapter’s invalidation, generation, frame, and JSON-validation behavior. I also inspected retained oracle and mutation-control evidence.

No edits, tests, gates, installs, browser launches, network requests, staging, commits, or external source exports were performed.

## Reports

**No material source findings.**

The classification in [renderInvalidation.ts](C:/Users/38909/Documents/github/aoe2-worktrees/engine-pin-1107/src/game/simulation/bridge/renderInvalidation.ts:12) covers the projector’s current external inputs. Units and buildings remain followed, including resource/building hybrids. Non-static resources cover wildlife, herdables, relics, and other mutable resource views. Unknown non-terrain entities are conservatively followed. Terrain and the four excluded static resource types still receive ordinary component-driven projection and selection invalidation.

This matches the unchanged surrounding implementation: [visibility.ts](C:/Users/38909/Documents/github/aoe2-worktrees/engine-pin-1107/src/game/simulation/bridge/visibility.ts:125) reads health, wildlife state, activity, civilization, and selection alongside components; [entityReadProbes.ts](C:/Users/38909/Documents/github/aoe2-worktrees/engine-pin-1107/src/game/simulation/bridge/entityReadProbes.ts:28) routes health through unit, building, or wildlife state. Static resources do not acquire those wildlife records through normal entity creation. Frame visibility, deaths, and projectiles remain independently projected each diff.

Membership maintenance handles destruction before reconsidering created entities and changes to every classification component. It rechecks current liveness and final component state. Consequently, destruction and same-ID reuse do not retain the previous classification. IDs are only candidate identifiers: the engine adapter captures current references and checks their generations before projection.

Previous/current selection differences invalidate both sides, including static entities and clearing. Tracking IDs here is sufficient because creation/reuse is independently processed by the adapter, while the supplied selection getter prunes stale generation references. The unchanged selection wrappers still mark between-tick changes.

The registration order at [createSimulationBridge.ts](C:/Users/38909/Documents/github/aoe2-worktrees/engine-pin-1107/src/game/simulation/createSimulationBridge.ts:187) is correct. The helper runs before the adapter receives the same diff, consumes the external-change flag, and queues invalidations for that message. Reconnecting the adapter leaves the earlier helper listener in place. The tracker belongs to the live world’s lifetime; on-read bridges do not install it.

The unchanged paths at [createSimulationBridge.ts](C:/Users/38909/Documents/github/aoe2-worktrees/engine-pin-1107/src/game/simulation/createSimulationBridge.ts:193) preserve immediate full-snapshot fallback, the render-store version increment, and on-read `connect`/`finally disconnect`. The step entry still flushes external changes before pause/halt/match refusal. Tick changes continue to invalidate render-state memoization; same-tick full refreshes use the existing version counter.

The installed engine adapter still performs JSON validation and generation-sensitive creation/update/destruction. It projects the frame on every render diff. The new helper uses its public invalidation API and does not replace transport, validation, or identity handling.

The final ID comparison in [renderStore.ts](C:/Users/38909/Documents/github/aoe2-worktrees/engine-pin-1107/src/game/simulation/renderStore.ts:90) makes coincident entities deterministic after lower-ID reuse. I verified that the engine’s full snapshot enumerates alive IDs in ascending order. The dedicated test checks the expected `[3, 9]` order explicitly, so the oracle does not merely normalize both sides without specifying the result.

## Findings and disposition

No material repair is requested for this exact source candidate.

The review accepts the bounded implementation and contract coverage. It does **not** establish performance improvement, visual equivalence, complete gameplay coverage, or shipping readiness.

## Verification

The paired tests in [selectedRenderInvalidation.test.ts](C:/Users/38909/Documents/github/aoe2-worktrees/engine-pin-1107/tests/simulation/selectedRenderInvalidation.test.ts:41) compare the incremental bridge with a separate on-read bridge using fresh engine snapshots. They compare entity order and complete values, frame contents, and final serialized-world digests. Occurrence assertions require actual health, activity, construction, conversion, wildlife, regeneration, repair-threshold, and Loom changes.

The oracle is independent of the new invalidation path, though it intentionally shares the game projector and engine adapter; it is not an independent implementation of game rules. Projector calls and full snapshots are counted separately, and the static-work assertion excludes entities actually touched by component/entity diffs.

The five tests in [renderInvalidationLifecycle.test.ts](C:/Users/38909/Documents/github/aoe2-worktrees/engine-pin-1107/tests/simulation/renderInvalidationLifecycle.test.ts:76) use a real adapter to cover mutable/static classification, both sides of selection changes without intermediate reads, reclassification, destruction/reused generations, and reconnection ordering.

Retained `complete-oracle.log` reports **16 passing tests** across both files. The three inspected controls fail on their intended assertions:

- Omitting external candidates produces no updates instead of the expected mutable entities.
- Omitting old selections leaves the previous static selection out of the update list.
- Registering after the adapter leaves the first-tick Berserk projection at 10 HP while the fresh projection shows regeneration.

Current helper and bridge hashes match the controls’ retained pre-mutation hashes:

- Helper: `2A2641BD4A01346A9E36EF60EA4F7C178D3E802286D950AF2FD27BC425364DC8`
- Bridge: `5CFD2092BCC61F04B4549B26B605EAA14E3E48EB8F15306376849BDF34A2857C`

The initial fixture type errors are retained and the current tests use the existing `worldStateOf` helper. Successful typecheck and affected-file lint are **root-observed results**, not independently inspected successful log files: the advertised `typecheck-final.log` and `lint-first.log` do not exist because those successful commands were silent. Root explicitly corrected that evidence boundary. Full verification will rerun both.

The retained first-run disposition distinguishes the earlier unexpected worker exit from a passing result and does not claim a confirmed operating-system kill cause.

## Round outcome

**Accepted for this exact bounded source review, with no material findings.** The frozen source remained unchanged throughout review.

Retained-map CPU measurements, performance claims, native GPU views, version/documentation completion, full verify and audits, integration, and terminal hosted acceptance remain root-owned and pending.
