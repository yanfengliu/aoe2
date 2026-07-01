## Agentic working style

Treat the rest of this file as **defaults, not rigid law.** The right approach is the one that fits the task in front of you — when a rule here would make the work worse, deviate and say why. Hard "always use X / never use Y" mandates go stale and silently mislead faster than principles do; optimize for the outcome (correct, verified, readable) over any prescribed mechanism.

**Scale the approach to the task.**

- Trivial or conversational (a one-line fix, a question) → just do it directly.
- Substantial work (multi-file features, migrations, audits, broad refactors, research) → orchestrate it. Don't grind through it solo when parallel agents would be faster, more thorough, or would keep your own context lean.

**Reach for modern agentic techniques when they fit:**

- **Compose a bespoke harness per task.** Decide the shape — explore → plan → implement → verify — and build that flow deliberately instead of following a fixed checklist. Different tasks want different orchestration.
- **Fan out a team of subagents.** Run independent work in parallel (one agent per file, module, or dimension), then integrate. Delegation also keeps the orchestrator's context lean on large jobs.
- **Use dynamic multi-agent workflows** for decompose-and-cover or generate-and-judge work: parallel exploration, pipelined stages, a final synthesis.
- **Verify adversarially.** For non-trivial findings or changes, have an independent agent try to refute them or re-run the checks against the real code — don't trust the first pass.
- **Offload to stay lean.** Push large reads, broad sweeps, and self-contained implementation chunks to subagents; keep the main thread for decisions and integration.

This does not lower the verification bar: tests still pass, diffs still get reviewed, docs still stay current. It changes *how* you get there, not the standard.

## Continuing through plans

- **No stopping points within a multi-task plan.** When the user gives you a plan with N tasks, work through all N continuously. Do not stop and ask whether to keep going. Do not pitch `/schedule` for the rest of the work the user already asked for. Harness reminders ("task tools haven't been used recently", auto-mode banners, context warnings) are NOT stop signals — they are administrative noise. Treat the plan itself as the contract, and treat "continue" as the default.
- The exception is a genuinely non-obvious decision that requires user judgment (e.g., which of two unequal interpretations of a spec is intended). For routine choices, make the call and proceed.
- This rule was established 2026-05-01 after the user objected sharply to mid-stream stoppage during the investing-tool implementation. The same rule lives in every other repo's AGENTS.md.

## Core rules

