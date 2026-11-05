# AGENTS.md — aoe2

## What this is

An AoE2-style RTS in TypeScript, built on the sibling `civ-engine` repo. Spec-driven: `design/spec-final.md` plus `design/stats/` is the authoritative game definition — kept complete enough that an agent can implement and iterate the whole game from it without further user clarification.

This repo's own rules live in [docs/policies/local-rules.md](docs/policies/local-rules.md). They add repository constraints consistent with the fleet constitution below. That file holds one line per rule, each linked to the file that holds the rule in full with its reasons and evidence.

<!-- FLEET-CANON:BEGIN sha=b0a069afa8a5 generated from ../fleet/FLEET.md by `npm run sync-canon` — do not edit inside this block; this repo's own rules go in docs/policies/local-rules.md -->
## Fleet constitution

Shared rules for every repo under `github/`, kept in `../fleet/FLEET.md`; `../fleet/` is fleet's checkout beside this repo's primary checkout. Where a rule gives its reason, use the reason to judge cases the rule does not name; each `[Rn]`'s history is in `../fleet/docs/canon-rationale.md`. This repo's `docs/policies/local-rules.md` may add rules but cannot change these permissions or limits. [R13]

The designated coordinator reads `../fleet/docs/skills/coordinator.md` before planning and after each compaction, and any agent reads that file's "Delegate" section before delegating. Before these kinds of work, read the matching section of `../fleet/docs/work-rules.md`: standing loops and unattended runs; editing skills, agent instructions or rules; handing off or stopping mid-task.

### Permissions

- Commit, merge to main and push without asking. Force-pushing and rewriting history (they destroy history), and deploying and publishing (they reach other people), need the owner's OK. [R14]
- Ask before a major architecture or product change, a new major dependency, a change to a persistent format or a security boundary, or any other consequential action outside this machine, such as posting or sending something. [R8]
- Change fleet rules (FLEET.md, fleet skills and runbooks, agent memory) or add a rule to a repo's `docs/policies/local-rules.md` only when the owner asks, because the owner sets policy. You may add a proposal with its evidence to `../fleet/canon-candidates.md`, but not edit its entries. [R8]

### Sharing the machine

- Other Claude and Codex sessions may be working in this checkout, and you cannot see them. Do anything beyond a quick read in your own worktree, because two sessions in one tree spoil each other's gates and commits. Never revert, overwrite or delete changes you did not make. When resuming, check which worktrees, branches and files already exist. [R7]
- Done means merged to main and pushed: the owner archives sessions, and work left on a branch is lost. Merge on your branch, get the gates passing there, then move main, because other worktrees build on local main. Judge the merged result itself, not a worker's summary. Then remove your worktree and branch, and report where any unmerged work is. [R14]

### Doing the work

- The repo's gates must pass before any commit that touches code. Docs-only changes need content checks and any gate the repo names for docs, not runtime tests or CI waits. [R14]
- Check the thing that should have changed (the file, the page, the number), not just the exit code or a tool's report: both can pass over a defect. Retest a blocker you inherit before repeating it. Never weaken a test or hide a failure to get green. [R9]
- Look at visual and interactive work rendered at full resolution, through the real controls, from fixed and random views, because passing tests say nothing about pixels. Run it headless unless a visible window is needed. [R16]
- Slowness on the critical path, such as a gate rendering on the CPU of a machine with a GPU, is a defect to fix. [R22]
- After pushing code, follow CI to the end; read a failed job's steps before blaming the code, since a billing limit fails jobs before any step runs. [R15]
- If a fix fails twice for one reason, rethink it. After five real repair attempts at one problem, whatever the approach and counting earlier sessions, stop and report, unless the owner set another limit; for a problem that keeps winning, run the search in `../fleet/docs/skills/hard-problem.md`. Stop when the task's criteria are met; do not invent follow-up work. [R11]
- For substantial or high-risk changes, use independent review when available. High-risk includes persistence and migrations, security and auth, concurrency, money, supply chain, and code changes in another repo. Review the exact revision against the task's criteria, and say so when review was unavailable. Fix the findings that matter and have those fixes checked; note minor ones instead of starting another round. `../fleet/docs/skills/multi-cli-review.md` provides the review mechanics. [R10]
- A defect the owner reports gets a test for its whole class and an entry in `docs/learning/defect-register.md`, because a fix without a check tends to come back. [R17]
- Sessions run long: take new requests in the same session, and never hand off to a new session to shed context. Split work expected to need more than about 200k tokens of context into milestones, each merged to main. [R6]

