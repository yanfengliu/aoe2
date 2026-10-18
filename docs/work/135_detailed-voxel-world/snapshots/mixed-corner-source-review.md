# Mixed woodline–bank corner — independent source review

2026-10-18. **ACCEPT for the bounded seven-file24-case semantic attempt, then the separately reported unchanged ResourceVariation21 comparison and ordinary typecheck under root's native grant.** No material source blocker found to attempting those checks. No test, count admission, native art, same-art runtime parity, performance or release result is inferred. This report is the only write; no product import, test, build, browser, native flow, engine or Git operation occurred. U's current native ownership was respected.

## Exact target and inspected evidence

M is `C:/Users/38909/Documents/github/aoe2-worktrees/mixed-corner-1018`, based on main E `1dc717882f76676894dd84c6d002087c77a51765` plus the retained D47 overlay. Root owns integration/acceptance. I read the approved plan, handoff/artifact contract, all14 source/test deltas, all seven proposed test files, and relevant unchanged resource/recipe/terrain/pose seams.

| Input | SHA-256 |
| --- | --- |
| Approved mixed-corner proposal plan | 3397fa0251037b97831f032a75ad9a7dc85969f1a17ec01d7e6ab1228c1c68fb |
| M handoff.md | e6d536b5aa8d7349443971927b7e8521808bab357bbe4cb1682b607215041d38 |
| after-source53.json | f9ec7d3f8e0b01cb6eeb92c959753e140123bfe56ab4be81f53078c6552dc627 |
| before-source48.json | e2d305e7d474aac4c5fed4463f900fa86e1048c5d3aeddcb25532869e76f6a7a |
| scoped.diff | 8263245e4da6a7d1a4871ea809404ea53d44ab798f98937bb441df57a18c0106 |
| artifact-contract.json | bb2f3f8cbd9e916e0cafd725daa3f086a5059fa571961a93bbcd30d5b145ffb9 |
| tests-first.json,initial authored contracts only | c694c6836e1e938cdd57f280cd35bb70baa52d82352a84b8c5f6dc35324be9a0 |

Fresh hashes match all53 current files to the after manifest;39 paths retain their before48 digests. The extra before48 context is the explicitly inventoried TerrainFrame, not an invented48th D overlay file. All53 files remain below500 lines; the maximum is498 in the unchanged adapter test. The ground-context ledger's five current Ground/Data/Detail/Shader/WorldRenderer files also match their recorded pins. Static parse/import checks are reported by the author only and are not typecheck or runtime execution.

Changed source/test pins:

| Path relative to M | SHA-256 |
| --- | --- |
| src/rendering/voxel/aoeVoxelConiferConstruction.ts | 2b8e3b8baa781a0e28b2bfd8c49ce7a7dba12c122542ad2769516e2388772c3f |
| src/rendering/voxel/aoeVoxelCornerLife.ts | 4e0d2c16c372e113db7c1123b2ae0b238f335d022abf2719475b4f82d550e1aa |
| src/rendering/voxel/aoeVoxelCornerStoneBank.ts | b8dafd4a794fb128f030f4635c501290e3c76f72d84b5191c31b2ed21fa64168 |
| src/rendering/voxel/aoeVoxelCornerVegetation.ts | 75441e99503526f26cda9310090e8bbb18c14d962902c61f3c1b7346152259c3 |
| src/rendering/voxel/aoeVoxelFineNaturalMesh.ts | 4c8d6556236bda41c7360ad378d9c73ce375df9a1fed057174fd11e01e3c664e |
| src/rendering/voxel/aoeVoxelNaturalRecipes.ts | 272ffaec7cfc7c89ea59b3dc8d7e09cc598bbdefe752d0783cbdaac83bf94404 |
| src/rendering/voxel/aoeVoxelResourceRecipes.ts | d4f64263e18ed4270fee121e0e003c7205351fe212de79a03c97a16530b5a539 |
| src/rendering/voxel/aoeVoxelTerrainFrame.ts | e9344c8ba944448a8b0d2b1eb5300484de4d66e26967287d6353b9d913a623f2 |
| src/rendering/voxel/aoeVoxelUnitHumanoidRecipes.ts | bc6c56966f87236c2ee448be5ece99e81d3ee545eb79cc6dff2582249d4e45cf |
| src/rendering/voxel/aoeVoxelVillagerPose.ts | 01a001aa323a48b9f26421893664ac514a17b092a6a28d5977d1ba922d68631f |
| tests/rendering/aoeVoxelConiferConstruction.test.ts | 39afbcc3c1498db8f7523c5105ace9004f2a2f3633fe74860192f85b8269d31f |
| tests/rendering/aoeVoxelConiferSculpture.test.ts | 95af321fbc3b6e7a27d2b03c5b0cac6b6b9c5db5ed7fff7fc605870dacea3a31 |
| tests/rendering/aoeVoxelCornerStudy.test.ts | 1a393c7e9866c3dfac1bbacdf1babd8b8d593d06424dc552f4b16a5c42831bb5 |
| tests/rendering/aoeVoxelVillagerJoins.test.ts | c27c081cb78f8a21d1cd4347193190e456e6adc1d4719131db81585610621cc6 |

## Source and mechanism assessment

