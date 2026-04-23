# Selection info panel: show current activity

## Goal

The selection info panel should show what the selected entity (or group) is currently doing. Today it shows identity, stats, inventory, queue, and command buttons — but not the live action ("Gathering wood", "Training Villager", "Idle"). This spec adds that.

## Scope (decided in brainstorm)

- **Entity coverage:** owned units and owned buildings only. Enemy/neutral selections and resources hide the activity row.
- **Granularity:** coarse + target (e.g. `Gathering wood`, `Attacking Knight`, `Building House`, `Training Villager`, `Researching Loom`, `Under construction`, `Idle`).
- **Placement:** a dedicated line under the selection name, above the Health/Attack/Armor detail grid.
- **Multi-selection:** coarse-verb roll-up, e.g. `5 gathering · 2 moving · 1 idle`. No target names in the roll-up — the breakdown line stays narrow.

## Non-goals

- No new behaviors or AI changes. Activity is a read-only label over existing simulation state.
- Enemy-unit activity is out of scope even though it would be easy — covered by the "owned only" brainstorm decision.
- No new visual treatments beyond the new line (no icons, no colors per activity). Keep it textual for this pass.
- No changes to the activity row when the panel is refreshing for an unchanged snapshot — the existing signature memoization in `selectionPanel.ts` must continue to suppress re-render.
- Garrisoned units are unselectable through the panel; no activity label is produced for them.

## Activity taxonomy

The bridge derives the activity from existing simulation state. No new components.

### Units — priority order (first match wins)

1. **Monk task** (`monkTasks.get(id)`):
   - `heal` → `Healing <Target>`
   - `convert` → `Converting <Target>`
   - `pickup` → `Retrieving relic`
   - `deposit` → `Depositing relic`
3. **Trebuchet pack state** (`trebuchetPackStates.get(id)`) → `Packing` or `Unpacking` when actively transitioning; no special label when stably packed/unpacked (falls through to step 4 or 5).
4. **Unit command** (`unitCommands.get(id)`):
   - `attack` → `Attacking <Target>` (target name from `targetEntityKind` + entity type; if the target has been destroyed, `Attacking`).
   - `build` → `Building <Building>`. If the target building is at full HP and still has the unit as a builder, the word is still `Building` — we do not distinguish "repair" in this pass (coarse-target rule).
   - `move` → `Moving`. (Gather/return paths go through `GathererComponent.task`, not unitCommands — see step 5 below.)
5. **Fall-through** → `Idle`.

### Buildings — priority order (first match wins)

1. **Under construction** — `constructionStates.get(id)?.isComplete === false` → `Under construction`.
2. **First queue entry** (`productionQueues.get(id)?.[0]`):
   - `unit` → `Training <Unit>`
   - `technology` → `Researching <Tech>`
3. **Fall-through** → `Idle`. (Garrison occupancy already shows in the `Inventory` row — not duplicated here.)

### Resources

No activity — row hidden.

### Enemy / neutral owner

No activity — row hidden.

## Multi-selection

When `selectedEntityIds.length > 1` and all entities share owner === human player:

- For each selected owned unit/building, compute the coarse verb only. The mapping from taxonomy branch to coarse verb is explicit (not derived by string-splitting the single-selection label, because `Under construction` is two words):
  - Healing / Converting / Retrieving relic / Depositing relic → `healing` / `converting` / `retrieving` / `depositing`
  - Packing / Unpacking → `packing` / `unpacking`
  - Attacking → `attacking`
  - Building → `building`
  - Gathering → `gathering`
  - Returning → `returning`
  - Moving → `moving`
  - Training → `training`
  - Researching → `researching`
  - Under construction → `under construction`
  - Idle → `idle`
- Group by verb. Order by count descending, then by verb alphabetical for stable output.
- Render as `N verb` tokens joined by ` · ` (middle dot). Cap at 5 tokens; if more, append `· …`.
- If any selected entity is not owned (e.g. selection mix that somehow includes a neutral sheep), drop it from the count. If the remaining set is empty, hide the line.
- Single-entity form is used when `selectedCount === 1`.

## Data surface

Two new optional fields on `SelectionState` in `src/game/simulation/types.ts`:

```ts
activity: string | null;
activityBreakdown: { entries: { label: string; count: number }[]; overflow: number } | null;
```

