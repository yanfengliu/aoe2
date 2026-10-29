# Several workers in one checkout: disjoint files, and ONE gate run over the combined tree (2026-09-05)

One of [this repo's local rules](../local-rules.md), where "above" and "below" mean earlier and later in its list.

**Amended 2026-09-22 (fleet canon, synced 2026-09-16):** workers now default to their own worktrees ("Worktrees are the default" above), one branch each. The integrator merges the branches into `main` in this checkout and runs `npm run verify` ONCE over the merged tree — the one gate over the combined tree this entry asks for. Sharing this checkout with disjoint files is now the fallback for when a worktree is genuinely unavailable, and the assignment says why. The rest holds in both modes: no worker runs `npm run verify`; one lane owns the browser pane, the preview port and `dist/`; and every commit checks `git diff --cached --name-only` first.

When several workers are given work in this one shared checkout at the same time, each gets a **disjoint set of files**, **no worker runs `npm run verify`**, and a single integrator rebuilds `dist/`, commits the batch that ships the work, and runs the gate ONCE on the batch's top (see "A batch of commits split from one gated tree" below). Every commit in that batch says plainly that the gate covered the batch's top rather than that commit alone. This is the concurrent-worker case of "one writer per checkout" above, not an exception to it: there is still exactly one session integrating, and the workers are its hands.

**Why:** three separate costs, all paid on 2026-09-05.

- `npm run verify` takes about **20 minutes**, seventeen of them the browser suite. Four workers each running it is over an hour of serialized wall time to integrate one change, and every one of those runs measures a tree that is about to change anyway.
- **`npm run build` regenerates `dist/` FROM THE SHARED TREE.** A worker that builds bakes a peer's half-finished code into the bundle the browser suite then tests — the suite is served from `dist/`, so it is no longer testing what that worker wrote. This happened here and forced a rebuild before the real gate could be trusted.
- **Concurrent heavy lanes make the gate less trustworthy, not more.** Two browser specs went red purely from machine load that day and passed when re-run alone. A red run that is really a busy machine costs the same investigation as a real defect, and teaches the next reader to discount red.

**How to apply.**

- **Name the peers' owned paths in every assignment**, not just the worker's own. A worker who knows which files are not its own can tell a peer's in-flight work from its own breakage.
- **Tell workers that a peer's in-flight file can make `tsc` red.** The instruction is to check that their own files are absent from the error list and carry on, rather than to fix or revert a file they do not own.
- **One lane owns the browser pane, the preview port and `dist/`.** Everyone else gets a `PREVIEW_PORT` away from 4173 and 4199, and does not build. A worker that needs to see something rendered asks the lane that owns the pane.
- **Verify `git diff --cached --name-only` before every commit in the batch**, against the file set that commit is supposed to carry. Staging is by explicit pathspec, as "Several sessions, one repo" above requires; the check is that the staged set is what you meant, because the tree holds other people's work.
