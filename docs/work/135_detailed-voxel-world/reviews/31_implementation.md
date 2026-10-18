# Review 31: implementation

## Target

Actual standalone M16 native output under `C:/Users/38909/Documents/Codex/2026-10-18/voxel-art-reference-proof/outputs/renders/`: the eleven `m16-*.png` originals recorded in `m16-capture.json`, SHA256 `4cbe5cbfc2a6ef21e65b9c898cea7030f76db84e105db06491fda768f9b73b4e`. This is an artwork review of those exact bytes, not approval of a later packet or authoring source.

The unchanged 685×419 reference is `C:/Users/38909/Documents/github/aoe2/tmp/visual-gallery/2026-10-18/56-fire-caster-m12-frozen/reference/frozen-original.png`, SHA256 `83bea5c03c0293710b27578bc0b2d6cf86fbb47bbe987695f9a3a7b1861016ef`. The human's intended subject is a dragon head emerging from the ground, without a humanoid body, arms, hands or paired legs/feet. F11–F13, Review 29's relational-composition discriminator and the existing disqualifiers remain fixed. Matched settings recorded by the capture are position `[264,188,300]`, target `[64,48,0]`, span 165 and daylight false; this review did not independently reconstruct the camera or rendering implementation.

## Reviewers and coverage

`/root/fresh_art_effort_audit`, independent native visual reviewer, 2026-10-18. Individually inspected the frozen reference and all eleven M16 originals through `view_image` at their actual dimensions. The required subject sequence was matched, front-oblique, opposite-side, rear-oblique and overhead, followed by detail, caster-close, caster-side, low-up, spell-end and the seeded exploratory view. Historical “caster” filenames did not determine subject judgment.

The independent brief verdict was sent to root immediately after viewing, before authoring this report and before receiving a root or implementer verdict. No other M16 visual judgment was consulted. M15's actual native matched image was then reopened to check the stated gains; its SHA256 remains `d19597e35a2dc8e9fc31c89196e82a057ecd7c3356e188db3103e0915f5c8cfa`. The prior known-labelled M13 subject control was not rerun in this round.

## Reports

### Independent native verdict

**Corrected subject category: PASS. Full reference fidelity: REJECT.** Matched/front show a jaw returning into the head rather than an arm ending in a palm; opposite/rear show one continuous neck/base reaching the ground, without separated boot contacts or a pelvis/leg chain. Overhead confirms cranial depth and a single broad ground footprint, while being insufficient alone to identify the lower anatomy. Close/side corroborate an actual open mouth. This preserves the bounded subject correction. It does not pass the complete emergence-form contract: the support-column appearance remains part of F11 and prevents full acceptance.

**F11 — major forms and value relationships remain materially wrong.** Matched/detail/caster-close now show a large box-like cranium, blunt block muzzle, broad rectangular cheek regions and a heavy stepped yellow brow surrounding one oversized white rectangular eye region. The frozen reference's swept jagged crest and shorter intersecting red/gold/cream planes are missing. M16 changes M15's domed envelope, but angularity alone does not reproduce those relationships. The smaller mouth opening and shorter jaw are bounded changes; they do not establish the target proportions.

Opposite-side/rear-oblique expose broad plain red back/neck faces and a narrow support beneath the very large upper head. Low-up and the exploratory view preserve that head-on-support impression. The ground contact is continuous rather than humanoid, but the transition still reads as a column planted on a pad rather than irregular overlapping emergence forms. F11 therefore remains open. The construction has visibly changed, yet the relational-composition discriminator still fails; this is not a request to add tiny decoration to the same boxes.

**F12 — scale improves, but flame envelope and hot grouping still fail.** At the unchanged matched framing, M16's flame is smaller than M15's, and its white regions no longer occupy M15's huge front patches. Those are useful gains. Matched/detail instead show a few large squared yellow/orange lobes, with small white shapes that read as windows within broad pale faces. Front-oblique/spell-end expose the blunt grouped end; opposite-side/rear/overhead expose extensive plain warm sides and a regular block-like volume. The reference's interlocking warm blocks, broken bright passages and unequal projecting hot tips remain absent. Shrinking the previous swollen body has not supplied directional flame structure. F12 remains material on envelope and value organization; its earlier oversized footprint/white-patch wording is not carried forward as if unchanged. No clipping claim is made.

