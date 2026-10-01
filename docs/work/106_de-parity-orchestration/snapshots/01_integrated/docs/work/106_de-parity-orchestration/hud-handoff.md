# Resource workforce: frozen implementation and bounded proof

Owner: `/root/presentation`. Integration: `/root`. Base: `99749eb12004cabf7d049abeddc2f84a0177d3db`. Status: locally verified and frozen; all 16 product digests checked during integration copy. Exact integrated review, full gate and shipping remain pending.

## Accepted storage contract

Store nullable `resourceOccupation` on `UnitComponent` for Villagers and Fishing Ships. Successful assignments and occupation-clear events publish cloned unit metadata through `setComponent`; ordinary movement preserves proven occupation. Keep the existing mutable gatherer task/drop-off path so same-tick traffic arbitration sees the same intent as before. Add no per-tick gatherer draft/replacement. Active trade counts by its existing trade state. The scalar `aoe2.resourceOccupationVersion=1` remains the modern-format marker.

Idle workers count zero but retain history after completing a plain move; another plain move counts them again. Fresh seeded resource desire is not history. Build/repair/attack/garrison clear occupation; no exposed stop command was found, so a stop/cancellation transition is not claimed. Reassigned carriers count their new desired resource rather than old cargo. Active Fishing Ships count food, active Trade Carts/Cogs gold; foreign/sheltered workers are excluded. Replay workforce remains player-1-bound even with fog owner 2.

Older user saves infer only active gathering; walkers with absent occupation history remain uncounted until their next assignment. Older recording worlds retain absent occupation fields and marker/slot keys, including newly spawned units. These compatibility rules are unchanged by moving the field.

Modern save schema 2 retains the additive unit field and marker. Writers and spawns gate on marker exactly 1; malformed resource kinds or unknown markers cannot create extra count keys or NaN. HUD metadata is not read by simulation decisions.

## Source and bounds