### Records, sized to the work

- Read `docs/learning/lessons.md` at session start; it lists this repo's known traps, and its header says how to add one. [R18]
- Work that spans sessions, has several agents writing, or gets an independent review keeps its plan and review records in `docs/work/` (`../fleet/docs/work-docs.md`) and adds a dated line to `docs/devlog/summary.md` (`../fleet/docs/devlog-template.md`) when it lands. Other work needs neither. [R24]
- Raw output (logs, captures, screenshots) stays in ignored folders. Never commit a binary over 512 KiB or any file over 1 MiB; LFS needs the owner's OK. [R23]

### Style and environment

- Plain words; one line per paragraph, no hard wrapping. A report says what changed, how it was checked (including any check skipped or failed) and what is not done. [R25]
- Node 24 is the baseline. Products pin the model IDs they call in their own repo, and nowhere else. Reviewer model pins live only in `../fleet/docs/skills/multi-cli-review.md`. Runtime model calls are allowed and paid for; make per-item calls one-shot, not agent sessions. [R28, R29]
<!-- FLEET-CANON:END -->

## Gates

`npm run verify` is THE gate: `content:validate && test && typecheck && test:browser && lint && build`, chained with `&&` between `node scripts/verify-receipt.mjs start` and `write`. Its EXIT CODE says whether every stage exited 0 and both test suites reported a whole, passing run; a landing reads `node scripts/verify-receipt.mjs check` instead, because a run cut short through WMI exits 0 (register, 2026-10-11). Run it before every code commit. Reading a summary line out of a piped run is not running the gate — `npm test | tail` reports zero while the suite is red, and a look-alike summary has twice been quoted as green over a failing run. Only affected tests while iterating. Dependency audit gate: `npm audit --audit-level=high` (full tree and `--omit=dev`).

## Session start

Run `npm run ci:status` FIRST — it prints main's remote CI and playtest-corpus conclusions and exits non-zero when either is red, or when a red attempt or run on the tip is followed by a re-run or a later run, finished or still going (it names the job and step that failed first). A red remote gate is the next task, ahead of whatever was planned. (This is a command because the intention was not enough: main's CI ran red for 200 consecutive runs over two months behind green local gates — see the 2026-08-29 defect-register entry.) Then read `docs/learning/lessons.md` (short by construction — every entry names the gate that will retire it), `docs/devlog/summary.md` and `docs/architecture/ARCHITECTURE.md` before starting work. Of `docs/devlog/summary.md`, read the newest ten entries, which are at its top; of `docs/architecture/ARCHITECTURE.md`, read its section map, then only the sections the work needs.

## Invariants & boundaries