**F13 — lattice removed, but ground material organization still differs.** Matched/detail and overhead confirm that M15's broad rectilinear white lattice is gone. The perimeter is more continuously broken red, a bounded gain. M16 now reads mostly as one warm orange/yellow disc with several separated white islands. Front/rear reinforce that sparse island arrangement. The reference has compact unequal warm and cream regions interlocking across the patch, with a more varied angular rhythm around the emergence base. Removing the lattice does not yet reproduce that mosaic or scene balance. F13 remains open.

## Findings and disposition

| Finding | Disposition | Remaining material gap |
| --- | --- | --- |
| F11 | OPEN; full fidelity rejected. | Box-like head planes, eye/brow value block, column-like emergence and source-specific proportions. |
| F12 | PARTLY IMPROVED; OPEN. | Smaller footprint/white groups retained as gains; broad lobes, plain sides and hot-tip organization still fail. |
| F13 | PARTLY IMPROVED; OPEN. | Lattice removal and broken perimeter retained as gains; sparse white islands and uniform warm field still differ. |

No new finding ID is needed. These are the existing form, proportion and material-grouping failures judged on the actual successor. Geometry counts, cell names, connectivity claims and capture success were not used as art acceptance.

## Verification

Before and after native inspection, the capture JSON and all eleven actual PNG SHA256 values matched their recorded pins, and the reference remained unchanged. Zero input drift was observed. The record is `C:/Users/38909/Documents/github/aoe2/tmp/work135-m16-review/rawdigest.json`. Exact reviewed M16 bindings follow:

| Original | Dimensions | SHA256 |
| --- | --- | --- |
| m16-matched.png | 685×419 | `382bd91a74470712912b02e43a7d7032976472780a833fb2602e95360913d986` |
| m16-detail.png | 1370×838 | `95fe625b41be95299fa9e80c44084f32affe8bd6be71d45bb7ea6bc8479e6d25` |
| m16-front-oblique.png | 800×600 | `9e473ab9336703ccfa3f6af9bd682297454869d9e846d6cdf87ca5005f1b3736` |
| m16-opposite-side.png | 800×600 | `580e8c36b179b6045353fe825b6ade78b8e217e8ab0cb9402b8d2386163fb49d` |
| m16-rear-oblique.png | 800×600 | `4aa66181d9927dc6c04af5e627dfb57e16eb2f3a562f5d79b58e7e5f40eae209` |
| m16-overhead.png | 900×700 | `14b535501fe42354d08dd881df1a9a9a4b675d6598b2c15fd089a9653a293baa` |
| m16-caster-close.png | 700×700 | `c2c46fd588480813c4a7e19103b261ff459ad2ea9fbd5477b2bf54ed76f3f839` |
| m16-caster-side.png | 700×700 | `24d09cce2a1f8c747a4a67821585a263bed4d20896359c9c1e856d55323fe34b` |
| m16-low-up.png | 800×600 | `9e68fe98d20e0afd953960d322123879c64354eb29075e46b23d5b303e6de09d` |
| m16-spell-end.png | 800×600 | `59c93dafb8737e1ea043cd675850441fbc13b907751897b99f38422acdd19c27` |
| m16-explore-seed-20261018.png | 800×600 | `fe8246d52854498d6ecd3b630a40c9f7c2f9723dca33bd479090fbb01cd01643` |

Hash matching binds the verdict to inspected bytes; it proves no rendering parity or art quality by itself. No source/build-pin audit, fresh reproduction, pixel-confinement analysis, hidden-geometry/watertightness check, animation, performance, game integration, runtime test, CI or full gate was performed. No browser, GUI or server was created. Only this authored review and its ignored digest record were written.

## Round outcome

M16 preserves the emerging-head category and absence of humanoid limbs. REJECT full reference fidelity: F11–F13 remain material despite the smaller flame, reduced white flame patches, removed pad lattice and improved perimeter. Retain those bounded gains and the exact rejected evidence. This round grants no standalone full-art, engine or game-readiness approval.
