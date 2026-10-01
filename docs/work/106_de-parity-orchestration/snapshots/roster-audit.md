# M3 read-only roster audit — 2026-09-30

Base: `99749eb12004cabf7d049abeddc2f84a0177d3db`. Workspace: `parity-content-0930`. No product, canonical-doc, dependency, engine or Git changes. This is an ignored authored investigation handoff, not a shipped content claim.

## Resolved population and source bounds

The pinned aoe2techtree `3bb43b14` data is DE update `185872`, matching the official September 22, 2026 update. Its 56 civilization keys are the mainline DE population, including The Viking Sagas Danes/Saxons/Varangians; they do not include the six Chronicles civilizations. All 56 are included in the proposed standard-mainline Random Map content target. This conclusion uses release/product evidence and explicit key reconciliation, not merely `era: base`.

Local 30 identities map to 30 of those 56 after Indians→Hindustanis identity reconciliation; 26 standard identities are absent. This is identity presence only: none of the 30 are asserted to have complete current bonuses, slots or tech trees. Local 93/93 unit coverage is a CSV denominator and preserves several historical names and mechanics.

Scope interpretation: the spec targets the standard mainline Random Map experience. Chronicles have an additional civilization set and Antiquity mechanics, and Return of Rome is self-contained; they are outside that interpreted mainline target. Official Chronicles sources explicitly allow AI skirmish and cross-play, so campaigns being excluded or Chronicles being unranked ALONE does not prove their exclusion. If the owner intended every selectable custom single-player civilization set, six Chronicles civilizations and the separate Return of Rome game would be additional scope. No canonical scope exclusion was edited during this audit.

Pinned inputs: raw `data.json`, 965,553 bytes, SHA-256 `66a439979afe62f71541cff05280837abfb04e7732e364e2eae2f318862ade6d`, verified before parsing; English strings SHA-256 `94f3077c8011ef3e57a2012d9cc7158499257b4c2dc8e5382c77e007249618b3`. The original audit's data hash identified a CRLF reserialization, not raw source bytes; review 1 supersedes that attribution while extracted values remain equal. URLs: https://github.com/SiegeEngineers/aoe2techtree/blob/3bb43b14/data/data.json and https://github.com/SiegeEngineers/aoe2techtree/blob/3bb43b14/data/locales/en/strings.json . Retrieved/inspected 2026-09-30. Civilization IDs below are source JSON keys, not fabricated numeric game IDs; source `internal_name` for Hindustanis remains `Indians`.

## Primary evidence

| Source | Date / bounded conclusion |
|---|---|
| https://www.ageofempires.com/news/age-of-empires-ii-definitive-edition-update-185872/ | September 22, 2026; Viking Sagas release, three new mainline civilizations, Longboat renamed Longship, regional Mounted Crossbowman and Varangian Guard, Throwing Axeman range and Frank technology replacement. |
| https://www.ageofempires.com/games/aoeiide/the-viking-sagas/ | Inspected September 30, 2026; Danes, Saxons and Varangians are new civilizations and their shared regional units are Varangian Guards, Mounted Crossbowmen and Longships. |
| https://www.ageofempires.com/games/aoeiide/the-last-chieftains/ | Inspected September 30, 2026; Mapuche, Muisca and Tupi are three mainline expansion civilizations. |
| https://www.ageofempires.com/games/aoeiide/the-three-kingdoms/ | Inspected September 30, 2026; five civilizations Shu, Wei, Wu, Jurchens and Khitans, plus regional unit changes affecting Chinese/Koreans/Vietnamese. |
| https://www.ageofempires.com/news/faq-the-three-kingdoms-dlc-playstation-5/ | Inspected September 30, 2026; Cao Cao, Liu Bei and Sun Jian are explicitly available in single-player skirmish with passive support abilities, while campaign active abilities are separate. Do not exclude those three merely because they are heroes. |
| https://www.ageofempires.com/news/dynasties_of_india_is_here/ | April 2022 announcement; explicit Hindustanis previously Indians, Ghulam and Imperial Camel Rider, Grand Trunk Road/Shatagni and Caravanserai. Historical numeric bonuses are superseded by pinned current fields. |
| https://support.ageofempires.com/hc/en-us/articles/31839163606932-Chronicles-Expansions-FAQ | Inspected September 30, 2026; identifies six Chronicles civilizations, unranked status and Antiquity mode. |
| https://www.ageofempires.com/news/what-to-expect-from-chronicles-alexander-the-great/ | October 10, 2025; explicitly permits Chronicles AI skirmish and custom cross-play; four alternative unique technologies and naval Antiquity options differentiate that set. |
| https://www.ageofempires.com/games/aoeiide/return-of-rome/ | Inspected September 30, 2026; self-contained 17 ancient civilizations, while the new mainline Romans are explicitly for standard Age II. |
| https://www.ageofempires.com/games/aoeiide/dawn-of-the-dukes/ | Inspected September 30, 2026; Bohemians/Poles mainline expansion. |
| https://www.ageofempires.com/games/aoeiide/lords-of-the-west/ | Inspected September 30, 2026; Burgundians/Sicilians mainline expansion. |
| https://www.ageofempires.com/games/aoeiide/the-mountain-royals/ | Inspected September 30, 2026; Armenians/Georgians mainline expansion. |

