# Align DE siege base stats

Status: active
Owner: /root/siege_content
Created: 2026-10-01
Updated: 2026-10-01

## Problem and outcome

The CSV and runtime share ten stale runtime fields: Onager attack 50 and pierce armor 7, Heavy Scorpion attack16, HP50, pierce armor7, melee armor0 and reload35ticks, plus sight 3 for Battering, Capped and Siege Rams. Correct these to DE update 185872 Onager attack 55, armor 8, Heavy Scorpion attack14, HP60, pierce armor8, melee armor1 and reload36ticks, plus Ram sight5, independently of the open full-parity queue.

## Scope

Base main 10c26f52f0810321784603a7b73f3fbf6789dc44 (0.3.242), private worktree siege-content-1001, held installed engine 2.5. Allowed product edits are units.csv and the three assigned stat tables. New source-contract and simulation tests are disjoint from work107/108. No engine, dependency, roster, technology, movement, replay implementation or migration changes. Root approved one new siegeBaseStats fixture and one direct registry entry; no barrel or second seed. Root explicitly extended scope to Heavy Scorpion attack16→14, HP50→60, pierceArmor7→8 and reload35→36ticks after raw source ID542 inspection. Root also approved Heavy Scorpion meleeArmor0→1. The final bounded vector census across the five identities and HP/attack/melee/pierce/reload/sight found only two additional vectors: Capped Ram melee-3 versus pin-2, and Siege Ram melee-3 versus pin-1. Their CSV ram-class armor+1/+2 is distinct from explicit melee armor; these vectors stay unresolved outside this milestone. No other fields may be changed automatically. Root owns canonical spec/version/devlog/register, integration, full gates, independent review, main/push and resource-slot scheduling.

## Approach

Promote a compact independent literal fixture from raw data.json at 3bb43b14, verified before parsing at 965553 bytes and SHA256 66a439979afe62f71541cff05280837abfb04e7732e364e2eae2f318862ade6d. Verify the name mapping against separately identified strings provenance. Use the content parser plus independently enumerated five supported runtime identities, not CSV-to-runtime agreement alone. Begin with RED source assertions before changing ten runtime fields and their CSV counterparts. Reuse imperial-siege and siege-workshop fixtures where they can exercise real production, upgrade, damage and isolated sight; Use the approved fixture for Champion70HP/1melee (Onager damage54 versus49) and Hand Cannoneer17/no bonus (Onager pierce damage9 versus10). Its isolated initial Ram uses public table-derived sight solely for paired fog images; real production/upgrade/move tests independently establish the mechanism. Heavy Scorpion base attack14 is separately checked through production/upgrades and a connected above-floor pierce hit under unchanged local bonus/armor rules. Actual upgraded/trained Heavy Scorpions must have HP60, pierceArmor8, meleeArmor1 and reload36ticks; the source decimal3.6seconds becomes exactly36ticks at10TPS. HP-ratio/cooldown retention and connected pierce-defense are added acceptance. Existing CSV reload3.6 is already correct, so ten runtime corrections require nine changed CSV numeric cells.

## Acceptance criteria

- [ ] Literal ten-field source contract, exact five ID/name mappings, missing/excess rejection and unchanged tier/attack/armor controls.
- [ ] Real production and completed upgrades yield corrected attacks, above-floor connected pierce defense and radius-5 owner sight; axial distance 4/5 visible, 6 unseen, with other sources isolated.
- [ ] Existing HP-ratio/cooldown behavior, new save/load and in-flight outcomes preserved; same-version replay performs nonzero work through affected endpoints.
- [ ] Agreed old-save bound remains explicit: serialized attack/sight survive until an existing applicable rebuild, current target pierce armor follows the table, and historical combat re-execution may differ.
- [ ] Literal RED and one-field rollback/population controls recorded with restored GREEN. No whole-game determinism or speed claim.
- [ ] Before/after/pixel diff from maintained scripts and representative real train/research/move controls accepted before shipping.
- [ ] Root final integrated gates, review, main/push and hosted acceptance complete before closure.

## Implementation steps

- [x] Create isolated sanctioned worktree, confirm main CI/corpus green, read scope instructions and verify supplied artifact/source hashes.
- [ ] Freeze amended source/test plan and obtain runtime-slot approval with exact commands and bounded cost.
- [ ] Author source/simulation contracts, retain RED evidence, then change only the ten assigned fields and source header.
- [ ] Run focused restored checks and sensitivity controls, then freeze reviewable bytes and canonical-text proposals for root.
- [ ] Coordinate visual evidence and real controls before final acceptance; retain private work until integrated.

## Outcome

Source fixture and tests are being authored; the stat fields remain unmodified pending RED evidence and a maintained before capture. Runtime tests, build, browser, gates and review are not run in this lane. The original five-field plan is retained byte-exact in snapshots/plan-five-field-original.md (SHA2569576ec01e4d0f96b88ce2e6fded87e2398e3e7df9c04ee6eaf7ce5c9a0bd3c55). Original English strings were freshly fetched and hashed94f3077c8011ef3e57a2012d9cc7158499257b4c2dc8e5382c77e007249618b3 before parsing. Original nine-field plan is retained byte-exact in snapshots/plan-nine-field-original.md (SHA2564789d3d6bc952fb3b0c6d47ce3328542c7376f4ec59635d451dd34c2c3389c69). Original six-field plan is retained byte-exact in snapshots/plan-six-field-original.md (SHA256e0d7dc9a9b9320d1be9cd03de0fa028b6df7a931d0e1aa7afdbd50ccba9faf7b). Added Heavy Scorpion sourceID542/name mapping and HP60/pierce8/reload3.6 are verified from those raw inputs. Added runtime work beyond six fields is one final-research cooldown checkpoint and one pierce-defense case, each bounded at500research+300training+1200move+1000hit ticks; elapsed runtime cost remains unknown until measured. Source packet artifacts match supplied hashes; two input-file checkout hashes differ solely CRLF versus LF, with exact normalized equality. Read-only ci:status ultimately exited 0 on 10c26f52: CI 36839039491 and playtest-corpus 36839039607 green. Initial safe.directory and network-sandbox attempts were unavailable, not failed product checks. The raw source is intact. Current inspection cost is commands/reads only; runtime work 0 and elapsed runtime 0 seconds; total inspection elapsed is not measured. Final source-test census: twenty independent CSV/runtime field assertions plus three provenance/population/unchanged-control cases; expected pre-change nineteen failures and four passes because CSV reload3.6 is already correct. Root granted one content-only RED command, one worker, no World/build/browser, max30seconds; world tests remain held. Before/after maintained fog plan is same seed siege-base-stats-fixture, paused tick0, focus32,22, zoom1.2, 1280x800, Moebius and identical SwiftShader rasteriser with no selection/commands; visible Ram boot sight changes3→5 while separate controls prove training/research/move. Source fields stay unmodified until the before image exists.
