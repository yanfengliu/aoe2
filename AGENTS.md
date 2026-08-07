# AGENTS.md — aoe2

## What this is

An AoE2-style RTS in TypeScript, built on the sibling `civ-engine` repo. Spec-driven: `design/spec-final.md` plus `design/stats/` is the authoritative game definition — kept complete enough that an agent can implement and iterate the whole game from it without further user clarification.

<!-- FLEET-CANON:BEGIN sha=66d32a789510 generated from ../fleet/FLEET.md by `npm run sync-canon` — do not edit inside this block; this repo's own rules go in docs/policies/local-rules.md -->
## Fleet constitution

- Work headlessly by default. If only a browser or GUI can finish or verify the task, say why.
- You are not the only writer in the worktree: your own subagents commit, and a stash may predate you. Commit by explicit pathspec (`git commit -- <files>`), never `git commit -a`, `git add -A`, or `git add .` followed by a bare commit, and never `git stash pop` — the stash on top is often not yours. (voxel c024b33.)
- Commit each verified unit of change to `main` without being asked, and push. Gates pass before any commit that touches code; a dependency change re-runs the audit gate.
- Toolchain baseline is Node 24. A repo that must keep an older major says so in its Gates section and keeps a CI job proving it.
- Runtime model calls are authorized and already paid for — this fleet has one user, with Claude Code and Codex subscriptions — so a program here may call a model at runtime, vision included.
- The top reasoning tier is rationed: spend it only on the hardest problem, or on directing the workhorse tier that does the work — and only at maximum effort or orchestration.
- High-risk work — persistence/migrations, security/auth, concurrency, money, supply chain, edits that reach sibling repos — escalates to the multi-cli-review skill. That is a review you run yourself, not permission you ask the user for; nothing in this canon requires asking.
- Error messages are a product surface: audit them as a class, including paths the task did not touch. Each names what happened, which input caused it, and what would satisfy it — context the throw site holds for free and a reader can only buy back by running it again. That detail is what closes the loop: a bare `Validation failed` turns an already-diagnosed failure into a debugging session.
- When blocked, hand over the raw artifact — screenshot, rendered page, log line, data row — as soon as the blocker is named rather than after the analysis: your description of it is filtered through the misunderstanding that caused the block, so it cannot contain what you failed to notice.
- Task-run evidence lives only under ignored paths and is deleted once nothing active needs it; it enters Git only when review promotes it into a repository input — a fixture, golden, snapshot, or contract. Tracked docs keep conclusions and provenance only. Blob ceilings for anything promoted: over 256 KiB needs a stated reason, over 512 KiB binary or 1 MiB of anything never enters ordinary Git, and an asset store or LFS needs the user's approval.
- Write prose one line per paragraph (no hard wrapping).
- Keep a devlog: one short dated line per behaviour-changing session in `docs/devlog/summary.md`, newest first, and a section in `docs/devlog/detailed/` for anything a later session could trip over — what was believed and proved false, what a reviewer caught that the author missed, what number moved and from what. Both shapes are in `../fleet/docs/devlog-template.md`. It is history, not status: the repo's design docs hold the current position. Write it because the alternative is rediscovering your own dead ends.
- Read `docs/learning/lessons.md` at session start: the one-line index of what this repo has already paid to learn, short by construction, with each entry's war story and anchor in `lessons-evidence.md` — opened only when a rule is in doubt or the work is in that area. A lesson lands the session it is learned, as an entry there plus one line here, anchored to a measurement, commit, or test id; unanchored, it is folklore. When a lesson becomes a gate — a test, a lint rule, a fixed command — delete both halves, because the machine enforces it now and every line that stays spends the attention that keeps the rest read. Shape: `../fleet/docs/lessons-template.md`.
- Steering compounds: a direction that outlives the immediate task lands that same session — `../fleet/FLEET.md` if fleet-wide, else this repo's `docs/policies/local-rules.md` — and you say where it went.
- Reviewer model pins live only in `../fleet/docs/skills/multi-cli-review.md`; a model a product itself calls is pinned in the repo that calls it. Never hardcode a model ID anywhere else.
<!-- FLEET-CANON:END -->

## Gates

`npm test` · `npm run typecheck` · `npm run lint` · `npm run build` — all four before every code commit; only affected tests while iterating. Dependency audit gate: `npm audit --audit-level=high` (full tree and `--omit=dev`).

## Session start

Read `docs/devlog/summary.md` and `docs/architecture/ARCHITECTURE.md` before starting work. Read `docs/learning/lessons.md` too — it records what has already been tried and what it cost, and a lessons file nothing tells anyone to open is write-only.

