# Review 35: implementation

## Target

M18 early coarse head/root major forms, reviewed 2026-10-18 against the frozen original reference. Repository base: `aoe2` main `67e5493abdcee9e5343226ee8bf16a4324179a7b`. Actual retained target: `C:/Users/38909/Documents/Codex/2026-10-18/voxel-art-reference-proof/outputs/renders/m18-capture.json` and its eleven original PNGs. Reference: `outputs/reference/frozen-original.png` under the same proof directory. Exact hashes appear below.

This is a head-form gate only. Fixed capture settings remain the comparison boundary. Fine eyes, teeth, scutes and inlays are intentionally absent and are not rejection reasons. The assigned M16 flame, pad and staff controls are outside this gate; full fidelity is not accepted by a coarse-form pass.

## Reviewers and coverage

Fresh independent native visual reviewer `/root/m18_fresh_native_review`. Read relevant repository instructions, lessons and fleet review format. Viewed the reference and all eleven actual M18 PNGs individually through `view_image` with `detail: original`, including matched, front-oblique, opposite-side, rear-oblique and overhead. Formed and sent the first verdict before consulting any producer review or root verdict. No prior reviews or M17 comparison images were consulted. No implementation, source audit, recapture, browser, GUI or server was used.

## Reports

### Fresh independent native visual reviewer

**Subject category: PASS.** The required five angles consistently show one head and continuous root emerging from the ground. Matched, caster-close and caster-side show an open mouth with visible upper and lower depth; opposite-side and rear-oblique carry that reading around the object. Overhead shows the head mass attached to the same root footprint. I see no humanoid arms, hands, paired legs or boots in these views. This accepts the subject category, not anatomical fidelity.

**EARLY HEAD MAJOR FORM: REJECT.** F11 remains material. In the reference, the swept crest, cranial/brow bulk and projecting muzzle create distinct changes of mass and direction. M18 matched, detail and caster-close instead present a long, broad upper roof with a swept triangular rise running into the muzzle. Caster-side is decisive: the upper contour descends almost continuously toward the nose, while the underside stays a long ledge. A rounded/downturned muzzle end exists, but it does not establish a separate cranial-brow mass behind it. Opposite-side, rear-oblique and overhead corroborate the dominant roof/wedge reading rather than correcting it from another angle.

The lower jaw is a bounded gain within the coarse contract: caster-side, opposite-side and matched show a shorter jaw, angled and turned at its tip, rather than two equally long parallel shovels. However, its rear attachment still reads as a narrow junction under the broad roof, without a localized cheek/hinge mass separating skull, jaw and root. This is a major-form relationship, not a request for facial detail.

The root also has useful coarse form. Matched and caster-side show unequal sections and a pronounced bend; rear-oblique, low-up and the seeded exploration view show a changed contour continuing into a flared ground contact. Overhead corroborates an irregular footprint. These observations satisfy the broad bent-root/ground-flare relationship for this early review. Smooth faces alone are not a failure at this stage.

Spell-end is strongly occluded by the held spell control and contributes little head evidence. Front-oblique supports subject continuity but is less diagnostic than the isolated close views. No conclusion rests on that obscured view, counts, a cage, unseen geometry or a watertightness claim. No clipping finding is made.

**Full fidelity: REJECT / remains unaccepted.** The upper skull and hinge finding remains open. F12 flame and F13 pad remain rejected controls outside this head gate; this review does not reopen or independently reaccept them.

## Findings and disposition

| ID | Finding | Disposition and reason | Repair or follow-up |
|---|---|---|---|
| F11 | Dominant upper roof still replaces distinct crest, cranial-brow and muzzle masses; cheek/hinge remains weakly localized. | Reviewer recommends unresolved; early major-form gate rejected on native image evidence. Integration-owner disposition remains theirs. | Rework coarse skull/hinge relationships before detail; re-review actual matched and side/rear/overhead outputs. Preserve the accepted subject and bounded jaw/root gains. |
| F12 | Flame fidelity control. | Existing rejection carried; outside this head-form review. | No acceptance change. |
| F13 | Pad fidelity control. | Existing rejection carried; outside this head-form review. | No acceptance change. |

## Verification

Verified reference, capture JSON and eleven PNG SHA-256 values before and after the native inspection; all thirteen remained unchanged and the image digests matched the capture manifest. Base HEAD was confirmed. Raw digest evidence is retained only in ignored `tmp/work135-m18-review/rawdigest.json` for the active task. The reviewer launched no browser/GUI/server processes. No tests, CI, full gate, source or capture mutations were performed; this is visual evidence only, bound to the bytes below.

| File | SHA-256, identical before/after |
|---|---|
| frozen-original.png | `83bea5c03c0293710b27578bc0b2d6cf86fbb47bbe987695f9a3a7b1861016ef` |
| m18-capture.json | `34b8ddcd378717fdcf04437df4fc65ea67b700d7567781570ef15188c0f60196` |
| m18-matched.png | `fdf48f6a7c351f5d66e6dbc76591251b94ce52166c44211203cf3953371b2339` |
| m18-detail.png | `6ae34cb7a71dbd5f80fa1c90e29ad5e951a43b4a6f8cc58c251bc4d7e76e20be` |
| m18-front-oblique.png | `c5ba42b571d7a79582496617ee20c76b93825e66257c58286730d4a59e73974a` |
| m18-opposite-side.png | `d4425697b7071a19538dcc1a710d4f8cf9a2daca60a4efb3dbb10f7633625ea4` |
| m18-rear-oblique.png | `8cbbb2640a586fd073f8e9ebe7e033436adb6a62fa789805a9d9cf7f6fdfdf41` |
| m18-overhead.png | `9c0d77e6f61b2147eda1f3998a409553bc8c11fa243d71d3be9580ff17d8bb5a` |
| m18-spell-end.png | `190a5c736ce1742bed3b85f89e331658fb6d84c3a8ea3b87bd075bd552209b1f` |
| m18-caster-close.png | `199b6b32df6c02e4fdc49c44b15eb0d58c313368335c52fb80c8454903c89b9c` |
| m18-caster-side.png | `c6421a7caf1f2c9e4f894b43a7919a7803864760604cb9bcdb202d96db6e3a02` |
| m18-low-up.png | `6b7815b76a58251c67914aa2325fe5323ac13cb6d18c2a5484a82a9012f34d18` |
| m18-explore-seed-20261018.png | `7700e388f239b3af1d95e7cf395586d144445e3bb4e6731c17943cdad7c069f6` |

## Round outcome

Subject category PASS; early head major forms REJECT; full fidelity REJECT/unaccepted. Preserve the shorter angled jaw and bent root gains, but resolve F11's upper cranial separation and localized hinge before advancing to facial detail. F12/F13 remain rejected outside this gate. This conclusion belongs to the inspected M18 bytes only.
