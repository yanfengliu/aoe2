# Lessons — evidence

The war story and the anchor behind each line in [lessons.md](lessons.md). Not session-start reading: open an entry when its rule is in doubt, or when the work is in that area.

Every entry this file has held until now was retired by a gate; the proofs are in [gate-proofs.md](gate-proofs.md), which also names the commit the deleted entries read back out of.

One rule has left [lessons.md](lessons.md) by a different route and never had a section here: the browser-spec duration budget, deleted on 2026-09-06 because the gate it named was built and the MEASUREMENT refused it. Nothing about it is in `gate-proofs.md` — no gate landed — and its substance is a rule in [local-rules.md](../policies/local-rules.md) with the full account in the defect register.

## A click on a unit's cell centre selected nothing (2026-09-26)

v0.3.238 gave the blast census fixture an ally, whose Town Centre spawns before the attacker, so the census Siege Onager's entity id went from 2162 to 2163. `worldOccupancy.ts` gives a unit the sub-cell slot `id mod 16`, so the Onager moved from the slot 0.5 east of its cell's corner to the one 0.75 east. `attack-ground-hotkey.spec.ts` selected it with a left `clickCell` on its cell's centre, and the page's click stack there (`getClickStackAtWorldPosition`) was empty: the lane's full gate failed with "Expected: siege-onager, Received: null", while main's build passed the same spec in the same container. The simulation was the same on both: a probe on the live bridge showed the Onager on the same cell, firing the same first shot at the same tick. The spec now clicks the Onager's displayed position plus half a cell, and passes on both builds. `new-tech-reach.spec.ts` still selects a Monk and a Transport Ship with a left `clickCell` on their cells; they pass because of their ids.

Anchor: `attack-ground-hotkey.spec.ts`'s comment above its first click, and the displayed positions of the two builds' Onagers, (30.75, 18) and (30.5, 18), read through `getDisplayedEntities`.

## A stage ended through WMI let the verify chain go on and earn a receipt (2026-10-12)

The independent review of work 124's first receipt commit, 20e5df14, reasoned that a process at or below a stage, ended through WMI, gives its parent exit 0, so the chain's `&&` runs the later stages and `write`. Work 124 measured it on its scratch chain, `start && npm run a && npm run long && npm run c && write`, run as `npm run verify > log 2>&1; echo $? > exit`. Ending the long step's own `node.exe` through `Get-CimInstance Win32_Process | Invoke-CimMethod -MethodName Terminate` (ReturnValue 0) wrote exit 0. The log has the long step's start line and no `long finished`, then `c ran`; the receipt was written and `check` exited 0. The incident of 2026-10-11 was not this: its log stopped at browser spec 139 with no lint or build after it, so the chain itself had stopped, which the receipt now catches.

Anchor: the work 124 entry in [gate-proofs.md](gate-proofs.md) (its bound), and the review of 20e5df14 in the work 124 devlog entry.
