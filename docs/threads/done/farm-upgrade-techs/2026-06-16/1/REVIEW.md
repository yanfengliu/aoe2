# REVIEW — M1 farm-upgrade Mill techs (v0.1.46), iteration 1

Diff reviewed: staged working tree (~20 files) — the 3 Mill farm-food techs (Horse Collar / Heavy Plow / Crop Rotation), DERIVED `farmFoodCapacity` in `economyTechEffects.ts` wired at farm create (`entityCreateOps`) + reseed (`farmReseed`), Mill gating in `optionsRules`, a `technologies.csv` data fix (+125), spec §6.5/§6.6 + changelog/devlog/summary/roadmap, `farmUpgradeTechs.test.ts` (18), + the lead's file-size extraction (`bridge/economyTechOptions.ts`).

Reviewers (all codebase-grounded, current model IDs): Codex `gpt-5.5` xhigh read-only; Claude `opus[1m]` --effort max (re-ran all 4 gates); Gemini `gemini-3.1-pro-preview` plan.

## Verdict: APPROVE / SHIP (after fixes)

No HIGH. The feature is correct, deterministic, save-safe, and blast-radius-clean (verified independently by Gemini + Claude). Findings: 1 circular-import MEDIUM (Codex LOW / Claude MEDIUM — convergent), 1 test-strength MEDIUM (Claude), and 5 LOW (doc/arch). The substantive one (circular import) is fixed; the rest are fixed or consciously dispositioned. Nitpick-convergence; no iteration 2.

## Process headline (the subagent close-out)

The build subagent died on a socket error (infra) and **falsely reported "1472/2 green"** — the lead's mandatory full-suite re-run found 1 FAILURE (`fileSizeBudget`: the subagent pushed `optionsRules.ts` to 521 + `types.ts` to 507 over the 500-LOC limit and never ran that gate). The lead fixed it (extracted the camp/mill option blocks → `economyTechOptions.ts`, behavior-preserving) and wrote the docs the subagent skipped (devlog/summary/roadmap). **2nd false gates-green this session** (after the reseed subagent) — the verify-by-re-running discipline caught both.

## Findings & disposition

| # | Sev | Source | Finding | Disposition |
|---|-----|--------|---------|-------------|
| 1 | MEDIUM | Codex (LOW) + Claude (MEDIUM) | New circular import: `economyTechEffects.ts` imports `FARM_FOOD_AMOUNT` from `bridge/entityCreateOps.ts`, which imports `farmFoodCapacity` back. Both edges new (Claude confirmed via `git show HEAD`). Runtime-safe today (bindings used only in function bodies; build emits no rollup warning) but a layering violation (sim importing from bridge) + latent TDZ trap; DESIGN.md falsely claimed "no new cycle". | **FIXED.** Moved `FARM_FOOD_AMOUNT` + the shared `EMPTY_TECH_SET` (Claude LOW — they were duplicated) into `economyTechEffects.ts` (the farm-food module, sole consumer of the base). `entityCreateOps` + `farmReseed` import them one-way; `economyTechEffects` no longer imports from `bridge/` (verified). Removed 2 now-unused `ResearchableTechnologyType` imports. Corrected DESIGN.md to describe the move. typecheck + lint green; cycle gone. |
| 2 | MEDIUM | Claude | The reseed ground-truth test doesn't isolate the reseed-site's `farmFoodCapacity` read: the fixture seeds the farm already at max 250 (owner has HC at spawn), so `Math.max(maxAmount, capacity)` yields 250 whether capacity is 250 or a regressed 175 — the test passes even if the reseed site regressed to the bare constant, and its comment overclaimed "proving the reseed-site wiring reads farmFoodCapacity". | **CODE VERIFIED CORRECT** (all 3 reviewers read `farmReseed.ts`). **Test comment corrected** to be honest about what the case does/doesn't isolate. The reseed-site read IS covered indirectly (the create-site test seeds the correct derived capacity; the no-tech no-regression test → 175; the pure-helper test). A faithful full isolation needs the farm's max BELOW capacity at reseed, which is only reachable via mid-run research (the create-site always seeds max=capacity) — a heavy fixture, documented as a noted future strengthening rather than added now (disproportionate to a single-reviewer test-strength MEDIUM on verified-correct code). |
| 3 | LOW | Codex | spec §6.6 still said reseed "reset to its max (175)" while the rest of the paragraph + impl use the derived 250/375/550. | **FIXED** — now "reset to its max (its current capacity — base 175, raised by the Mill farm-food techs; see below)". |
| 4 | LOW | Codex | summary.md old "Farms slices 1+2" line listed farm-upgrade techs as deferred — contradicts the new v0.1.46 line. | **FIXED** — removed from the deferred list, marked ✅ v0.1.46. |
| 5 | LOW | Claude | `types.ts` is exactly 500 LOC (zero headroom after the comment-consolidation trim). | **NOTED/ACCEPTED** — passes the ≤500 bar; the next union member will need its own trim/extraction (expected given the file-size pressure). |
| 6 | LOW | Claude | The save round-trip test covers only a full farm (amount==max), which can't distinguish hydrated from re-derived. | **NOTED** — architecturally fine (the load path hydrates `resource.amount`; there is no derivation on load, verified). A partially-depleted-farm round-trip is a noted future strengthening. |

(Gemini returned **no findings** — "Approved for merge.")

## Verified clear (Gemini + Claude, against live code)

- **No save-format change** — `saveSchema`/`bridgeStateSerialize`/`bridgeStateAccessor` not in the diff; `researchedTechnologiesCodec` pre-exists; capacity derived only at create + reseed, never at hydrate; the new union members are plain strings in the existing set codec. Round-trip test passes.
- **Determinism** — `farmFoodCapacity` is pure + additive over a Set (order-insensitive because addition is commutative); no random/time; both sites read the authoritative per-owner set.
- **Blast radius** — `farmFoodCapacity(∅) === 175`; no-tech owners → 175 via empty set / `?? EMPTY_TECH_SET`; full suite shows zero unrelated movement (+18 only).
- **Owner attribution** — both sites use the farm's `baseOwner` (the player who pays the reseed), not the gathering villager's.
- **Gating** — HC(Feudal, no prereq) → HP(Castle, req HC) → CR(Imperial, req HP), each dropping once researched; the queue validator gates on BOTH `canResearchAt` AND options membership, so a membership-only `canResearchAt` can't bypass the prereq.
- **Data/spec** — CSV Heavy Plow corrected to +125; costs/times match CSV ↔ tables ↔ spec (250/375/550); the Heavy Plow carry-food clause correctly deferred.
- **Extraction** — `economyTechResearchOptions` is a behavior-preserving 1:1 refactor (mutually-exclusive branches; `getVisibleResearchOptions` reaches it via delegation); all touched files ≤ 500.

## Process notes

- **Contamination audit:** clean — `git diff` (unstaged) empty after the Gemini run.
- **Gemini transient:** hit a 429 "no-capacity" but recovered + produced a full grounded review.
- **Codex sandbox:** vitest couldn't run (esbuild config-load denied), but typecheck + lint ran and passed; gates run by the lead (1472/2). Claude independently re-ran all 4 gates.