- Use test-driven development for behavior changes: write or update tests first, then make them pass. Test the contract, not the code: tests should focus primarily on app experience and mechanisms.
- For each desired change, make the change easy, then make the easy change.
- Before implementing a change, write a plan.
- Verify every change against this project's gates: `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`. All four must pass before declaring a task done.
- **Dependency-change protocol (mandatory whenever you touch `package.json`'s dependency surface):**
  1. Re-resolve the lockfile: `npm install` (commits `package-lock.json`).
  2. Run `npm audit --audit-level=high --omit=dev` and `npm audit --audit-level=high`. A new HIGH/CRITICAL CVE is a blocker — upgrade past it, swap the dep, or document the suppression in the devlog with a reason and expiry date.
  3. Mention the audit result in the commit message.
  Skipping any step is a process regression — supply-chain risk compounds silently.
- **Multi-CLI code review is mandatory for every behavior or code change before declaring the task done.** Run Codex + Claude per the Code review section, synthesize their findings into `docs/threads/current/<objective>/<date>/<iteration_number>/REVIEW.md`, address every real finding, and re-review until reviewers nitpick instead of catching real bugs. Move the thread to `docs/threads/done/<objective>/` when the task is closed. This applies to all changes — single-file fixes, doc-only edits with code implications, refactors, and big features alike. Do not rationalize your way out of review with phrases like "single-file behavior fix," "trivial change," "TDD coverage is sufficient," "subagent dispatch is a tool not a mandate," or any equivalent. The Code review section is non-negotiable; the Team-of-subagents flexibility clause does NOT cover the multi-CLI review step. Skipping review is a process regression and must be corrected by running the review post-hoc on the same branch before merge.
- **Verify reviewer claims against the codebase before acting on them.** As the driver (team lead / main agent), when a reviewer says "function X has signature Y" or "this contract is broken," grep / read the actual file before merging the fix. A reviewer might be working from training knowledge, a stale snapshot, or a hallucinated symbol. The cost of one extra `Read` is negligible; the cost of acting on a stale or wrong claim is rework + iteration debt. This pairs with the "Reviewers MUST read the codebase" rule in the Code review section — what gets verified is more important than who said it.
- When the change is visual:
  - Capture a before screenshot.
  - Apply the change.
  - Capture an after screenshot.
  - Generate a pixel diff and use that as verification alongside the normal test/build gates.

## Team of subagents (flexible, not rigid)

Subagent dispatch is a tool, not a mandate. Use it when:

- Context budget matters (a long-running investigation that would clutter the main thread)
- Work is genuinely parallel (independent searches or independent reviews)
- A specialist agent type fits naturally (Explore for codebase audits, etc.)

For sequential focused work in the main thread, act as engineer directly — dispatching adds overhead and removes the ability to course-correct quickly.

When you do dispatch, the team roles below describe how to brief them. The Team Lead role is always you (the main agent).

- **Team lead** (always the main agent):
  - Breaks the human's request into atomic tasks, selects the appropriate domain specialists, routes the tasks, and acts as the final gatekeeper before merging.
- **Architect**: Acts as a consultant. Drafts the initial implementation plan and verifies it against ARCHITECTURE.md before work dispatches.
- **Game designer**: Validates that the game mechanism works well and is fun. Researches local and online sources to ground opinions.
- **Software engineer**: Handles code writing.
  - After coding, ask the code reviewer to review (see Code review section). Iterate with reviewers — diff reviews take ~5 minutes per CLI; use `run_in_background: true` and an `until [ -s <output-file> ]; do sleep 8; done` poller to wait without burning context or hitting harness sleep limits.
  - After addressing review comments, ask the reviewer to verify the fix.
  - If engineer + reviewer cannot reach consensus after 3 iterations, surface the disagreement to the user with both positions and let the user decide.
  - Save reviewer synthesis under `docs/threads/current/<objective>/<date>/<iteration_number>/`, mirroring the full-codebase review convention (see `docs/threads/done/full/<date>/<iteration_number>/` for historical precedent). The `<objective>` folder is a concise kebab-case phrase naming the work, such as `unit-pathfinding-T2`, `combat-rules-T1`, or `engine-feedback-cleanup`; for full-codebase reviews, use `full`.
  - Thread-level design artifacts live directly under the objective folder as `DESIGN.md` and `PLAN.md`. These are the authoritative design and implementation-plan docs for that objective; `<date>/design-N/REVIEW.md` and `<date>/plan-N/REVIEW.md` are only historical review summaries of design or plan iterations.
  - Each iteration directory contains only `REVIEW.md`, the concise synthesized summary with severity-tagged findings and the final disposition. Do not commit raw CLI output, stderr/stdout logs, error logs, prompts, or diff snapshots anywhere under `docs`. (Pre-existing iterations migrated from the legacy `docs/reviews/` tree keep their `raw/` and `diff.md` files as historical audit trail; the REVIEW.md-only rule applies to new iterations.)
  - If temporary capture files are useful while synthesizing a review, write them outside the thread tree under `tmp/review-runs/<objective>/<date>/<iteration_number>/`, do not stage them, and clean them up when they are no longer useful. The committed thread artifact is the summary only.
  - `<iteration_number>` starts at 1 and increments for each re-review. Re-reviewers should consider previous iterations' `REVIEW.md` + `docs/learning/lessons.md` + the new diff so they verify earlier fixes landed and don't re-flag old issues.
  - After folding the final iteration's `REVIEW.md` into the devlog entry for the task, move the objective folder from `docs/threads/current/` to `docs/threads/done/`. The done thread stays as a historical artifact (do not delete — these are valuable audit trails alongside the full-review history).
  - Continue iterating until reviewers nitpick instead of catching real bugs / giving substantial feedback. Do not get stuck in an infinite loop.
- **Code reviewer**: Follow the Code review section.

## Code review

Operational details for the multi-CLI review rule above.

- **Reviewers MUST read the codebase to ground their claims.** Every review prompt must include the directive: *"Verify each claim in the plan/diff against the live codebase — grep for the symbols, function signatures, column names, and file paths it references; do not approve based on prompt text alone."* Without this directive baked in, two reviewers can APPROVE a design with a real defect that only the codebase-reading reviewer catches. Convergence is measured by *substantive finding count*, not *vote count* — a HIGH defect from one reviewer outweighs APPROVED from two. Per-CLI reading capability:
  - **Claude** reads via the Read/Glob/Grep tools you grant it (`--allowedTools "Read,Glob,Grep,..."`). Treat as load-bearing for code-vs-spec correctness.
  - **Codex** can read files when `--sandbox read-only` runs WITHOUT `--ignore-user-config`. The user rules file (`~/.codex/rules/default.rules`) then permits Windows-native file ops (`findstr`, `type`, `dir`, `ls`) as fallback when bash hits the PowerShell deny rule. Smoke-test occasionally with `echo "Read X and report" | codex exec --sandbox read-only --ephemeral` — codex must return content, not bail on "PowerShell blocked."
- Use Codex / Claude in CLI to independently review every change. Aspects to review:
  1. Design — easily scales, generalizes, debugs, can be understood and reasoned about, stays lean.
  2. Test coverage.
  3. Correctness.
  4. Clean code, typing, efficiency, memory leaks. No duplicated logic, inconsistent implementations, violation of boundaries. No file > 500 LOC. Prefer composition over inheritance. Clean up dead code. Do not change app mechanics or behavior unless explicitly asked.

  Documentation accuracy is covered by the Documentation discipline section's reviewer prompt addendum — do not duplicate the rule here.

- A baseline prompt is below; **enrich it with task-specific context** for real reviews — the change's intent, prior-iteration findings to verify, files to focus on, and an anti-regression checklist. The bare baseline returns generic feedback; useful reviews need the specifics.

  > "You are a senior code reviewer. Flag bugs, security issues, and performance concerns. Do NOT modify files or propose patches. Only return findings, explanations, and suggestions in plain text. Only point out an issue if it is real and important. If there is no issue, say so instead of nit-picking."

- **Always upgrade the Codex CLI before each review session** (defensive against silent model-name rejection and sandbox-policy regressions in older builds):
  - `npm install -g @openai/codex@latest`
  - Verify version afterwards (`codex --version`).
- Codex:
  - `git diff [branch] | codex exec --model gpt-5.5 -c model_reasoning_effort=xhigh -c approval_policy=never --sandbox read-only --ephemeral <prompt>`
  - **Do NOT pass `--ignore-user-config`.** That flag bypasses `~/.codex/rules/default.rules`, which is what permits codex on this Windows machine to use Windows-native commands (`findstr`, `type`, `dir`, `ls`) when its bash wrapper hits the PowerShell deny rule. Without those rules, codex's `read-only` sandbox blocks every shell tool and the reviewer silently falls back to "review without reading the code." Verified 2026-05-02.
  - Codex caps reasoning effort at `xhigh` (no `max` value).
- Claude:
  - With diff piped via stdin: `git diff [branch] | claude -p --model "opus[1m]" --effort max --append-system-prompt <prompt> --allowedTools "Read,Bash(git diff *),Bash(git log *),Bash(git show *)"`
  - For full-codebase (no diff): pass the prompt as the positional argument: `claude -p "<full prompt>" --model "opus[1m]" --effort max --allowedTools "Read,Glob,Grep,Bash(git diff *),Bash(git log *),Bash(git show *),Bash(wc *),Bash(ls *),Bash(find *)"`. `--append-system-prompt` is unnecessary and the long-prompt-as-stdin form is not needed.
  - The `[1m]` suffix selects the 1 M-token-context variant of the latest Opus alias. Quote the model string so the shell doesn't glob-expand the brackets.
- **Keep model IDs current.** Use the latest-family alias when a command is meant to track the newest model (for example, `opus[1m]`); bump pinned strings whenever a more capable fixed variant ships (e.g. `claude-opus-5-0[1m]`, `gpt-5.6`). Verify with a one-line smoke test (`echo "ok" | <cli> ...`) before committing the bump — silent fallback to an older model is the failure mode to guard against.
- For full-codebase reviews (no diff), drop the `git diff` pipe and let each CLI agentically explore the workspace from its CWD; keep the same model/effort flags.
- **Diff reviews take ~5 minutes per CLI on a multi-hundred-line diff.** Run them in parallel with `run_in_background: true`. Wait via a single background `until` poller (`until [ -s codex.txt ] && [ -s claude.txt ]; do sleep 8; done`) so the harness's no-long-sleeps guard doesn't fire and you don't poll repeatedly.
- **Reading codex review output efficiently.** Codex's `tmp/review-runs/.../codex.txt` echoes the entire piped stdin (including the prompt that quotes the BEGIN/END markers as instructions) plus exec-sandbox chatter, then prints the actual review TWICE near the end. A naive `awk` from the first marker captures the PROMPT (which contains the literal marker strings as instructions to Codex), not the review. This is the root cause of the "Codex unreachable" misdiagnosis observed in impls 16–24 of the v0.1.6 thread.
  - **Primary approach — make Codex bracket its review with markers, AND extract from the LAST occurrence.** Add the following sentence to every Codex review prompt: `Begin your review with the literal token "===BEGIN-REVIEW===" on its own line and end with "===END-REVIEW===" on its own line. Do not emit those markers anywhere else in your output.`
  - **Correct extraction** (only the actual review, NOT the prompt-echo):
    ```bash
    # Slice everything from the FIRST `^codex$` line onward — Codex prints
    # this header right before its real response. Then grab the BEGIN/END
    # block. This avoids matching the markers inside the prompt-echo.
    sed -n '/^codex$/,$p' codex.txt | awk '/===BEGIN-REVIEW===/{p=1; next} /===END-REVIEW===/{exit} p'
    ```
  - **Wrong extraction (the bug):** `awk '/===BEGIN-REVIEW===/{p=1; next} /===END-REVIEW===/{exit} p' codex.txt` grabs the FIRST pair, which is the literal markers in the prompt-echo. Every review using this extraction silently lost Codex's actual findings.
  - **Fallback when markers are missing**: `wc -l codex.txt`, then `Read` with `offset = lines - 250`. Or `sed -n '/<\/stdin>/,$p' codex.txt | head -300`.
  - Claude output is clean — markers optional there.
- **If a CLI is unreachable** (quota exhaustion, model name rejected by harness), proceed with the remaining reviewer and note the unreachable CLI in the devlog. Convergence is the signal to stop iterating; one reviewer is acceptable for a single iteration when the other is unreachable, but always retry the unreachable CLI on the next iteration.

## Git

- **Commit directly to `main`.** This is a solo-developer project; branches add overhead without payoff and block autonomous progress while waiting for merge authorization. Each coherent change lands as its own commit on `main`. The full suite (`npm test`, `npm run typecheck`, `npm run lint`, `npm run build`) must pass before each commit.
- When you iterate, only run affected tests.
- After confidence in the change, run the full suite to make sure you didn't accidentally break anything before committing.
- Commit as soon as you have a coherent, self-contained unit of change.
- Commit durable docs you added if you are not planning to remove them.
- **No branches needed for normal work.** Branches are reserved for explicit experimentation that you intend to keep isolated from `main` (and even then, prefer revertable single-commit experiments on `main`). The earlier `agent/<task>` branch convention and the merge-authorization gate are removed — they were artifacts of a multi-developer workflow that doesn't apply here.
- **Push to remote at the end of every task.** If local commits are ahead of the remote, run `git -C <path> push`. Don't leave the remote behind.

## Documentation

Read `docs/devlog/summary.md` and `docs/architecture/ARCHITECTURE.md` at session start. Key directories:

- `src`: app code.
- `docs`: architecture, devlogs, threads, API, tutorials, guides.
- `design`: app and mechanism notes.

### Discipline (mandatory; not optional)

Code changes are not done until the docs match. Before declaring any task complete, run through this checklist for every shipped change. Skipping any item is a regression and will be caught by the next audit.

**Always update on every feature / behavior change:**

- `docs/devlog/summary.md` — one line per task; remove outdated info; compact if > 50 lines. Do not cheat by writing super long line.
- `docs/devlog/detailed/<latest>.md` — full per-task entry per the Devlog convention below.

**Update only on user-visible behavior changes (new feature, bug fix, gameplay-rule change, save-format change, public-API change):**

- `docs/changelog.md` — new version entry with what shipped, why, validation, and behavior callouts. Audience is external; focus on what users need to know to migrate. Keep dev-internal commentary in the devlog. Pure refactors, type-safety hardening, doc sweeps, internal cleanups, and efficiency wins with no observable effect do NOT get changelog entries.
- `package.json` — version bump per the Versioning convention below. Same scope: only bump for user-visible changes.

**Always update if the change introduces or removes public API surface (new exports, new methods, new types, removed APIs, renamed APIs):**

- `README.md` — Feature Overview / Public Surface mentions the new capability if it's a user-visible feature; Public Surface bullets list the new top-level export if applicable.

**Always update if the change is structural (new subsystem, new boundary, changed data flow):**

- `docs/architecture/ARCHITECTURE.md` — Component Map row + Boundaries paragraph for the new subsystem; tick lifecycle ASCII updated if the flow changes.
- `docs/architecture/drift-log.md` — append a row with date + change + reason.
- `docs/architecture/decisions.md` — append a Key Architectural Decision row when the change reflects a non-obvious tradeoff worth recording. Never delete an existing decision; add a newer one that supersedes it.

**Update if applicable to the change's topic:**

- `docs/learning/lessons.md` — when you encounter a non-obvious failure mode worth preserving for future sessions (a recurring trap, a rule that prevented a reasonable-seeming mistake, a process step that turned out load-bearing). **Each lesson MUST start with this evidence-anchor table** — without anchors a "lesson" is folklore and self-improvement becomes prompt drift:

  | Field | Value |
  |---|---|
  | Surfaced by | path to `REVIEW.md` / debug log / commit / conversation that exposed the failure |
  | Reviewer findings | which CLI flagged it, severity, finding ID — e.g. `Codex 3-C1`, `Claude iter-2 IMPORTANT` |
  | Fix commit | short SHA of the commit that closed it |
  | Test added | exact test node id (or `n/a — process lesson` for review/tooling-only lessons) |
  | Behavior delta | concrete before/after — what would have happened in production without the fix; for game/sim changes include the affected replay/build/scenario ID and the behavioral metric that moved (faction win-rate, micro accuracy, build-order timing) |

  Code lessons require a real test node id; only genuinely process-level lessons may use `n/a`. One concise entry per lesson; this is the source of process learnings that re-reviewers consult alongside prior `REVIEW.md` files.

**Verification step (mandatory before declaring task done):**

- Invoke the `doc-review` skill or grep for removed-API names across `docs/` and `README.md`. The audit must come back clean for the change's diff. Stale references in historical changelog / devlog / drift-log entries are intentional context and should remain — every other surface must reflect current reality.
- The multi-CLI code review must explicitly verify doc accuracy as part of its review prompt — include "verify docs in the diff match implementation; flag any stale signatures, removed APIs still mentioned, or missing coverage of new APIs in canonical guides."

**Why this is mandatory:** doc drift compounds. A single stale signature becomes the source of truth for the next reader, then for the next feature built on top. Treating documentation as part of the change (not after the change) is the only way to keep the surface trustworthy.

**Note on retired files (iter-2 V5-5):** the project does NOT maintain `docs/api-reference.md`, `docs/guides/<topic>.md`, or `docs/README.md`. The canonical surfaces are README.md (entry-point summary), `docs/architecture/ARCHITECTURE.md` (boundaries + topology), `docs/architecture/decisions.md` (Key Architectural Decisions), `docs/architecture/drift-log.md` (structural change log), the per-task devlogs, and `docs/changelog.md` (user-visible bumps). The `SimulationBridge` interface in `src/game/simulation/createSimulationBridge.ts` is the canonical "API reference" — TypeScript types are the source of truth. This scoping decision parallels iter-1 V4-22's versioning relaxation: the project is internal-only, so heavyweight external doc surfaces are deferred until external consumers exist.

### Architecture

- Respect the boundaries documented in `docs/architecture/ARCHITECTURE.md`. If a boundary seems wrong, flag it instead of silently violating it.
- If architecture changes, update the relevant sections in `docs/architecture/ARCHITECTURE.md`, append a row to `docs/architecture/drift-log.md`, and mention the update in the devlog.
- Do not update `docs/architecture/ARCHITECTURE.md` for non-structural fixes, refactors, UI tweaks, or test-only work.
- Never delete a Key Architectural Decision in `docs/architecture/decisions.md`; add a newer decision that supersedes it.

### Devlog

- Detailed devlogs live under `docs/devlog/detailed/` as files named `START_DATE_END_DATE.md` (e.g. `2026-04-07_2026-04-13.md`).
- A new active file is created with `START_DATE == END_DATE` (today's date for both halves).
- Always append new entries to the latest detailed devlog (the file with the most recent `END_DATE`). When looking something up, start from the latest file and work backwards.
- Periodically archive: when the active file grows larger than 500 lines or a significant time boundary is reached, `git mv` the file to update its `END_DATE` to the date of its last entry, then start a new file whose `START_DATE` is today (and whose `END_DATE` initially equals `START_DATE`). Check that all previous devlogs' filename dates are still accurate.
- After every completed task, append a detailed entry with:
  - timestamp
  - action
  - code reviewer comments, broken down by AI provider and theme as stated above
  - result
  - reasoning
  - notes
- Keep `docs/devlog/summary.md` current after updating the detailed log. Always remove outdated info. Compact when it grows larger than 50 lines.
- If a subagent handles summary work, it should extract facts only and avoid interpretation.

### Versioning

- Maintain a version number `a.b.c` in `package.json`. **Bumps are scoped to user-visible behavior changes only** — pure refactors, type-safety hardening, doc sweeps, internal cleanups, and efficiency wins with no observable effect do not bump the version.
  - Only bump `a` when the human says so.
  - Whenever you introduce a breaking user-visible change (save-format break, removed gameplay rule, removed public API), bump `b` and reset `c`.
  - Whenever you introduce a non-breaking user-visible change (new feature, bug fix, gameplay-rule tweak, public-API addition), bump `c`.
- **One version bump per coherent shipped change.** Three independent user-visible features land as three commits on `main`, each with its own bump (e.g., 0.5.9 → 0.5.10 → 0.5.11). Do not roll multiple unrelated user-visible features into a single version. A single feature that needs iter-1 + iter-2 fix commits stays on the same version — the fixes fold into the original.
- Maintain `docs/changelog.md` with one entry per version. Skip the file entirely on pure-refactor batches. Check `docs/devlog/` for context.

### Doc formatting

- Don't wrap lines. Only use a new line when you are starting a new paragraph.

## Debugging

- **Always reach for the engine-provided debugging tools FIRST — before synthetic repros, and before trusting any agent/trace narration or LLM-finding.** `civ-engine` ships real introspection: `WorldDebugger` (component/resource/spatial snapshots + issue/warning detection), the `createOccupancyDebugProbe` / `createPathQueueDebugProbe` / `createVisibilityDebugProbe` probes, and `SessionReplayer` (replay any RECORDED bundle to any tick via `openAt`). A playtest finding is a CLAIM about a recorded run — verify it by REPLAYING that exact bundle and reading ground-truth state (`scripts/replay-inspect.mjs`: `SessionReplayer.fromBundle` → `openAt(tick)` → `getEconomyState()` per owner gives villager tasks, units, buildings, and resources, un-fog-filtered), not by reconstructing a synthetic scenario that may not match the real run. Synthetic repros and unit tests come SECOND, to isolate a confirmed cause. This rule was added 2026-06-13 after both an LLM conformance finding ("wood gather is broken") AND a subagent's synthetic-repro hypothesis ("villager attrition from enemy raids") were proven WRONG — only replaying the actual campaign-4 bundle showed the truth (19 woodcutters stuck in `to-resource`, 0 gathering, full trees 8 cells away) and incidentally exposed a recorder bug (`metadata.endTick: 0`) that made the bundle look un-replayable. The cost of one replay-inspect pass is minutes; the cost of chasing a misattributed bug is a wasted implementation cycle.
- When debugging, use `docs/debugging/template.md` to record your process. Create a new file per debugging session and use it to iterate until you solve the problem.
- If a future session makes you realize that your previous debug sessions on the same topic did not fully solve the problem, update past docs to avoid misunderstandings.
- Clean up the temporary files (such as stack dump, test results) created during debugging after you are done.

## Game spec

`design/spec-final.md` is the authoritative game definition. The goal is that the spec alone (plus the structured data under `design/stats/`) is sufficient for an agent to implement and iterate the entire game without further user clarification.

- **Persist every user-described rule, behavior, mechanic, content change, UX expectation, or constraint into `design/spec-final.md` as part of the same task.** Adding the rule to the spec is preparatory work that runs alongside (not after) implementation. A task is not done until the spec reflects the new rule.
- Place new content under the section that best matches its topic (combat, pathfinding, units, UI, simulation, etc.); add a new subsection if no existing one fits.
- If the user's description conflicts with existing spec language, edit the spec so it stays internally consistent — do not let two contradictory rules coexist.
- Spec updates are independent of the devlog/changelog/architecture pipelines; the spec captures rules, the devlog captures activity, the changelog captures user-visible behavior bumps. Update all surfaces that apply.
- Spec updates do not replace the TDD + multi-CLI review gates for code/test changes that follow from the new rule.
- This rule was added 2026-05-08 after the user emphasized that a complete spec is what enables autonomous hand-off iteration without per-change intervention.

## Game specific

- Record current `civ-engine` weaknesses and misses in `docs/engine-feedback/current.md` as you work. Historical observations belong in `docs/engine-feedback/past.md`. Before you write to the current file, use a subagent to audit if its content is still valid and up to date. If too long, stale, or the issues are already addressed, it should be adjusted.
- If a missing engine feature blocks the task, stop your work and report it to the user. But do not modify the `civ-engine` repo directly.
