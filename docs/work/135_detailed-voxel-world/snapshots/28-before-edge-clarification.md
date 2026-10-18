# Review 28: implementation

## Target

Full reference-fidelity review of the actual standalone M15 native output under `C:/Users/38909/Documents/Codex/2026-10-18/voxel-art-reference-proof/outputs/`. The recoverable raw target is the eleven `renders/m15-*.png` originals and `renders/m15-capture.json`, SHA256 `26ac42bbdb58bcf1c607f63a271824fc8e187d3f5b81c0bbc4c1f34468815bc0`, with exact image digests below. The existing implementer owns retention and the packet freeze; this review does not claim that a later packet manifest was already finalized. No image bytes enter Git with this report.

The target remains the frozen 685×419 reference, `reference/frozen-original.png`, SHA256 `83bea5c03c0293710b27578bc0b2d6cf86fbb47bbe987695f9a3a7b1861016ef`, interpreted by the user's explicit correction as a dragon head emerging from the ground, without a humanoid body, arms, hands or paired legs/feet. The matched record uses position `[264,188,300]`, target `[64,48,0]`, span165 and daylight false.

## Reviewers and coverage

`/root/art_construction_search`, independent native visual reviewer, 2026-10-18. Inspected all eleven actual original M15 PNGs and the frozen reference at native resolution through `view_image`: matched, detail, front-oblique, opposite-side, rear-oblique, overhead, caster-close, caster-side, low-up, spell-end and seeded exploratory view. The historical “caster” filenames do not determine subject acceptance.

The verdict was formed and sent to root before any worker review or root verdict was consulted. Root subsequently shared an independently agreeing verdict and allocated F11–F13; that did not alter this authored judgment. No fresh M14 comparison, source/build audit, authoring, capture, browser launch or gate run was performed. The post-capture ROI investigation is outside this art review.

## Reports

### /root/art_construction_search

**REJECT full reference fidelity.** M15 retains the corrected emerging-head subject and coherent full 3D. Its mouth is an actual opening, the jaw connects coherently, and the broad continuous neck/base contains no humanoid limbs or paired boot contacts across the required five angles. Those are bounded gains. They do not establish this reference's proportions, major forms or value grouping.

**F11 — the head/neck construction and value groups remain materially different from the reference.** In the native matched/detail/caster-close images, a broad domed crown, long continuous cheek band and large crescent lower jaw dominate the head. The reference instead has a jagged swept crest and shorter intersecting red/gold/cream planes. The side view exposes a few large horizontal bands and broad plain throat surfaces; the rear-oblique view shows the tall neck as a largely regular slab with sparse lateral fins. The base flares like a pedestal rather than carrying the reference's irregular overlapping emergence forms into the ground. The neck's broad gold front, large cream inset and dark rear strips organize the sculpture into a few large vertical/horizontal regions. Fine voxel stairs along their edges do not supply the missing major volume and value relationships. The category still reads as an emerging dragon head; this finding concerns the reference-specific form, not a return of the humanoid error.

**F12 — the flame's major envelope, scale and bright grouping remain wrong.** The matched original has a large rounded, almost capped volume, with several very large white patches laid across a broad pale-yellow end. Its rightmost portion meets and is clipped by the right image boundary, whereas the reference leaves a visible gray margin beyond its irregular hot tips. The detail and spell-end originals confirm the few large round bright regions. Overhead, opposite-side and rear-oblique expose broad axial color bands and a comparatively plain warm rear envelope. The reference's smaller interlocking orange/yellow blocks, broken bright passages and uneven projecting tips are not reproduced by this swollen body. Stronger white contrast is a bounded gain over a weak core; its present placement and volume still fail the target.

**F13 — the pad has a coarse lattice and different edge/value structure.** The native matched/detail pad uses broad rectilinear white/cream strips and large repeated rectangular patches. Overhead makes its near-rectangular patch grid and scattered dark edge fragments particularly clear. The reference's ground patch is a compact irregular warm mosaic, with unequal hot islands and a more continuous broken red perimeter. M15's pad is visibly patterned, but that pattern and its large bright group sizes change the ground transition and scene balance. This is a composition/material-layout difference, not a request for more tiny decoration.

These three failures are visible at the fixed matched size and persist in the supplementary views. No close-only rescue, part names, voxel counts, connectivity result, capture success or cleanup claim was used as art acceptance.

## Findings and disposition

| ID | Finding | Disposition and reason | Repair or follow-up |
| --- | --- | --- | --- |
| F11 | Reference-specific head/neck major forms and value groups differ. | Material reviewer finding; integration-owner disposition remains separate. | Full-fidelity acceptance remains open. |
| F12 | Rounded oversized flame, broad bands/white patches and matched-frame clipping differ. | Material reviewer finding; integration-owner disposition remains separate. | Full-fidelity acceptance remains open. |
| F13 | Coarse pad lattice and edge/value structure differ. | Material reviewer finding; integration-owner disposition remains separate. | Full-fidelity acceptance remains open. |

## Verification

Before and after inspection, all eleven actual image SHA256 values matched their capture-record pins. The capture-record and reference digests were also identical before/after. Zero mutable-file drift was observed. The exact reviewed PNG hashes are:

| Native original under `renders/` | Actual SHA256, stable before/after |
| --- | --- |
| `m15-matched.png` | `d19597e35a2dc8e9fc31c89196e82a057ecd7c3356e188db3103e0915f5c8cfa` |
| `m15-detail.png` | `1c79bf0c48a9c6075c81f886d538be377c1e7a5cecc819106302735fc185a30e` |
| `m15-front-oblique.png` | `07d6b14d704675988a80021e6ea100cb47e34e93285c06c2bcd118bac18d24ff` |
| `m15-rear-oblique.png` | `d4a42b45910e16f3e0b78f91a32ad55c9c3693db29b287cd0649e606efafbe7d` |
| `m15-spell-end.png` | `8ac3d8b7cd2ca3f8cbde3d72df8c2484b7803fab4d29fce44f64f7dee56185dc` |
| `m15-opposite-side.png` | `8a187b9abd6dd9e4882a35a42c6cef3206caa30e110203292361911b2689d1ea` |
| `m15-overhead.png` | `c7a5ae488008f363c448845921fd82eb4ebe2993229cdadc630b1aa63ae68322` |
| `m15-caster-close.png` | `770a9adb9358639716147d82ec79b3b018829118ef94f38a4f8f338b7d77a3d9` |
| `m15-caster-side.png` | `fa29bdad9d5f605a1de25bcf89418ec5526eddfb7c7e11a7e4a9da637e69c61b` |
| `m15-low-up.png` | `75bf734846b6d3f46f22dc247464c81768ed9b8712e80c4d4321512213e30fc0` |
| `m15-explore-seed-20261018.png` | `bc84e1ee5f4b884bee0a7b2c20933beca26919ab4aab20f816b86be21dc8ba9f` |

This verifies the record-to-PNG binding and pins this visual verdict. It does not independently prove the claimed unchanged engine-build/light/render implementation, fresh pixel reproducibility, hidden internal geometry, watertightness, animation, production performance or game integration. No product tests or runtime gates were run for this read-only artwork review. No task-owned browser, server or GUI process was created.

## Round outcome

REJECT M15 as a faithful reproduction of the frozen reference. Preserve its corrected subject and actual 3D as bounded gains; retain the exact rejected candidate and review evidence. F11–F13 remain material full-fidelity gaps. The earlier rough-subject pass is not broader art approval, and no final reference, engine or game-readiness claim follows from this round.

