# Gate proofs

The standing answer to "did the gates actually do their job".

A lesson leaves [lessons.md](lessons.md) only when it becomes a gate, and a gate counts only once it has been made to go RED by reintroducing the defect. This file records the mutation, the failure it produced, and the bound the gate does not reach past. Without it, "this became a gate" is an unverified claim and the deletion it justifies is unearned.

## If a gate here is wrong

A gate and the claim in its header can be wrong together, and when they are they look exactly like a gate that is right. Auditing one means reaching what was believed, measured and abandoned at the time — never the sentence the gate carries about itself. The evidence deleted in a retirement commit is not lost; this repository's evidence file as it stood immediately before the first retirement reads back out of:

    git show 96ed269d:docs/learning/lessons-evidence.md

`git log -- docs/learning/lessons-evidence.md` lists every earlier revision, and `git log -S'<phrase from the gate header>' -- docs/learning/` finds the entry a particular gate retired.

## An arithmetic claim about hardware is not a measurement, and the gate that measures it must read the buffer the work actually lands in

- **Gate:** `tests/browser/shadow-depth-precision.spec.ts` :: `every buffer the scene draws into resolves the shadow level step` — run by `npm run test:browser`, and so by `npm run verify`.
- **Claim it carries:** `SHADOW_LEVEL_STEP = 0.002` world units separates two casters' shadows in depth. That is derived arithmetically as about four depth quanta from the orthographic camera's 4000-unit range on a 24-BIT buffer, and nothing in the renderer requests 24 bits — the context asks for `{alpha, antialias, powerPreference}` and takes whatever the device gives. At 16 bits one quantum is 0.061 world units, thirty times the separation, and every shadow lands in one bucket: the level scheme degrades silently into the z-fighting stripes it exists to prevent.
- **Mutation:** in the spec's own `depthOf`, `return 16;` for every non-default framebuffer — a device whose offscreen targets are allocated `DEPTH_COMPONENT16`, which is Three's default internal format for a depth-only renderbuffer and therefore the realistic form of this defect rather than a synthetic one.
- **Red:** `the scene draws into a offscreen buffer with 16 depth bits; SHADOW_LEVEL_STEP = 0.002 needs at least 24 to separate two shadows (measured: {"drewAnything":true,"frames":13,"canvasSize":{"width":800,"height":480},"buffers":[{"target":"offscreen","depthBits":16},{"target":"offscreen","depthBits":16},{"target":"default","depthBits":24}]})`.
- **Green after revert:** yes, 1 passed in 2.7s.

**The finding that changed the gate, and the reason this entry is worth reading.** The lesson specified the gate as "a browser spec reading `gl.getParameter(gl.DEPTH_BITS)` off the live world canvas and asserting >= 24". **That gate would have measured the wrong buffer.** The default art style, Moebius, resolves the frame through a stylized pass, so the scene is rendered into offscreen targets first — and a Three render target's depth attachment is allocated independently of the canvas's. Instrumenting `bindFramebuffer` and the four draw entry points for twelve real animation frames shows the scene's draws landing in **three** buffers on this machine: two offscreen and one default. The canvas-only reading would have covered one of the three, and NOT the ones the shadow depth test actually runs in under the shipped default style. It would have been green for the same reason the defect is invisible.

Measured here, all three report 24. The specified gate would also have passed. That is precisely the problem with it: a gate that is right by luck is indistinguishable from a gate that is right, until the day the luck changes.

- **Bound.** ONE machine, ONE art style, ONE scene, ONE moment. It asserts what this device hands back when `aoe2-prototype` is drawn under the default style; a device that allocates 16-bit targets fails it, which is the point, but only if the suite is ever run there. It also only sees framebuffers that receive a draw call in the twelve frames it samples — a lane that draws rarely (a resize path, a picking pass) is outside it. It does not check that 0.002 is ENOUGH at 24 bits; that arithmetic is still arithmetic, and the thing that tests it empirically is the overlapping-shadow gate in `tests/rendering/aoeVoxelShadowLayering.test.ts`.
- **Guard against a false green:** the spec fails if the canvas is 1x1 or nothing drew. That is not hypothetical — measuring this by hand first, through a hidden browser pane, returned a 1x1 canvas, zero animation frames and zero draw calls, and every depth assertion would have passed vacuously because there was no buffer to fault.

## An AI that reaches the Imperial age must still be able to train a unit

- **Gate:** `tests/simulation/aiUnitLineTraining.test.ts` :: `fields an army in the Imperial age with no unit upgrades researched` — run by `npm test`, and so by `npm run verify`.
- **Claim it carries:** the AI trains the tier it HOLDS. `getTrainOptions` offers `latestResearchedInChain`; `pickUnitMix` names the top of each line; matching them by exact name meant an AI that aged up without the upgrades matched nothing at any building and stopped training units for the rest of the match.
- **Mutation:** the pre-fix guard, `if (!getTrainOptions(owner, producer).includes(unitType)) continue;`.
- **Red:** `expected 0 to be greater than or equal to 2` — zero spear-line units in 3,000 ticks, on a fixture holding 4,000 food and 4,000 wood.
- **Green after revert:** yes, 5 passed.

