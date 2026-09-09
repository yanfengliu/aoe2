# LLM-Agent Playtest Loop — Design

Date: 2026-05-08

## Goal

Plug a multimodal LLM into the playtest loop as the agent that plays the game. The LLM looks at canvas screenshots + structured state JSON, plans short-term tactics under a longer-term strategy, and emits commands. Output is a standard SessionBundle so the existing oracle layer + replay system work unchanged. Adds a visual-regression oracle for the screenshot stream so visual bugs (missing sprites, broken HP bars, fog rendering glitches) are gated alongside gameplay regressions.

This is additive — it does NOT replace the deterministic-AI playtest path shipped in the playtest-loop thread. The deterministic loop stays the cheap regression-detection workhorse; the LLM loop is the *adversarial / exploratory* counterpart that finds edge cases the rule-based AI doesn't and that exercises the real renderer end-to-end.

## Constraints

- The game runs Phaser in a browser. Real visual regression coverage requires the real renderer, which means Playwright-driven Chromium, not the existing Node-only `runPlaytest`.
- The LLM is non-deterministic. Bundles must remain deterministically replayable, which is satisfied by the existing recorder: the LLM emits commands, the recorder logs them, replay reads from the bundle (not from a re-query). **Caveat:** "deterministically replayable from the bundle" means the bundle replays bit-exact — it does NOT mean re-querying the LLM on the same seed gives the same actions (it doesn't, even at `temperature: 0`). Counterfactual fix-validation that re-rolls the LLM on a patched build is a different flow that needs the trace JSON + a fresh API call, deferred to Phase 6. (Claude iter-1 determinism verification.)
- Cost is the binding constraint on per-tick decision granularity. Vision-LLM-per-tick is prohibitive (~$150 per 30k-tick playtest at Sonnet rates; ~$750 with Opus). Decision interval has to be game-seconds, not ticks. (Claude iter-1 M2 — earlier estimate of "$30+" was off by 5×.)
- Anthropic API key required (`ANTHROPIC_API_KEY` env var). No fallback to text-only providers because the design's whole point is "LLM looks at the screen."
- Existing `__AOE2_TEST__` browser API is the integration seam; we extend it with a few methods rather than introduce a parallel surface.

## Architecture

```
                      scripts/playtest-llm.mjs
                              │
                              ├── boots dev server (vite)
                              ├── boots Playwright (Chromium headless)
                              │
                              ▼
              ┌─────────────────────────────────────┐
              │  game @ localhost:5173               │
              │  ?seed=…&disableAi=2,3 (LLM owners) │
              │                                      │
              │  __AOE2_TEST__:                       │
              │    snapshotForAgent() → state JSON   │
              │    captureCanvasPng() → PNG buffer   │
              │    dispatchAgentCommand(json)         │
              │    advanceTicks(n)                    │
              │    getRecorderBundle()                │
              └─────────────────────────────────────┘
                       │            ▲
                       │ state+png  │ commands
                       ▼            │
                 ┌──────────────────┐
                 │   LlmAgent       │
                 │   (@anthropic-   │
                 │    ai/sdk)       │
                 │                  │
                 │  strategy(every  │
                 │     K decisions) │
                 │  tactic (every   │
                 │     decision)    │
                 └──────────────────┘
                       │
                       ▼ commands logged via recorder

After run:
  output/playtests-llm/<id>.json          (bundle, identical shape)
  output/playtests-llm/<id>.envelope.json (stop reason, ticks)
  output/playtests-llm/<id>.llm-trace.json (prompts + responses + costs)
  output/playtests-llm/<id>-screenshots/  (PNGs at decision ticks)
```

## Components

### 1. Browser test API extensions (`src/app/bootstrap/browserTestApi.ts`)

Existing surface: `getEconomyState`, `getSelectionState`, `selectEntityAtCell`, `issueMoveCommand`, etc. We extend with five methods scoped to the agent harness:

- **`snapshotForAgent(): AgentStateSnapshot`** — purpose-built bounded view for the LLM. Includes per-player resources, age, villager count by task, building count by type, military unit count by type, current selection, queued production, visible enemies (deduped by entity id, capped at 200 entries), camera bbox in **both world coords and screen-pixel coords plus a `worldToScreen(cellX, cellY)` reference table for visible cells** (Claude iter-1 L2: without the world↔pixel mapping the LLM cannot correlate "what's on screen" with "what entity to address"), current tick, time elapsed in mm:ss. Distinct from `getEconomyState()` which dumps the whole economy state — the agent snapshot is shaped for prompt-token efficiency, not faithful state reconstruction.
- **`getCanvasBboxForScreenshot(): { x: number; y: number; width: number; height: number }`** — returns the on-page canvas bounding box in CSS pixels. The Playwright runner calls `page.screenshot({ clip: bbox })` to capture the actual PNG; this method exists only to give the runner the right `clip` rect without it having to hard-code or re-discover the canvas. The browser side never produces a PNG buffer (avoids serializing megabytes through `page.evaluate`).
- **`dispatchAgentCommand(command: GameCommand): Promise<CommandDispatchResult>`** — pushes a structured command onto the same `pendingCommands` queue the in-game AI uses. Validation is **shape-only** at push time (right discriminator, required fields, owner ∈ [1, N]); per `wireBridgeOps.ts:411-486`, no semantic validation runs at push time — semantic validators run later inside `world.submitWithResult` during `drainPendingCommands`. The trace logs the post-shape-validation `accepted: true` push; semantic-rejection diagnostics surface via `bridge.consumeCommandRejection()` (already exists, `createSimulationBridge.ts:109`) which the runner drains after each `advanceTicks` and folds into the `<out>.llm-trace.json` so the agent can correlate dispatched commands with downstream rejections.
  ```ts
  type CommandDispatchResult<K extends keyof GameCommands = keyof GameCommands> =
    | { accepted: true; commandKind: K; normalized: GameCommands[K] }
    | { accepted: false; reason: 'unknown-kind' | 'malformed-payload' | 'wrong-owner-range'; details?: string };
  ```
  Generic on `K` so TS callers can narrow `normalized` by switching on `commandKind` without re-discriminating. (Claude iter-2 LOW 2.)
  Async even though the first impl resolves synchronously — leaves room for tick-phase-aware validation and matches Playwright's `await page.evaluate(...)` ergonomics. (Codex iter-1 MED1; Claude iter-1 H1 — chose the shape-only-push variant per Claude's recommendation, matching how `wireBridgeOps` typed pushers behave today.)

  **Canonical command examples** (matching the actual `GameCommands` discriminators in `src/game/simulation/commands.ts:29`):
  ```json
  { "type": "building.placeConfirm", "data": { "builderId": 42, "buildingType": "farm", "position": { "x": 12, "y": 14 }, "additionalBuilderIds": [43] } }
  { "type": "queue.train", "data": { "buildingId": 5, "unitType": "villager" } }
  ```
  No translation layer. The LLM tool-use schema mirrors `GameCommands[K]` for each `K`; `dispatchAgentCommand` accepts the canonical shape directly. Phase 2's tool-use schema generator emits one tool per discriminator with the exact field names; a unit test in `tests/playtest/llmPromptBuilder.test.ts` round-trips every discriminator to catch drift if `commands.ts` changes. (Claude iter-1 H3.)