- `activity` is set when `selectedCount === 1` and the selected entity is an owned unit or building. Null otherwise.
- `activityBreakdown` is set when `selectedCount > 1` and at least one selected entity is an owned unit/building. Null otherwise. `entries` holds up to 5 verbs (most-frequent first); `overflow` counts any verbs beyond the cap.
- Exactly one of the two is non-null for a valid activity read; both null means "no activity to show" and the row is hidden.

The bridge's `getSelectionState()` fills these fields using the taxonomy above, pulling from the same maps it already consults (`unitCommands`, `monkTasks`, `trebuchetPackStates`, `productionQueues`, `constructionStates`, `GathererComponent`).

## Rendering

`src/ui/hud/selectionPanel.ts` gets a new render function `renderSelectionActivity(selectionState)`:

- Single: `<div class="hud-selection-activity" data-selection-activity>Gathering wood</div>`
- Multi: `<div class="hud-selection-activity" data-selection-activity-multi>5 gathering · 2 moving · 1 idle</div>`
- Null: return empty string, row absent.

Note: `data-selection-activity` and `data-selection-activity-multi` are mutually exclusive — single-entity renders use the former, multi-selection renders use the latter.

The activity block is inserted between `formatSelectionName(...)` and `selectionDetails` in the existing innerHTML template. CSS styling: matches `hud-selection-meta` in weight — smaller than the name, same text color as other details. Add a minimal CSS rule in `src/styles.css` only if the existing classes don't already give the right look.

Browser tests key off `[data-selection-activity]` (single) and `[data-selection-activity-multi]` (multi).

## Tests

### Simulation (vitest)

New file `tests/simulation/selectionActivity.test.ts`:

1. Idle villager → `activity === 'Idle'`.
2. Villager moving to empty tile → `Moving`.
3. Villager ordered to chop tree → `Gathering wood`.
4. Villager with carried wood heading to lumber camp → `Returning wood`.
5. Villager placing a house foundation → `Building House`.
6. Knight with attack command on enemy unit → `Attacking <UnitName>`.
7. Monk healing a wounded unit → `Healing <UnitName>`.
8. Monk converting an enemy → `Converting <UnitName>`.
9. Monk retrieving a relic → `Retrieving relic`. Depositing → `Depositing relic`.
10. Town Center with Villager at head of queue → `Training Villager`.
12. University with a tech at head of queue → `Researching <TechName>`.
13. Building mid-construction → `Under construction`.
14. Idle Barracks → `Idle`.
15. Enemy unit selected → `activity === null`, `activityBreakdown === null`.
16. Resource (tree) selected → both null.
17. Multi-select with 3 villagers gathering wood + 2 idle villagers → `activityBreakdown === [{ label: 'gathering', count: 3 }, { label: 'idle', count: 2 }]`.
18. Multi-select with more than 5 distinct verbs → breakdown length <= 5 and the overflow token shows.
19. Signature memoization: two consecutive frames with the same activity must hit the "no re-render" path in `selectionPanel.ts` (already covered by the `JSON.stringify` diff — just assert activity is captured in the signature).

### Browser (playwright)

Append to `tests/browser/game-selection.spec.ts` (or a new file if the suite is full) — one end-to-end happy path:

- Select a villager, issue a wood-chop order → `[data-selection-activity]` text contains `Gathering wood`.
- Box-select 3 idle villagers → `[data-selection-activity-multi]` text contains `3 idle`.

No visual pixel diff needed — the change is additive textual content.

## Architecture impact

No architecture change. The bridge already owns selection-string derivation (`getSelectionInventory`, `getSelectionHealth`, etc.); this is the same pattern. No new module, no new boundary. No `ARCHITECTURE.md` or `drift-log.md` update.

## Engine feedback

None expected. Everything the taxonomy needs is already tracked in the bridge's own maps; no `civ-engine` gap. If a gap surfaces during implementation (for example, a Monk task target entity reference that won't resolve into a display name), record it in `docs/engine-feedback/current.md` and stop per `GAME_SPECIFIC.md`.

## Out of scope / deferred

- Enemy unit activity display.
- Icons, colors, or animations for activity states.
- Activity history or "just finished X" hints.
- Multi-selection breakdown with target detail (`2 gathering wood · 1 gathering gold`) — revisit if the coarse roll-up feels under-informative.
- Sorting multi-selection breakdown by a game-meaningful priority (e.g. idle last). Current spec: count desc, then verb alphabetical.