## Included mainline source IDs

| Source ID | Local identity |
|---|---|
| Armenians | MISSING |
| Aztecs | Aztecs |
| Bengalis | MISSING |
| Berbers | Berbers |
| Bohemians | MISSING |
| Britons | Britons |
| Bulgarians | MISSING |
| Burgundians | MISSING |
| Burmese | Burmese |
| Byzantines | Byzantines |
| Celts | Celts |
| Chinese | Chinese |
| Cumans | MISSING |
| Danes | MISSING |
| Dravidians | MISSING |
| Ethiopians | Ethiopians |
| Franks | Franks |
| Georgians | MISSING |
| Goths | Goths |
| Gurjaras | MISSING |
| Hindustanis | Indians — rename plus substantive slot/content changes |
| Huns | Huns |
| Incas | Incas |
| Italians | Italians |
| Japanese | Japanese |
| Jurchens | MISSING |
| Khitans | MISSING |
| Khmer | Khmer |
| Koreans | Koreans |
| Lithuanians | MISSING |
| Magyars | Magyars |
| Malay | MISSING — absent even from local Rise of Rajas rows |
| Malians | Malians |
| Mapuche | MISSING |
| Mayans | Mayans |
| Mongols | Mongols |
| Muisca | MISSING |
| Persians | Persians |
| Poles | MISSING |
| Portuguese | Portuguese |
| Romans | MISSING — standard mainline Romans, not RoR ancient Romans |
| Saracens | Saracens |
| Saxons | MISSING |
| Shu | MISSING |
| Sicilians | MISSING |
| Slavs | Slavs |
| Spanish | Spanish |
| Tatars | MISSING |
| Teutons | Teutons |
| Tupi | MISSING |
| Turks | Turks |
| Varangians | MISSING |
| Vietnamese | Vietnamese |
| Vikings | Vikings |
| Wei | MISSING |
| Wu | MISSING |

## Excluded or distinct-set identities

| Source / set | IDs / distinction |
|---|---|
| Chronicles: Battle for Greece | Achaemenids, Athenians, Spartans — absent from the pinned mainline civ keys. |
| Chronicles: Alexander the Great | Macedonians, Thracians, Puru — absent from pinned mainline keys; custom AI skirmish exists. |
| Return of Rome | Assyrians, Babylonians, Carthaginians, Choson, Egyptians, Greeks, Hittites, Macedonians, Minoans, Palmyrans, ancient Persians, Phoenicians, ancient Romans, Shang, Sumerians, Yamato, Lac Viet — separate self-contained ancient game, not these mainline IDs. |
| Campaign-only active hero abilities | Campaign abilities are excluded; standard Cao Cao ID 1954, Liu Bei ID 1966 and Sun Jian ID 1978 remain candidate in-scope skirmish content. |

## Supported historical identities and proven changes