- **`getRecorderBundle(): SessionBundle`** — returns the live `RecordingService.bundle()`. The service is created and started unconditionally during bootstrap (`src/app/bootstrap/createApp.ts:130,137`), so by the time `__AOE2_TEST__.isBooted()` returns `true`, the in-app recorder is observing every command + tick diff. LLM-dispatched commands enter via `pendingCommands.push` → next-tick `drainPendingCommands` → `world.submitWithResult` → `SessionRecorder` captures, exactly like in-game-AI commands. No separate harness recorder needed. (Claude iter-1 M5.) **Side effect:** because `RecordingService` mirrors to IndexedDB, the LLM run's session lands in IDB just like a live game would; this is fine because each headless Playwright context has its own ephemeral IDB. Use this method for small smoke runs only.
- **`exportRecorderBundleToFile(): Promise<{ blobUrl: string; size: number }>`** — serializes the bundle to a `Blob` and returns a `blob:` URL plus the byte size. The Playwright runner then `await page.evaluate(url => fetch(url).then(r => r.arrayBuffer()))` to read it as bytes, or uses Playwright's `page.evaluate(() => downloads...)` pattern. This avoids the JSON-RPC payload limit (~1 MB default) that `getRecorderBundle()` hits for 30k-tick bundles. (Claude iter-1 L6.)

