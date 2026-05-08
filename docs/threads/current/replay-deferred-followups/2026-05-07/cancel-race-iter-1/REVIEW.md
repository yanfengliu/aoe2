# Cancel-during-load race fix — Iter 1

**Diff base:** `5f43a4a` (escapeHtml-consolidation commit).
**Reviewers:** Codex `gpt-5.5` xhigh, Claude `opus-4-7[1m]` max. Both reachable.
**Disposition:** Did NOT converge — both reviewers raised IMPORTANT findings; iter-2 follows.

## Codex iter-1

### IMPORTANT — `dispose()` does not invalidate in-flight async handlers

`generation` only increments from the dialog `close` listener. `dispose()` removes listeners and detaches the dialog without changing the generation token. If the dialog is disposed while a prior-row load or file read is pending, the resumed handler can still reach `enterReplay` after teardown. Real lifecycle race distinct from the normal Cancel path.

### IMPORTANT — Unguarded `handleTabClick` can stale-write `priorSessionsCache`

The handler awaits `recording.listPriorSessions()` and then writes `priorSessionsCache` + calls `renderPriorList()` with no generation check. An older tab-click request can resolve after a later reopen reset and repopulate the cache with stale descriptors. The "DOM-only" characterization is incomplete — the post-await path mutates dialog state that controls whether later prior-tab clicks re-fetch.

### MAJOR — Missing version bump + changelog + devlog

`package.json` remains `0.1.13`, `docs/changelog.md` still tops out at `0.1.13`, and the devlog still lists the cancel-race as deferred. Per AGENTS.md this is a user-visible bug fix and needs the `0.1.14` treatment before declaring the task complete. Absence from the reviewed commit is not acceptable as a shipped unit.

Codex acknowledged the core race fix (signal check + post-await guards; tests exercise the actual race window) and confirmed the slice-4 transactional `enterReplay` and `priorSessionsCache` / `opening` reentrancy guards are untouched.

## Claude iter-1

### IMPORTANT — Same doc/version gap as Codex's MAJOR

Code changes are not done until docs match.

### Race correctness — VERIFIED

`enterReplay` is synchronous; the helper's `signal?.isCancelled()` check between the bundle await and the controller call closes the prior-row race. `parseSessionBundleFile` is also synchronous, so the handler's post-`file.text()` check closes the file-import race.

### Listener leak — VERIFIED no leak

The `'close'` listener captures only the `generation` `let` binding plus `dialogEl`; once the caller releases the `api` handle, the entire closure graph is GC-eligible.

### `handleTabClick` and `open()` not guarded — JUSTIFIED

(Note: Codex disagreed on `handleTabClick`; iter-2 sides with Codex and adds the guard.)

### Test coverage — VERIFIED

Tests place Cancel before resolving the controlled promise, exercising the actual race window. Pre-fix code would call `enterReplay`; the assertion would fail.

### NITs

1. `LoadPriorSessionSignal` could be the standard `AbortSignal`. Deferred — local clarity acceptable.
2. Polyfill `__polyfilled` brand on a function reads awkwardly. Deferred.
3. The two cancel-checks in `handleFileChange` are intentional but a comment would help. Adopted in iter-3 (deferred from iter-2 since the iter-2 changelog edits surfaced the same area).
4. Positive call-out on the generation-token comment block.

## Iter-2 actions

1. Add `generation += 1` to `dispose()` (closes Codex IMPORTANT #1).
2. Add generation guards to `handleTabClick` and `open()`'s in-flight `listPriorSessions` await (closes Codex IMPORTANT #2 + open() symmetry).
3. Bump `package.json` 0.1.13 → 0.1.14, add changelog entry, append devlog entry (closes both reviewers' MAJOR/IMPORTANT doc gap).
4. New tests: dispose-during-prior-row + handleTabClick stale-cache.
5. Add comment to `handleFileChange` on why two cancel-checks are needed (Claude NIT 3) — deferred again in iter-2; landed in iter-3 alongside the changelog edits.

NITs deferred: `AbortSignal` migration, `__polyfilled` brand cleanup. Out of scope; can land later.
