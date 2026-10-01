# Review 1: implementation — completed combat continuation and repairs

## Target

AoE2 base `99749eb12004cabf7d049abeddc2f84a0177d3db`. The continuation reviewed the final 17 combat paths, including repaired COMBAT-R1 test `401124f7881de6a495a1aa93b98992dfddb7714004fdb5f2bccdbc12a8ce55d9`; the other 16 path diff sections were unchanged from round 0. The coordinator verified all reviewed working/index hashes before and after the read-only continuation. Ignored `combat-final-target.json` SHA-256 is `3ba834717c9d85535a05b478313b1c0922e788ce63cd0a72b749ce8fea02249e`; its exact authored identity table follows. The integration owner must bind these inputs to recoverable committed contents or a minimal authored delta before deleting ignored raw evidence. Earlier immutable source/doc/test snapshots remain unchanged.

The exact original source input is recoverable from [00_combat-target.patch.txt](../snapshots/00_combat-target.patch.txt), 85,114 bytes, SHA-256 `1eac61cb3f30d8a288820e08c538434b8f7d6e1e6470a632b150a0096528ce50`; the subsequent integrated input including repaired COMBAT-R1 is retained in [01_integrated-target.patch.txt](../snapshots/01_integrated-target.patch.txt), 270,941 bytes, SHA-256 `7c3312c6e097b2bd8501488d18bfbbfb1c3c49aab7761d39974bc683e6fa1791`. Both are exact authored reviewed Git source patches reconstructed against immutable base `99749eb12004cabf7d049abeddc2f84a0177d3db`, not raw CLI reports. The integrated patch exceeds 256 KiB but remains below 1 MiB; complete retention preserves the exact reviewed staged source/document input, including original defects/layout, after later fixes. Existing 15 full authored-document snapshots and the original reviewed test remain byte-identical; no additional large copies are required.

| Reviewed path | SHA-256 |
|---|---|
| `design/stats/units.csv` | `9b373d0a26e1baccad7f38953c38002a7189f7a38a4ccb299fac995ad527d36c` |
| `src/game/simulation/bridge/unitAttackAnimationFeed.ts` | `df82f1afccd8633e7fdc38f88ee01342e1ba8f5b80324ce9df68f19ecb392d7d` |
| `src/game/simulation/fixtures/attackDamageTypes.ts` | `faa5509d37bf49bf78e1c191ca7fcaa691e6a547d5e4e04dc96b212d94196bd5` |
| `src/game/simulation/projectileRules.ts` | `364b92adcf24f75881f2623ba7dcab2c2eee3b604538d52541e6372839b04566` |
| `src/game/simulation/prototypeScenario/scenarioRegistry.ts` | `afbb2d6b42b7d28f2feb7e4c47844f4dbdb2081835894a221c8e2bcaa70f3bda` |
| `src/game/simulation/prototypeUnitRules.ts` | `88803e20193f429ae2cbbef483b19ba78f869dea789f51f8e2ae736fd1626d24` |
| `src/game/simulation/prototypeUnitRules/unitClassSets.ts` | `8f02ab416cf8d9c53208593a7d7eef112bcbf2198ef6f42e7f9e639c00694c36` |
| `tests/content/attackDamageTypes.test.ts` | `3b4a82bb25af7919360b47bb4130e8ea176341024a79f06585b300829cb343e5` |
| `tests/content/deAttackDamageReference.ts` | `197682170db5e8238fa59a07db6e1e03b337b7eddac814d05abbb9de289eddde` |
| `tests/content/fixtures/deProjectileStats.json` | `5d192b35193ddcf1a6c80257ec6bef3ef8b71ef1fdbbe6300b2fde7ac003b4e5` |
| `tests/content/projectileStats.test.ts` | `5306de6024c63ca8a12f0f4f572b025a427eb287b2165e79854755fcdbd6201a` |
| `tests/simulation/attackDamageTypes.test.ts` | `401124f7881de6a495a1aa93b98992dfddb7714004fdb5f2bccdbc12a8ce55d9` |
| `tests/simulation/blastDamage.test.ts` | `bd66754dd643760cf3568b66851f5251a8427114d5d64f7a8e9bcd0cb1e9c52f` |
| `tests/simulation/combatArmor.test.ts` | `5f7d3c0e1daf0f235dcca74d11d71641068a2cab4e3413223e1776fabfb51c95` |
| `tests/simulation/projectileRules.test.ts` | `e7d695062e3c7efb47a6703a906c1f9c83b2eb39f7bf24c99b7848f6e1a55068` |
| `tests/simulation/projectileStatTiming.test.ts` | `23df23df57bc7d5a5c48a6d41c808021df2d90c302f280885dc634fb378f713d` |
| `tests/simulation/unitAttackAnimationFeedPersistence.test.ts` | `2869c1f21b11b936e3c5159a2f786a32b62205d436c5318086c092eba75d0d75` |

