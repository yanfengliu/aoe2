# LLM-Agent Playtest — Design Review iter-1

Date: 2026-05-08

Reviewers:
- **Claude** (`claude-opus-4-7[1m]` max effort, `Read,Glob,Grep,Bash(git diff *),Bash(git log *)` enabled). Verified each claim against the live codebase.
- **Codex** (`gpt-5.5` xhigh, read-only sandbox, ephemeral). The first two attempts (`codex.txt`, `codex-v2.txt`) both blew their token budget on file-content dumps before producing a review — codex's bash tool kept getting rejected by the PowerShell deny-rule and it kept trying `rg` invocations through different escape paths. The third attempt (`codex-tight.txt`) used a constrained prompt that forbade file-spelunking; codex emitted a clean four-MEDIUM review.

## Disposition

**Conditional GO with iter-2 fixes applied inline.** Claude found 3 HIGH + 5 MEDIUM + 6 LOW; Codex found 4 MEDIUM + 0 HIGH. Findings are largely complementary — Claude focused on integration-seam correctness against the live code, Codex focused on operational concerns (HMR-vs-built-bundle, cost guards, secret hygiene). All actionable findings folded into DESIGN.md and PLAN.md before plan-1 review.

## Findings

### HIGH (Claude only — Codex deferred to MEDIUMs)

**H1. `dispatchAgentCommand` validation semantics under-specified.**

Original design said the method "feeds a structured command into `pendingCommands`" AND "returns `true` if validated". These conflict in this codebase: `pendingCommands.push` runs no validation (`wireBridgeOps.ts:411-486`); semantic validators run later inside `world.submitWithResult` during `drainPendingCommands` (`dispatcher.ts:40-52`). A synchronous `boolean` return cannot reflect "validated".

**Fix.** `dispatchAgentCommand` now does shape-only validation (right discriminator, required fields, owner ∈ [1, N]) and returns `Promise<CommandDispatchResult>` with `accepted: true | false` + structured reason for shape failures. Semantic-rejection diagnostics surface separately via `bridge.consumeCommandRejection()` (already exists at `createSimulationBridge.ts:109`), drained by the runner after each `advanceTicks` and folded into `<out>.llm-trace.json`. Codex iter-1 MED1 (async structured result) fixed in the same change.

**H2. `world.state.aoe2.aiAgentDisabledForOwners` would pollute the save format.**

Tier-3 `world.state.aoe2.*` slots get serialized into `worldSnapshot` per `saveSchema.ts:104-115`. A human player saving a game with `?disableAi=2` set in this session's URL would persist the disable directive into the save file with no UI to clear it. The disable flag is a harness directive, not gameplay state.

**Fix.** Use the existing `PlayerStartSpec.disableAi` flag (`prototypeScenario.ts:122`) which already feeds into `aiStates.has(owner)` runtime gates in `aiSystem.ts` and `autoAggressionSystem.ts`. The URL param is consumed at scenario seed time only and never enters world state. No new world-state slot, no save-format bump. (This was open question 4 in iter-1 design.)

**H3. Command-shape examples don't match the canonical `GameCommands` discriminators.**

The iter-1 design's example commands used invented field names (`builderIds`, flat `x, y`, `trainKey`) that don't match `commands.ts:54,58` (`builderId + additionalBuilderIds[]`, nested `position: Position`, `unitType`). Without a translation layer, a developer writing the LLM tool-use schema from the design would produce commands that the runner rejects every time.

**Fix.** Updated the design's example commands to canonical `{ "type": K, "data": GameCommands[K] }` shape. No translation layer — Phase 2 generates Anthropic tool-use schemas directly from the `GameCommands` types via codegen, with a unit test in `tests/playtest/llmPromptBuilder.test.ts` round-tripping every discriminator to catch drift if `commands.ts` changes.

### MEDIUM

**Codex MED1 (folded into H1 fix above):** async structured dispatch result.

**Codex MED2.** vite dev server is the wrong default for a regression harness. HMR + websocket + dependency prebundling + file-watch reactions can perturb timing. Fix: runner builds with `npm run build` then serves via `vite preview --port 5174` (built bundle). `--use-dev-server` flag is local-debugging-only.

**Codex MED3.** Cost estimate undercounted; need hard budget cap. Fix: `--cost-budget` default $5.00, 80% warn / 100% abort; `--max-output-tokens` 1024 tactical / 2048 strategy; `--max-image-bytes` 1MB after PNG encoding (downscale to 1024px width); `--max-retries` 2 per decision. The agent module enforces; the runner surfaces in trace summary.

**Codex MED4.** CI made `ANTHROPIC_API_KEY` a hard requirement. Fix: separate `playtest-llm.yml` workflow; PR opt-in via `llm-playtest` label AND `secrets.ANTHROPIC_API_KEY != ''`; runtime guard inside `playtest-corpus-llm.mjs` exits 0 with "skipped: ANTHROPIC_API_KEY absent". Default PR validation never depends on this workflow. The `@anthropic-ai/sdk` import is contained to `scripts/` + `src/game/playtest/llmProviders.ts`; production app bundle excludes it (verified via vite-build smoke check).