**Bound.** It proves the AI trains SOMETHING from an un-upgraded producer where resources and population are abundant. Not that the army is big enough, arrives, or wins.

**The fixture had to be rebuilt twice, and both versions are the interesting part.** The first handed the AI 4,000 of every resource and PASSED WITH THE DEFECT FULLY PRESENT — on Onagers, Monks and a Throwing Axeman, because the AI built a Castle and a Monastery and researched the gold-free Onager upgrade, none of which reads the unit mix. The second squeezed wood to 600 to seal those escapes and left the gate sitting on its threshold: exactly two Spearmen, with 5 wood to spare, so any later change spending 25 more wood would have turned it red in a way indistinguishable from the defect (found by a critic, not the author). The version that works does neither: resources are generous again, and the ESCAPES ARE CLOSED BY THE ASSERTION rather than by the budget — it names the spear line, and nothing else in the game trains a Spearman. Gold stays 0 because that, alone, is the trap: every unit upgrade costs gold except the Onager's and the Capped Ram's.

## The unit-line table and the tier chains are two sources that can drift apart

- **Gate:** `tests/simulation/aiUnitLineTraining.test.ts` :: `resolves every mix entry against the REAL offers, at both tech extremes`.
- **Claim it carries:** every unit `pickUnitMix` names resolves to something its producer actually offers, at both ends of the tech state.
- **Mutation:** deleted the `'halberdier-upgrade': { from: ['pikeman'], to: 'halberdier' }` row from `UNIT_LINE_UPGRADES` — a tier known to `trainOptions.ts` but not to the line table, which is the drift this gate exists for.
- **Red:** `feudal-age: the mix wants spearman but barracks offers [champion, halberdier] with allResearched=true: expected undefined to be defined`.
- **Green after revert:** yes.

**This gate replaced a TAUTOLOGY, which is why it exists in this form.** The assertion it replaced was `trainableInSameLine(unit, [unitLineOf(unit)])`, which cannot fail for any input — `unitLineOf` is idempotent, so the single offer is always in the line. A critic confirmed it passed for `villager`, `trebuchet`, `petard`, `monk` and the literal string `made-up-unit`. It read like a class check and proved nothing. The binding form builds the REAL `createTrainOptions` so the tier chains come from `trainOptions.ts` rather than from the same table the assertion uses; a check built from the same symbol as the thing it checks proves only that the code agrees with itself.

**Bound.** One civilization with a complete tech tree (`getTrainOptions` filters civ denials, and a civ legitimately lacking a whole line would fail this for the wrong reason). Resolution only — not affordability, population, or whether the unit is worth training.

## The Feudal AI keeps mining stone, measured inside a match that is still being played

- **Gate:** `tests/simulation/aiFeudalStone.test.ts` :: `banks stone from zero, and keeps banking it`.
- **Mutation:** the Feudal villager split's `stone` weight, 1 -> 0.
- **Red:** the crossing assertion reports `stone never reached 125 — peak 60`, and the sustained-mining assertion independently measures **20 against its bar of 30** in the 2,000-5,000 window. Both were checked; an earlier version of this entry recorded only the first, because the crossing throws before the mining assertion is reached, which left the moved window's bar with no red-check at all. A critic caught that.
- **Green after revert:** yes, 2 passed.

**What does NOT redden it, which is the more useful finding.** Setting the CASTLE weight to 0 — stone abandoned on ageing up — changes the mining rate not at all: a steady +10 per 250 ticks straight through, identical to the unmutated run. `villagerRebalance` never treats a zero-target kind as a donor, so villagers already on stone stay there and a mid-game reweight is not a defect that manifests. The window's real blind spot is narrower than it first appears: churn after tick 5,000 from some OTHER cause — villagers dying, or the idle-gatherer fallback rewriting their desired resource when a node stops being assignable.

**Bound, and why the window moved.** It measures ticks 2,000-5,000 only, ending 1,096 ticks BEFORE the AI first holds 125 stone. It was anchored AT that crossing until v0.3.199, when the AI started fielding an army and began winning this fixture at tick 6,561 instead of 11,442 — so the old window spent 2,535 of its 3,000 ticks measuring a FINISHED match and reported 10 mined against a bar of 30, with nothing wrong. The file had carried a liveness assertion for exactly that, placed AFTER the mining assertion where it could never fire; it runs first now, and a second guard reports a match that ends before the crossing in those words instead of as "stone never reached 125".

## A drop-off building has to be able to REACH the woodline of every map that ships

- **Gate:** `tests/simulation/dropOffAnchorReach.test.ts` — run by `npm test`, and so by `npm run verify`.
- **Claim it carries:** the AI's lumber-camp anchor is found from every start of every seed in `PLAYABLE_MAPS`, and IS the nearest tree. `DROP_OFF_ANCHOR_RADIUS` was 12 while `paintWoodlines` keeps every woodline at least `MIN_START_GAP` = 14 EUCLIDEAN cells clear of every start — up to 20 in the manhattan metric the anchor measures in — so on arena, fortress and gold-rush there was no tree within reach of either start, the camp went up beside the Town Centre, and every load was carried fifteen cells.
- **Mutation:** `DROP_OFF_ANCHOR_RADIUS = 12`, the shipped value before this change.
- **Red:** three of the nine maps failed by name — `Arena: no woodline within 12 of the start at (8,8) — the camp would go up beside the Town Centre and every load would be carried the whole way: expected null not to be null`, and the same for Fortress and Gold Rush. The constant case failed with `expected 12 to be greater than or equal to 20`.
- **Green after revert:** yes, 10 passed.

