# Review synthesis — playtest-fixes impl-2 (2026-06-10)

Reviewers: Codex (gpt-5.5, xhigh) + Claude (claude-fable-5[1m], max). Input: cumulative diff (playtest-fixes A-F + engine v0.8.15 absorb + iter-1 fixes) + the iter-1 synthesis. Both verified every iter-1 fix against the live tree.

Process note: the `browserTestApi.ts` → `browserTestAgentApi.ts` split (the agent sub-API extraction forced by the 500-line budget after the ownership code landed) happened after the iter-2 diff snapshot was taken. Claude detected and reviewed it anyway by reading the live tree ("the split is clean — type-only import back to BrowserTestBridge avoids a value-level cycle, behavior identical"); Codex flagged only that the new file was untracked at review time (staged before commit). The split is a pure code move verified by full gates.

## Iter-1 fix verification

Both reviewers confirmed all five iter-1 fixes landed and are correct. Claude's deep pass: ownership switch covers all 15 GameCommands kinds with the right component per id family (targets intentionally unchecked — attacking enemies is the point); `agentIssued` is set in exactly one place, dropped by `clonePendingCommand` on every persistence path (save flush + both hydrates), and there is exactly one drain site; the atomic-advance accumulator argument re-verified (pause gate before `accumulatorMs +=`, tickMs == deltaMs → exactly one tick per step); no stale model strings remain in `scripts/`.

## Findings and disposition

| ID | Severity | Finding | Disposition |
|---|---|---|---|
| Codex-1 ≡ Claude NEW-1 | MEDIUM | Pre-queue rejections (`not-owned`, `malformed-payload`, `wrong-owner-range`) bypass the new feedback loop — they never enter the engine queue, so the next prompt's outcome line under-reports (an all-rejected decision would read "0 accepted, 0 rejected"). The ownership gate (iter-1) re-opened the retry-blind failure mode for the id-confusion class. Independently found by both reviewers. | FIXED in iter-2: the runner synthesizes feedback events from rejected `dispatchResults` (commandType from the dispatched command, reason/details from the result) and merges them ahead of the drained events in `reportDispatchOutcome`. New runner test pins "0 accepted, 1 rejected" + `not-owned` + REJECTED warning rendering. |
| Codex-2 | MEDIUM | `nearbyResources` lists non-harvestable entities (wolf, relic → `null` economy resource) as gather targets; a `unit.gather` against them no-ops with no useful feedback. | FIXED in iter-2: `nearbyResourcesFor` filters through `resourceKindToEconomyResource(kind) !== null`. New snapshot test pins wolf/relic exclusion. |
| Codex-3 | MEDIUM | `browserTestAgentApi.ts` untracked in the worktree at review time — committing the split without it would break the build. | Resolved at commit: `git add -A` stages it; gates run on the full tree. |
| Claude NEW-2 | LOW | Spec §15.7 didn't document the ownership gate / `not-owned` reason. | FIXED: one sentence added to the Agent-context bullet (ownership enforcement + pre-queue rejection merge). |
| Claude NEW-3 | LOW | Ownership boundary fail-open in two places: `expectedOwner` undefined skips enforcement (acceptable today — sole caller passes it); the per-kind switch had no default, so a future 16th kind would silently bypass. | Default arm FIXED (fail-closed: unknown kind → rejected "no ownership rule"). The undefined-skip default stays as designed back-compat; documented in the dispatch doc comment. |
| Claude pre-existing | LOW | `snapshotForAgent` hardcoded `tps: 50` vs the sim's `TPS = 10` — the agent's `elapsedMmSs` clock ran 5× fast (tick 2000 shown as "00:40" instead of "03:20"), skewing pacing judgment. Pre-existing Phase-1.B, adjacent to this thread's snapshot overhaul. | FIXED: imports `TPS` from `prototypeScenario` (no hardcode). |

## Convergence

Iter-2 verdicts: Claude — "all five iter-1 fixes landed and are correct... if NEW-1 is fixed I'd call this thread converged — the remaining items are nitpick-grade." Codex — no HIGH; two real MEDIUMs (one shared with Claude), both fixed inline with tests, plus a staging observation. Both reviewers' substantive findings are closed with reviewer-specified one-line-to-small fixes, each test-covered where behavior-bearing. **Converged at iter-2.**

Residual accepted items (carried from iter-1 dispositions + iter-2 notes): prompt's "always fully listed" vs caps phrasing; `CHUNK_BYTES` naming; enemy-claimed herdables listed as resources (intended); mid-run save/load strips the `agentIssued` tag (documented design; harness never saves mid-run). Queued follow-ups (devlog): observation-oracle HUD blind spot (G), placement-validity prompt hints (H).
