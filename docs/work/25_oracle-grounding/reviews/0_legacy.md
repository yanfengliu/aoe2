# Review synthesis — oracle-grounding impl-1 (2026-06-10)

Scope: finding-G fix (observation oracle graded the passive human's HUD instead of the agent's economy) + cost-constant re-derivation + corpus smoke row drops `omniscient` + engine v0.8.16 check. Reviewers: Codex (gpt-5.5 xhigh) + Claude (claude-fable-5[1m] max), both reading the live tree.

## Findings and disposition

| ID | Severity | Finding | Disposition |
|---|---|---|---|
| Codex-1 ≈ Claude-2 | MEDIUM | Spec §15.7's observation bullet still described the pre-fix summary (no agent-state block, no HUD-ownership rule) — a handoff would rebuild the oracle with the finding-G blind spot. | FIXED: bullet now documents the agent-state block + HUD grounding (landed between the two reviews; Claude reviewed the pre-fix snapshot). |
| Codex-2 | MEDIUM | Stale `omniscient`/smoke-baseline rationale in 3 source comment sites (corpusLlmSchema rationale was fine; agentSnapshot ×3 + browserTestAgentApi) contradicting the new fog-filtered smoke row. | FIXED: comments now describe omniscient as opt-in cheat mode; corpus row runs fog-filtered since 2026-06-10. |
| Claude-1 | MEDIUM | Spec §15.7's cost-budget bullet still said ~$0.25/call → ~18 decisions; the diff's own constants say $0.55 observed (~$0.61 blended → ~8 decisions on the default $5). Operators budgeting from the spec would be 2.2× off. | FIXED: bullet re-derived ($0.55/call observed, ~8 decisions default, `--cost-budget 20` ≈ a full 5000-tick run). |
| Codex-3 | LOW | No vitest coverage of the script-level wiring (post-run snapshot pull → summary). | Accepted with rationale: matches the repo convention (runner tested via RunnerHost mock; the .mjs layer is thin glue validated by real runs) — Claude independently reached the same conclusion ("that matches the established convention here"). The live campaign-1 run exercises the wiring end-to-end. |
| Claude minor | NIT | `--observation` flag comment said "~$0.10 per run" (same vintage as the stale constants); the inner snapshot catch was fully silent (persistent breakage would quietly degrade verdicts). | Both FIXED: comment re-derived (~$0.40-0.60); catch now `console.warn`s. |
| Claude pre-existing | NOTE | The committed `aoe2-prototype` baselines date from the no-op-agent era (9cfc503) and were never re-captured after the agent started actually playing; whether checkpoint diffs cross the 5% HIGH corpus gate is empirical (observed 2.1% so far). | Queued for operator decision (baseline updates are a deliberate human action per the visual-oracle design); recorded in the devlog backlog. |

## Verified clean

Claude confirmed the engine v0.8.16 check beyond the intent's own greps (`selfCheck`/`FileSink`/engine `findNearest`/`onDiff` listeners — zero aoe2 exposure), the `AgentPlayerState` shape, pause/engineHalt safety of the post-run snapshot (pure read; `perPlayer` is never fog-filtered so the agent row always resolves), back-compat of the optional params, and the internal consistency of the cost math.

## Convergence

No code defects in either review; all substantive findings were doc-accuracy items, all fixed inline. Converged at iter-1.