We also need to gate the in-game AI:

- **`?disableAi=2,3`** URL param: on bootstrap, parse and apply `disableAi: true` to the matching `PlayerStartSpec` entries during scenario seed. The flag already exists at `src/game/simulation/prototypeScenario.ts:122` and the existing AI gating mechanism (`aiStates.has(owner)` checked in `aiSystem` and `autoAggressionSystem`) handles the rest — no new world-state slot needed.
- **Parsing contract.** Comma-separated positive integers; reject `1` (the human owner; passing this would leave nobody to attack); ignore unparseable tokens with a `console.warn`. Empty or absent param is a no-op. (Claude iter-1 L1.)
- **Why not `world.state.aoe2.aiAgentDisabledForOwners`** (the previous proposal): tier-3 `world.state.aoe2.*` slots get serialized into `worldSnapshot` at save time per `src/game/simulation/saveSchema.ts:104-115`. A human player who saved a game with `?disableAi=2` set in this session's URL would persist the disable directive into the save file — there is no UI to clear it. The disable flag is a **harness directive**, not gameplay state; persisting it is a category error. The `PlayerStartSpec` flag is consumed at scenario seed time only and does not survive into world state. (Claude iter-1 H2.)

### 2. LLM agent (`src/game/playtest/llmAgent.ts`)

```ts
interface LlmAgentConfig {
  provider: AnthropicProvider;       // wraps @anthropic-ai/sdk
  ownerId: number;                    // which player the agent controls
  strategyModel: string;              // e.g. claude-opus-4-7
  tacticalModel: string;              // e.g. claude-sonnet-4-6
  decisionIntervalTicks: number;      // default 250 (5 game-sec @ 50 tps)
  strategyEveryNDecisions: number;    // default 10 (~ once per 50 game-sec)
  screenshotDownscaleWidth: number;   // default 1024
}
class LlmAgent {
  async decide(state: AgentStateSnapshot, screenshot: Uint8Array): Promise<AgentDecision>;
}
interface AgentDecision {
  thought: string;
  commands: GameCommand[];
  strategyRefresh?: { strategy: string; targetAge: AgeKey; targetUnitMix: string };
  tokensIn: number;
  tokensOut: number;
  costUsd: number;
}
```

**Strategy tier.** Every `strategyEveryNDecisions` calls, prepend a "what is your strategy?" system prompt to the tactical prompt and request a strategy paragraph + target age + target unit mix in the response. Strategy is cached and stuffed into subsequent tactical prompts as `Current strategy: …`. Justifies the higher cost of the strategy tier (Opus) being amortized over 10 decisions.

**Tactical tier.** Each call: send (current strategy, agent state JSON, screenshot, recent command history, last 3 enemy events). Response is JSON:

```json
{
  "thought": "Building two more farms; food is starving research.",
  "commands": [
    { "type": "building.placeConfirm", "data": { "builderId": 42, "buildingType": "farm", "position": { "x": 12, "y": 14 }, "additionalBuilderIds": [43] } },
    { "type": "queue.train", "data": { "buildingId": 5, "unitType": "villager" } }
  ]
}
```

Output JSON is parsed via Anthropic tool-use (structured outputs); each `GameCommands` discriminator becomes one tool with the canonical field shape. Invalid commands (shape-rejected by `dispatchAgentCommand` or semantic-rejected by `consumeCommandRejection` after the next tick) are noted in the trace and counted as a soft failure metric.

**Trace logging.** Every prompt + response + cost is appended to `<out>.llm-trace.json` so a developer can inspect why the model did what it did. Trace is bounded — screenshot bytes are referenced by file path (saved under `<out>-screenshots/`), not embedded. **Secret hygiene** (Claude iter-1 L5): the trace must NOT include any HTTP authorization header or response error object that the SDK might attach `x-api-key` to; the agent serializes only `{ messages, response.content, usage }` and explicitly drops the SDK's `request` / `error.response` fields.

