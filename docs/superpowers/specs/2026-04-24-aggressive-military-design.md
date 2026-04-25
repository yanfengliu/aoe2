# Aggressive military units (canonical AoE2 stance defaults)

## Goal

Idle military units should pursue and engage visible enemies on their own. Idle villagers should swing back at adjacent attackers. The reference behavior is canonical AoE2: the Aggressive stance for military, the Defensive stance for villagers. Today every owned unit is fully passive — an idle Knight standing next to an enemy archer just dies.

## Scope (decided in brainstorm)

- **Coverage:** every owned military unit (everything except `villager`, `monk`, and resource entities like sheep). Plus `villager` with a narrow defensive rule.
- **Trigger:** a unit with no entry in `unitCommands` and not garrisoned. Player-issued orders (move / build / gather / explicit attack) take precedence and are never auto-overridden.
- **Detection radius:**
  - Military: `unitVisionRadius(unitType)` — the unit's per-type LOS already used by the visibility system. Matches AoE2 Aggressive stance, where pursuit happens on anything in personal LOS.
  - Villager: `1` — melee attack range only. Matches AoE2 Defensive stance: counter-attack adjacent attackers; no pursuit.
- **Targeting priority:** reuse the existing `targetPriority(unitType)` and `buildingTargetPriority(buildingType)` tables in `bridge/targetFindingOps.ts`. Tie-break by Manhattan distance from the unit's own position.
- **Target classes:** prefer enemy units over enemy buildings within radius. (Towers + TCs + Castles already auto-fire at us; ignoring an enemy unit while attacking a Castle would be a footgun.)
- **Auto-attack vs player attack:** the issued command has the same shape as a player-issued attack-command. The existing `prototypePlayerCommands` system handles pursuit, range checks, cooldown, and damage application. Auto-aggression only *originates* the command.

## Non-goals

- No stance toggle UI. Defaults are baked in.
- No "return to origin" after an Aggressive-stance kill. Canonical Aggressive stance leaves units where they ended; the player re-positions manually.
- No counter-attack interruption of player orders. A villager moving toward a forest under a `move` command does not stop to fight a passing wolf or arrow. The player gave the order; we honor it.
- No change to the AI's existing attack-group logic. The AI already drives military aggression through its own broader scan in `prototypeAi`.
- No change to wildlife auto-aggro (wolves) or building auto-fire (towers, castles).
- Monks excluded — their "attack" is conversion, which has its own pipeline (`bridge/monkTaskOps.ts`). Out of scope for this pass.
- Save/load schema: no new state. Auto-attack-commands serialize through the existing `unitCommands` map.

## Decision tree (per tick, per unit)

```
for each unit owned by any player (not just human):
  if unitCommands.has(unitId):                                  → skip (player/AI order in flight)
  if unit is garrisoned:                                        → skip
  if currentHp <= 0:                                            → skip
  if unitType === 'monk':                                       → skip (monk pipeline owns its own targeting)
  if unitType === 'sheep' or wildlife:                          → already excluded (not in 'unit' query)

  if unitType === 'villager':
    radius = 1
  else:
    radius = unitVisionRadius(unitType)

  target = findPreferredEnemyUnitInRadius(owner, position, radius)
  if target === null:
    target = findPreferredEnemyBuildingInRadius(owner, position, radius)
  if target === null:
    → skip

  issueUnitAttackCommand(unitId, target, kind)
```

## Architecture

### New helpers — `src/game/simulation/bridge/targetFindingOps.ts`

Two new exports on the existing `TargetFindingOps` interface:

```ts
findPreferredEnemyUnitInRadius(
  viewerOwner: number,
  origin: Position,
  radius: number,
): number | null;

findPreferredEnemyBuildingInRadius(
  viewerOwner: number,
  origin: Position,
  radius: number,
): number | null;
```

Both use `world.queryInRadius` for the candidate set, filter by owner-mismatch and (for buildings) construction-complete, then sort by `targetPriority` / `buildingTargetPriority` then by Manhattan distance. Same priority tables as `findPreferredVisibleEnemyUnit` / `findPreferredVisibleEnemyBuilding` — no new tables.

Visibility check (fog of war) is intentionally **not** applied. Aggressive stance in canonical AoE2 triggers on personal LOS, not on player fog state. A Knight standing next to an enemy unit attacks it even if no other allied unit illuminates that tile. The radius itself is the gate.

### New simulation system — `prototypeAutoAggression`

Registered in `createSimulationBridge.ts`, runs in the `update` phase, **before** `prototypePlayerCommands` so the auto-issued commands are processed in the same tick they are emitted. Skips wildlife (not in `'unit'` query), skips garrisoned units, skips dead units. Issues commands through the existing `issueUnitAttackCommand` helper — no new command pathway.