## Invariants & boundaries

- `design/spec-final.md` is authoritative. Persist every user-described rule, mechanic, content change, UX expectation, or constraint into it as part of the same task — a task is not done until the spec reflects the rule, and the spec must stay internally consistent (edit conflicting language rather than letting two rules coexist). (Established 2026-05-08 — a complete spec is what enables autonomous iteration.)
- Do not modify the `civ-engine` repo. If a missing engine feature blocks the task, stop and report it to the user.
- Record engine weaknesses in `docs/engine-feedback/current.md` as you work (history in `docs/engine-feedback/past.md`); before writing, audit the current file's freshness with a subagent and prune stale or already-addressed items.
- Stay current with civ-engine: when the engine ships an update, check `../civ-engine/docs/changelog.md`, keep the CI engine-dist chain green (it fetches civ-engine's prebuilt tarball — engine must be green and pushed first), adapt call sites, and re-run the gates before other work. Convenience trigger: the repo-scoped `check-engine` command.
- The playtest LLM model policy — one model for every harness call, the current pin, and the wholesale-swap procedure — is governed by `design/spec-final.md` §15.7; never bump the playtest pin anywhere else.
- File size: 500 LOC cap per file, enforced by `tests/architecture/fileSizeBudget.test.ts` (legacy violators grandfathered there with shrink-only caps; split by lifecycle/role and delete the entry).
- TDD for behavior changes: tests first, testing the contract (app experience and mechanisms), not the code.
- The playtest harness observes and reports; it never writes code, applies a patch, or touches git. (The automated fix arm was removed 2026-08-01 — see `docs/architecture/decisions.md`.)

## Known traps

- Reach for the engine's introspection FIRST when debugging — `WorldDebugger`, the occupancy/path-queue/visibility probes, and `SessionReplayer` via `scripts/replay-inspect.mjs` (`fromBundle` → `openAt(tick)` → `getEconomyState()` per owner, un-fog-filtered). A playtest finding is a claim about a recorded run: verify it by replaying that exact bundle, not with a synthetic repro. (2026-06-13: an LLM conformance finding and a subagent's synthetic-repro hypothesis were both wrong; replaying the real campaign-4 bundle showed 19 woodcutters stuck `to-resource` with full trees 8 cells away, and exposed a recorder bug — `metadata.endTick: 0` — that made the bundle look un-replayable.)
- Visual changes verify with before screenshot → change → after screenshot → pixel diff, alongside the normal gates.
- Debugging sessions record their process in a new file per session from `docs/debugging/template.md`; if a later session invalidates an old conclusion, update the old doc; clean up temporary dumps when done.

## Conventions

- Devlog: `docs/devlog/summary.md` (one line per task; remove outdated info; compact past 50 lines — no cheating with mega-lines) + `docs/devlog/detailed/START_DATE_END_DATE.md` (per-task entry: timestamp, action, reviewer findings by provider/theme, result, reasoning, notes; archive via `git mv` when the active file passes 500 lines, starting a new file dated today).
- Changelog `docs/changelog.md` + `package.json` version: user-visible changes only (external audience; migration focus). Bump `c` per non-breaking change, `b` (reset `c`) per breaking change, `a` only when the user says so; one bump per coherent shipped change; pure refactors/doc sweeps bump nothing.
- Architecture: structural changes update `docs/architecture/ARCHITECTURE.md` and append a row to `docs/architecture/drift-log.md`; non-obvious tradeoffs append to `docs/architecture/decisions.md` (append-only — supersede, never delete). Non-structural fixes touch none of these.
- Lessons: `docs/learning/lessons.md` per the fleet evidence-anchor rule; code lessons need a real test node id.
- Review threads: syntheses land in `docs/threads/current/<objective>/<date>/<n>/REVIEW.md` (synthesis only — no raw CLI output; temp captures go to gitignored `tmp/review-runs/`); `DESIGN.md`/`PLAN.md` live at the objective root; move the objective to `docs/threads/done/` when closed and keep it as audit trail. Archived threads carry synthesis only — strip any `raw/` when moving to `done/` (raw has zero downstream reuse; the `REVIEW.md` is the durable, cited record).
- Canonical doc surfaces are README, ARCHITECTURE + decisions + drift-log, devlogs, and changelog. There is deliberately no `docs/api-reference.md` or guides tree — TypeScript types (e.g. `SimulationBridge` in `src/game/simulation/createSimulationBridge.ts`) are the API reference. README changes only when public surface or user-visible features change.