**Cost budget** (Codex iter-1 MED3). The agent enforces a hard ceiling:
- `--cost-budget <usd>` default `5.00`. The agent tracks rolling cost from `usage.input_tokens × $price + usage.output_tokens × $price`; on 80% it logs a warning, on 100% it returns `{ commands: [], stopReason: 'cost-budget-exceeded' }` from the next `decide()` call so the runner aborts cleanly.
- `--max-output-tokens <n>` default `1024` per tactical call, `2048` per strategy call.
- `--max-image-bytes <n>` default `1MB` after PNG encoding; the runner downscales to `screenshotDownscaleWidth` (default 1024px) before sending. **Overflow path** (Claude iter-2 LOW 4): if the resulting PNG still exceeds the limit, halve `screenshotDownscaleWidth` and retry; if still over after 2 halvings (256px), omit the screenshot from the call, log to trace as `screenshot-omitted: too-large`, and proceed text-only for that decision.
- `--max-retries <n>` default `2` per decision (parser failure / transient API error). Retries count against the cost budget.

### 3. Runner (`scripts/playtest-llm.mjs`)

Orchestrates the loop:

1. **Build + serve the static bundle.** `npm run build` then `vite preview --port 5174` (Codex iter-1 MED2). The dev server (`vite` HMR + websocket + dependency prebundling + file-watch reactions) is the wrong default for a regression harness — its module-graph invalidation can perturb timing in ways that don't reflect the shipped bundle. `vite preview` serves the production build; this is what CI and nightly runs use. A `--use-dev-server` flag is supported for local debugging only.
2. Boot Playwright Chromium, navigate to `http://localhost:5174/?seed=<s>&disableAi=2,3`.
3. Wait for `__AOE2_TEST__.isBooted() === true`.
4. Construct `LlmAgent`.
5. Loop until `tick >= maxTicks` or `engineHalt` or `stopWhen` or `cost-budget-exceeded`:
   - `state = await page.evaluate(() => __AOE2_TEST__.snapshotForAgent())`.
   - `bbox = await page.evaluate(() => __AOE2_TEST__.getCanvasBboxForScreenshot())`.
   - `screenshot = await page.screenshot({ clip: bbox })`.
   - `decision = await agent.decide(state, screenshot)`.
   - For each command: `await page.evaluate(cmd => __AOE2_TEST__.dispatchAgentCommand(cmd), cmd)`. Collect results.
   - `await page.evaluate(n => __AOE2_TEST__.advanceTicks(n), config.decisionIntervalTicks)`.
   - Drain `consumeCommandRejection` for semantic failures, append to trace.
   - Append decision to `<out>.llm-trace.json`. Save screenshot to `<out>-screenshots/<tickN>.png` every `screenshotSaveEveryNDecisions` decisions (default `1` — save every decision; configurable via `--screenshot-save-every <n>` to reduce disk I/O on long runs). Claude iter-2 LOW 3 — the cadence default is now pinned to avoid implementer drift.
6. After loop: invoke `__AOE2_TEST__.exportRecorderBundleToFile(path)` and read the bundle from disk. Write `<out>.json` + `<out>.envelope.json` + `<out>.llm-trace.json`. Trace summary (totals, cost, per-tier counts) printed to stdout.

CLI: `npm run playtest:llm -- --seed <s> --max-ticks <n> --out <path> [--decision-interval <ticks>] [--strategy-every <decisions>] [--owners <comma-sep>] [--cost-budget <usd>] [--use-dev-server]`. Owners default `[2]` (single LLM vs passive human), can be `[2,3]` for two-LLM games (per-owner `decide()` calls run sequentially per loop tick — Claude iter-1 L3 flags this as a parallelization opportunity for a follow-up).

**Runner-side directory hygiene** (Claude iter-1 L4): `output/playtests-llm/` and `<out>-screenshots/` go in `.gitignore`. Retention policy: keep the last 5 nightly runs; older runs are pruned by the corpus runner before each new run.

### 4. Visual-regression oracle (`src/game/playtest/oracles.ts`)

