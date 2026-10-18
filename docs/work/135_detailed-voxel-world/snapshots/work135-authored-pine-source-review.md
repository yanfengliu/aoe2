# Authored Fluffy Pine source review — 2026-10-18

Independent read-only review of one frozen third-party technical input. No decoder/product import, test suite, mesher, renderer, browser, build, server or Git command was run by this review. The only computation was standard-library parsing/hashing of frozen bytes. The only authored output is this report. The five rejected original conifer routes remain stopped; this review does not accept game art or reopen sculpting.

**Verdict: ACCEPT the exact geometry and stored base-color preparation under the declared VOX200 loader overlap convention. ACCEPT a future explicitly labelled opaque diffuse/base-color technical projection as a bounded experiment. HOLD exact MagicaVoxel/author optics, native dispatch readiness and game readiness.** An opaque projection is an intentional benchmark mapping, not proof that `_ior`, `_ri` or `_d` are inactive. No engine deficiency has been established.

## Frozen evidence and independent readback

Freeze `8d678cb797ee4a52366c796a77d743b90ae8409a8323b3a6dcf2f5950138cca7`: all 38 own files and all 51 external inputs match both byte lengths and SHA256. The 43 public static distribution modules are included within the 51 external inputs, not 43 additional files. Actual mesher distribution bytes are bound; source-to-distribution build equivalence is not established. Retained controls report 11 passing hand-authored cases, diagnostic verification reports 10 arrays, and merged verification reports five arrays/454 winners. I read those programs and receipts; I did not rerun them or treat console PASS as native proof.

| Inspected input | SHA256 |
|---|---|
| HANDOFF.md | `e23545cf545f42ef50cbdfbbac7f1b2338c888375e72503e274434b990782208` |
| vox200.mjs | `5268312dd063fca0b2bbccf1031733353c259fe21502b034c772d3f2634f6a04` |
| coordinates.mjs | `ae6a84f41cc9211cb5921005438fbec8da14f184ac612772bcbc78a006441eab` |
| controls.test.mjs | `2071fe3984d519d6ab412e3f373ceffbbd3481a449c2b6c56f09920d33490c3d` |
| prepare-resolved.mjs | `4a17a75fb9ce8fc97b97b790888ffd868a4e3a4311456b92fd69952756287fef` |
| verify-candidate.mjs | `c862122f471e5b5faf5c1e569d943a1fda727977939301fc17b8b518395d0d32` |
| resolved-cells.json | `b4513db6f452b293f810fed62daa763286ac55fdd54481e8c463ccfeacdfaa9a` |
| render-candidate.json | `7e5c72bb5092be65b6780e1b35a43138cbf602d2840079843cea53fb80c96bf4` |
| ogt_vox.h | `933a9251a0241333280f30a89bb09a7c726c93c622696334c7d081ccf8a18b74` |
| MagicaVoxel-file-format-vox-extension.txt | `693a2aa46a5a038561773e6e35a5f2da4127b5d19bc97ae5dcba3802b0f68470` |
| Fluffy Pine.vox | `3577760a9eb5fe6a8988683a17f80f4e726b1faf9c9471f8611b3854747ec08f` |

Also inspected `prepare.mjs`, `verify-prepared.mjs`, `seal.mjs`, source-inspection and resolved-cell data (decoded/inventory outputs were hash-bound), retained control/result texts, pinned original/extended VOX specifications and material-release-note excerpts, public geometry/material/batch contracts, and orthographic camera source. Supplementary public `geometryPresenter.ts` source SHA `037016465de85bf2f8dbf68cd463b2a9c634541ead0e34d756375d64f15b69eb` is not in the mesher freeze; its source semantics are not a substitute for pinning the future served renderer distribution.

## Geometry, scene and overlap

I independently parsed the original 75,475-byte file using standard-library struct/string reads, without calling the checked decoder or its transform helpers. It contains two SIZE/XYZI models (both 128³), three nTRN, one nGRP, two nSHP, 16 LAYR, one RGBA, 256 MATL, 15 rOBJ, 10 rCAM and one NOTE. Model counts are 7,228 foliage and 5,264 trunk. Root0 is identity to group1; child order is exactly [2,4]. Transform2 points to shape3/model0 and transform4 to shape5/model1; both have `_t="0 0 64"`, no rotation field, visible layer0. No layer is hidden.

The actual-file transform is therefore independently literal: local voxel corner `(x,y,z)` becomes `(x−64,y−64,z)`, using pivot64 and translation64 in Z. The resulting raw union has 12,038 positions, 454 differently colored overlaps, no same-color overlaps, bounds [-39,-40,0]..[38,39,128], and exactly 41,824 exposed unit faces by independent six-neighbor enumeration. Every resolved position/palette equals that independently constructed union with model0 first. Every conflicting winner maps to instance0/shape3/model0. No first-XYZI truncation or model co-location error is present for this file.

The overlap rule is adequately evidenced for a **named loader-convention benchmark**: pinned ogt_vox.h:98–100 states lower instance priority for VOX200; :1242–1243 traverses child order, and :1286 appends each shape instance. This gives foliage priority here. It is not an official format guarantee or an exact author optical golden. Both losing origins are retained, so this is auditable resolution rather than silent channel deletion. Per-model output is diagnostic only; rendering both overlapping surfaces would not implement this accepted merged input.

The decoder bounds-checks chunk/record lengths, validates the features actually used here, preserves material/editor dictionaries and rejects unsupported format/version/animation/graph conditions. Its claim should remain “bounded reader for this frozen file,” not a general VOX importer: model/record ranges and all possible editor metadata semantics are not comprehensively covered by the 11 fixtures. No such generalization is needed for this proof.

## Independent transform, color and test assessment

