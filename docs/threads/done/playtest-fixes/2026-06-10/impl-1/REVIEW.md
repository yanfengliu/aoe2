# Review synthesis — playtest-fixes impl-1 (2026-06-10)

Reviewers: Codex (gpt-5.5, xhigh, read-only sandbox) + Claude (claude-fable-5[1m], max effort — first review under the new Fable-5 reviewer policy). Diff: the full playtest-fixes A-F stream + the civ-engine v0.8.15 absorb (49 files). Both read the live tree; Claude additionally verified the engine's d.ts to confirm the invariance mechanism and walked all eight requested checks.

## Findings and disposition

| ID | Severity | Finding | Disposition |
|---|---|---|---|
| Codex-1 | HIGH | Agent commands are not owner-scoped: the engine's semantic validators have no actor identity (`unit.move` checks "is a unit", `queue.train` keys costs off `building.owner`), `agentCommandValidator` explicitly assumed "ownership is enforced downstream" (it wasn't), and the prompt renders enemy ids — so the LLM could move enemy units or queue enemy production, breaking playtest validity and the prompt's own "will be rejected" claim. Verified real against both validators. Pre-existing (Phase 1), but squarely in this thread's scope. | FIXED in iter-1: new pure `checkAgentActorOwnership` in `agentCommandValidator.ts` (per-kind acting-entity map: unitId/sheepId/buildingId/builderId+additionalBuilderIds/playerId) over an owner-lookup callback; `dispatchAgentCommand` gains `options.expectedOwner` and rejects with new `CommandDispatchResult` reason `'not-owned'`; Playwright host plumbs `ownerId` through. 9 new tests. |
| Codex-2 | MEDIUM | Dispatch feedback not scoped to the agent's commands: `drainPendingCommands` reports EVERY queue entry to the observer, and the same queue carries AI/auto-aggression intentions — so unrelated engine intentions could masquerade as "your previous commands" in the next tactical prompt. Verified real (dispatcher.ts iterates the shared queue). Latent in the clean run (no combat → counts matched exactly) but real in combat-heavy runs. | FIXED in iter-1: `PendingCommand` gains a runtime-only `agentIssued?: boolean` (dropped by `clonePendingCommand`, so it never reaches snapshots/saves); the dispatcher forwards it on `AgentDispatchEvent`; `dispatchAgentCommand` tags its pushes; the browser-api observer filters to `agentIssued` only. 1 new dispatcher test. |
| Codex-3 | MEDIUM | Devlog internal inconsistency: "all four gates green" alongside "build pending in the gate run". | FIXED: wording corrected after the post-absorb gate run completed green. |
| Claude-1 | MEDIUM | The Fable-5-only sweep missed `scripts/propose-fix.mjs:137` (still `claude-opus-4-7[1m]`), contradicting spec §15.7's "all playtest LLM calls" claim. | FIXED: bumped to `claude-fable-5[1m]`. |
| Claude-2 | LOW | `RunnerHost.exportBundle` doc comment still described the removed blob-URL path. | FIXED: comment now names the chunked pull. |
| Claude-3 | LOW | Two codemod vestiges: self-casts `activeWorld as GameWorld` in `visibility.ts` (+`typedWorld` indirection) and `targetFindingOps.ts` on parameters this diff already retyped. | FIXED: casts removed; the only remaining bridge casts are the sanctioned pureHelpers seam. |
| Claude nits | NIT | Prompt says own forces "always fully listed" vs 150/64 caps (late-game over-promise); PLAN.md says `MODEL_PRICES` vs actual `DEFAULT_LLM_COST_TABLE`; `nearbyResourcesFor` doesn't owner-filter (enemy-claimed herdables listed — arguably intended); `CHUNK_BYTES` counts UTF-16 code units. | Accepted as-is (Claude marked all non-blocking; the resource-listing behavior is intended — gatherable is gatherable). |

## Positive verification (Claude's eight checks)

All eight passed against live code: own-entity composer caps/filtering sound; reportDispatchOutcome has no off-by-one and the cost-budget clobber case is guarded (the exact case the prompt asked about); atomic advanceTicks is interleaving-proof INCLUDING the accumulator question (pause gate sits before `accumulatorMs +=`, so think-time accrues zero; tickMs == deltaMs makes each step exactly one tick); chunked export boundaries/cleanup/failure-contract correct; CivWorld unification semantically right everywhere; every seam cast verified honest against the engine d.ts; fileSizeBudget net −1 with all new files under 500; docs accurate except Claude-1.

## Convergence

Iter-1 surfaced 1 HIGH + 3 MEDIUM real findings — substantive; iter-2 re-review required per convention. All findings fixed inline before iter-2.
