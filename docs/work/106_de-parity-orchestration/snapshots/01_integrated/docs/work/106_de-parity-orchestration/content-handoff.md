# Accuracy and wind-up: bounded content handoff

Owner: `/root/content_tracker`. Base: `99749eb12004cabf7d049abeddc2f84a0177d3db`. Status: locally verified, frozen and digest-verified into integration; exact integrated review, full gate and shipping pending. No full DE parity is claimed.

## Outcome and provenance

Corrected the accuracy/delay branches of `projectileRules.ts` and re-sourced the same CSV fields for 44 supported trainable ranged attackers. The independent pinned-source census found 47 stale CSV fields and 19 differing runtime unit rows; the old CSV-only comparison saw five field differences. Other combat values, flight speeds, projectile identity/looks, blast behavior and miss semantics are outside this increment. The Fire Ship help-text sentence now names melee damage in agreement with the parallel attack-class source.

Source: [aoe2techtree data](https://github.com/SiegeEngineers/aoe2techtree/blob/3bb43b14/data/data.json) and [English localization](https://github.com/SiegeEngineers/aoe2techtree/blob/3bb43b14/data/locales/en/strings.json), DE update `185872`. Their raw SHA-256 hashes are `7604d5117fa6201c7dd19a78660525bbab7ccce00c3274c42ce04d3ba61f0f14` and `94f3077c8011ef3e57a2012d9cc7158499257b4c2dc8e5382c77e007249618b3`. The promoted fixture retains only the scoped fields, stable source IDs, URLs, hashes and name mapping.

Trebuchet is unpacked ID 42 (15%, 0.88 seconds), with packed ID 331 as the excluded identity control. Fire Ship and Fast Fire Ship source accuracy 0 is unused flame data: CSV remains unspecified and runtime defaults to 100%; this named exception proves no DE flame or miss parity. Delay seconds retain source precision; runtime uses the existing `Math.round(seconds * 10)` policy.

## Runtime rows corrected

| Row | Corrected base accuracy or delay |
|---|---|
| Arbalest | 0.342222 seconds → 3 ticks |
| Cavalry Archer | 0.91 seconds → 9 ticks |
| Heavy Cavalry Archer | 80%; 0.897 seconds → 9 ticks |
| Hand Cannoneer | 75%; 0.35 seconds → 4 ticks |
| Trebuchet | 0.88 seconds → 9 ticks |
| Longboat | 0 seconds → 0 ticks |
| Turtle Ship and Elite Turtle Ship | 0.15 seconds → 2 ticks each |
| Bombard Cannon | 100% |
| Janissary | 0.4 seconds → 4 ticks |
| Elite Janissary | 65% |
| Longbowman | 0.5 seconds → 5 ticks |
| Elite Longbowman | 80%; 0.5 seconds → 5 ticks |
| Mameluke | 0.4 seconds → 4 ticks |
| Elite Mameluke | 0.2 seconds → 2 ticks |
| Mangudai and Elite Mangudai | 0.498333 seconds → 5 ticks each |
| Elite Plumed Archer | 90% |
| Throwing Axeman | 0.995556 seconds → 10 ticks |

## Verification and limits

Tests were written before the runtime fix. The source census derives the 44-row population from trainable CSV attackers with positive attack/range rather than runtime table keys. The production launch census initially found 16 wrong delays, Heavy Cavalry Archer hit 404/800 shots against sourced 80%, and a real Cavalry Archer context order launched at world tick 10 against expected 9. Timing from the completed-tick animation label was rejected because it concealed that one-tick defect; the final check measures from the actual order world tick and checks the presented frame.

Direct affected run: seven files, 61/61 checks passed (`projectileStats`, `baseStats`, `trainAndResearchCostsAndTimes`, `projectileStatTiming`, `projectileRules`, `projectileFlight`, `projectileTechs`). Final restored product run: three files, 27/27 checks passed. Direct scoped ESLint and `git diff --check` exited 0. No full gate, browser run or commit was performed by this worker.

The runtime mutation changed Heavy Cavalry Archer accuracy alone to 50% and confirmed its delay remained nine ticks: independent comparison and the 800-shot sample both failed. A source mutation changed Longboat CSV delay back to 9 and the DE-to-CSV comparison failed. Each source file was restored byte-identical in `finally`; the final run followed restoration. [Gate proofs](../../learning/gate-proofs.md#pinned-de-projectile-values-reach-the-csv-and-actual-launches) retain the authored conclusions and instrument bounds; ignored logs stay available during active integration.

Bound: all 44 base launch delays at the production launcher, six changed accuracy samples, a certain-hit control and one Cavalry Archer real command/render/save path. Every unit's input path, civilization/technology modifiers, bursts, miss collision, historical replay outcomes and full DE roster remain outside this result.

## Frozen product identity

| Path | SHA-256 |
|---|---|
| `design/stats/units.csv` | `9b373d0a26e1baccad7f38953c38002a7189f7a38a4ccb299fac995ad527d36c` |
| `src/game/simulation/projectileRules.ts` | `364b92adcf24f75881f2623ba7dcab2c2eee3b604538d52541e6372839b04566` |
| `tests/content/fixtures/deProjectileStats.json` | `5d192b35193ddcf1a6c80257ec6bef3ef8b71ef1fdbbe6300b2fde7ac003b4e5` |
| `tests/content/projectileStats.test.ts` | `5306de6024c63ca8a12f0f4f572b025a427eb287b2165e79854755fcdbd6201a` |
| `tests/simulation/projectileRules.test.ts` | `e7d695062e3c7efb47a6703a906c1f9c83b2eb39f7bf24c99b7848f6e1a55068` |
| `tests/simulation/projectileStatTiming.test.ts` | `23df23df57bc7d5a5c48a6d41c808021df2d90c302f280885dc634fb378f713d` |

The integration owner checked all six digests after copying. Product source stays frozen. Canonical docs are authored separately in the integration tree; final acceptance and main/remote shipping belong to the orchestrator.
