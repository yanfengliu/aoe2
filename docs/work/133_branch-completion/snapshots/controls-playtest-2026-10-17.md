# Work 133 real-controls handoff, 2026-10-17

All six requested control flows passed within the bounds below. No product, test, tracked documentation or dist file was changed during browser work. The earlier IR3 repair is a separate handed-off patch in the original foundation worktree.

## Reproducible controls and observations

- Every page opened a named existing fixture with `speed=normal`, default Natural (`de`) style and player 1 human. The browser was headless ANGLE Direct3D11 on the NVIDIA RTX 4090; every page checked the actual game-canvas renderer string. Viewport was 1280x720. Test API use was limited to read projections/debug state, camera framing, pause and bounded tick stepping. Mouse clicks landed on displayed unit bodies, accounting for subcell positions. Every gameplay order went through actual inputs.
- Gathering: `carry-on-berry-bush-fixture`; click villager 2161, right-click bush A (13,12). In 25-tick observation chunks, A depleted; at tick 800 bush B (16,14) had 7/8 food. The HUD Save at tick 800 is `gather-continuing.save.json`. By tick 1550 both A/B were gone, the villager was idle with no carry and the stockpile held all 23 food. The far bush (8,10), sheep (13,15) and fish (18,16) remained at 100 each.
- Exact rally: `rally-gather-eligibility-fixture`; click Town Center 2160, right-click own Farm 2164 at (12,6), click Train Villager. At tick 375 trained villager 2170 was gathering from targetResourceId 2164 with an explicit gather order, while nearer own Farm 2163 at (8,12) was the decoy. Actual HUD save `rally-exact-farm.save.json` stores both the exact Farm target and rally point (12,6).
- Monk: `monk-carried-relic-fixture`; click Monk 2162, right-click relic 2166 at (33,10), right-click ground (36,10), then right-click Monastery 2161 at (8,24). Relic pickup, movement with the carrier and deposit all occurred. `monk-carrying-move.save.json` at tick 35 contains carrier map 2162->2166. After deposit, 20 further ticks paid exactly 1 gold.
- Missionary: same controls on `missionary-carried-relic-fixture`, with `civ=Spanish`. Carrier moved while carrying, deposited and paid 1 gold over 20 ticks. `missionary-carrying-move.save.json` at tick 35 contains carrier map 2162->2166. This supports the corrected carrying capability; the exact loaded speed is covered separately by the integrated mechanism tests, not measured here.
- Foundation: `unbuilt-foundations-fixture`; click villager at (22,21), click Build House, click anchor (22,26), advance 1 tick. The zero-progress House took 25 wood (1000->975). Click its foundation, press Delete and advance 1 tick: House gone, wood 1000. Repeat real placement and step until positive progress: House started at tick 52. Actual HUD save `foundation-started.save.json` retains that state. No overlapping-unit clearing or started-site proportional refund was exercised through the browser.
- Clock: `wonder-default-clock-2p-fixture`; step 100 ticks, hover the countdown chip: 16:30 and 198 years. Leave the pointer resting and step 50: 16:25 and 197 years. Actual menu Save at tick 150 stored remaining 9850 and deadline 10000. After step 200, real menu Load/browser-storage radio/Load rewound from tick 350 to tick 152 with remaining 9848; deadline stayed 10000 and the real hover said 197 years/16:25. The 2-tick offset is elapsed animation after ordinary Load. The first scratch assertion incorrectly required no elapsed tick; its failure is preserved in `play.log` and `observations.json`, and the corrected bounded flow is in `clock-followup/observations.json`. No product change was made.

## Captures inspected at native resolution

All four use `scripts/captureMapScreenshot.mjs`, its source freshness and served-asset checks, `RASTERISER=gpu`, `STYLE=de`, `SIZE=1280x720`, `TICKS=0` and LOAD of the actual HUD save. No one-off screenshot code was used. They are informational state captures, not before/after visual-change proofs or performance measurements. LOAD clears the selection; the first three retain the loader's menu hover hint.