**Claude M1.** Visual oracle scoping correct on determinism, but deterministic-AI baselines cover only a sub-distribution of game visuals. Out-of-distribution states (LLM builds a Wonder, mass-castle-age unique units, monk-with-3-relics glow) would slip through. Fix: LLM runner saves screenshots at the same tick milestones as deterministic baselines; trace emits "visual delta vs deterministic baseline at tick X = Y%" entries. Frames with large delta are flagged for human spot-check. O(1) human signal, not O(N) frames-to-eyeball.

**Claude M2.** Cost-claim "$30+ per playtest at Sonnet rates" undershoots — actual is ~$150 at 30k ticks. Doesn't change the conclusion (still prohibitive vs the $2 decision-interval design) but a sloppy number invites later "well, can we just do per-tick?" pushback. Fix: updated to ~$150 (Sonnet) / ~$750 (Opus).

**Claude M3.** Phase 4 has no runtime dependency on Phases 1-3. Fix: PLAN.md notes the independence; default ordering still 1→5 because the LLM-run advisory delta surfacing depends on Phase 3's screenshot capture path.

**Claude M4.** `pixelmatch` adds to the existing `pngjs` dep without acknowledging the overlap. Fix: design now documents that `pngjs` decodes, `pixelmatch` does the diff, and `pixelmatch` is justified by anti-aliasing tolerance + perceptual color difference (the existing `scripts/diffMapScreenshots.mjs` byte-by-byte diff over-reports on AA fringes). AGENTS.md dep-protocol applies (`npm install` + `npm audit --audit-level=high`).

**Claude M5.** RecordingService integration is fine but should be pinned. Fix: design explicitly cites `createApp.ts:130,137` for the RecordingService creation/start, the `pendingCommands → drainPendingCommands → world.submitWithResult → SessionRecorder` flow, and notes the IDB side-effect (each headless Playwright context isolates). Also adds the bundle-serialization caveat (Claude L6) — `getRecorderBundle()` exceeds Playwright's ~1MB JSON-RPC limit for 30k-tick bundles, so a new `exportRecorderBundleToFile()` returns a `blob:` URL the runner reads via `fetch(blobUrl)`.

### LOW (Claude)

- **L1.** `?disableAi=` parsing edge cases. Fix: design pins "comma-separated positive integers; reject 1; ignore unparseable tokens with `console.warn`."
- **L2.** Camera bbox in `AgentStateSnapshot` was world-coords-only. Fix: snapshot now includes both world and screen-pixel bbox plus a `worldToScreen(cellX, cellY)` reference table for visible cells.
- **L3.** Two-LLM games serialize per-owner `decide()` calls; flagged as future parallelization target.
- **L4.** Screenshot directory retention. Fix: `.gitignore` `output/playtests-llm/`; corpus runner prunes older runs (keep last 5).
- **L5.** SDK secret hygiene. Fix: trace serializes only `{ messages, response.content, usage }`; explicitly drops `x-api-key` and `error.response`. Phase 3 test asserts the trace contains no auth header and no SDK request/response objects.
- **L6.** Folded into M5 fix above.

### Verified clean

- Determinism / replay-bundle compatibility: confirmed by Claude against `createSimulationBridge.ts:303-316` (`drainPendingCommands` between every `world.step()`), `runPlaytest.ts:95` (`recorder.toBundle()` mid-session is safe), and the `RecordedCommand` path being generic over command kind. The bundle replays bit-exact; counterfactual replay (re-rolling the LLM on a patched build) is a different flow that needs the trace JSON, deferred to Phase 6.
- Tactical = Sonnet, Strategy = Opus: both reviewers confirmed.
- Decision interval default 250 ticks: both reviewers confirmed.
- Anthropic SDK over CLI: both reviewers confirmed.

## Action plan

Iter-2 fixes applied inline:

1. **Claude H1 + Codex MED1.** Updated `dispatchAgentCommand` to async structured result; shape-only validation; semantic rejections via `consumeCommandRejection`.
2. **Claude H2.** Removed proposed `world.state.aoe2.aiAgentDisabledForOwners` slot. Disable directive lives in scenario-seed-time closure via `PlayerStartSpec.disableAi`.
3. **Claude H3.** Updated example commands to canonical `{ type, data }` shape. Codegen tool-use schemas from `GameCommands` types; round-trip test in plan.
4. **Codex MED2.** Runner uses `vite preview` (built bundle); dev server is opt-in via `--use-dev-server`.
5. **Codex MED3.** Hard cost cap with `--cost-budget`; per-call output token / image byte / retry caps.
6. **Codex MED4.** Separate CI workflow; Anthropic absence is a clean skip; SDK import contained to scripts + provider module.
7. **Claude M1.** LLM-run advisory delta surfacing pulled into Phase 4.
8. **Claude M2.** Cost numbers corrected to ~$150 (Sonnet) / ~$750 (Opus) for vision-LLM-per-tick worst case.
9. **Claude M3.** Phase-4 independence noted in PLAN.md.
10. **Claude M4.** `pixelmatch` justification + audit step in design + plan.
11. **Claude M5.** RecordingService integration pinned with explicit citations.
12. **Claude L1-L6.** All addressed inline (parsing contract, snapshot pixel coords, retention policy, secret hygiene, bundle export-to-file).

## Next iteration

Plan-1 multi-CLI review fires next, against the iter-2 design + iter-2 plan. Convergence to nits closes the design phase; Phase 1 implementation starts after.