The corrected raw DE data URL is [pinned data.json](https://raw.githubusercontent.com/SiegeEngineers/aoe2techtree/3bb43b14/data/data.json), update 185872. Actual response bytes: 965,553, SHA-256 `66a439979afe62f71541cff05280837abfb04e7732e364e2eae2f318862ade6d`. The coordinator downloaded bytes before parsing; the content worker independently hashed that retained response before parsing, confirmed deep equality with the old normalized copy and checked all 44 projectile rows. The former `7604d5117fa6201c7dd19a78660525bbab7ccce00c3274c42ce04d3ba61f0f14` belongs to a 683,828-byte reserialized CRLF copy. Historical snapshots and quoted reports retain their original bytes; their raw-hash claim is explicitly superseded here.

## Reviewers and coverage

Claude Opus 5.5/max continuation completed with actual exit 0 after 581.177 seconds, the sole fleet-pinned model, zero new subagents and no edits. The coordinator verified all 17 source hashes unchanged and owned PID 66248 lineage empty. The initial waiting-only run remains an abstention. This continuation supplies substantive constrained combat coverage, not full-milestone acceptance. Its report independently traces damage/delivery/formation/garrison/save/hydration callers and source values; no test, typecheck, lint, gate or browser was run. The interrupted outside-diff sweep supplies no completed report; unread scopes are named in the original report. Codex's round-0 coverage and findings remain separately attributed.

## Reports

### Claude: completed substantive combat continuation

Full authored substantive report retained below. Original report: 9,692 bytes, SHA-256 `62dd7a2f6271524de24328938e6bae0a3b629df5e127219e0fece5e86d6458f0`. Only its final unrelated private connector-authorization status paragraph is omitted; no finding, dissent, constraint, inspected caller or missing lens is removed. Retained report-body SHA-256 is `b9081828ee85e06ff064a31d5a010daba424bc4b4ea9dc263c4cd750f71321fc`.

# Combat review, work 106: read-only report

**Verdict: changes requested, but only one Medium fix and it's not in runtime code.** I found no material runtime defect in the combat product change. One Medium provenance defect (CL-1) should be fixed before these provenance claims ship, and there are four Low items. The COMBAT-R1 repair is correct as far as I can tell from reading it, but I did not run it.

This is not an approval of the milestone. The full gate is red and owned by integration, I ran no tests, and one review lens is only partly covered (see "Missing lens").

## Identity checked

- **Base:** `99749eb12004…`, from `tmp/review-runs/parity-0930/combat-final-target.json`.
- **Hashes:** all 17 SHA-256 values match in both the working tree and the index.
- **16 carried files:** each one's diff section is byte-identical to the original 17-file patch I reviewed.
- **Retained original:** `snapshots/00_attackDamageTypes.reviewed.txt` equals the original test.
- **Only delta:** `tests/simulation/attackDamageTypes.test.ts` (`401124f7…`).

## Findings

**CL-1 · Medium · the cited `data.json` hash is not the hash of the cited source**
- **Lines:** `tests/content/fixtures/deProjectileStats.json:5` (sits next to `dataUrl` at :3), `tests/content/deAttackDamageReference.ts:6`, and `design/stats/units.csv:12` ("raw-input hashes").
- **Trigger:** hash the bytes at the fixture's own `dataUrl`.
  - The real file is 965,553 bytes with SHA-256 `66a439979afe62f71541cff05280837abfb04e7732e364e2eae2f318862ade6d` (git blob `c4f7da96…`; commit `3bb43b1439ee…` is the latest commit touching `data.json`).
  - The claimed `7604d511…` is the hash of the worker's re-serialized CRLF copy at `parity-content-0930/tmp/parity-106/data.json` (683,828 bytes), which is the file the extractor hashed.
  - No variant of the real file reproduces it: CRLF, BOM, minified, 2-space indent and the GitHub API envelope all differ. The `strings.json` hash `94f3077c…` is correct.
- **Impact:** the values are right. The local copy has zero deep differences from the real file, and all 93 reference rows and 44 projectile rows match the source. But the provenance claim is false and points at an ignored temp file that will be deleted. The docs lane repeats the same hash (gate-proofs, content handoff, spec draft).
- **Correction:** use the real-file hash (optionally also the blob SHA) in all three staged files and in the docs that copy it. Hash downloaded bytes before parsing them.
- **Missing check:** nothing reads `dataSha256`.

**CL-2 · Low · comments now contradict the code**
- `src/game/simulation/projectileRules.ts:138` says `units.csv` leaves the mangonel line's accuracy empty; this patch sets it to 100%.
- `prototypeUnitRules.ts:54` says "siege (pierce)"; `prototypeUnitRules/unitArmorTables.ts:10` says "pierce attacks (archers/skirmishers/siege/towers)".
- `unitClassSets.ts:4` says statTables re-exports every name in the file; `statTables.ts:420-430` does not export `MELEE_DAMAGE_PROJECTILE_UNITS`.
- `projectileRules.ts:76` and `:126-127` file Hand Cannoneer and Turtle Ship under the "Elite tier." header at `:68` and `:106`.
- Tests: `mangonelBlast.test.ts:84,121` and `siegeWorkshop.test.ts:237` still say "Base 40 pierce". Their assertions still pass because those targets have 0 melee armor, and the militia check is a ≥39 bound.
- **Impact:** none at runtime. **Correction:** reword the comments.

**CL-3 · Low · the participant-hydration tests don't pin two validator rules**
- `unitAttackAnimationFeedPersistence.test.ts:57-62` has no case for an owner in range 1–8 that isn't a player (for example owner 3 when the players are {1,2}). Deleting `!validPlayerIds.has(...)` at `unitAttackAnimationFeed.ts:165` would pass every test.
- The `toEqual([legacy])` check at `:62` ignores an explicit `participants: undefined` key. civ-engine's `deepEqualWithPath` (`session-deep-equal.ts:33`) counts keys, so a regression that emitted that key would break replay self-check for legacy cues while this test stayed green.
- **Correction:** add the owner-3 case and assert the key is absent (`toStrictEqual`). The product code is correct today.

**CL-4 · Low · pre-existing gap that a new comment now calls intended**
- `unitClassSets.ts:150-152` says this set "remain[s] shooters for … garrison eligibility".
- Through `prototypeBuildingRules.ts:344-346`, Mameluke and Elite Mameluke (not in `MOUNTED_UNITS`, not melee, range 3) count as foot soldiers. So they can garrison in Town Centers and towers, which DE camel riders cannot.
- Behavior is unchanged from base, so this is not a regression. Mangudai and War Wagon have the same gap.
- **Correction:** don't describe it as intended; record it in the register.

**CL-5 · Low · the 44-unit population isn't tied to the runtime shooters**
- `tests/content/projectileStats.test.ts:43,51` derive the 44 rows from the CSV and fixture only.
- I counted the runtime shooters (`firesProjectile`) myself: there are also 44, and they're the same units. So the denominator is right today, but a runtime shooter without a trainable CSV row would escape both census tests.
- **Correction:** assert set equality with `Object.keys(UNIT_MAX_HP).filter(firesProjectile)`.

## COMBAT-R1 repair: correct on reading, not executed by me

The repair is in `tests/simulation/attackDamageTypes.test.ts:121-161`.

- **Impact falls inside the last segment:** civ-engine takes periodic snapshots only when the absolute tick is a multiple of 5 (`session-recorder.ts:400`) and a terminal snapshot at disconnect (`:214-216`). So the assertion at `:135` that the impact tick isn't a multiple of 5 puts the impact strictly inside the final segment.
- **Every segment is checked:** `:151` requires `checkedSegments` to equal the number of snapshot gaps. `snapshotTicks()` and `selfCheck` walk the same list (`session-replayer.ts:174-180`, `:302-326`), and `:152` makes the last snapshot reach the impact tick.
- **The tail replay re-executes the impact:**
  - The bundle keeps `initialSnapshot` separate from `snapshots[]` (`session-bundle.ts:176,181`), so the filter drops only snapshots at or after the impact.
  - `openAt` steps forward from the latest earlier snapshot through the impact tick (`session-replayer.ts:236-258`).
  - `getEntityHealth` exists on the replay API (`createWorldResult.ts:61`) and reads live combat state (`entityReadProbes.ts:28-35`).
- **Limits:** it covers one unit type and compares one value (target HP).
- **Cross-lane note:** these replay worlds now also run the HUD lane's `initializeResourceOccupations` (`createWorld.ts:160`). The combat replay evidence therefore needs re-observing on the final integrated tree.

## Coverage (all from my own reading)

- **Product callers:**
  - `unitAttackType` is defined at `prototypeUnitRules.ts:80-82`. Every caller: `projectileOps.ts:158` and `:291`, `blastDamage.ts:60` and `:206-211`.
  - Every `isMeleeUnit` caller: `firesProjectile`, `unitFormation.ts:40-41`, `prototypeBuildingRules.ts:346`.
  - The contact/projectile split at `attackDelivery.ts:77,165,240`.
  - The projectile save codec passes `attackType` through unvalidated (`bridgeStateSerialize.ts:310-316`). So old direct shots keep their saved family and old saved stones re-derive theirs, as declared.
- **No knock-on effects:**
  - The 23 contact units are all range 1, so delivery and garrison rules don't change; only their formation rank moves from 1 to 0.
  - Melee attack techs use armor classes, not `MELEE_UNITS`; target priority is a hard-coded switch.
  - There are no other accuracy modifiers.
  - Building shots stay pierce, which matches the pinned data for every tower and the Castle.
- **Hydration:**
  - The live producer only records player owners (`unitAttackAnimationFeed.ts:338`); no Gaia-owned units or buildings exist in `src`.
  - The attack feed exists only in replays (saves strip it).
  - Audio and the HUD read the hit feed (`mountGameAudio.ts:87`), so retained participants change nothing the player sees.
- **Source data:** I fetched the pinned `data.json` and `strings.json` read-only. All 93 reference rows (ID, range, family) and all 44 projectile rows (ID, accuracy, delay) match. I recounted 47 CSV fields and 19 runtime rows, and checked the whole-tick rounding for every row. Packed Trebuchet ID 331 is 92% accuracy with zero delay, so choosing ID 42 matters.
- **Files outside the diff I read for stale expectations:** eagleAndHandCannon, unitFormation, formationOrders, navalCombat, castle, castleNewUnits, siegeWorkshop, imperialSiege, mangonelBlast, wildlifeShots, blacksmithProgression, civBonusBreadth, plus the launch/impact-tick assertions in six projectile and attack-ground tests. None would fail; three have stale comments (CL-2).
- **File-size budget:** every changed file is under 500 lines.

## Missing lens

- **Test sweep incomplete:** the delegated sweep of tests outside the diff was terminated with no report. Unread: browser specs, rendering tests, `tests/replay/*`, AI tests, uniqueTechnologies, berserkRegeneration, the rest of classArmor, and the self-play golden (AI attacks are off there, so probably unaffected, but unverified).
- **Nothing executed:** I ran no tests, typecheck, lint or gate, and read no Codex reports.
- **Read-only work outside the repo:** the source was fetched with curl piped into node (nothing written), and I read the workers' ignored temp files in sibling worktrees. No edits and no Git writes.

## Findings and disposition

| ID | Disposition and evidence | Remaining acceptance |
|---|---|---|
| CL-1 Medium | Accepted; raw-source hash attribution was false although values match. Fixture/CSV/reference-comment and current copied docs use the actual response hash. Offline metadata test was RED one failed/three passed, then restored GREEN. | Final integrated check/re-review; this offline pin does not verify network availability or future bytes. |
| CL-2 Low | Accepted; content corrected Mangonel 100% and common/base gunpowder labels. Gameplay corrected siege/armor/class-export and older simulation-test comments; no runtime behavior changed. | Local handoffs frozen; exact integrated review pending. |
| CL-3 Low | Accepted; owner 3 among players {1,2} is checked in both participant-owner fields and strict legacy comparison requires the optional key absent. Removing actual-player predicates and emitting `participants:undefined` separately each fail one check/eight filtered. Validator bytes restore exactly. | Restored four-file/43-test and six-file lint runs passed locally; exact integrated recheck/review pending. |
| CL-4 Low | Accepted inherited gap, recorded OPEN: all six Mameluke/Mangudai/War Wagon tiers pass foot-soldier eligibility in Town Center/Watch Tower/Bombard Tower, unlike Cavalry Archer/Knight controls. Pinned English help establishes mounted identities; export omits raw garrison flags. Newly implying-intended comment removed. | M2 independent current-DE garrison-mask census and live entry/population/healing/save/replay controls; no eligibility fix in M1. |
| CL-5 Low | Accepted; independent CSV/fixture set now equals actual `Object.keys(UNIT_MAX_HP).filter(firesProjectile)`. Rogue Villager and missing Archer mutations each fail the new population assertion. | Final integrated census and review. |

No dissent from the substantive findings is asserted. COMBAT-R1 repair is correct on Claude's reading, with only one unit/one target-health replay bound; final cross-lane execution is required because replay creation also initializes H4 occupation metadata. The inherited M7 long-walk divergence, whole-game content gaps and broad CSS mechanism bounds remain open.

## Verification

Content worker used exact already-frozen peer classifiers only as local prerequisites: `prototypeUnitRules.ts` SHA-256 `88803e20193f429ae2cbbef483b19ba78f869dea789f51f8e2ae736fd1626d24` and `unitClassSets.ts` `8f02ab416cf8d9c53208593a7d7eef112bcbf2198ef6f42e7f9e639c00694c36`. Both nonowned preimages were restored in finally and hash-checked, excluded from product handoff. The initial sandbox Vitest startup refused config access and ran no tests; elevated narrow checks actually executed. Source metadata tests-first: one failed/three passed. Rogue/missing runtime shooter mutations: each one failed/three filtered at the population assertion. Restored affected suite: three files/28 passed; directly changed three TS files lint passed. Raw response hash checked before parsing, all 44 rows agree, no runtime numbers changed.

Gameplay's separate CL-3 mutations each failed one check/eight filtered, then restored product `unitAttackAnimationFeed.ts` hash `df82f1afccd8633e7fdc38f88ee01342e1ba8f5b80324ce9df68f19ecb392d7d`. Four affected files/43 tests and six-file lint passed; five delta files are comments only and the sixth adds test controls. H4 layout repair has separate local 75-test/six-browser and native-diff evidence, not supplied by this reviewer. E16 freshness is independently already-supported engine 1.1.4 evidence, not a combat review or new engine fix. No full runtime gate was run by this content/docs worker. Root owns final combined gate, review, realistic play, main integration, remote acceptance and resource cleanup.

## Round outcome

Changes requested in the reviewed target. CL-1/CL-2/CL-3/CL-5 have frozen bounded local repairs; CL-4's intended-behavior comment is corrected while inherited eligibility remains OPEN. Final combined acceptance is pending. This is a substantive Claude continuation, not a fabricated completion of the initial run, not blanket dual-review approval and not evidence of full DE parity. The canonical plan owns the next exact-revision review/gate/shipping status.
