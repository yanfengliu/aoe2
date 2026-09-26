# Lessons — evidence

The war story and the anchor behind each line in [lessons.md](lessons.md). Not session-start reading: open an entry when its rule is in doubt, or when the work is in that area.

Every entry this file has held until now was retired by a gate; the proofs are in [gate-proofs.md](gate-proofs.md), which also names the commit the deleted entries read back out of.

One rule has left [lessons.md](lessons.md) by a different route and never had a section here: the browser-spec duration budget, deleted on 2026-09-06 because the gate it named was built and the MEASUREMENT refused it. Nothing about it is in `gate-proofs.md` — no gate landed — and its substance is a rule in [local-rules.md](../policies/local-rules.md) with the full account in the defect register.

## A click on a unit's cell centre selected nothing (2026-09-26)

v0.3.238 gave the blast census fixture an ally, whose Town Centre spawns before the attacker, so the census Siege Onager's entity id went from 2162 to 2163. `worldOccupancy.ts` gives a unit the sub-cell slot `id mod 16`, so the Onager moved from the slot 0.5 east of its cell's corner to the one 0.75 east. `attack-ground-hotkey.spec.ts` selected it with a left `clickCell` on its cell's centre, and the page's click stack there (`getClickStackAtWorldPosition`) was empty: the lane's full gate failed with "Expected: siege-onager, Received: null", while main's build passed the same spec in the same container. The simulation was the same on both: a probe on the live bridge showed the Onager on the same cell, firing the same first shot at the same tick. The spec now clicks the Onager's displayed position plus half a cell, and passes on both builds. `new-tech-reach.spec.ts` still selects a Monk and a Transport Ship with a left `clickCell` on their cells; they pass because of their ids.

Anchor: `attack-ground-hotkey.spec.ts`'s comment above its first click, and the displayed positions of the two builds' Onagers, (30.75, 18) and (30.5, 18), read through `getDisplayedEntities`.