Reads from a sidecar baseline directory: `tests/playtest/baselines/<seed>/<tickN>.png`. For each baseline tick that exists, compare against the run's screenshot at the matching tick using `pixelmatch` (small dep, deterministic, anti-aliasing-tolerant — the existing `scripts/diffMapScreenshots.mjs` uses raw `pngjs` byte-by-byte diffing which over-reports on AA fringes). The new dep is in addition to `pngjs` (already a devDep at `package.json:39`), not a replacement; `pngjs` decodes the PNGs, `pixelmatch` does the diff. AGENTS.md dependency-change protocol applies: `npm install` lockfile re-resolve + `npm audit --audit-level=high` (Claude iter-1 M4).

Fire a violation when:

- Pixel-diff fraction > threshold (default `0.005`, configurable per row).
- The diff isn't trivially the HUD's tick counter (mask the tick-display region).

Severity: `medium` by default, `high` if diff > 0.05.

**Baseline capture cadence** (Claude iter-2 LOW 5). Baselines are captured at every `1000` ticks for the default-seed corpus row (configurable per row via `baselineEveryNTicks`). For a 30k-tick run that's ~30 PNGs per seed at ~50 KB each = ~1.5 MB committed per seed. The deterministic-AI playtest captures these via the same `--screenshot-save-every` mechanism; the visual oracle reads from `tests/playtest/baselines/<seed>/<tickN>.png` and matches against the run's screenshot at the same tick.

Baselines are committed to the repo. Updating a baseline is a deliberate action — `npm run playtest -- --update-baselines --seed <s>`. New baselines require a code review (the diff in `tests/playtest/baselines/` is reviewable).

For determinism: visual baselines are captured against the **deterministic-AI** playtest, not the LLM playtest. The LLM run's screenshots aren't stable seed-to-seed (the LLM picks different actions); we compare pixel-diff at tick milestones where state is *expected* to differ — this oracle is only useful when paired with a deterministic-AI run for the same seed. The two bundle types share the same seed-to-bundle mapping, so the oracle compares deterministic-AI screenshots against deterministic-AI baselines.

