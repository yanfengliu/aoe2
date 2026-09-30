# LLM-Agent Playtest — Design Review iter-2

Date: 2026-05-08

Reviewers:
- **Claude** (`claude-opus-4-7[1m]` max effort, `Read,Glob,Grep,Bash(git diff *)` enabled). Verified each iter-1 finding's iter-2 mitigation against the live codebase.
- **Codex** (`gpt-5.5` xhigh, read-only sandbox). Same Windows PowerShell-deny-rule failure mode as iter-1 — codex blew its budget on `rg` invocations through different escape paths and never emitted a review. Marked unreachable for iter-2; will retry on iter-3 if needed.

## Disposition

**Design converged.** Claude verified all 13 iter-1 findings closed with citable mitigations. iter-2 introduced 5 LOW + 2 NIT issues, all addressed inline. No HIGH or MEDIUM defects. Plan is ready for impl-1 dispatch.

## Findings

### Iter-1 closures verified (Claude)

All 13 named findings from iter-1 are addressed in iter-2 with citable mitigations:

| Finding | DESIGN.md citation |
|---|---|
| H1 dispatch semantics | "shape-only at push time… semantic validators run later inside `world.submitWithResult`" + `wireBridgeOps.ts:411-486` + `consumeCommandRejection` (`createSimulationBridge.ts:109`) |
| H2 no world.state.aoe2 slot | Explicit "Why not… would be serialized into `worldSnapshot` per `saveSchema.ts:104-115`"; uses `PlayerStartSpec.disableAi` instead |
| H3 canonical command shapes | `building.placeConfirm` + `queue.train` examples cite `commands.ts:29`; round-trip test pinned in §2 |
| MED1 async structured result | Discriminated `CommandDispatchResult` with `accepted: true / false`, three named reasons |
| MED2 vite preview vs dev | `vite preview --port 5174` default, `--use-dev-server` flag for local debug |
| MED3 hard cost cap | `--cost-budget` $5.00 default, 80%/100% gates, plus `--max-output-tokens`, `--max-image-bytes`, `--max-retries` |
| MED4 ANTHROPIC_API_KEY absence | Job-level `if: secrets.ANTHROPIC_API_KEY != ''` + runtime guard; clean skip not failure |
| M1 visual-novelty advisory | §4 specifies the LLM-vs-deterministic-baseline delta as advisory in trace summary |
| M2 cost numbers | `$150 / $750 per 30k tick` corrected from earlier `$30+` (off by 5×) |
| M3 Phase 4 independence | Both DESIGN §Phasing and PLAN Phase 4 explicitly state no Phases 1-3 dependency |
| M4 pixelmatch justify + audit | Justified vs `pngjs` byte-diff (AA fringes); cites `package.json:39`; AGENTS.md audit invoked |
| M5 RecordingService pin + export | Cites `createApp.ts:130,137`; `exportRecorderBundleToFile` returns blob URL + size |
| L1-L6 | Each cited inline in DESIGN |

### Iter-2 issues introduced

All LOW/NIT — none HIGH or MEDIUM.

**LOW 1.** PLAN Phase 5 didn't operationalize the retention pruning DESIGN §3 promised. Fix: PLAN Step 5.1 now includes "TDD coverage of the cost-rollup logic AND the retention pruning step." Test pins: 7 → 5, 3 → 3, 0 → 0.

**LOW 2.** `CommandDispatchResult.normalized` typing was loose (full union; required re-discrimination). Fix: made generic on `K extends keyof GameCommands` so TS callers narrow `normalized` by switching on `commandKind`.

**LOW 3.** Screenshot save cadence used undefined `M`. Fix: pinned to `screenshotSaveEveryNDecisions` default `1` (every decision); `--screenshot-save-every` flag for tuning.

**LOW 4.** `--max-image-bytes` overflow path undefined. Fix: documented "halve `screenshotDownscaleWidth` and retry; if still over after 2 halvings (256px), omit the screenshot from the call, log to trace as `screenshot-omitted: too-large`, and proceed text-only for that decision."

**LOW 5.** Baseline capture cadence was a PLAN-only invention (Step 4.3 said "every 1000 ticks, configurable") with no DESIGN sign-off. Fix: brought into DESIGN §4 with explicit repo-size implications: "every 1000 ticks; ~30 PNGs/30k-tick run/seed at ~50 KB each = ~1.5 MB committed per seed."

**NIT 6.** PLAN Step 1.5 said "dispatch returns `true` / `false`" — DESIGN has structured result. Fix: PLAN now says "returns `accepted: true` with `commandKind` + normalized `data` for shape-valid examples; returns `accepted: false` with `reason: 'malformed-payload' | 'unknown-kind' | 'wrong-owner-range'` for invalid."

**NIT 7.** PLAN test example referenced `unit.move` discriminator; DESIGN canonical examples use `building.placeConfirm` and `queue.train`. Fix: PLAN now uses the same canonical examples to keep the docs aligned.

### DESIGN ↔ PLAN consistency

Claude verified: all five phases line up; Phase 4 independence consistently stated; cost-budget defaults match; CI gating expressions match; files-to-touch in PLAN cover the surface DESIGN describes. No conflicting facts.

## Action plan

Iter-3 fixes applied inline (this iteration):

1. PLAN.md Step 5.1 — retention pruning step.
2. DESIGN.md `CommandDispatchResult` — generic `K`.
3. DESIGN.md §3 — `screenshotSaveEveryNDecisions` default + flag.
4. DESIGN.md §2 — image overflow path.
5. DESIGN.md §4 — baseline cadence.
6. PLAN.md Step 1.5 — dispatch wording matches DESIGN.
7. PLAN.md Step 1.5 — test examples match DESIGN canonical discriminators.

Codex was unreachable on iter-2 (Windows PowerShell deny-rule loop, same as iter-1). Will retry on impl-1 review when there's diff content rather than design-doc verbatim.

## Next iteration

Design + plan converged. impl-1 dispatch follows: Phase 1 implementation (browser test API extensions + AI gating), TDD per AGENTS.md, multi-CLI review on the diff.