- `design/spec-final.md` is authoritative. Persist every user-described rule, mechanic, content change, UX expectation, or constraint into it as part of the same task — a task is not done until the spec reflects the rule, and the spec must stay internally consistent (edit conflicting language rather than letting two rules coexist). (Established 2026-05-08 — a complete spec is what enables autonomous iteration.)
- Do not modify the `civ-engine` repo. If a missing engine feature blocks the task, report the blocker and continue safe independent work within scope.
- Record engine weaknesses in `docs/engine-feedback/current.md` as you work (history in `docs/engine-feedback/past.md`); before writing, audit the current file's freshness and prune stale or already-addressed items.
- Stay current with civ-engine: when the engine ships an update, check `../civ-engine/docs/changelog.md`, keep the CI engine-dist chain green (it fetches civ-engine's prebuilt tarball — engine must be green and pushed first), adapt call sites, and re-run the gates before other work. Convenience trigger: the repo-scoped `check-engine` command.
- The playtest LLM model policy — one model for every harness call, the current pin, and the wholesale-swap procedure — is governed by `design/spec-final.md` §15.7; never bump the playtest pin anywhere else.
- File size: 500 LOC cap per file, enforced by `tests/architecture/fileSizeBudget.test.ts` (legacy violators grandfathered there with shrink-only caps; split by lifecycle/role and delete the entry).
- TDD for behavior changes: tests first, testing the contract (app experience and mechanisms), not the code.
- A visual change is not verified until a before screenshot, the change, an after screenshot, and a pixel diff exist alongside the normal gates, and the diff shows the delta confined to the region the change was meant to touch. `scripts/captureMapScreenshot.mjs` + `scripts/diffMapScreenshots.mjs` are the maintained pair (`SEED`/`LABEL` env vars reach any scenario); one-off capture scripts are not.
- Playtest runs and observation tools report; they never generate or apply product fixes or touch Git. The manually invoked `playtest:canary` developer drill is a retained exception: it temporarily applies a checked-in seeded bug and restores its clean baseline. It measures oracle sensitivity, never selects or ships a fix. (The automated fix arm was removed 2026-08-01 — see `docs/architecture/decisions.md`.)

## Conventions

- Devlog: `docs/devlog/summary.md` (one line per task; compact past 50 lines — no cheating with mega-lines) + `docs/devlog/detailed/START_DATE_END_DATE.md` (per-task entry: timestamp, action, reviewer findings by provider/theme, result, reasoning, notes; archive via `git mv` when the active file passes 500 lines, starting a new file dated today).
- Changelog `docs/changelog.md` + `package.json` version: user-visible changes only (external audience; migration focus). Bump `c` per non-breaking change, `b` (reset `c`) per breaking change, `a` only when the user says so; one bump per coherent shipped change; pure refactors/doc sweeps bump nothing.
- Architecture: structural changes update `docs/architecture/ARCHITECTURE.md` and append a row to `docs/architecture/drift-log.md`; non-obvious tradeoffs append to `docs/architecture/decisions.md` (append-only — supersede, never delete). Non-structural fixes touch none of these.
- Debugging: one file per session, copied from `docs/debugging/template.md`, which owns the copy-and-cleanup mechanics; when a later session invalidates an old conclusion, update that old doc rather than leaving it to mislead. An existing instrument comes FIRST, before any probe of your own — the rule stands, and the three tools this bullet used to name were each wrong in a different way, so they are corrected below rather than repeated. What exists, and the question each answers, is in [docs/debugging/instruments.md](docs/debugging/instruments.md). Every scratch probe under `tmp/probes/` carries a `// harness:` line naming the tool that answers its question, or `none` with the reason (a question about which cell a unit chose lives in bridge closure state that a replay re-simulates from a snapshot, so only the live bridge answers it); the hook in `.claude/settings.json` refuses to write or run a probe without that line.
- New work records: plans and every authored review round use permanent `docs/work/<id>_<theme>/` folders and the common fleet allocator. `plan.md` owns current status and shipping outcomes. During the bounded September 29 historical migration, active legacy threads retain the closure and freshness rule below; imported active wrappers and their owner threads are updated together. See `docs/policies/local-rules.md` for the verified migration boundary.
- Review threads: syntheses land in `docs/threads/current/<objective>/<date>/<n>/REVIEW.md` (synthesis only — no raw CLI output; temp captures go to gitignored `tmp/review-runs/`); `DESIGN.md`/`PLAN.md` live at the objective root. A thread closes in the commit that ships or drops its objective, never in a later sweep: `git mv` it to `docs/threads/done/`, add a closure line under the title (`Closed YYYY-MM-DD: <version or decision>`), fix every pointer to the old path, and give each leftover a home (the lessons queue, the register, or an explicit drop with its reason). Every task ends with a look at `docs/threads/current`: a thread the task advanced gets a dated status line (what moved, what is still open); one whose objective has shipped or been dropped is moved. The rule and its evidence are in `docs/policies/local-rules.md`. Archived threads carry synthesis only — strip any `raw/` when moving to `done/` (raw has zero downstream reuse; the `REVIEW.md` is the durable, cited record).
- Canonical doc surfaces are README, ARCHITECTURE + decisions + drift-log, devlogs, and changelog. There is deliberately no `docs/api-reference.md` or guides tree — TypeScript types (e.g. `SimulationBridge` in `src/game/simulation/createSimulationBridge.ts`) are the API reference. README changes only when public surface or user-visible features change.
