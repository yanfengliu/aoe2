# Review 69: implementation

## Target

2026-10-20; M27 candidate 5 of 5; frozen reference `C:/Users/38909/Documents/github/aoe2/tmp/visual-gallery/2026-10-18/56-fire-caster-m12-frozen/reference/frozen-original.png`; seven native `m27-c5-astra-finished-head-{hero,side,opposite,rear,top,low,hero-reduced}.png` under `C:/Users/38909/Documents/Codex/2026-10-18/voxel-art-reference-proof/outputs/renders/`; exact inspected bytes identified below.

## Reviewers and coverage

Independent reviewer `/root/fresh_art_reassessment` inspected the reference and all seven native candidate images individually with view_image, with comparison to previously inspected C2 originals; no source/runtime inspection and no root verdict supplied.

## Reports

### fresh_art_reassessment

FAIL: the fifth candidate does not meet the finished-quality head benchmark, irrespective of its filename.
It restores a more coherent animal silhouette than C3/C4 and presents a cleaner hero view, with a recognizable open mouth, narrower jaw, backward projections and quieter broad color.
Against C2, that cleaner presentation does not resolve the anatomical relationships: the brow merges into the skull roof, the bright outlined eye still lacks a convincingly modeled surrounding socket, and the cheek-to-hinge transition remains a soft rounded swelling.
The long muzzle and lower jaw retain simple rounded profiles rather than the reference's compact hierarchy of overlapping masses and deliberate unequal changes of direction.
Material clusters frequently stand in for form: the top exposes a conspicuous square yellow patch on the muzzle bridge and a broad rectangular red rear patch, while the cheek highlights read as attached color panels.
The hero's relative quiet does not persist around the object: the opposite, rear and low views remain dominated by regular stepped stripes over the cheek, jaw and skull, obscuring anatomical surfaces instead of articulating them.
The rear has complete visible volume but still lacks deliberately resolved transitions around the crest roots and rear skull, and the low view exposes a broad rounded jaw with the same layered surface treatment.
At reduced size the head remains recognizable, but its eye and teeth are the strongest landmarks while the brow, cheek and hinge merge into one large orange region.
The supplied change in ambient occlusion is an explicit comparison limitation, so cleaner appearance is not treated as proof of improved sculpture; the remaining failures are visible directly in C5's own views.
The bounded five-candidate run therefore ends without an independently accepted finished head sample, with no further experiment proposed by this review.

## Findings and disposition

| ID | Finding | Disposition and reason | Repair or follow-up |
|---|---|---|---|
| F11 | [Unfinished anatomical sculpture](#fresh_art_reassessment) | Reviewer REJECT; unresolved socket/cheek/hinge anatomy, color standing in for form, and unfinished reverse surfaces; root REJECT after separately inspecting all seven native originals | Preserve this final rejection and the five-candidate outcome |

## Verification

Visual inspection and SHA256 hashing only, bounded to the listed PNGs; author reports AO disabled with other rendering/camera conditions held, which was not independently verified through source or runtime.

- frozen-original.png: 83BEA5C03C0293710B27578BC0B2D6CF86FBB47BBE987695F9A3A7B1861016EF
- m27-c5-astra-finished-head-hero.png: 3525B0EE607213259E83496EDFB20E1263B62F3CA3DCBEBC6A598244F9B636A1
- m27-c5-astra-finished-head-side.png: 9158BF830FA5DC1F1EBED261E974524355A1F237D230BF34D47B3DFF103BAA89
- m27-c5-astra-finished-head-opposite.png: A038C8800EA9BEBE70421B69A98CFAFB440A743D7ABF0BA594C2CFF554BA2713
- m27-c5-astra-finished-head-rear.png: C5804A4D8A301F3D3DD60F220B20C795CE37D8E9F087C1419891FBF24637E94A
- m27-c5-astra-finished-head-top.png: AC003AA6E940E830065816CE5AFEF746487B5F17E7EB1527FAB698EFACDAED4B
- m27-c5-astra-finished-head-low.png: 223268D151096888A2C0D4CE50F4EE3C2F1B6F95453D141EE9258A6C295B1A99
- m27-c5-astra-finished-head-hero-reduced.png: 255A951213A6293BBA11F22B0E580A7FCA04DAFF65CB20EF6B3722F696F17F7D

## Round outcome

Independent reviewer REJECT; F11 remains open; all five M27 candidates failed independent finished-art acceptance, and this bounded run is exhausted.