**Bound.** It reads the GENERATED SPAWNS of each map and checks where the AI AIMS the camp. It does not run a simulation, does not check where `findBuildPlacementNear` finally puts the building, and says nothing about a map outside `PLAYABLE_MAPS` or about the SECOND camp — there is none; `pickNextBuildTarget` asks for a lumber camp only in the Dark Age and only when the owner has none, so two of the four measured slots finish a match with zero camps and the carry creeps back from 4 to 9 cells as the near woodline is eaten.

**Why it enumerates a shared roster rather than a list of its own.** The list of maps that ship lived only in `setupScreen.ts`, where a simulation test has no business reading it. It moved to `mapGeneration/playableMaps.ts` so the gate walks the SAME list the player picks from — a hand-typed copy would have let the next map with a distant woodline through silently, which is exactly how three of them got here.

**Why the second case ties two constants together.** The pair was incompatible for as long as both existed, and neither file mentions the other. The gate derives its floor from `MIN_START_GAP`, so it goes red when EITHER constant moves — not only when a shipped map changes.

## An AI whose enemy has only garrisoned units left must still finish the base

- **Gate:** `tests/simulation/aiGarrisonedDefender.test.ts`, two cases on `ai-garrisoned-defender-fixture` and `-few-fixture` — run by `npm test`, and so by `npm run verify`.
- **Claim it carries, half one:** `findOwnedUnitOnMap` queries `('unit', 'position')`. A garrisoned unit is alive and keeps its `unit` component but `garrisonUnit` strips its position, and `setUnitAttackCommandDirect` returns false without a target position — a silent no-op that the validator never sees. The AI's attack phase prefers the target enemy's villager, so one hidden villager pinned an army idle for 30,000 ticks on `gold-rush`.
- **Mutation:** `for (const id of world.query('unit'))`, the shipped query before this change.
- **Red:** both cases. `owner 2 still holds 3 building(s) (town-center, house, barracks); 23 of 23 attackers idle` and `closest approach 21 cells; 4 of 4 attackers idle`.
- **Claim it carries, half two:** the attack-group threshold does not apply to an enemy with NO UNITS ON THE MAP. `shouldPush` gates every fallback in the attack phase, the v0.3.197 last-resort branch included, so an army below the threshold never marched on an opponent that had nothing left to be caught by.
- **Mutation:** `const shouldPush = state.attackGroup.length >= threshold;` — the exception removed.
- **Red:** the `-few` case only: `four attackers against a Castle-age threshold of seven never reached the enemy: closest approach 21 cells; owner 2 still holds 3 building(s); 4 of 4 attackers idle`.
- **Green after revert:** yes, 2 passed; the full arm resolves by about tick 4,000 against an 8,000-tick window, and the few arm's closest approach is 1 against a bound of 4.

**Bound.** One map, one age, two attacker sizes, 8,000 ticks, three enemy buildings. It proves the attacker does not STALL; not that it wins, picks a good building, breaches a wall, or copes with a defender that shoots back with more than a Town Centre.

**Half two was found by a CRITIC, and the first fixture could not have caught it.** With resources the four attackers trained their way back over the threshold within two thousand ticks — measured, four became eleven — so the case never arose. The `-few` arm is therefore broke on purpose: zero of every resource, on a bare grass map with nothing to gather.

**It asks the few arm whether the army MARCHED, not whether it won.** Four Men-at-Arms lose to a Town Centre's arrows and cannot be replaced, so a resolution assertion would demand what the composition cannot do. The measure is the closest any attacker ever gets to the enemy Town Centre: 1 cell with the fix, 21 without — and the attackers spawn at their OWN base rather than the enemy's doorstep, because an army that starts beside its target makes "did it march?" unanswerable.

**The escapes it closes, one of which two earlier versions left open.**
- The assertion is the match OUTCOME, not "a building fell". The first version asked for one building to fall and PASSED WITH THE DEFECT FULLY PRESENT — the attackers engage during the 300 ticks the villagers spend walking to the door, and a house fell before the army went idle for the remaining 3,000 ticks.
- The defenders must be off the map AND STILL THERE, or the attack phase falls through for the right answer for the wrong reason. The second version checked `bridge.world.isAlive(id)`, and **that check was unsound**: `EntityManager.isAlive` takes a bare id with no generation, and the engine recycles ids from a free list — a critic reproduced `alive: false,true` in this very fixture for a villager that had been killed and whose id was reused. It now takes an `EntityRef` at garrison time and asks `world.isCurrent(ref)`, and independently asserts owner 2's POPULATION still counts the two, which is what "garrisoned" means and what no recycled id can fake.
