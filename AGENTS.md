# AGENTS.md — aoe2

## What this is

An AoE2-style RTS in TypeScript, built on the sibling `civ-engine` repo. Spec-driven: `design/spec-final.md` plus `design/stats/` is the authoritative game definition — kept complete enough that an agent can implement and iterate the whole game from it without further user clarification.

<!-- FLEET-CANON:BEGIN sha=f3fc55a93a9a generated from fleet/FLEET.md by `npm run sync-canon` — do not edit inside this block; this repo's own rules go in docs/policies/local-rules.md -->
## Fleet constitution

- Work headlessly by default. If only a browser or GUI can finish or verify the task, say why, and close what you opened.
- Concurrent sessions share one worktree and one index: commit by explicit pathspec (`git commit -- <files>`), never `git commit -a`, `git add -A`, or `git add .` — a sweeping commit captures whatever another session has staged. (voxel c024b33.)
- Commit each verified unit to `main` promptly without being asked, and push at the end of the task; never commit failing or partial work as a checkpoint. Gates pass before any commit that touches code; a dependency change re-runs the audit gate.
- Toolchain baseline is Node 24, pinned per repo in `.nvmrc`. A repo that must keep an older major says so in its Gates section and keeps a CI job proving it.
- Runtime model calls are authorized and already paid for — this fleet has one user, with Claude Code and Codex subscriptions — so a program here may call a model at runtime, vision included, wherever that beats a hand-written heuristic. Model output proposes; a deterministic check disposes.
- A fix is done when the failing case has been rerun and a regression test or fixture fails if the fix reverts. A diff is not evidence.
- High-risk work — persistence/migrations, security/auth, concurrency, money, supply chain, edits that reach sibling repos — escalates to the multi-cli-review skill.
- Error messages are a product surface: audit them as a class, including paths the task did not touch. Every path that rejects or throws names what happened, which input caused it, and what would satisfy it — never a bare `Validation failed`.
- Docs are part of the change: update every affected surface in the same commit, and write prose one line per paragraph (no hard wrapping).
- Task-run evidence — raw traces, per-sample results, screenshots, recordings, generated reports, archives — lives only under ignored paths and is deleted once nothing active needs it; never commit, push, or move it to LFS. Tracked docs keep conclusions and provenance only. Such output enters Git only when review promotes it into a genuine repository input — a fixture, golden, snapshot, or contract.
- Git blob ceilings: a new or changed blob over 256 KiB needs an explicit repository-input reason; over 512 KiB binary, or 1 MiB anything, never enters ordinary Git. An external asset store or LFS requires explicit user approval, and an existing oversized blob is never precedent for another.
- Steering compounds: when the user gives a direction that outlives the immediate task, land it that same session — `../fleet/FLEET.md` if fleet-wide, else this repo's `docs/policies/local-rules.md` — and say where it went.
- Citations are part of the deliverable: anything with a public answer — a numerical method, a library's behaviour, an engine parameter, a format, a protocol — carries the source it was read from, and so does any mechanism offered to explain a measured result. A dependency's source is one call away (`gh api repos/<owner>/<repo>/contents/<path>`).
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