The [official forum report and staff confirmation](https://forums.ageofempires.com/t/incorrect-villager-counts-in-the-upper-left-if-villagers-are-walking-to-a-location/195310) pins report build `101.101.58259.0` in February 2022. IkoKnight checked with the team on March 3, 2022 and confirmed remembered walking occupation as designed. Reproduction steps 6/7 describe walk→idle zero→walk one. Player reports identify active fishing-food/trade-gold in January 2024 and reconfirm walking in March 2026. The [official resource tutorial](https://www.ageofempires.com/learn-to-play/control-resources-aoe2/) establishes the HUD context. These sources were inspected September 30, 2026. Exact nongather transitions beyond those observations remain explicit project rules, not an independently measured complete DE transition matrix.

## Rejected route and useful evidence

The first route placed occupation on `GathererComponent` and used detached gatherer drafts to publish state. Its noncosmetic comparison was initially insufficient; after the comparison was corrected, it went RED. Same-tick traffic arbitration reads gatherer task/drop-off intent from the live world, while deferred whole-component replacements delayed that intent and changed gameplay. The worker also measured 12,521 writes versus 33 over 1,500 ticks. This is evidence against that route, not a result for the approved alternative or a long-horizon performance claim.

The first comparison used repeated BigInt whole-world hashing, took 62 seconds over 600 ticks and hit the 30-second timeout. The accepted replacement uses exact `isDeepStrictEqual` on the same complete serialized states, deleting only intended unit occupation and marker. No timeout increase or reduced samples was accepted. Reintroducing the rejected Gatherer draft with that corrected comparison fails at tick 1; approved source was restored in `finally`. Earlier insufficient green results do not transfer to the accepted route.

## Local contract and compatibility checks

- Count contract initially failed 4/4 because counters were absent; publication independently failed when a previously read component changed null→wood, and malformed metadata failed with `silver: NaN`.
- Final focused command/save/replay/UI-teardown/file-budget checks passed 18/18; neighboring queued orders 7/7, carry 1/1 and gather-domain 5/5 passed. Build, typecheck, exact-file lint and whitespace checks passed.
- All 600 serialized-state comparisons execute without skips, removing only occupation/marker, across gathering/carry/deposit and automatic replay assignments. SessionRecorder tick folding observes assignment, remembered movement and garrison clear.
- Modern saves/loads and multiple seeks pass. Modern and old recordings execute nonzero self-check segments with zero skipped segments for bounded short completed movement/training. Legacy/modern complete worlds agree at 281 ticks including a newly trained villager; key absence is checked after seeks at ticks 1/100/end.

## Equal-world cost bound

The maintained `scripts/aiTickAb.mjs` interleaves baseline and H4 from one saved 4,000-tick, two-player/no-attack world containing 23 units and 12 gatherers. Both arms record and instrument 1,500 ticks in 250-tick chunks; fingerprints delete only unit occupation and marker. Every chunk agrees. Gatherer publications remain 33→33; Unit publications 3→34 add 31 occupation events. Tick-entry bytes 19,058,242→19,061,127 add 2,885 bytes (0.015%). CPU 2.7984→2.7872 ms/tick is instrument noise, not a speed gain claim. Two thousand read-only HUD calls cost 0.00121→0.00279 ms/call. Foreign-load input was stubbed zero, so no machine-load attribution is made.

## Visual and real-control proof

Maintained `captureMapScreenshot.mjs` and `diffMapScreenshots.mjs` used the default `aoe2-prototype`, Natural style, tick 1 and default camera. Baseline/final captures ran on RTX 4090 ANGLE D3D11 blend at 800×600, 1280×720 and 1920×1080. Every diff has 1,983 changed pixels, confined to resource chips within `(33,28)..(330,61)`: 0.41%, 0.22% and 0.10%. The worker inspected every baseline/after/diff at original resolution and retained byte digests; the coordinator inspected original after/diffs at all widths and gather/walk/build controls at 1280.

| Diff | SHA-256 |
|---|---|
| 800×600 | `aa56da7c3cef41e9438ec95976c7b7a716e1b6e33d07a1d4f49bbfdef6efdedf2` |
| 1280×720 | `9e85d722a39bbb7d123c578367f21ac0c4503a897e661d3f9a4c61ce6d1736b4` |
| 1920×1080 | `0c004958ae80e04690d1e8a5356d0f63b638930660ed115654ca2e2b837cbd1e` |

`resource-workers.spec.ts` was RED on original dist with missing counters. Final 3/3 passed in 8.0 seconds using the default lobby, real mouse villager selection, sheep right-click (food one), plain walk (still one), House card and placement (food zero), with clipping/overlap and page/console checks at all three widths. No direct test command or stepping/pause bypassed the controls. Nine gather/walk/build captures were inspected at native resolution and digest-bound. The earlier maintained opening-control baseline passed 1/1 in 44.9 seconds. This is not a complete conquest match or the full browser gate.

## Inherited OPEN replay limitation

Both unchanged baseline and H4 fail the same legacy long-walk self-check segment 70→140 at `components.position[2205][1].x`, with five checked segments and zero skipped. The equal-world instrument reproduces both arms. H4's new compatibility cases deliberately bound training to short completed movement and modern walking to a short seek segment; no claim that long-path deterministic replay passed is made. M7 and the defect register retain this separate issue. Full DE parity remains OPEN.

## Integration and resource state

The frozen 16-file product manifest and final authored worker handoff are retained under ignored `tmp/parity-106/` in the integration tree while review needs them. The source files were digest-checked during copy. The worker closed its hidden preview PID/process tree on port 4281 in `finally`; maintained captures and browser tests closed their browsers. Final owned-process/port queries were empty. No GUI/server was left open. Independent integrated persistence review, combined `npm run verify`, representative play and main/remote shipping remain integration-owned.

No sibling engine, dependency or version changes were made by the presentation worker. The prepared batch version remains 0.3.242.
