# civ-engine v1.3 visual-playtest contracts - Review iteration 1

Change under review: adopt civ-engine v1.3.0 visual-playtest vocabulary on the aoe2 side without replacing the existing LLM playtest runner. The implementation adds `src/game/playtest/visualPlaytestAdapter.ts`, prepends `buildVisualPlaytestPrompt` player-surface context to tactical prompts, embeds `data.visualPlaytest` payloads from `visualPlaytestFindingToMarker` into existing agent markers, refreshes `package-lock.json` for `../civ-engine` 1.3.0, and updates the internal harness docs.

## Reviewer availability

External CLI review was attempted per AGENTS.md but blocked by tenant policy before execution: both Codex and Claude review commands were rejected because piping the local diff/live-code context would disclose private workspace code to external services. Codex CLI was upgraded first as requested by the repo policy (`codex-cli 0.142.5`); Claude CLI was available (`2.1.178`). Because external upload was disallowed, this iteration used a local adversarial pass against the live diff and codebase.

## Verdict

APPROVE after two local LOW fixes. No confirmed correctness issue remains in prompt construction, marker data shape, deterministic marker identity, lockfile scope, or docs.

## Findings and disposition

| ID | Severity | Finding | Disposition |
|---|---|---|---|
| Local-1 | LOW | The first adapter version formatted screenshot metadata as `Screenshot: [not provided] 800x600 image/png` even when the LLM call carried an image block separately. That was not a crash, but it could confuse the agent about whether visual evidence is attached. | FIXED. `buildTacticalVisualPlaytestObservation` now sets `path: '[attached image block]'`, and the prompt test pins `Screenshot: [attached image block] 800x600 image/png`. |
| Local-2 | LOW | The drift-log row initially landed below the table header rather than at the append position, contrary to the file's append-only convention. | FIXED. The row was moved to the bottom of `docs/architecture/drift-log.md`. |

## Verified checks

- Red tests were observed before implementation: `npx.cmd vitest run tests/playtest/llmPromptBuilder.test.ts tests/playtest/findingsToMarkers.test.ts` failed on the missing shared prompt header and missing `data.visualPlaytest`.
- After implementation and review fixes: `npx.cmd vitest run tests/playtest/llmPromptBuilder.test.ts tests/playtest/findingsToMarkers.test.ts` passed, 44 tests.
- `npx.cmd tsc --noEmit` passed after the JSON-data fix and again after review fixes.
- `npx.cmd eslint src/game/playtest tests/playtest --no-error-on-unmatched-pattern` passed after implementation and again after review fixes.

## Notes

The shared engine vocabulary is intentionally an adapter layer only. The review confirmed `llmRunner`, provider wiring, image block handling, cost accounting, command-tool schemas, dispatch feedback, and existing conformance marker UI data remain in place.
