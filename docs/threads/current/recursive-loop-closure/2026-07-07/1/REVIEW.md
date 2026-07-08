# Review - 2026-07-07 Iteration 1

## Scope

Track A recursive loop closure: engine-1.6 alignment (widened `nextAction` classification, minimal schema-version stamping, replay-gated oracle verification), episodic memory (`knownIssues` prompt section + `--known-findings`), the new `playtest:recursive` bounded pass (run -> ledger -> propose -> opt-in apply+gate -> rerun -> prove-fixed -> engine pass manifest), and the legacy auto-fix path note.

## Reviewers

Codex CLI (`gpt-5.5`, xhigh, read-only sandbox) + one in-process adversarial subagent with live probes, per the multi-CLI escalation for agent-loop/apply-to-worktree machinery.

## Findings

- **HIGH (in-process) - prove-fixed was unsound for tick-anchored oracle candidates.** Oracle identity keys embed run-specific ticks/entities/messages, and LLM-driven reruns drift even at temperature 0 — so the same bug class recurring at a new tick produced a fresh identity, the candidate looked "resolved," and the pass reported `fixed-proven` for an unfixed bug (the exact inversion of the design's "safe direction" claim). Fixed: `proveFixOutcome` proves at ORACLE granularity — any same-oracle violation in the rerun (or any same-identity finding) holds the fix unproven — judged over the union of rerun-ledger findings and a fresh oracle sweep; DESIGN.md rewritten to document the rule and why. Pinned by four tests including the fresh-identity and marker-shadow cases.
- **HIGH (Codex) - `fixed-proven` could also be faked by ledger source priority.** `extractImprovementFindingsFromRun` prefers markers over oracle violations, so a rerun with any marker finding dropped oracle rows from the ledger entirely. Fixed: the pass re-runs the oracles directly over the rerun bundle and judges against the union (same fix as above); failure to evaluate oracles is conservatively `fix-unproven`.
- **MEDIUM (in-process) - the fresh oracle sweep skipped `repairBundleEndTick`,** so legacy-shaped bundles (endTick 0) would under-detect pinned-unit violations in exactly the backstop path. Fixed: repair extracted into shared `src/game/playtest/bundleEndTick.ts`, applied in both the self-improve script and the recursive sweep.
- **MEDIUM (Codex) - per-run budget forwarding let one `--apply` pass spend ~2x `--cost-budget`, and the manifest undercounted.** Fixed: the pass splits the budget (run gets half up front, rerun gets the unspent remainder, floor $0.50); the manifest documents that `costUsd` meters playtest envelopes only (the propose-fix CLI call runs on subscription auth and is unmetered).
- **MEDIUM (Codex) - invalid `--known-findings` leaked the Vite/Chromium processes** (validated after server/browser startup, `process.exit` bypassing cleanup). Fixed: validated immediately after arg parsing, before any startup.
- **MEDIUM (in-process) - the prove decision lived in untested script code.** Fixed: composition moved into `recursivePass.proveFixOutcome` and unit-tested; the script only assembles inputs.
- **MEDIUM (in-process) - unsanitized `violation.oracle` as a directory segment** (marker-derived candidates carry LLM-authored `area` text; Windows-invalid chars crash `mkdirSync`, `../` content escapes the proposal root). Fixed: `slugIdPart` exported and applied in BOTH `propose-fix.mjs` and the recursive pass so the derived paths stay agreed; oracle-named flows are byte-identical (names already slug-safe).
- **MEDIUM (in-process) - design/impl mismatches.** Fixed by aligning DESIGN.md: no wall-clock-ceiling or `--max-fix-attempts` flags (one attempt per pass, hard-coded), `--known-findings` is explicit (auto-chaining is a follow-up), and the corrected prove-fixed semantics.
- **LOW (both) - assorted.** Fixed: manifest attribution (`model`/`provider` dropped; `reviewer` recorded under `data`), silent envelope-cost probe (no error noise on proposal-only passes), `return finish(...)` at every call site, HEAD-left-on-branch documented in the header, known-issue lines whitespace-collapsed (prompt-injection hygiene) with limit clamped, unused import removed, seed sanitized for branch/pass ids, pass dir stamped with pid, pre-existing `critical -> low` severity collapse in `fixProposalInput.normalizedSeverity` corrected to `critical -> high`.

Clean per reviewers (verified against live code): worktree safety (gitignored `output/` survives `git clean -fd`, dirty/main preconditions, applyAndGate revert-on-gate-failure, branch ownership rules), proposal path parity between the two scripts, `alignOracleVerification` gating with strict-assert fallback, classification routing, minimal stamping site completeness, knownIssues threading and placement in both prompts, Windows spawn robustness, no async-exit race (sync manifest write before `process.exit`).

## Disposition

All findings fixed in this iteration. The prove-fixed HIGH pair is the load-bearing correction: false-proven is now structurally unreachable for same-oracle recurrences; residual nondeterminism lands on `fix-unproven` (revert), the safe direction.

## Verification

- `npx.cmd vitest run tests/playtest/` — 312 passed + 1 skipped (35 files) after all fixes; `tsc --noEmit` clean.
- Full gates green before commit: `npm test` (1846 passed + 2 skipped), `npm run typecheck`, `npm run lint`, `npm run build`.
