# A map-generation change is measured against the maps it cannot reach (2026-09-04)

One of [this repo's local rules](../local-rules.md), where "above" and "below" mean earlier and later in its list.

Any change to map generation is A/B'd on the whole seed set, and the maps the change CANNOT touch are the control: they must come back **byte-identical on every column of both owners**. If they move, the reasoning is wrong or the arms differ by more than the variable, and nothing else in the run can be trusted.

**Why:** it has paid twice in one day. Raising `DROP_OFF_ANCHOR_RADIUS` can only bite where the anchor was null, so `coastal` — nearest tree 5-7 cells — had to be unchanged, and was. Putting a woodline inside a wall can only reach a map that HAS a wall, so `aoe2-prototype`, `arabia`, `gold-rush` and `coastal` had to be unchanged, and were, across three different placement orderings. That last part is what made the three orderings comparable to each other at all. The one time a control did move, the cause was source edits landing between the two arms rather than a real effect.

**How to apply:** run `SEEDS=aoe2-prototype,arabia,arena,fortress,gold-rush,coastal TICKS=60000 SAMPLE=500 npm run ai:army-block` for both arms, back to back, in ONE background job that flips the variable itself and verifies `src` is unchanged at the end — never by editing between two hand-started runs. `diff` the control rows first and stop if they differ. The walled maps are `arena` and `fortress`; every other shipped seed is a control for anything that only reaches a wall.