The basis B(x,y,z)=(x,z,−y) is a proper rotation (determinant +1), so rotating normals with B and retaining winding is correct. Uniform pitch is 1.6298/128=0.0127328125; subtracting horizontal center(-0.5,-0.5) and base0 gives x±0.49021328125, y[0,1.6298], z±0.50294609375. The diagnostic model geometry already includes pivot subtraction and pitch; applying B·T minus that center gives literal translation `(0.00636640625,0.8149,−0.00636640625)` with identity linear matrix. The merged geometry has those placements baked once and correctly uses an identity instance matrix. Applying the diagnostic translations again to the merged mesh would double-transform it and is disallowed.

The controls' expected matrices are independent literals, not outputs of the checked rotation/flatten helpers. For fixture rotation17, VOX `(x,y,z)→(−y,x,z)` becomes engine `(X,Y,Z)→(Z,Y,−X)`, matching the asserted column-major matrix; parent translation gives `(10,30,−23)`. Specification rotation105 likewise matches its literal official example. Odd-size pivot, two models, hidden layer, translated parent, colors1/2/255 and malformed-input controls exercise useful independent contracts. The overlap fixture tests an explicit policy; it cannot independently establish artist intent. The real-array checks verify bounds, color/index mapping and winding, but do not prove all general importer inputs, renderer execution or source optical equivalence.

Original RGBA indexing independently confirms palette80=(67,52,27,255),161=(9,97,72,255),162=(32,96,79,255),163=(15,76,58,255). All used entries are opaque. Palette entry1 starts at raw RGBA entry0, and the reserved last entry remains preserved. Public GeometryResourceV1 explicitly takes straight-alpha sRGB8 Uint8 colors; the proposed arrays match that interface. Preserve these bytes and let the public presentation path perform its defined color conversion. Do not pre-linearize, multiply by a colored material/instance tint, or replace them with a new palette. Base-color byte fidelity does not imply equal lit screenshot colors.

## Material and public runtime boundary

Every used MATL contains `_rough=0.1`, `_ior=0.3`, `_ri=1.3`, `_d=0.05`, with no `_type`. ogt_vox's default enum/zero initialization supports its diffuse interpretation; the official extension lists types/properties but does not settle inactivity of the stored additional fields for this implicit type. Public material contracts have shading/color/roughness/metalness/opacity, not general IOR/density. That mismatch alone is not an engine gap: the actual relevance of those stored fields is unproved. Retaining the raw dictionaries and `requirePublicMaterials` HOLD is correct.

An explicitly disclosed opaque base-color/diffuse projection can answer whether the artist-authored geometry is represented and legible through the public renderer. The future manifest must state its actual material values, shading choice and every unmapped stored field; it must not rename that projection “exact materials.” A game-Natural material/light comparison and an author-render parity test are different claims. No exact per-file author render exists in this packet, so the latter remains HOLD regardless of a future attractive screenshot. The author pack preview is reference/provenance only. Third-party reuse permission does not make the pine original game artwork.

Merged output is 133,620 vertices / 200,430 uint32 indices / 66,810 triangles. Public mesher output is 4,275,840 bytes; the five retained arrays additionally include 534,480 color bytes, totaling **4,810,320 bytes**. The retained sample volume adds 1,663,740 bytes during preparation; renderer copies, GPU allocation, materials and process overhead are additional. This fits the stated public hard vertex/index ceilings, but exceeds existing game mesh budgets. The ~74ms pure-mesher observation excludes renderer/game costs and is not a performance acceptance. No game cap change, simplification or memory approval follows from this review.

`render-candidate.json` is honestly non-executable: paths describe arrays, matrices are JSON numbers and material keys still say HOLD. Before native use, reconstruct the exact typed arrays, use Uint32 indices, Float32 instance matrices, complete matching geometry/material resources and a public validated RenderSnapshot/InstanceBatch. Do not run this metadata object as if it already were the validated public snapshot. No hidden renderer fallback or private Three mesh path is needed or authorized.

## Minimum next proof contract

1. Freeze one materialized public snapshot and the served renderer/package closure. Include explicit opaque-projection disclosure, white neutral material/instance multipliers for exact stored vertex colors, actual resource/batch/presentation flags and complete hashes. Validate the public snapshot with declared technical-proof budgets; do not alter game budgets.
2. Export and bind the actual game Natural ground/material/light/tone/fog/shadow and camera inputs for any game-comparison claim. This closure is presently absent. Ground/contact cannot be replaced by an unlabelled blank plane or inferred from geometry bounds.
3. Retain the proposed 1600×900 DPR1, tile64×32, Normal1.5 and whole-subject close3.4 contract; fixed azimuths45/135/225/315 plus independently drawn held-out angle. **The public camera helper itself always initializes positive-X/positive-Z 45° and exposes no azimuth argument.** Future capture code must explicitly apply and record each camera orbit, retaining the intended frustum/elevation, and compare to independent analytic basis/frustum/vertex projections. Repeated 45° images with different labels would fail. Expectations must not call the checked decoder or camera projection helper.
4. At native proof inspect every original at both scales, full silhouette/base/ground and all angles; bind source/snapshot/actual matrices/backend/GL/image hashes and finite owned-process cleanup. Root must separately grant that run. This source verdict is not a grant, art acceptance, input-flow proof or full game/engine readiness.

The change in mechanism is meaningful: an unchanged externally authored artifact tests import/presentation independently of the failed procedural sculpting routes. Its useful result can establish a known asset baseline and isolate where fidelity is lost. It cannot resolve the original-art requirement by relabelling third-party art, nor justify another parameter search. The strongest proved result now is faithful static occupancy and stored-color preparation under one documented overlap convention; exact optics and native game-context behavior remain the precise gaps.