| Capture | Saved tick, framing | SHA-256 |
| --- | --- | --- |
| `01-gather-continuing.png` | 800, focus 15,14 / zoom 1.7 | `8b7a75072a962e93d48d6441f34bb6232530aed367fdd081a5ffff07c2de119c` |
| `02-missionary-carrying.png` | 35, focus 35,10 / zoom 2.2 | `d2b99de0d6bb67a331c8e847942fc996e60dc9f90436e09863dd4ad52c99b2a3` |
| `03-house-started.png` | 52, focus 23,25 / zoom 1.8 | `77089709a89603b9d52992f8d17b587c9a99d52c973c5557cbde47629741ab5d` |
| `clock-followup/04-wonder-clock-tooltip.png` | 150, focus 14,8 / zoom 1.2, real chip hover | `2c5841e5e2aa725efab07dbee8bd318430a441b60cc3561dcc4bb3cf86c287e7` |

The whole-frame sweep found the requested entities, construction state, fog and readable countdown tooltip. It also makes the existing coarse block silhouettes and rounded translucent HUD plain. This lane has no newly captured real-DE visual reference, so these frames establish this game's current appearance, not visual parity.

## DE source comparison and remaining bounds

The target and comparison requirement are spec section 2.1. The dated source binding is `docs/work/128_ai-relic-collection/de-comparison-2026-10-17.md`: installed DE English strings SHA-256 `6CB9D3516BA4BF486F926560AAF4A9798CA659B807E0B61C02909BF1E1178C2F` (modified 2026-10-06), installed Promisory AI scripts, named official patch notes, and explicitly lower-strength community reports. No live DE match or new DE screenshot was inspected here; no parity percentage is inferred.

- Continuation and resource rally agree qualitatively with official 108769/109739 and installed string 4944. The exact five-cell continuation radius remains this game's approximation. The browser exercised berries and one own-Farm rally, not every gather kind, hunt or rally eligibility combination.
- Both relic carriers now satisfy pickup/movement/deposit through controls. Current Missionary carrying is sourced to official update 169123 and installed IDs 26691/5319. Explicit Drop Relic remains absent, and the four-cell action range remains an approximation. Difficulty-dependent AI relic policy was not tested in this browser lane.
- The unstarted Delete refund agrees with direct reports in DE forum 137076 (community strength). Paid-cost receipts and proportional refunds after work remain separate known bounds. This game's instant clearing is distinct from DE walking evacuation; the browser did not exercise that clearing path.
- The Wonder chip and restored deadline satisfy this game's sourced clock contract. Years use installed strings 3020/3028; seconds per year and map-size duration table remain community-source bounds. This run did not measure a live DE timer, Relic clock, larger map or Atheism targeting/stacking.
- Rendered original/procedural art is the permitted art distinction. The HUD's DE look target and remaining H1-H7 work are specified in section 14.1; the native frames here still show the current rounded glass chassis. No direct visual side-by-side was performed.

## Cleanup and retained evidence

No page exceptions or console errors occurred in either browser run. Both persistent contexts were closed in finally. Preview PIDs 56916/52716 and capture node PIDs 42248/40880/50480/45700 finished. `cleanup-audit.json` records no task-owned browser/server descendants and no listener on 4811. Both task-owned Chromium profile directories were removed after resolved absolute-path containment checks. The browser slot was released to the coordinator.

Retain this folder's HUD saves, four PNGs, capture logs, control logs, observation JSON and handoff while acceptance/gallery work needs them. `handoff.json` binds the source HEAD, served bundle names, dist index digest, exact rally target, initial harness failure, all native-inspected image hashes and cleanup audit. No test suite or build ran in this lane.

## Missionary image clarification

The gold head/post left of the mount in `02-missionary-carrying.png` belongs to Farm 2165 at (34,12): `aoeVoxelBuildingDetails.ts:247-249` names its scarecrow post, arms and thatch head. It is not another ground relic. The actual HUD save contains exactly one relic, 2166, at (35,10), and maps carrier 2162 to it; the Missionary coarse position is also (35,10), with fine transform (140,40) and occupancy offset (0.5,0). This saved state proves carrying at the carrier cell. The still does not establish an attached carry pose or a clearly visible carried relic; the mount may obscure it. No further browser or performance work was run for this clarification.
