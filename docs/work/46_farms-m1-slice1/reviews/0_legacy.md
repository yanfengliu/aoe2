# Farms (M1 food backbone, slice 1, v0.1.34) — Review iteration 1

Change under review: a farm — a building+resource HYBRID. A villager builds it (60 wood, Dark Age, 480 HP); on construction-complete it gains a `resource` component (175 food, owner:null, baseOwner:builder) so the existing villager economy gathers food from it; when depleted it is removed. Reseed, farm-upgrade techs, Mill-anchor, sprite, AI-builds-farms DEFERRED. Implemented by a fresh-context subagent; reviewed + gated by the main agent.

Reviewers: Codex (gpt-5.5, xhigh), Claude (opus[1m], --effort max), Gemini (gemini-3.1-pro, plan mode). All three read the live codebase. Gemini's grep tool errored mid-run (it reviewed more from the diff). Contamination audit: clean.

## Verdict: SHIP-WITH-FIXES → fixed in iter-2

The hybrid model + gather/depletion/save/build/determinism were confirmed SOUND by all three. Codex found 1 HIGH + 2 MEDIUM that Claude + Gemini missed; the main agent VERIFIED all three against the live code before acting (per the "verify reviewer claims" rule, a verified HIGH from one reviewer governs over the others' approval).

## Findings and disposition (fixed in iteration 2)

| # | Severity | Source | Finding | Disposition |
|---|---|---|---|---|
| 1 | HIGH | Codex (verified) | **Food theft.** A farm is an owned structure, but the gather paths treated it like neutral food — `assignNearestResource` (villagerEconomySystem) only DEPRIORITIZED baseOwner-mismatch (tier 2) instead of excluding it, and `setUnitGatherCommandDirect`/`unitGatherValidator` only checked harvestability. So an AI villager whose own food was exhausted would fall through and gather the human's farm, depositing food to itself. | FIXED (iter-2) — new pure `canGatherResource(gathererOwner, isOwnedStructure, baseOwner)` (false iff owned-structure AND baseOwner≠gatherer), applied at all 3 gather paths; tests prove enemy-can't/owner-can. |
| 2 | MEDIUM | Codex (verified) | **Visibility owner loss.** `visibility.ts` set `owner=building.owner` then overwrote it with `resource.owner` (null) for a farm, so the owner's farm projected as un-owned and got fog-filtered instead of live-rendered. | FIXED (iter-2) — resource branch is now `if (resource && !building)`; a hybrid keeps its building owner/type. |
| 3 | MEDIUM | Codex (verified) | **rallyPoints orphan.** A completed farm is a selectable building (can take a rally point), but `destroyResourceEntity` didn't clear `rallyPoints` on depletion. | FIXED (iter-2) — `destroyResourceEntity` now deletes the `rallyPoints` entry for hybrids (no double-delete). |
| 4 | LOW | Claude | **Selectable double-count.** The hybrid was pushed to the candidate list twice (building + resource loops), so `tileEntityCount` reported 2 for a lone farm (latent — no consumer today). | FIXED (iter-2) — the resource-candidate loop skips entities with a building component. |
| — | LOW | Codex | Add a built-farm save/load test. | Optional — save round-trip verified by reasoning (generic ECS snapshot serializes both components); not added this slice. |
| — | LOW | Codex | Docs reference `done/` thread + a stale 500-LOC claim. | The 500-LOC claim is ACCURATE (the 3 files are at exactly 500; Codex's "475/474/453" was a miscount, confirmed by `wc -l` + Claude). Thread moved to `done/` on this commit. |

## Verified-sound (all three, iter-1)
Occupancy single-claim (transformOps dispatches building-first), gather integration (isHarvestableResource passes a farm, 1×1 approach, food attributes to baseOwner), depletion orphan-free (the destroy path clears the building side-maps), build flow (Dark-Age option, 60 wood, 480 HP ramp), save round-trip (generic ECS snapshot — both components survive), determinism (no random/time), tests genuinely end-to-end.