| Identity / source fields | Observed current source versus local behavior |
|---|---|
| Longboat/Elite Longboat → Longship/Elite Longship | Source unit IDs 250/533 retain internal `LNGBT`/`ULNGB` but names now Longship. Same units, renamed and shared regionally; preserve legacy unit IDs/save aliases when changing display/content identity. |
| Berserk vs Varangian Guard | Berserk IDs 692/694 remain Berserk/Elite Berserk, still the Viking unique unit. New Varangian Guard IDs 2703/2704 are separate regional units with distinct mechanics; do not alias Berserk to Varangian Guard. Vikings and Byzantines gain the new unit. |
| Bearded Axe → Ordonnance Companies | Official 185872 explicitly removes Bearded Axe. Current Frank Castle unique tech ID 1496, LanguageNameId 507025, is Ordonnance Companies: 400 food/250 gold, 40 seconds, Mounted Crossbowmen -40% gold. Chivalry remains ID 493. Local Bearded Axe is a shipped range modifier on throwing axes. Successor behavior requires the missing Mounted Crossbowman line first or in the same milestone. |
| Throwing Axeman/Elite Throwing Axeman | Official update and pinned IDs 281/531 prove base range 3→5 and elite 4→6. This resolves the earlier upgrades/provenance uncertainty. Range alone is a small next-milestone fix, but retire/reconcile Bearded Axe explicitly to avoid an unintended extra range stack. |
| Vikings technology slots | Source Bogsveigar ID 49 replaces local historical Berserkergang; Chieftains ID 463 also exists. Bogsveigar grants Archer-line/Longships +1 attack. Current source Viking help names those two, not Berserkergang. |
| Other changed local slots | Current source examples: Persians Citadels/Kamandaran (local Mahouts), Saracens Bimaristan/Counterweights (historical Madrasah/Zealotry), Slavs Detinets/Druzhina (local Orthodoxy), Incas Andean Sling/Fabric Shields (local Couriers), Italians Silk Road/Pirotechnia (local Pavise), Portuguese Circumnavigation/Arquebus (local Carrack), Mayans Holcans (historical El Dorado). Changes may rename identical effects or replace mechanics; validate each field and migration rather than treating every name mismatch as absent implementation. |

## Indians → Hindustanis is not a cosmetic rename

Pinned `civs.Hindustanis.internal_name` is still `Indians`, but its user-facing identity is Hindustanis. Its source help names Ghulam/Imperial Camel Rider and Grand Trunk Road/Shatagni, plus Caravanserai. Unit IDs: Ghulam 1747, Elite Ghulam 1749, Imperial Camel Rider 207, Armored Elephant 1744 and Siege Elephant 1746. Hindustanis no longer carry Elephant Archer IDs 873/875 in their unit list; those belong to the separate Bengali/Dravidian/Gurjara regional roster. Caravanserai is building ID 1754.

Grand Trunk Road is tech ID 506 (internal `Indians UT`, LanguageNameId 7270, display string 17270 and help 28270), cost 250 food/200 wood, research 40 seconds. Current effect: all gold income +10%, market trading fee 10%. Local Sultans is ID `sultans`, 400 gold/50 seconds, applies only a gather-rate gold factor and is explicitly marked unverified. It is neither current name/cost nor full scope. Shatagni remains source ID 507, 500 food/650 gold, 40 seconds, Hand Cannoneers +2 range, already runtime implemented but missing technology CSV row.

Current source Hindustani numeric bonuses retain local -8/13/18/23% villager prices, Camel Rider attack +20%, gunpowder +1/+1 armor and scout/camel +2 versus buildings. The April 2022 official launch page has older -10/15/20/25%/+25% values and is identity/mechanism evidence only; use the pinned current fields for numbers. Slot changes also include Armored/Siege Elephants and shared newer naval units, so one renamed civ row does not close Hindustani parity.

## Unit and technology census bounds

Unioning the 56 `civs[*].Unit` lists produces 248 raw source unit IDs; `Tech` produces 199 IDs. These are source availability IDs, not already-normalized trainable logical identities. Duplicate forms include mounted/dismounted Konnik, Ratha combat states, production-site Serjeant variants and elite mercenary Kipchak. Name aliases include Heavy Demo Ship, Arbalester, Camel Rider, shortened elite labels and renamed Longship. Thus no 93/248 or technology fraction is asserted.

