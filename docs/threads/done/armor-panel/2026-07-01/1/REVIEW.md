# Armor panel (melee/pierce rows) — Review iteration 1 (2026-07-01)

Change under review: the selection panel now shows Melee armor + Pierce armor as two rows (spec §11.8), surfacing the v0.1.53 asymmetric armor split. Display-only: `SelectionState.pierceArmor` (= `pierceArmorTechBonus(combat)`) + a `pierce-armor` render row + relabel "Armor" → "Melee armor" (data-key unchanged).

Reviewers: **Codex** (gpt-5.5 xhigh) and **Claude** (opus[1m]). Gemini not run (headless OAuth). Both verified against the live codebase. **Verdict: no correctness/contract/consistency defects — display-only and safe.**

## Findings

### Both — minor (fixed): stale shared fixture shape
`tests/playtest/agentSnapshotTestKit.ts:makeSelection` casts `as SelectionState` without `pierceArmor`. Typecheck misses it (assertion, not assignment). Harmless today (it feeds the agent-snapshot builder, not `renderSelectionDetails`, and already omits ~7 required fields via the same cast — a pre-existing partial-fixture pattern), but a stale shape for the grown contract.
- **Fix:** added `pierceArmor: null` to the fixture for consistency.

### Claude — cosmetic (fixed): formatting wart
Two fixture files had `faction: null,  civ: null,` on one line (irregular spacing from the field-insertion perl). Not a gate failure (no prettier gate).
- **Fix:** split onto one-property-per-line.

## Confirmed correct by both reviewers (no action)
- `getSelectionPierceArmor` mirrors the melee handling exactly (unit → `pierceArmorTechBonus`, building → 0, live wildlife → 0, else null); the empty-selection default AND the assembled state both set `pierceArmor` — no runtime shape mismatch.
- No existing browser test broken: the melee row's `data-selection-detail(-value)="armor"` key is unchanged (only the visible label changed), so `expectSelectionDetail(page, 'armor', …)` / `expectSelectionDetailAbsent` still resolve; the new row uses a distinct `pierce-armor` key.
- Key union consistent across render.ts, tooltips.ts (`SELECTION_DETAIL_TOOLTIPS` includes `pierce-armor`, so the tooltip lookup returns a real string), and the browser helper hud.ts.
- Docs accurate: spec §11.8 two-row sentence, changelog 0.1.54, package.json bump.

## Extra (self-caught): file-size budget
Adding the field + comments pushed `types.ts` to 504 (500 hard limit — already maxed). Trimmed the added comments to inline form + condensed one unrelated 3-line comment → back to 500.

## Disposition — CONVERGED
Both reviewers found no real defects (display-only, safe). The two minor items (stale fixture shape + formatting) are fixed. LOC regression fixed. Proceeding.
