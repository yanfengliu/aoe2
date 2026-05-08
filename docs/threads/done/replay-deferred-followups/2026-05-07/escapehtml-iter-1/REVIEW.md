# escapeHtml consolidation — Iter 1

**Diff base:** `f033569` (replay-load-and-e2e thread close).
**Reviewers:** Codex `gpt-5.5` xhigh, Claude `opus-4-7[1m]` max. Both reachable.
**Disposition:** CONVERGED on iter 1 — Codex: "No substantive findings"; Claude: APPROVE with one NIT.

## Codex iter-1

**No substantive findings.** Verified the canonical helper exists at `src/ui/utils/escapeHtml.ts`, the three call sites import it correctly, the `priorSessionsCache` / `opening` reentrancy guard in `replayLoadDialog.ts` is intact, the regex never matches `__proto__`, tests cover all 5 chars + edge cases, no file > 500 LOC, and `package.json` / `docs/changelog.md` correctly remain unchanged for an internal refactor.

## Claude iter-1

**APPROVE.** Same verifications passed. One **NIT** on test naming: `'escapes the four canonical HTML metacharacters'` at `tests/ui/escapeHtml.test.ts:17` actually only asserts three (`<`, `>`, `"`); `&` and `'` are tested in adjacent cases.

**Fix applied:** renamed to `'escapes <, >, and " metacharacters'`.

Claude noted that the apostrophe addition for `postGameSummary` is invisible in text-context renders (browser parsers don't treat `'` specially in text content), so it's defense-in-depth rather than a user-visible bug fix — confirms the no-version-bump / no-changelog decision is correct per AGENTS.md.

## Disposition

Convergence on iter 1. Commit the consolidation directly to `main`. No version bump (pure refactor with defense-in-depth side effect that does not change rendered output).

## Files changed by iter-1

- `src/ui/utils/escapeHtml.ts` (new — 20 LOC).
- `src/ui/annotation/MarkerListPanel.ts`: import + delete local copy (no call-site change).
- `src/ui/replay/replayLoadDialog.ts`: import + delete local copy (no call-site change).
- `src/ui/hud/postGameSummary.ts`: import + delete local copy + 4-char→5-char upgrade (defense-in-depth).
- `tests/ui/escapeHtml.test.ts` (new — 6 tests covering & < > " ' + mixed + empty + unicode).
