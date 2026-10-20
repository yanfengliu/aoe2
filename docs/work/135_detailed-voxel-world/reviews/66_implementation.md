# Review 66: implementation

## Target

M27 candidate 2 head sample against the frozen original reference and the previously inspected candidate 1. The retained native image paths and exact SHA256 digests appear in the authored report below; source code was outside this visual review.

## Reviewers and coverage

Independent reviewer `/root/fresh_art_reassessment` inspected the reference and all seven native candidate images. The integration owner supplied root's REJECT disposition for this preservation record; no additional root report or review coverage is inferred.

## Reports

### fresh_art_reassessment

2026-10-20. Verdict: FAIL for the finished-quality head sample. The result remains a preliminary sculpt despite bounded silhouette gains.
Inspected individually with view_image: frozen original at `C:/Users/38909/Documents/github/aoe2/tmp/visual-gallery/2026-10-18/56-fire-caster-m12-frozen/reference/frozen-original.png`; all seven native files `m27-c2-astra-head-{hero,side,opposite,rear,top,low,hero-reduced}.png` under `C:/Users/38909/Documents/Codex/2026-10-18/voxel-art-reference-proof/outputs/renders/`. C1 comparisons use the seven originals inspected for review-c1.md. No source or runtime inspection.
Gains over C1: the lower jaw is narrower, the rear silhouette is less swollen, the crest roots are larger and more integrated, and the top view has a more purposeful outline. The mouth and silhouette remain readable when reduced. Removing the large nostril patches also reduces one distracting graphic feature.
These images do not establish meaningful local plane sculpture. The hero brow and muzzle are still rounded mounds with concentric terraces; the cheek is a round lobe; the lower jaw is a tapering rounded tube. The low view makes those primitive forms especially obvious.
The rear now contains more ridges, but its large red side remains poorly articulated. Added transitions do not give the eye, cheek, hinge and crest roots a coherent shared structure. The eye continues to read as an oval dark patch beneath a broad brow rather than a resolved socket with an authored rim.
The reference's compact, forceful layering and deliberate unequal changes of direction remain absent. At reduced size C2 reads as a long soft snout, circular cheek and thin jaw. Surface speckles and step bands survive reduction and compete with the anatomy.
Mechanism-level diagnosis from appearance only: local cuts have edited the silhouettes of soft assembled volumes without replacing the volumes' underlying surface language. A larger or smaller cut, finer voxels or extra ridge parameters would continue the same failure. This is the second candidate failing primarily for unresolved form, so a third parameter pass is not justified.
The useful authoring change is to create an original sparse polygon sculpture with explicit anatomical topology, then voxelize that authored volume. This must not be another cage lofted through repeated cross-sections.
Concretely, manually place a small 3D landmark network for the upper and lower socket rim, brow peak, cheek apex, jaw hinge, muzzle pinch, lip corners and crest roots/tips. Connect those landmarks into unequal planar patches whose junctions are the intended ridges and recesses. Give each region its own patch layout rather than applying a uniform triangulation or a repeated wedge template.
A brow should have a broad sloping crown, a shorter overhanging front plane and a recessed socket wall; the cheek should join these through a different oblique plane and end at a narrower hinge. Those shared edges and concave junctions are the authoring work C1/C2 still lack. Model both sides, underside and crest terminations through the same explicit topology.
Keep planes planar and preserve their intersections when sampling the voxel grid; do not round the new structure back into blended primitives. Assign quiet broad colors to anatomical surfaces, with sparse focal accents. This changes where shape decisions are made; merely converting the present rounded forms to triangles would change nothing.
Remaining difficulty: choosing convincing landmark positions and unequal facets is actual sculpting and may still fail. A new representation is not evidence of quality. The head must earn acceptance through its resulting form before expansion.
SHA256 of inspected images:
- frozen-original.png: 83BEA5C03C0293710B27578BC0B2D6CF86FBB47BBE987695F9A3A7B1861016EF
- m27-c2-astra-head-hero.png: 58E4CB2969C8911EB4DE2758687AED1CCD2AB576CC550E955B5B46D5770ACDDD
- m27-c2-astra-head-side.png: 9798A8846B26A9D63EFECB43C4E9B7EDB6C5D1CA33AD866346D8CA86CD7BEED8
- m27-c2-astra-head-opposite.png: 884747CBBD18057FAEC6ACAB94AAEB29A98BDBD40E256DB6AFF422FEFF24F60D
- m27-c2-astra-head-rear.png: 668DDBE46FB377ACEEA47DED307C7471B788C65B7BB4930213C0CB8CBCCA03D9
- m27-c2-astra-head-top.png: 87BBD66497101396E7EC6004D20F424302C12CD28A691F94289E058FAEB6FA75
- m27-c2-astra-head-low.png: A477A4E7DB2B39CB85B5F23AA58BB4A8B2A4EB8A2AEE8CA8B0019308729A7F6F
- m27-c2-astra-head-hero-reduced.png: 4D0D03F9FB2EB27ED4E5C0C1AD8CD0F4F12C189F2BE1150B8C892BAFA22F73AC

## Findings and disposition

| ID | Finding | Disposition and reason | Repair or follow-up |
|---|---|---|---|
| F11 | [Unfinished anatomical sculpture](#fresh_art_reassessment) | Unresolved; root REJECT and reviewer REJECT. Silhouette edits leave soft assembled volumes and unresolved anatomical planes. | Retain the repeated failure and mechanism reassessment; later candidates require their own review. |

## Verification

Individual image inspection and image hashing only, bounded to the listed bytes and viewpoints. No source or runtime verification; no new visual pass was performed during formatting.

## Round outcome

Root REJECT; independent reviewer REJECT. F11 remains open after a second candidate failing primarily for unresolved form. No finished sample or expansion accepted.
