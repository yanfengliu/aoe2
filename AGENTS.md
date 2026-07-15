# AGENTS.md — aoe2

## What this is

An AoE2-style RTS in TypeScript, built on the sibling `civ-engine` repo. Spec-driven: `design/spec-final.md` plus `design/stats/` is the authoritative game definition — kept complete enough that an agent can implement and iterate the whole game from it without further user clarification.

## Fleet constitution

- Work headlessly by default; go non-headless only when nothing else can complete or verify the task, and say why.
- These rules are strong defaults, not law: when one would make the work worse, deviate and say why.
- Scale the approach to the task: trivial changes directly; substantial work as explore → plan → implement → verify, with subagents when work is genuinely parallel.
- Delivery boundary: each minimal coherent verified unit is reviewed, staged (scoped files only), and committed promptly — never commit failing or partial work as a checkpoint. Commit to `main`; push at the end of every task.
- The repo's gates must pass before every commit that touches code; doc-only changes need a self-reviewed diff.
- Review: self-review trivial changes; adversarially review non-trivial ones — independent agents that try to refute the change against the live code. High-risk work (persistence/migrations, security/auth, concurrency, money, supply chain, edits that reach sibling repos) escalates to the multi-cli-review skill. Reviewers must read the live code; verify reviewer claims against the codebase before acting on them; substantive findings outweigh approval votes.
- Dependency changes: re-resolve the lockfile, run the repo's audit gate (a new HIGH/CRITICAL is a blocker), and note the audit result in the commit message.
- Docs are part of the change: update every affected surface in the same commit; write prose one line per paragraph (no hard wrapping); never reference or mandate files that don't exist.
- Bias to continue: work through the whole accepted plan without mid-plan check-ins; context management is the harness's job, never a reason to stop. Stop only for a genuine blocker, a direction-changing decision, or an explicit stop. (Established 2026-05-01; reinforced 2026-07-05.)
- Model pins live only in `../loop-ops/docs/skills/multi-cli-review.md` — never hardcode model IDs anywhere else.
- Lessons files (`docs/learning/lessons.md` where present) require evidence anchors — source, fix commit, test id, behavior delta; unanchored lessons are folklore.
- Recursive loop: before running or driving a pass, read `../loop-ops/docs/skills/recursive-playtest.md`; before building loop machinery, read `../loop-ops/docs/skills/building-recursive-loop.md`.

## Gates

`npm test` · `npm run typecheck` · `npm run lint` · `npm run build` — all four before every code commit; only affected tests while iterating. Dependency audit gate: `npm audit --audit-level=high` (full tree and `--omit=dev`).

## Session start

Read `docs/devlog/summary.md` and `docs/architecture/ARCHITECTURE.md` before starting work.

## Invariants & boundaries

- `design/spec-final.md` is authoritative. Persist every user-described rule, mechanic, content change, UX expectation, or constraint into it as part of the same task — a task is not done until the spec reflects the rule, and the spec must stay internally consistent (edit conflicting language rather than letting two rules coexist). (Established 2026-05-08 — a complete spec is what enables autonomous iteration.)
- Do not modify the `civ-engine` repo. If a missing engine feature blocks the task, stop and report it to the user.
- Record engine weaknesses in `docs/engine-feedback/current.md` as you work (history in `docs/engine-feedback/past.md`); before writing, audit the current file's freshness with a subagent and prune stale or already-addressed items.
- Stay current with civ-engine: when the engine ships an update, check `../civ-engine/docs/changelog.md`, keep the CI engine-dist chain green (it fetches civ-engine's prebuilt tarball — engine must be green and pushed first), adapt call sites, and re-run the gates before other work. Convenience trigger: the repo-scoped `check-engine` command.
- The playtest LLM model policy — one model for every harness call, the current pin, and the wholesale-swap procedure — is governed by `design/spec-final.md` §15.7; never bump the playtest pin anywhere else.
- File size: 500 LOC cap per file, enforced by `tests/architecture/fileSizeBudget.test.ts` (legacy violators grandfathered there with shrink-only caps; split by lifecycle/role and delete the entry).
- TDD for behavior changes: tests first, testing the contract (app experience and mechanisms), not the code.
- The recursive pass runs the FULL loop by default (`--propose-only` opts out) and never auto-merges.

## Known traps

- Reach for the engine's introspection FIRST when debugging — `WorldDebugger`, the occupancy/path-queue/visibility probes, and `SessionReplayer` via `scripts/replay-inspect.mjs` (`fromBundle` → `openAt(tick)` → `getEconomyState()` per owner, un-fog-filtered). A playtest finding is a claim about a recorded run: verify it by replaying that exact bundle, not with a synthetic repro. (2026-06-13: an LLM conformance finding and a subagent's synthetic-repro hypothesis were both wrong; replaying the real campaign-4 bundle showed 19 woodcutters stuck `to-resource` with full trees 8 cells away, and exposed a recorder bug — `metadata.endTick: 0` — that made the bundle look un-replayable.)
- Visual changes verify with before screenshot → change → after screenshot → pixel diff, alongside the normal gates.
- Debugging sessions record their process in a new file per session from `docs/debugging/template.md`; if a later session invalidates an old conclusion, update the old doc; clean up temporary dumps when done.

## Conventions

- Devlog: `docs/devlog/summary.md` (one line per task; remove outdated info; compact past 50 lines — no cheating with mega-lines) + `docs/devlog/detailed/START_DATE_END_DATE.md` (per-task entry: timestamp, action, reviewer findings by provider/theme, result, reasoning, notes; archive via `git mv` when the active file passes 500 lines, starting a new file dated today).
- Changelog `docs/changelog.md` + `package.json` version: user-visible changes only (external audience; migration focus). Bump `c` per non-breaking change, `b` (reset `c`) per breaking change, `a` only when the user says so; one bump per coherent shipped change; pure refactors/doc sweeps bump nothing.
- Architecture: structural changes update `docs/architecture/ARCHITECTURE.md` and append a row to `docs/architecture/drift-log.md`; non-obvious tradeoffs append to `docs/architecture/decisions.md` (append-only — supersede, never delete). Non-structural fixes touch none of these.
- Lessons: `docs/learning/lessons.md` per the fleet evidence-anchor rule; code lessons need a real test node id.
- Review threads: syntheses land in `docs/threads/current/<objective>/<date>/<n>/REVIEW.md` (synthesis only — no raw CLI output; temp captures go to gitignored `tmp/review-runs/`; legacy iterations keep their historical `raw/` files); `DESIGN.md`/`PLAN.md` live at the objective root; move the objective to `docs/threads/done/` when closed and keep it as audit trail.
- Canonical doc surfaces are README, ARCHITECTURE + decisions + drift-log, devlogs, and changelog. There is deliberately no `docs/api-reference.md` or guides tree — TypeScript types (e.g. `SimulationBridge` in `src/game/simulation/createSimulationBridge.ts`) are the API reference. README changes only when public surface or user-visible features change.
