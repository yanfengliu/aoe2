# Herbal Medicine (Monastery, 4× garrison heal) — DESIGN

**Objective (v0.1.70):** the Monastery tech Herbal Medicine (`technologies.csv:65` — Castle, 350 gold, 35s, "Garrisoned Units 4x healing speed"), which makes an owner's garrisoned units heal 4× faster. A real M4 Monastery-content gap that cleanly extends the v0.1.63 passive garrison-heal system.

## Design: a derived multiplier on the existing garrison-heal rate

v0.1.63's `garrisonHealSystem` heals every garrisoned unit `GARRISON_HEAL_HP_PER_TICK = 0.4`/tick via the pure `garrisonHealStep(currentHp, maxHp, rate)`. Herbal Medicine is a flat 4× on that rate for units whose OWNER researched it — the same DERIVED-from-the-researched-set pattern the monk techs (Block Printing/Faith) already use in `monasteryTechEffects`:

```ts
export const HERBAL_MEDICINE_HEAL_MULTIPLIER = 4;
export function garrisonHealRateMultiplier(ownerResearched) {
  return ownerResearched.has('herbal-medicine') ? HERBAL_MEDICINE_HEAL_MULTIPLIER : 1;
}
```

The system change: it now also reads `researchedTechnologiesCodec`, and for each garrisoned unit looks up its owner (`world.getComponent(unitId, 'unit').owner` — garrisoned units keep their `unit` component; only `position`/`visionSource` are removed on garrison), computes `rate = 0.4 × garrisonHealRateMultiplier(owner's techs)`, and passes it to the unchanged `garrisonHealStep`. Rates are cached per owner (`rateByOwner` Map) so a full garrison isn't re-derived per unit.

**Byte-identical base path:** without the tech the multiplier is 1, so `rate = 0.4` exactly — the same value `garrisonHealStep` used before — and the cap/dead/full guards + `markDirty`-only-when-healed logic are untouched. Determinism preserved (no random/time; the accessor reads are per-tick stable).

## No save-format change

The effect is derived from the already-persisted researched-tech set; no new stored state. Save/load and replay reproduce it for free.

## Seam wiring

Standard: `technologyTypes` union → `prototypeEconomyRules` cost `{gold:350}` + time `350` (CSV 35 s × 10 TPS; one gather-rate comment folded to hold the 500-LOC cap, landed 499) → `prototypeBuildingRules` monastery RESEARCHES row → `monasteryTechOptions` Castle block (drops once researched) → `formatters` label.

## Validation

TDD: pure `garrisonHealRateMultiplier` (1 without, 4 with) + gating (cost/time, monastery-only) + a live 4×-gain race — a garrisoned villager with Herbal Medicine gains exactly 4× the HP of the baseline fixture over a shared 10-tick pre-cap window (`herbalGain ≈ baselineGain × 4`), proving the system reads the owner's set and applies the multiplier end-to-end. New `garrison-heal-herbal-fixture` = the base garrison-heal fixture with `startingResearchedTechnologies: ['herbal-medicine']` on owner 1. Deterministic fixtures, not an LLM playtest.
