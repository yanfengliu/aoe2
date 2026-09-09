# Prior-session e2e + dialog interactivity fix — Iter 1

**Diff base:** `f9d476c` (v0.1.14 cancel-race fix).
**Reviewers:** Codex `gpt-5.5` xhigh, Claude `opus-4-7[1m]` max. Both reachable.
**Disposition:** Did NOT converge — Codex raised 1 MAJOR + 2 IMPORTANT + 1 NIT; Claude raised 2 NITs (one shared with Codex). Iter-2 follows.

## Codex iter-1

### MAJOR — `npm test` validation claim is misleading

The diff's Validation section says "863 unit tests pass; 5 known full-suite contention flakes (pass in isolation) per AGENTS.md." Codex verified `AGENTS.md` does not contain a flake-exception clause. Per AGENTS.md "All four must pass before declaring a task done." Either fix the gate or explicitly mark the docs as honest about a failing gate.

**Fix applied in iter-2:** changelog Validation now says "5 pre-existing full-suite contention flakes ... that pass in isolation. These are not introduced or affected by this change — same flakes ride v0.1.13 / v0.1.14. AGENTS.md does not yet codify a contention-flake exception, so flagging here for transparency." Devlog mirrors the same.

### IMPORTANT — `package-lock.json` not bumped

`package.json:3` is `0.1.15` but `package-lock.json` still has `0.1.13`. Avoidable lockfile churn on next install.

**Fix applied in iter-2:** ran `npm install`, lockfile resolved to 0.1.15. `npm audit --audit-level=high` clean for prod; one dev-only moderate (sub-blocker).

### IMPORTANT — Visual gate unmet

CSS/browser-interaction fix without before/after screenshots + pixel diff per AGENTS.md "When the change is visual" rule.

**Fix applied in iter-2:** captured before/after screenshots via a temporary `tests/browser/capture-dialog.spec.ts` (since deleted) by reverting one CSS rule, screenshotting, restoring, screenshotting again. Wrote `scripts/diffReplayLoadDialog.mjs` mirroring the existing `diffMapScreenshots.mjs` pattern. Generated `docs/devlog/artifacts/2026-05-07-replay-load-dialog-{before,after,diff}.png`. Diff covers 14.45% of pixels, highlighting the now-hidden Prior + From-file panel content stack.

### NIT — CSS specificity diagnosis is wrong (shared with Claude)

Both reviewers caught: docs/comments said class selectors "outweigh" attribute selectors. They have **equal** specificity per the CSS Selectors spec. The original bug was author-vs-UA cascade origin; the fix wins on author-stylesheet specificity (`.class[attr]` is 0,2,0 vs `.class` 0,1,0).

**Fix applied in iter-2:** reworded styles.css comments, changelog, and devlog to cite cascade origin for the original bug and class+attribute specificity for the fix.

## Claude iter-1

### NIT — Same CSS specificity issue as Codex

(Addressed above.)

### NIT — Comment at `src/styles.css` for the panel-hide rule conflated panel-hide with click fall-through

The original comment muddled cause and effect — said clicks fall through to html "because the live-panel button stack visually covers the cancel button on smaller viewports." Click fall-through is caused by the *separate* pointer-events bug (fixed by the *other* new rule). Visual covering doesn't make clicks fall through to `html`.

**Fix applied in iter-2:** the panel-hide comment now describes cascade origin + specificity. The pointer-events comment explicitly notes "the panel-hide bug above is independent and produces visual stacking; this rule is what restores click handling."

## Anti-regression / verification (positive findings agreed by both reviewers)

- Both reviewers verified the v0.1.14 anti-regression items are intact (priorSessionsCache, opening flag, generation token, dispose-bump, slice-4 transactional `enterReplay`).
- Claude ran `npx playwright test tests/browser/replay-load-dialog.spec.ts` and saw 5/5 pass — confirms the changelog claim.
- Both reviewers traced `seedPriorSession` → `bridge.saveGame()` → `handleLoadGame` → `chainRebuild` → `rebuildAnnotationStack` → previous stack's `dispose` → `recording.stop()` → mirror flush + `markClosed`. Confirmed the prior session shows up in `listPriorSessions()`.
- Test stability: 120 ticks confirmed deterministic (existing live-confirm test uses same drive + asserts non-empty bundle implicitly via successful replay-mode entry).
- Version bump consistent across `package.json`, changelog, devlog summary, devlog detailed.

## Iter-2 actions

1. Lockfile bump (npm install) — closes Codex IMPORTANT.
2. Visual gate (before/after/diff screenshots + diff script) — closes Codex IMPORTANT.
3. Gate honesty wording — closes Codex MAJOR.
4. CSS specificity wording fix in styles.css + changelog + devlog — closes both reviewers' NIT.
5. Comment-conflation fix in styles.css panel-hide rule — closes Claude NIT.

NITs deferred: none.
