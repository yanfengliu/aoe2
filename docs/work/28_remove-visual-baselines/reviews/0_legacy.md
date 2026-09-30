# Review synthesis — remove-visual-baselines impl-1 (2026-06-11)

Scope: option C (user decision) — delete the visual-baseline concept from the LLM harness; checkpoint screenshots become dashboard-only (`--screenshot-every`); corpus/auto-fix visual gating removed; baselines + capture script deleted; `visualOracle.ts` retained unwired. Plus the mid-task civ-engine v0.8.17-0.8.19 absorb (`skipRegistrationCheck` at replayer sites).

Reviewers: Claude (claude-fable-5[1m], max — full live-tree verification) + Gemini (gemini-3.1-pro-preview, plan mode — prompt-only structural fallback). **Codex was unreachable (usage limit, resets Jul 10)** — per the AGENTS.md unreachable-CLI rule, proceeded with the remaining reviewers; retry Codex next iteration.

## Findings and disposition

| ID | Severity | Finding | Disposition |
|---|---|---|---|
| Claude-1 ≡ Gemini-1 | MEDIUM | Stray codemod scratch file `patch-c-corpus.mjs` staged at the repo root (preview-only, would throw if re-run; AGENTS.md requires temp tooling under tmp/, unstaged). Found independently by both reviewers. | FIXED: unstaged + deleted. |
| Claude-2 | LOW | Dangling truncated comment in `playtest-corpus-llm.mjs` describing the deleted visual column (codemod anchored on the comment's second line). | FIXED: line removed. |
| Claude-3 | LOW | Dashboard header comment mangled by the codemod (parenthetical split across unrelated lines); dead `.delta*` CSS classes. | FIXED: header rejoined; dead CSS removed. |
| Claude-4 | LOW | Four stale comments still referencing the removed oracle/baselines (llmRunner ×3, playtest-llm advanceTicks host comment). | FIXED: all reworded; grep for "visual oracle"/"baseline checkpoints" in src now clean. |
| Claude-5 | LOW | `--screenshot-every` missing from the script's CLI usage doc block (the handler existed; the doc insert had silently failed). | FIXED: documented with the divisibility guidance. |
| Claude-6 | LOW | Spec §15.7 intro still said the harness "checks for gameplay/visual regressions", contradicting the option-C bullet below it. | FIXED: reworded (gameplay regressions; advisory visual observation, no pixel gating). |

## Verified clean

Claude's structural pass (all live-tree): zero remaining references to `envelope.visualOracle` / `baselineCheckpointTicks` / `listBaselineCheckpoints` / `capture-baselines` / `tests/playtest/baselines` outside intentionally-historical records; `--screenshot-every` guard semantics sound (0/negative/NaN disable; cap at maxTicks; exact-landing unchanged); corpus `out` in scope with header/row column alignment; dashboard filesystem reads try/catch-safe with correct relative img paths; retained-unwired `visualOracle.ts` disposition accepted (deterministic-corpus reservation is concrete; noted trade-off: future capture tooling rebuilds from git history); spec/README/ARCHITECTURE/CI consistent. Gemini independently confirmed the rename consistency, gating logic, import pruning, and doc accuracy.

## Engine absorb (in the same diff)

civ-engine v0.8.18's registration-manifest verification correctly identifies aoe2's replay factory as divergent — by design (replay-mode systems + `aoe2ReplayPendingCommandDrain`). Applied the engine's documented `skipRegistrationCheck` escape hatch at the single production construction site (ReplayController, with rationale comment) + 5 test sites; 25 `BundleIntegrityError` failures → 0. selfCheck remains the divergence backstop. v0.8.19 `error.name` wire delta: zero aoe2 exposure (no name string-matching). v0.8.17 is engine-internal CI.

## Convergence

Gemini: "Approve after removing patch-c-corpus.mjs." Claude: no HIGH; 1 MEDIUM + 5 LOW, all cleanliness/doc items, all fixed inline. Converged at iter-1 (two reviewers; Codex retry owed next iteration).