### What does not change

- `prototypePlayerCommands` (the attack/move/build dispatcher). Auto-issued attack-commands flow through unchanged.
- `prototypeAi` attack-group code. It still calls the existing `findPreferredVisibleEnemyUnit` and continues to drive AI aggression through its own scan.
- `prototypeTowerCombat`. Towers / Castles / TCs continue to auto-fire on visible enemies in their attackRange.
- `prototypeWildlifeCombat`. Wolves continue to use their own `autoAggro` + `aggroRange`.
- `unitCommands` schema and save/load.

## Test contract

New file `tests/simulation/autoAggression.test.ts`. New fixtures under `fixtures/combatMatchups/` for two-unit auto-aggression scenarios. The tests assert app behavior, not internal helper calls.

1. **Idle militia + enemy in vision** — human militia idle, enemy spearman placed 4 tiles away (within militia vision 3? no — within vision-overlap; pick a unit/distance combo that's clearly inside vision). After N ticks, target HP has dropped, attacker has moved closer, attacker has a non-empty `unitCommand`.
2. **Idle militia + enemy outside vision** — enemy placed 8 tiles away (outside militia vision 3). After N ticks, target HP unchanged, attacker still idle.
3. **Idle archer + enemy in vision range, beyond attack range** — archer's attack range is 4, vision is 5. Enemy placed at distance 5. Archer auto-pursues, closes to range, fires.
4. **Idle militia under player move-order, enemy beside it** — militia given a `move` to the opposite end of the map, enemy spearman 1 tile away. Militia keeps moving past the spearman and does not auto-engage. (Player order honored.)
5. **Villager + adjacent enemy militia** — villager idle, enemy 1 tile away. Villager auto-attacks. Target HP drops.
6. **Villager + enemy archer 4 tiles away (out of villager radius 1)** — villager does NOT pursue. Stays idle. (Defensive stance canon.)
7. **Auto-engaged unit kills target → re-engages** — two enemies in a militia's vision. Militia kills first, then auto-engages second. (Idempotency: `unitCommands` clears on kill, next-tick scan picks up the second target.)
8. **Save/load preserves auto-aggression after rehydrate** — set up scenario where militia is auto-attacking enemy, save mid-engagement, load, advance ticks, target HP continues to drop. Verifies the auto-issued attack-command saved/loaded correctly.

## TDD ordering

Write all 8 tests first against the existing code (they will fail because there's no auto-aggression). Then add `findPreferredEnemyUnitInRadius` / `findPreferredEnemyBuildingInRadius`, then register `prototypeAutoAggression`. The same test list is the green check.

## Validation gates

- `npx vitest run` — full suite green
- `npx tsc --noEmit` — clean
- `npx vite build` — clean
- `npm run test:browser` — full Playwright suite green (no UI surface change expected, but auto-attacks must not break any browser test that places idle enemies near idle units)
- Code review iteration with at least Claude CLI; Codex / Gemini if available (per CLI-drift memory, fall back to Claude only if needed)

## Files touched

| Path | Change |
|---|---|
| `src/game/simulation/bridge/targetFindingOps.ts` | +2 helpers, ~50 lines |
| `src/game/simulation/createSimulationBridge.ts` | +1 system registration, ~50 lines |
| `src/game/simulation/fixtures/combatMatchups/<new>.ts` | new fixtures for auto-aggression scenarios |
| `tests/simulation/autoAggression.test.ts` | new test file, 8 cases |
| `docs/devlog/detailed/<latest>.md` | append new entry per AGENTS.md |
| `docs/architecture/ARCHITECTURE.md` | no change (not a structural shift) |

## Risk + mitigation

- **AI tests regress** — the AI's own attack-group code might double-issue commands or race with auto-aggression. Mitigation: `prototypeAutoAggression` skips units that already have a `unitCommands` entry, including AI-issued commands. The AI runs `prototypeAi` first, sets commands; auto-aggression sees them and skips. Order-of-systems matters; document it inline.
- **Browser tests regress** — some browser tests place enemies near idle players for visual checks. Auto-aggression might now have them attack each other on first tick, breaking visual expectations. Mitigation: run the full Playwright suite as a gate; any regression flagged is a real ask of "did this scenario previously rely on passive behavior?"
- **Performance** — every idle unit now does a `queryInRadius` per tick. The radius is small (1-16 tiles) and `queryInRadius` is the engine's spatial index. No measurable impact expected; if profiling later shows otherwise, add a per-N-tick cadence (every 5 ticks) before any other optimization.
