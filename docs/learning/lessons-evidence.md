# Lessons — evidence

The war story and the anchor behind each line in [lessons.md](lessons.md). Not session-start reading: open an entry when its rule is in doubt, or when the work is in that area.

Every entry this file has held until now was retired by a gate; the proofs are in [gate-proofs.md](gate-proofs.md), which also names the commit the deleted entries read back out of.

One rule has left [lessons.md](lessons.md) by a different route and never had a section here: the browser-spec duration budget, deleted on 2026-09-06 because the gate it named was built and the MEASUREMENT refused it. Nothing about it is in `gate-proofs.md` — no gate landed — and its substance is a rule in [local-rules.md](../policies/local-rules.md) with the full account in the defect register.

## A click on a unit's cell centre selected nothing (2026-09-26)

v0.3.238 gave the blast census fixture an ally, whose Town Centre spawns before the attacker, so the census Siege Onager's entity id went from 2162 to 2163. `worldOccupancy.ts` gives a unit the sub-cell slot `id mod 16`, so the Onager moved from the slot 0.5 east of its cell's corner to the one 0.75 east. `attack-ground-hotkey.spec.ts` selected it with a left `clickCell` on its cell's centre, and the page's click stack there (`getClickStackAtWorldPosition`) was empty: the lane's full gate failed with "Expected: siege-onager, Received: null", while main's build passed the same spec in the same container. The simulation was the same on both: a probe on the live bridge showed the Onager on the same cell, firing the same first shot at the same tick. The spec now clicks the Onager's displayed position plus half a cell, and passes on both builds. `new-tech-reach.spec.ts` still selects a Monk and a Transport Ship with a left `clickCell` on their cells; they pass because of their ids.

Anchor: `attack-ground-hotkey.spec.ts`'s comment above its first click, and the displayed positions of the two builds' Onagers, (30.75, 18) and (30.5, 18), read through `getDisplayedEntities`.

## A verify exit file read 0 for a run that stopped in the browser suite (2026-10-11)

Work 120's first landing run of `npm run verify` was started as `PREVIEW_PORT=4648 npm run verify > tmp/civ-bonus-corrections-verify.log 2>&1; echo $? > tmp/civ-bonus-corrections-verify.exit`. It wrote 0 after 15 minutes 31 seconds. Its log stops at the start of browser spec 139 of 238, with no Playwright summary, no lint and no build, and with no "^C" or "Terminate batch job" either. The worker read the log, called the run invalid, and ran the gate again; that run exited 0 with every stage logged.

It then reproduced the result on a scratch npm project whose chain was `a && long && c`. Killing the long step with `taskkill /F`, aimed at the leaf, the chain's `cmd` or the outer npm, wrote 1. A console Ctrl+C killed the wrapper too, so it wrote nothing. Ending the outer npm or the chain's `cmd` with WMI's `Win32_Process.Terminate`, through `Invoke-CimMethod`, wrote 0, and `c` never ran. That is the first run's signature exactly. Who ended that run is unknown: nothing in aoe2 or the fleet docs terminates processes through WMI, and other sessions were running on the machine at the time.

Anchor: the worktree logs `civ-bonus-corrections-verify.run1.log` (cut) and `civ-bonus-corrections-verify.log` (complete), and the work 120 M1 close-out `aa4f6e57`.
