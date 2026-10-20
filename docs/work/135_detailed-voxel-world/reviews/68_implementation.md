# Review 68: implementation

## Target

2026-10-20; M27 candidate 4 of 5; frozen reference `C:/Users/38909/Documents/github/aoe2/tmp/visual-gallery/2026-10-18/56-fire-caster-m12-frozen/reference/frozen-original.png`; seven native `m27-c4-astra-local-voxel-head-{hero,side,opposite,rear,top,low,hero-reduced}.png` under `C:/Users/38909/Documents/Codex/2026-10-18/voxel-art-reference-proof/outputs/renders/`; exact inspected bytes identified below.

## Reviewers and coverage

Independent reviewer `/root/fresh_art_reassessment` inspected every listed image individually with view_image and compared against the previously inspected C2/C3 originals; no source/runtime access, no root verdict supplied.

## Reports

### fresh_art_reassessment

FAIL: C4 is a substantial regression from C2/C3 as a finished dragon-head sample.
The bounded gains are quieter surface color, fewer fine terraces/speckles and clearer large voxel steps, while the mouth remains legible.
Those steps form rectangular masonry: the hero muzzle is stacked shelves with upright slabs, the side cheek is a block wall, the rear is a box with tabs, and the low view exposes a layered rectangular underside.
The top view has an almost rectangular footprint and rectangular color regions, with little narrowing or anatomical variation in the skull and muzzle.
C2's soft volumes and C3's broad surfaces were unfinished, but both retained a more coherent animal silhouette than C4's large right-angle protrusions.
The eye remains a dark rectangular frame and bright mark surrounded by ledges; no convincing socket, cheek, jaw hinge or crest-root anatomy has emerged.
At reduced size the object reads as an assembled block head, whereas the frozen reference retains compact overlapping masses and deliberate directional changes.
The new visible surfaces therefore do not solve F11 and directly meet the rectangular-masonry disqualifier.
I cannot identify a plausible local correction that would turn this candidate into a finished result within one remaining attempt, because its primary skull, muzzle, cheek, jaw and crest relationships all require redesign rather than localized finishing.

## Findings and disposition

| ID | Finding | Disposition and reason | Repair or follow-up |
|---|---|---|---|
| F11 | [Unfinished anatomical sculpture](#fresh_art_reassessment) | Reviewer REJECT; anatomical planes replaced by rectangular masonry; root REJECT after separately inspecting all seven native originals | Retain rejection; no credible local finishing correction identified |

## Verification

Visual inspection and SHA256 hashing only, bounded to the listed images; no source, runtime, browser, topology or artistic-acceptance claim derived from the reported authoring method.

- frozen-original.png: 83BEA5C03C0293710B27578BC0B2D6CF86FBB47BBE987695F9A3A7B1861016EF
- m27-c4-astra-local-voxel-head-hero.png: 0FD732BD693DCC449A83F63C3CE17F7FB6C4D8284E567886C6926E8CA01E5CEB
- m27-c4-astra-local-voxel-head-side.png: 876AB77FC98D8CBE44B18F9EC1CF15FE8A970344308B1E7D55142B05BA54B9C3
- m27-c4-astra-local-voxel-head-opposite.png: 1D1F45F962515AFE8F3F69D5BFC8157CBE936BEBDE1CE524C7D8DB216F5D213F
- m27-c4-astra-local-voxel-head-rear.png: 83D4E073DB598B4F52188EAA24CA61F8D67A1E0194901AFFEE160D3FB18CE695
- m27-c4-astra-local-voxel-head-top.png: 0C5C1999CC029C120F8BE2D9B2E23BA4C932B58E9052B56A8561A94F85E066FE
- m27-c4-astra-local-voxel-head-low.png: 576CC0F663A1FBF5F37B65D1ADE1FB08266740FE8C02A3F3E5A24FF2B87A717C
- m27-c4-astra-local-voxel-head-hero-reduced.png: 99C823717DA20E9731B3023AEBDD0BCA8FCC78B5B97CAC102D898E0E0C69BCE6

## Round outcome

Independent reviewer REJECT; F11 remains open; one candidate remains, with no evidence-backed local route to finished quality identified here.
