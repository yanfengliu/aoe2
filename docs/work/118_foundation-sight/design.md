# Foundation sight in Definitive Edition: what the record shows

Research for [the plan](plan.md), done 2026-10-11. The question is spec §12.2's: does a Definitive Edition foundation give its owner line of sight before it is complete, and does it reveal the ground under it?

## Answer

- **A foundation nobody has started building gives its owner no sight in current DE, not even of its own footprint.** It stays under the fog until a unit comes near. This game already behaves this way, so for this case DE matches the spec.
- **A building whose construction has started but is not complete: not settled.** No patch note, developer statement, forum report, dataset field or recorded play found says whether DE gives it sight. This game gives it none.
- **Before DE the unstarted case was different.** In The Conquerors and HD, a foundation revealed the ground beneath it. An early-DE player called foundation vision a glitch, and by 2023 a player's own foundation could sit under fog.

## Evidence for the unstarted case

| Source | Edition, date | What it shows |
|---|---|---|
| [Official update 87863 notes](https://www.ageofempires.com/news/age-of-empires-ii-definitive-edition-update-87863/), Xbox section | DE, published 2023-06-27 | Wall foundations became selectable when "covered by the Fog of War", and the note says this is "as intended". So a player's own foundation can sit under the fog. |
| [Forum bug report 226573](https://forums.ageofempires.com/t/cannot-delete-building-foundations-in-the-fog-of-war-on-xbox/226573) | DE build 78174, 2023-03-10 | A house foundation the player placed in fog could not be selected on Xbox. A reply from Felizon89, whom the forum labels a Forgotten Empires developer, said the team was already working on it. |
| [Forum bug report 228581](https://forums.ageofempires.com/t/delete-buildings-in-fog-of-war-xbox/228581) | DE build 81058, 2023-04-12 | On PC a foundation placed in fog can be selected and deleted while it is still in fog; on Xbox the player had to walk a unit up to it to make it visible first. The same developer replied that the issue was being tracked. 87863 is the fix. |
| [Forum discussion 227893](https://forums.ageofempires.com/t/issue-with-seeing-units-that-passed-through-construction-reservations/227893) | DE, 2023-04-02 | A player reported the old trick: enemy units crossing your own unstarted foundation are visible to you. Another player said DE had fixed it. The reporter retested the same day and found it fixed. |
| [Forum discussion 72447](https://forums.ageofempires.com/t/unbuilt-farm-foundations-can-be-killed/72447) | DE, 2020-02-26 | A player in early DE refers to "the foundation vision glitch" and asks whether farm foundations became killable to counter it. The post does not describe the glitch. |
| [Aoe2Sheet knowledge base](https://siegeengineers.github.io/Aoe2Sheet/knowledge_base.html) | The Conquerors/HD | The line "Building foundations reveal the ground beneath them" was added in gh-pages commit `f2e0dab9b7` on 2018-12-17. The page last changed in `6268d284d3` on 2018-12-30, before DE's release on 2019-11-14. It names HD once and UserPatch six times, and never DE. It describes the pre-DE game. |

The 2023 DE sources agree with each other. The developer replies and the 87863 fix accept the premise that a player's own foundation can be under fog, and nothing found contradicts them.

## What other players see of an unstarted foundation (context, not this card's scope)

DE treats an opponent's or ally's view of an unstarted foundation as a leak to close:
- Update [46295](https://www.ageofempires.com/news/aoe2de-update-46295/) fixed allied foundations that had not started construction showing in fog.
- Updates [58259](https://liquipedia.net/ageofempires/Age_of_Empires_II/Definitive_Edition/Dawn_of_the_Dukes/Update_58259) and [61321](https://liquipedia.net/ageofempires/Age_of_Empires_II/Definitive_Edition/Dynasties_of_India/Update_61321) stopped players seeing an enemy's unbuilt foundations during a treaty.
- Update [185872](https://www.ageofempires.com/news/age-of-empires-ii-definitive-edition-update-185872/), the dataset's pinned update, stopped unbuilt foundations from blocking other players' buildings and from blocking villagers.
- [Forum bug report 199626](https://forums.ageofempires.com/t/unstarted-enemy-foundations-reveal-additional-map-tiles/199626) (DE build 59165, 2022-04-01) says an enemy's unstarted foundation explored its whole footprint for you once you saw one of its tiles. The reply says it is tracked internally. This is the "unstarted enemy foundations" report spec §12.2 cites; it is about the opponent's map, not the owner's sight.

In this game a foundation is a valid target whatever its progress (`targetFindingOps.ts`), and no code found hides an unstarted one from opponents. That is a separate possible divergence, and the handoff names it for the coordinator.

## The started case: what was searched

Nothing found says either way. Searched:
- The pinned dataset, SiegeEngineers/aoe2techtree at `3bb43b14`. `data/data.json` gives each building a `LineOfSight` and nothing for a foundation or a building under construction. `data/locales/en/strings.json` has no string that mentions foundations or construction.
- Every DE update page Liquipedia holds, read through its API: 87 pages covering 74 updates from 32911 to 145651, with 39 distinct foundation notes, none about the owner's sight. Also the official notes for 44725, 45185, 46295, 50292, 87863 and 185872.
- The Age of Empires forum's search API, over queries on foundations, construction, partly built buildings, fog, vision and line of sight.
- Web searches over the same ground, the openage reverse-engineering notes and the AoE2 DE UGC guide's attribute list.

Update [50292](https://www.ageofempires.com/news/aoe2de-update-50292/) (2021-07-06) fixed issues with partly built foundations in the fog of war and the black map. It does not say whose view that was, so it supports neither answer.

Not reachable: the AoEZone threads sit behind a bot check, which was not bypassed. Liquipedia's and the Fandom wiki's line-of-sight pages refused the fetch. Recorded DE play was not examined: no DE install or replay viewer was available.

## Options for the started case

1. **Keep it blind and record it as unverified.** This is a docs-only change: §12.2 cites the unstarted case and says the started case has no reference. This is the change on this branch.
2. **Settle it in DE, then follow the answer.** It takes about three minutes in a DE skirmish with fog on. Place a House far from your units and start it with one villager. Pull the villager out of sight before the House is done. Then see whether the ground around the partly built House, and under it, stays fogged. If DE gives it sight, a code change follows: a vision source when construction starts, gone on cancel or destruction, plus save and replay compatibility for the building visibility slot. Work 116's fog-memory skip would then need extending, because the owner's own foundations would no longer sit under fog.
3. **An owner product call without a reference.**

The owner's reproduction (two Militia at a Barracks foundation, drawn for nobody) does not record whether construction had started. If it had not, DE would show its owner nothing either. By the reports above, DE would also hide that foundation from the raiders, which is the separate divergence above.

## Side findings for other open work (not changed here)

Spec §12.1 and the defect register entry of 2026-09-23 say DE's rule for placing a building on unexplored ground is unverified. DE's official notes settle it:
- [Update 44725](https://www.ageofempires.com/news/aoeiide-update-44725/) (2021-01-25): hovering a building's blueprint over unexplored terrain no longer reveals whether a building or unit occupies it. The blueprint can still be placed, but it cannot be built if the ground is obstructed. This fixed the "palisade scan" exploit.
- [Hotfix 45185](https://www.ageofempires.com/news/aoe2de-hotfix-45185/) (2021-02-11): a foundation may be placed over unexplored ground if part of it is explored, never on ground that is wholly unexplored. Construction cannot start while it overlaps a structure or foundation outside the player's sight.
- [Update 46295](https://www.ageofempires.com/news/aoe2de-update-46295/) (2021-03-24): a foundation placed over an obstacle that fog hid is cancelled when villagers try to start it.

The §12.1 sentence and that register entry belong to other lines and other owners, so they are not edited here.