- **Bounded family and scope.** The three new modules supply fixed vegetation, life and stone/bank data. Existing natural recipes consume their arrays/samplers; sheep and villager recipes consume the same life data. Unrelated wildlife/unit/building recipes are unchanged. The selected new shared life meshes are used by sheep/villager parts, not an unreviewed full-roster conversion. ConiferConstruction is a forwarding seam to the new sampler; no S3 construction source is imported. Artifact data and game recipes share these sources rather than maintaining a separately authored viewer model.
- **Finite construction/cost.** The conifer retains the40×84×40 lattice and2.15×4.6×2.15 envelope, with a continuous tapered stem, six finite wood load paths and nineteen overlapping crown volumes. Other replaced meshes retain24³ sampling. All construction loops have fixed bounds; the existing cache is keyed by the nine fixed geometry tags, not entities/time. Existing16384 conifer/8192 other vertex ceilings,24576 indices,resource24 reserve and tree8 limits remain. New arrays do not create per-voxel instances. Changed mesh revisions advance to4 while untouched needle/branch remain3. Actual mesh sizes, connectivity, first-build CPU/allocation cost and live rendering cost are still unmeasured.
- **Contact intent.** Sheep has four distinct grounded legs, body/haunch, neck/head/muzzle and ears/tail within the existing twelve-part ceiling. Worker parts retain the existing-length handle, common shoulder1.04, independent upper-arm/forearm/hand segments and grounded boots. The one pose edit replaces literal1.04 with the same constant; existing rigid-pose paths are unchanged. Source geometry suggests the intended connections but cannot establish visible grip, anatomy, motion or good proportions at Normal zoom. Ellipsoidal/clipped cluster unions and host fragments may still read as recipe shapes; native pixels must decide.
- **Bank route is present in Natural.** Adapter line140 calls detailParts regardless of voxelGround; false controls existing shore surf, not the whole detail lane. Appending ordinary matte bank parts there therefore avoids the plan's prohibited Moebius-only shore path. The exact two land/water pairs require visible non-memory terrain, correct grass/forest and water types, and zero elevation; output is at most ten reused fractured-rock parts. Existing detail cache/reset owns the new parts. This finite coordinate-bound study is not a general shoreline implementation. Actual contact with Natural's displaced shore/water is explicitly unproved, and neither source attachment nor a bounds test proves that contact.

## Test honesty and coverage

The proposed denominator is correct: CornerStudy6 + unchanged Sculpture5 + ConiferConstruction4 + unchanged NaturalConstruction4 + unchanged VisualSpike1 + VillagerJoins3 + unchanged NaturalAnatomy1 =24 cases across seven files. Retained Sculpture SHA95af321f is exact, including its depth/filled-volume/recess and two-yaw emitted-outline guards. No thresholds or caps were relaxed. The changed old appearance assertion retains exact needle/branch hashes and removes equality only for the six deliberately reauthored old art assets; all old hashes and original test bytes remain recorded. Joins replaces only left-upper-arm→hand with upper-arm→forearm→hand, preserving every tolerance, scale, facing, pose, ambient time and part ceiling.

CornerStudy's sheep contact helper reconstructs interior intervals from actual emitted triangles rather than calling the checked occupancy function. Its no-rotation local transform is valid for this specific unposed sheep recipe, which receives no natural-resource yaw. It checks four actual leg-tip/body contacts. Head/neck checks remain box overlap, and villager grip checks an actual recipe's handle-axis/hand envelope at one idle facing; the broader unchanged Joins suite uses oriented-box contact across poses. These are useful physical safeguards, not emitted-surface contact or native anatomy proof for every part/pose. Bank visibility/reset tests use real TerrainFrame integration, though they do not yet exercise a real non-null fog frame or displaced Natural water.

The artifact-copy test establishes deterministic defensive resource copies and named template presence, not independent game-versus-viewer equality. The tests-first record proves authored ordering only. No new meaningful RED or sensitivity run has occurred. Preserve all unexpected failures and stop the affected stage; do not repair thresholds/goldens during the grant. Run the unchanged21-case ResourceVariation set separately and compare exact failure names/messages against the retained baseline; four inherited failures are not a waiver for new failures. Untouched UnitRecipeCharacterization hashes are expected to disagree with intentionally changed villager art and must not be bulk-updated or called green.

## Required boundaries before any later parity/art claim

`copyCornerStudyArtifact` is presently a **resource/template accessor**, not a sealed canonical scene. Its worker uses fixed tint0x4477aa while the actual game uses entity.tint, and its broadleaf uses default wind while game form2 may use±.12. The actual game also applies entity size/minimum scale, resource yaw and mine size variants, pose/time, ground offset and identity. This is not a blocker to the proposed semantic checks, but the accessor must not be mislabeled as already matching selected2352/2186/2161/2206 world instances. A later exporter must bind the actual chosen variant/tint/pose and independently recorded expected transforms to the actual presented inspector, preserving one geometry/material artifact across arms.

The complete Natural packDeGround payload, AoeDeGround mesh/material/tier state, bank anchors, camera/projection/light/resolve/shadow settings and actual geometry/material digests remain absent from the frozen scene record. No engine interface gap is established by that unfinished export. If the exact Natural state cannot be reproduced through the existing public AoE layer, the comparison must remain unavailable rather than substitute another floor. First native acceptance still requires the complete uncropped Normal family at the planned actual identities; target2352's yaw144.3969539087 is the already established opening facing. Idle2206 is not evidence of chopping/tool contact. A Normal rejection must stop further coverage, as the approved plan specifies.

## Disposition

The source is sufficiently bounded and the retained/new contracts sufficiently meaningful to justify the requested semantic attempt. Require whole actual test reports/native exits, exact53 restoration/readback, ordinary prehooks with their actual voxel SKIP/result, separate Variation/typecheck outcomes and owned-process closure. No build/native art/direct-engine comparison or source repair is granted by this review; root assigns those phases separately. Broader memory/picking/shadow/gameplay/performance/full-release gates remain open.
