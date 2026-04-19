# Deferred follow-ups plan

Source: the deferred-items enumeration from the post-Slice-12 status check.

Each batch is a self-contained subagent task. Batches commit independently; later batches may depend on earlier ones (armor formula is a prerequisite for meaningful new armor tiers).

## Batch FU1 — Armor damage-reduction + full Blacksmith progression

- Wire `CombatState.armor` into the combat formula: `damage = max(0, atk + bonus − target.armor)`.
- Add Feudal + Castle Blacksmith techs that were skipped in Slice 7:
  - Feudal: **Scale Mail Armor** (+1 infantry armor), **Scale Barding** (+1 cavalry armor), **Padded Archer Armor** (+1 archer armor), **Forging** (+1 melee attack), **Fletching** already exists.
  - Castle: **Chain Mail Armor** (+1 infantry armor), **Chain Barding** (+1 cavalry armor), **Leather Archer Armor** (+1 archer armor), **Iron Casting** (+1 melee attack), **Bodkin Arrow** (+1 archer attack + range), **Ring Archer Armor** (+1 archer armor, Imperial — move to FU1 even though Imperial tier).
- Chemistry tech (Imperial Blacksmith, +1 attack to gunpowder + archer units; gates Bombard Cannon / Cannon Galleon).
- Rework Slice 7's Imperial armor techs to stack correctly on top of Feudal/Castle tiers.
- Tests: one per tech (stacking, application to existing + future units), plus regression tests that existing combat damage values shift by the expected amount after each tech.

## Batch FU2 — Militia-line intermediates + Paladin + Heavy Camel

- **Man-at-Arms** (Feudal Barracks upgrade; Militia → Man-at-Arms: +5 HP, +1 attack)
- **Long Swordsman** (Castle Barracks upgrade; Man-at-Arms → Long Swordsman: +15 HP, +2 attack)
- **Two-Handed Swordsman** (Imperial Barracks upgrade; Long Swordsman → Two-Handed Swordsman: +5 HP, +1 attack)
- **Champion** becomes Two-Handed → Champion (was Militia → Champion in Slice 7)
- **Paladin** (Imperial Stable upgrade; Cavalier → Paladin: +40 HP, +2 attack)
- **Heavy Camel** (Imperial Stable upgrade; Camel → Heavy Camel: +20 HP, +2 attack) — optional if data-backed
- Fletching-style stacking: intermediate tiers preserved when upgraded

## Batch FU3 — Defensive-fire polish + real stone-wall

- **Garrisoned-archer-extra-arrows** for Castle: each archer inside a Castle adds +1 arrow per attack, capped at 5 (canonical AoE2).
- **Closest-edge distance** for `findPreferredVisibleEnemyUnitInRange` when evaluating large buildings — use nearest footprint cell rather than anchor.
- **Real `stone-wall` building** (1x1, HP 2000, impassable, no attack) so Arena map uses a real wall instead of stone-mine proxy.
- **Palisade Wall** (1x1, HP 250, Feudal) optional additional wall type.

## Batch FU4 — AI improvements

- AI Castle/Imperial push tuning: change villager resource targets + decision interval per age to reach Castle in the 8000-tick test budget.
- AI uses Monks: build Monastery in Castle, train Monks, heal wounded own units, attempt conversions on enemy military, collect nearby relics.
- AI pursues Wonder victory: in Imperial Age with >40 villagers + safe economy, queue a Wonder and defend.
- AI-gather test flake (`ai-economy-fixture` tick 120): fix deterministic gather-start timing so all P2 villagers are in `to-resource`/`gathering`/`to-dropoff`.

## Batch FU5 — Save/Load HUD + Playwright

- HUD Save button: serializes `bridge.saveGame()` to `localStorage['aoe2-save-v1']` and triggers a download of `aoe2-save-<timestamp>.json`.
- HUD Load button: reads `localStorage` or accepts paste/upload; calls `createSimulationBridge(seed, { savedGame })`.
- Playwright case: save mid-match, reload page, load, assert match resumes.

## Batch FU6 — Refactors (pure, no behavior change)

- Split `src/ui/hud/createHudController.ts` into `tooltips.ts`, `toast.ts`, `debugOverlay.ts`, `postGameSummary.ts`, and keep `createHudController.ts` as the orchestrator.
- Move `SimulationDebugSnapshot` type from `createSimulationBridge.ts` to `types.ts` alongside `HudState`.
- Extract a `latestResearchedInChain` helper set into `upgradeChains.ts` module.

## Batch FU7 — Trebuchet pack/unpack + smaller polish

- **Trebuchet pack/unpack**: a Trebuchet has two states (`'packed'` = mobile, no fire; `'unpacked'` = stationary, fires). Player right-click ground packs/moves; right-click on enemy unpacks.
- Slice 8 tie-break: explicit `lastCompletedTick` on wonder/relic countdown resolution so "first to complete" is explicit instead of implicit system order.
- Score-weight tuning pass: adjust `computePlayerScore` weights.
- Wonder-owner-after-Monk-conversion regression test.

## Batch FU8 — Infrastructure (nice-to-haves)

- `vitest-worker` RPC timeout investigation: suppress warning if benign, or find root cause.
- `civ-engine` `OccupancyGrid` migration attempt #2 (or document permanent skip).

## Sequencing

FU1 must ship first (armor formula is load-bearing for FU2-FU7 meaningful-armor checks). Otherwise independent.

## Process

For each batch: subagent executes tasks + commits + devlog entry. After each batch: run full gate. Codex/gemini review only if the user specifically asks — the roadmap had reached diminishing returns on per-batch review cycles.
