# Forced-AI auto-gather gate fix — DESIGN

**Objective:** fix a total economy freeze for a FORCED-AI owner in the headless AI-vs-AI corpus, found while grounding the wood-throttle. It is a test-infrastructure bug (real games are byte-identical), but it invalidated the AI-vs-AI corpus for owner 1 and MASKED the wood investigation.

## Grounding (engine debug tools first, per the rule)

A deterministic 8000-tick AI-vs-AI run (`npm run playtest -- --all-ai`) replayed with `replay:inspect`: **owner 1 (the forced-AI human slot) was hard-frozen the entire run** — wood stuck at exactly 0, food at 40, 5 villagers ALL `idle`, never left the Dark Age — while owner 2 (the enemy AI, same AI logic) developed normally to Feudal. The `--detail` histogram confirmed owner 1's 5 villagers were `{"idle":5}` despite 24 wood resources within 14 cells and full trees 8 cells from its TC. So the villagers were not gridlocked-moving (the roadmap's wood-locality throttle) — they were never ASSIGNED to gather at all.

## Root cause

`pureHelpers.ts:shouldMaintainGatheringOrder(owner, gatherer)` — the gate that decides whether the gather state machine auto-(re)assigns an idle villager — returned `owner !== HUMAN_PLAYER_ID || gatherer.hasExplicitGatherOrder`. It keyed on OWNER ID: AI owners (owner ≠ 1) auto-gather; the human slot (owner 1) only maintains a villager that has an EXPLICIT order (AoE2-faithful — human villagers idle until tasked). But `forceAiForOwners` (the headless AI-vs-AI override) makes owner 1 RUN THE AI while owner 1 is still `HUMAN_PLAYER_ID`. So its AI-driven villagers, which never carry explicit player orders, failed the gate and idled forever — the AI built and trained (the `aiVsAi` test only checked those) but its economy never gathered.

## Fix: key the gate on AI-CONTROL, not owner id

`shouldMaintainGatheringOrder(owner, gatherer, isAiControlled)` → `owner !== HUMAN_PLAYER_ID || isAiControlled || gatherer.hasExplicitGatherOrder`. The `isAiControlled` clause is **ADDITIVE** — the original `owner !== HUMAN_PLAYER_ID` clause is RETAINED, and a third disjunct is added so a forced-AI human slot also auto-gathers. The villager economy system passes `isAiControlled = aiStates.has(unit.owner)` (read once per tick, accessor-cached). `aiStates` (the persisted `aoe2.aiStates` codec) marks every AI-controlled owner INCLUDING a forced-AI human slot (the same set that gates `aiSystem`/`autoAggressionSystem`).

**Why additive, not a replacement:** the first attempt REPLACED the owner-id clause with `isAiControlled` alone (`isAiControlled || hasExplicitGatherOrder`). That broke 6 test files (villagerGatherReroute/dropOffReroute/…): an AI-DISABLED owner (fixtures use `disableAi` to isolate scenarios) has `aiStates.has(owner) = false`, so its villagers — which auto-gathered under the old owner-id check — stopped. Retaining `owner !== HUMAN_PLAYER_ID` keeps every non-human owner (including AI-disabled) byte-identical.

**Byte-identical for real games:** with the owner-id clause retained, the disjunction changes value ONLY when `owner === HUMAN_PLAYER_ID` AND `isAiControlled` is true — i.e. a forced-AI owner 1. Every other case (owner 2 AI or AI-disabled → owner-id clause true; owner 1 real human → both new clauses false, falls through to `hasExplicitGatherOrder` as before) is unchanged. The ONLY behavior delta is a forced-AI owner 1, which now correctly auto-gathers.

**Determinism/save-safe:** `aiStates` is persisted Tier-1 state, so a save/loaded game reads the same AI-control status; replay re-steps deterministically. No transient state, no save-shape change.

## Scope note (what this is NOT)

This is NOT the roadmap's wood-locality throttle (villagers gridlocked deep in forest, moving without net progress). That remains OPEN — even after this fix, owner 1's WOOD stays low (19–54) while food/gold flow, so the wood-specific locality/pathing throttle persists. This fix unfreezes the BROADER economy so the corpus is valid and a future AI-vs-AI run can actually surface the wood-gridlock (previously masked by the total idle-freeze).

## Validation (before/after replay)

- BEFORE (`output/ai-vs-ai/run.json`): owner 1 wood=0, food=40, Dark Age, 5 idle villagers — frozen at tick 2000/4000/8000.
- AFTER (`output/ai-vs-ai/run-fixed.json`, same seed): owner 1 gathers (food 415 @ t2000), reaches FEUDAL by t4000, gold 887 @ t8000 — economy alive; both owners reach Feudal.
- TDD: pure `shouldMaintainGatheringOrder` (AI-controlled → true regardless of explicit order; human → true only with an explicit order) + the existing `aiVsAi` forceAi test strengthened to assert owner 1 has actively-gathering (non-idle) villagers (RED before: 0 working; GREEN after).

Test-infra only → no version bump / changelog; devlog + roadmap (wood-throttle unblocked) + this thread.