**Out-of-distribution coverage for LLM screenshots** (Claude iter-1 M1). The deterministic AI plays a single fixed strategy, so its baselines cover only a sub-distribution of game visuals — late-imp wonder hover, monk-with-3-relics glow, mass-castle-age unique units arise only from non-default strategies. To surface visual regressions in those out-of-distribution states without gating CI on a non-deterministic stream, the LLM runner saves screenshots at the same tick milestones the deterministic baseline uses and emits an **advisory** "visual-novelty" report alongside `<out>.llm-trace.json`: each LLM screenshot has a "delta vs deterministic baseline at this tick = Y%" entry. Frames where Y% is large (out-of-distribution states, e.g., the LLM built a Wonder where the deterministic AI didn't) are flagged for human spot-check in the trace summary. This is O(1) human signal regardless of run length, not O(N) frames-to-eyeball. The richer "ask the model 'is anything visually wrong?'" oracle stays in Phase-6 follow-ups; the advisory delta is a cheap superset.

**The LLM agent loop adds reasoning depth and exploratory coverage; the visual oracle gate fires on the deterministic loop; the LLM run's visual delta is advisory.** The three signals are complements.

### 5. CI integration (`.github/workflows/playtest-llm.yml`)

Separate workflow from `playtest.yml` so the deterministic loop never depends on Anthropic availability or API key presence (Codex iter-1 MED4).

Triggers:

- **Nightly cron** (`schedule: cron: "17 4 * * *"`): runs `npm run playtest:corpus-llm` against `playtest-corpus-llm.json`. Skipped automatically when `ANTHROPIC_API_KEY` is absent (`if: secrets.ANTHROPIC_API_KEY != ''` on the job, plus a runtime guard inside the runner). Posts a `SUMMARY-LLM.md` comment to the most recent non-merged PR.
- **`workflow_dispatch`**: manual trigger with inputs for `seed` override and `maxTicks` override.
- **PR opt-in**: `pull_request` events run only when the PR carries the `llm-playtest` label, AND `ANTHROPIC_API_KEY` is configured. Default PR validation does NOT depend on this workflow — `playtest.yml` (deterministic) is the gating workflow.

The `@anthropic-ai/sdk` import is contained in `scripts/playtest-llm.mjs` and `src/game/playtest/llmProviders.ts`; the production app bundle never imports the SDK (verified by a `vite build` smoke check that the SDK doesn't appear in `dist/`).

## Phasing

Five phases, each TDD + multi-CLI review per AGENTS.md. **Phase 4 has no runtime dependency on Phases 1-3** (Claude iter-1 M3) — it can be developed against the existing deterministic playtest output and could land first if a visual regression is suspected. The default phasing still goes 1→2→3→4→5 because the LLM runner depends on Phase 1 + 2 + 3 in series.

1. **Browser test API extensions + AI-disable flag.** New methods on `__AOE2_TEST__`; `?disableAi=` URL param wired through; existing tests unaffected.
2. **LLM agent core.** `llmAgent.ts` with two-tier prompting against the Anthropic SDK. Mocked-provider tests pin prompt structure + decision parsing.
3. **Runner.** `scripts/playtest-llm.mjs` Playwright orchestration over `vite preview` (built bundle). Smoke-tested against a 500-tick run with mocked LLM to validate the harness.
4. **Visual-regression oracle.** `pixelmatch` integration; baseline capture mode; diff oracle in `oracles.ts`. Baselines for the existing default-seed corpus row. Includes the LLM-run advisory delta surfacing (Claude iter-1 M1).
5. **CI integration.** Separate `playtest-llm.yml` workflow; nightly cron + workflow_dispatch + `llm-playtest` label opt-in. `ANTHROPIC_API_KEY` absence is a clean skip, not a failure (Codex iter-1 MED4). Cost reporting in trace summary.

## Phase-6 follow-ups (deferred)

- AI-vs-LLM head-to-head (today owner 1 is passive; would need aiSystem owner-target generalisation).
- LLM observation pass: separate post-hoc ask-the-model "is anything visually wrong?" oracle (advisory).
- Auto-apply patches from `propose-fix.mjs` when an LLM playtest catches a regression the deterministic loop misses.
- Counterfactual fix-validation: re-run the LLM on the same seed with a candidate patch, compare violation diff.
- Cross-corpus baseline visualisation (HTML dashboard).

## Open questions — resolved by iter-1 review

All six iter-1 open questions are now resolved against multi-CLI review feedback (Codex iter-1 + Claude iter-1):

1. **Tactical = Sonnet, Strategy = Opus.** Confirmed by both reviewers. Sonnet 4.6 is capable for vision + constrained-JSON tactical output; Opus on tactical is wasted reasoning depth at 5× cost. Default `tacticalModel: 'claude-sonnet-4-6'`, `strategyModel: 'claude-opus-4-7'`.
2. **Decision interval default 250 ticks.** Confirmed. Mid-fight-micro miss is a real but acceptable hole; Phase-6 candidate is an event-trigger ("combat started for owner X") that schedules an extra decision out-of-cadence (Claude iter-1 open-question 2 verdict).
3. **Visual oracle gated on deterministic-AI only, LLM runs advisory.** Confirmed by both reviewers. The LLM-run advisory delta surfacing mechanism is now specified in §4 (Claude iter-1 M1).
4. **AI gating: `?disableAi=` URL param + closure-local bridge field.** Confirmed. Closure-local — NOT `world.state.aoe2.*` (Claude iter-1 H2: world-state would leak into save format).
5. **Anthropic SDK over CLI.** Confirmed by both reviewers. SDK gives structured outputs, retry semantics, per-call cost — all required for the agent loop. Cost: 150 KB in `node_modules` + `ANTHROPIC_API_KEY` env. SDK import contained to `scripts/` + `src/game/playtest/llmProviders.ts`; production bundle excludes it.
6. **Hard cost cap with `--cost-budget` default $5.00, 80% warn / 100% abort.** Confirmed (Codex iter-1 MED3, Claude iter-1 open-question 6). "Trust the developer" is rejected because silent runaway cost is a real failure mode (parser-loop retry, model-rate change, prompt-template explosion).
