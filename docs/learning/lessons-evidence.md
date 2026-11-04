# Lessons — evidence

The war story and the anchor behind each line in [lessons.md](lessons.md). Not session-start reading: open an entry when its rule is in doubt, or when the work is in that area.

Every entry this file has held until now was retired by a gate; the proofs are in [gate-proofs.md](gate-proofs.md), which also names the commit the deleted entries read back out of.

One rule has left [lessons.md](lessons.md) by a different route and never had a section here: the browser-spec duration budget, deleted on 2026-09-06 because the gate it named was built and the MEASUREMENT refused it. Nothing about it is in `gate-proofs.md` — no gate landed — and its substance is a rule in [local-rules.md](../policies/local-rules.md) with the full account in the defect register.

## A click on a unit's cell centre selected nothing (2026-09-26)

v0.3.238 gave the blast census fixture an ally, whose Town Centre spawns before the attacker, so the census Siege Onager's entity id went from 2162 to 2163. `worldOccupancy.ts` gives a unit the sub-cell slot `id mod 16`, so the Onager moved from the slot 0.5 east of its cell's corner to the one 0.75 east. `attack-ground-hotkey.spec.ts` selected it with a left `clickCell` on its cell's centre, and the page's click stack there (`getClickStackAtWorldPosition`) was empty: the lane's full gate failed with "Expected: siege-onager, Received: null", while main's build passed the same spec in the same container. The simulation was the same on both: a probe on the live bridge showed the Onager on the same cell, firing the same first shot at the same tick. The spec now clicks the Onager's displayed position plus half a cell, and passes on both builds. `new-tech-reach.spec.ts` still selects a Monk and a Transport Ship with a left `clickCell` on their cells; they pass because of their ids.

Anchor: `attack-ground-hotkey.spec.ts`'s comment above its first click, and the displayed positions of the two builds' Onagers, (30.75, 18) and (30.5, 18), read through `getDisplayedEntities`.

## Relative gallery hrefs survived alias retirement (2026-10-18)

The absolute-only canonical migration missed six relative hrefs. Its zero-missing check ran before ten aliases retired and did not prove post-retirement validity; the Update68 guard caught six missing targets before any68 index write. Root corrected those hrefs, reverified all ten exact committed copies and retained images/body bytes; post-correction checks found925 links/0missing, then Gallery68 found931/0.

Anchor: primary ignored `tmp/work135-docs-primary-custody/canonical-relative-href-correction.json` and `tmp/work135-multiview-control/gallery-integration.json`; the initial receipt and exact before-index copies remain retained. The old relative M13 report href is a known broken-relative control after alias retirement.

Retiring gate (queued, not built or proved): normalize both href forms and recheck after retirement; go RED with that retired-relative-href control and GREEN after its correction. Record the red/green proof before deleting this evidence and its lesson line. No gate implementation or gate-proof claim lands here.

## Eighteen leftover worktrees (2026-11-04)

On 2026-11-04 the coordinator's repo review found 18 worktrees on disk besides the primary checkout. Every HEAD was in main, and they had sat for 4 to 34 days. Fifteen held uncommitted work that main's history lacked: 629 changed files, including a parked UI release and reviewed candidates. Work 129 had retired five on 2026-10-15 and left five for an M2 that nobody was assigned; thirteen more piled up meanwhile. No session had listed them, because the session-start command reads only the remote gates.

Anchor: the 2026-11-04 entry in [the defect register](defect-register.md) and [work 138's plan](../work/138_worktree-retirement/plan.md), whose decision table lists the 15 `retained/<name>` branches the work was moved to.

Retiring gate (queued, not built or proved): work 138 M2. `npm run ci:status` reports a registered worktree whose HEAD main contains and that shows no activity for 24 hours. It goes RED on a planted leftover and GREEN once that leftover is removed. Record that proof in [gate-proofs.md](gate-proofs.md) before deleting this entry and its lesson line.
