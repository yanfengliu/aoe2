# DESIGN — ai-age-up-priority (campaign-11 finding c)

## Problem (ground-truth verified)

campaign-11 replay (`output/playtests-llm/campaign-11.json`, `npm run replay:inspect`) shows owner 2 (the deterministic AI) reached **food=510 at tick 3000** with a complete **Barracks + Lumber Camp + Mill** (3 of the Feudal building prerequisites; only 2 are needed) and an **idle Town Center** (6 villagers = the Dark-Age villager cap), yet **stayed in the Dark Age for all 6000 ticks**, oscillating food 446–510 while massing Militia 10 → 19. A custom probe confirmed the prerequisites were complete (not under construction) at tick 3000.

## Root cause

In `aiSystem.ts`, within one decision cycle the AI pushes a **Militia** (Barracks, 60 food + 20 gold) BEFORE it pushes the **feudal-age** research (Town Center, 500 food). Both are individually affordable at 510 food, but not together (60 + 500 = 560 > 510). The pushes become intentions drained between ticks; the handlers run FIFO, so the Militia is spent first (510 → 450), and the age-up research then **silently no-ops** (handlers do a best-effort spend and no-op on an unaffordable stockpile). `savingForAgeUp` (which suppresses military at 0.6·cost … cost, i.e. 300–499 food) turns OFF at ≥500 food, so the instant food crosses 500 a Militia is trained and drops it back under — the AI never holds 500 food through a decision→handler cycle. Military is the only pre-age-up spend that consumes the constrained FOOD: build placements (watch-tower / wonder / nextBuild) are also pushed *before* the age-up research but spend wood/stone, while villager training, building-tech research, and the Monastery are sequenced *after* it — so FIFO already protects the research from those, and only military needed the reserve.

This is NOT the same as finding (a) (which was the human's prerequisite-count question, verified not-a-bug). Finding (c) is a real AI strategic-affordability bug; without it neither side ever reaches the mid-game (farms / pop-cap / Loom / farm-upgrade techs stay unexercised).

## Fix

RESERVE the next age-up's research cost from military training. Compute `ageUpReserve` = `researchCost(nextAgeTech)` when the AI QUALIFIES for the next age (its `canAdvanceTo*Age` check passes), else `{}`; a `canAffordWithReserve(cost)` helper requires the stockpile to cover the unit cost ON TOP OF that reserve, and the military block uses it instead of the bare `canAfford`. So military spends only from the surplus above the age-up cost — it can no longer drain the stockpile below the cost and starve the FIFO-later research. No save-format change; no engine change; only the military block is touched (the only pre-age-up spend that consumes the constrained food — build placements, also before it, spend wood/stone).

**Iteration note.** A first attempt fully SUPPRESSED military whenever a fundable age-up was pending (`!savingForAgeUp && !committingToAgeUp`). It went green on the regression fixture but REGRESSED `aiPlayer.test.ts`'s "accumulates 5+ military before pushing in Feudal" on the `ai-planner-fixture` (2000-of-every-resource): with infinite stockpiles a fundable age-up is *perpetually* pending, so the AI rushed ages and trained almost no military. The RESERVE refinement fixes both — at 510 food the 500 reserve leaves only 10 surplus (no Militia → age-up commits), while at 2000 food it leaves ~1490 surplus (trains military AND ages up).

## Validation

TDD regression fixture `ai-age-up-priority-fixture`: AI owner 2 in Dark Age with 520 food, deep gold (unlimited Militia), no food income, complete TC + Barracks + Mill, 6 villagers (idle TC). Without the fix the AI trains one Militia and is stuck at 460 food forever (red: `age=dark-age food=460 militia=1`); with the fix it commits the age-up and reaches Feudal within the 2500-tick budget (research is 1300 ticks). Full `aiPlayer.test.ts` re-run guards the rich-fixture age-up / 5+-military / barracks-rush / difficulty assertions.

See `2026-06-17/<n>/REVIEW.md` for the multi-CLI review.