`m3-roster-audit.json` retains parsed local data plus all source IDs/names/civilization memberships. `m3-candidates.json` retains missing-name candidates and missing civ records; it includes false positives from aliases and from the six implemented unique technologies without CSV rows, so it is a triage input, not a completed absence ledger. Technology localization uses `LanguageNameId + 10000`, units use `+9000`, and civ help uses its explicit help_string_id. Source fields/internal names and variant IDs remain available for proper normalization.

Proven basic missing families affecting current local civilizations: Eagle Scout, Fire Galley, Demolition Raft, Siege Tower, Battle Elephant line, Imperial Skirmisher, Armored/Siege Elephant, Ghulam line, Savar, Fire Lancer line, Rocket Cart line, Dragon Ship, Lou Chuan, Hulk/War Hulk/Carrack, Catapult Galleon, Mounted Crossbowman line and Varangian Guard line. The existing local expansion ledger's 17 unique units/18 techs is a historical subset, not the current missing full-DE population. The closed runtime union in src/game/simulation/unitTypes.ts also lacks those unit identities; searching simulation for their kebab-case IDs finds none. Carrack currently appears only as the old Portuguese technology, not a trainable ship. Every source identity must still map to runtime train/research availability and current civ-tree membership before calling it supported.

## Next bounded assignment candidates

1. Existing-roster range/stat normalization: scope one pinned field/class at a time, first Throwing Axeman range 5/6 with explicit Bearded Axe successor dependency. TDD independent source-ID census, actual commanded first-shot reach, upgraded-unit behavior and legacy saves; no concurrent edits to frozen M1 tables. A standalone range fix must decide the still-exposed obsolete tech rather than silently stack it.
   A smaller independent candidate from the same official update is Onager base attack 50→55 and pierce armor 7→8, plus the Ram line sight 3→5. Confirm CSV/runtime rows and isolate those exact sourced fields; these avoid the Frank replacement-tech dependency. Pinned exact fields: Unit 550 Attack=55/PierceArmor=8; Unit 1258/422/548 LineOfSight=5. Local runtime still has onager attack50 (prototypeUnitRules/statTables.ts), armor7 (prototypeUnitRules/unitArmorTables.ts) and ram sight3 (prototypeUnitRules/presentationTables.ts); units.csv agrees with those stale values. Own those three narrow tables, exact CSV fields and new independent content plus simulation damage/vision tests; exclude damage-family and accuracy/wind-up branches, all other stats and engine changes. Their exact field census and real damage/sight/upgrade controls must fail before correction.
2. Frank/current European regional line milestone: implement Mounted Crossbowman/Heavy Mounted Crossbowman, Cranequins and Ordonnance Companies with exact 185872 civ availability changes. Own unit types/stats/production/upgrade/projectile/render profiles plus civ trees and unique-tech slots; use one accountable owner because those interfaces overlap. Acceptance includes actual train/upgrade/research, cost effect, source census, original visuals and migration/replay bounds. This is larger than a simple rename.
3. Identity normalization milestone: Longboat display/source naming with stable serialized IDs; Indians/Hindustanis identity alias plus explicit unresolved slot ledger. Avoid claiming Hindustani full support before Ghulam/Caravanserai/Grand Trunk Road and corrected unit tree are implemented. Source renames can be added without fabricating missing mechanics.
4. Then civilization-content batches with shared mechanic prerequisites: Malay/Battle Elephant/Karambit and existing Rajas content; African/Forgotten unique-unit closure; Indian split civs after elephant/charge/pass-through/aura primitives; later Three Kingdoms, Chieftains and Viking Sagas. Allocate per dependency, not twenty-six parallel writes to shared union/roster files.

No code/gate/visual result is claimed by this read-only audit. Standard versus additional custom civ-set scope remains an explicit coordinator decision. All current milestone product and canonical draft bytes were left alone.
