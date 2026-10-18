# Work 135 — interim M11 native art review

Reviewed 2026-10-18 by native_art_acceptance. **Verdict: REJECT faithful reference-art quality.** M11 is a substantial visible improvement over the historical M06 study, including real articulated volume across the supplied angles. The current pixels still fail the frozen reference's meaningful shape, fine-structure and flame criteria. This is an interim review of named M11 bytes, not a completed worker handoff or a judgment on later work.

I formed this verdict without opening the worker's latest review verdict. I inspected the frozen reference and all 12 M11 PNGs individually through view_image with detail=original: matched, detail, reverse and all nine named multiview originals. All 12 hashes match their capture JSON pins. Before/after SHA256 reads of all 13 images and both capture JSONs found **zero drift**. The nine multiview filenames exactly match the nine captured entries. The replaced m11-angles-undefined.png was excluded; the correctly named set has no corresponding coverage omission.

## Bounded improvements and remaining findings

- **Real volume improves and passes the supplied-angle check.** M06's broad profile slabs have become separate head and lower-jaw masses, shoulder pieces, a bent segmented arm, torso, legs and feet. Caster-close and caster-side show joints and spacing; rear-oblique, opposite-side, overhead, low-up and the exploratory angle retain coherent thickness. This is not a close-view rescue or a flat picture that collapses when turned. Exact unseen reference back surfaces cannot be judged from its single frozen view.
- **Head, anatomy and voids still fail faithful reconstruction.** At the matched camera the head has a rounded, bulky upper mass, a heavily striped tapered nose and large contiguous white patches. The reference has a flatter, more broken arrangement of smaller stepped head/jaw forms. The new deep neck/mouth separation and large curled jaw change that arrangement. The torso and shoulder now articulate, but their stacked rectangular masses, slim waist and leg rhythm do not retain the reference's compact interlocking armor and negative spaces. Recognizable subject and approximate outer bounds are preserved; the internal form remains a different interpretation.
- **Fine structure improves, but its organization remains uneven.** Small stepped volumes, teeth, claws, joint breaks and raised armor now affect the silhouette. At native detail, repeated parallel grooves on the snout and jaw, layered shoulder blocks and dense speckled/ribbed patches on the limbs still dominate parts of the figure. These patterns provide activity without consistently reproducing the reference's unequal, interlocking chunks and color regions. The close views substantiate added construction, but do not make it faithful.
- **Flame remains a material blocker.** The M06 rounded bulb has become a stepped three-dimensional blast with some projecting white pieces. The matched/detail view still shows large smooth orange/yellow bands and a few very large white blocks at the tip. Overhead and opposite-side confirm a regular broad envelope around a clean dark-red connector. The reference's finer uneven tongues, deeper local breaks and fragmented bright cores give stronger directional motion. M11's few large masses do not reproduce that shape language. This is implied motion in static art, not an animation requirement.
- **Value hierarchy improves, but remains incomplete.** Dark red sides and undersides separate from brighter orange upper forms more clearly than M06. However, large white head patches and the broad pale flame region flatten local detail and draw attention away from the reference's finer yellow/white accents and dark recesses. The pool remains a regular concentric/tiled platform rather than the reference's less regular distribution. The scene contains the subject, staff, sparks, blast and pool, but its density of purposeful small forms remains lower.

No camera evasion is needed to explain rejection. The M11 matched capture records the same position [264,188,300], target [64,48,0], span 165 and 685×419 dimensions as the retained M06 matched settings. Supplemental fitted cameras vary as allowed. Lighting settings differ from M06, so this review does not attribute the whole visual change to geometry or to a renderer change alone.

## Bounds and engine scrutiny

The current artifact proves more capable three-dimensional construction and readable value separation than M06. It does **not** prove faithful Voxelnauts reference quality. The remaining blockers are visibly the organization of forms, flame breakup and color/value placement. Pixels alone establish neither a missing engine capability nor the necessity/correctness of any engine edit; no controlled same-geometry comparison was performed here. No engine blocker follows from this review.

No product/source changes, capture, browser, GUI, server or runtime gate was run. Source provenance, engine gates, reproducibility, reusable engine work, performance and game readiness are outside this visual review. Only this authored review was written. Root must compare these exact hashes with the later immutable handoff packet before reusing this verdict. The ongoing human-authorized worker is not declared finished.

## Exact inspected bytes

Root: C:/Users/38909/Documents/Codex/2026-10-18/voxel-art-reference-proof/outputs/. Hashes below were identical before and after native inspection.

| Input | Native size | SHA256 |
|---|---|---|
| reference/frozen-original.png | 685×419 | 83bea5c03c0293710b27578bc0b2d6cf86fbb47bbe987695f9a3a7b1861016ef |
| renders/m11-matched.png | 685×419 | e6b7a5a88c20fe3d7ba077b5d64ac51a500ad505717881be6a688d895becf147 |
| renders/m11-detail.png | 1370×838 | 9aa1017e2a0db47b5fcaf71ffabc4984ed167df4f24716a5377a4ab2ce952dc9 |
| renders/m11-reverse.png | 685×419 | d648f0188856a5039d203a2c1a75dfc0ae3ffdf4130ed679a4048c42efac76fb |
| renders/m11-multiview-front-oblique.png | 800×600 | 78574448c17cb3b60e0e062c2bb8167141df0210f839dcdaa59b500ef3f4b14e |
| renders/m11-multiview-rear-oblique.png | 800×600 | e59c9c8f14d45302b485d1b871057d8352d00c8296146f011ee09810dd5ed1c8 |
| renders/m11-multiview-spell-end.png | 800×600 | ac4d802cc58f2d6dbe7d0c95a204856bb03c5872e32a4b4e5b5484ab1a725e7b |
| renders/m11-multiview-opposite-side.png | 800×600 | d68f229fd98547ab54b207089445627766cab9ec55dd29317db5d3cbfd4a6a0b |
| renders/m11-multiview-overhead.png | 900×700 | 675f66635a42ca247b03e41e088de4c35a4897a32f83347cf670c7b13cd0cddf |
| renders/m11-multiview-caster-close.png | 700×700 | 0823fee8d69a1e8f311d01a5669867c26bb623b185a201bf07957765ff37404d |
| renders/m11-multiview-caster-side.png | 700×700 | aa4fe746bd973eaa7c88cb6b8031dec22c1265b27865beb0bdecf1f87155dc2f |
| renders/m11-multiview-low-up.png | 800×600 | a2b5059508686b1b28fea54fee6e88b408783ac6378ac47e82e263a5a558a6a9 |
| renders/m11-multiview-explore-seed-20261018.png | 800×600 | 8aef3f3b09a799cc8c3cc78ad9e2bd0e0882c886f24aeba9a197228b89d37c1d |
| renders/m11-capture.json | 3 image pins | 2f49ddd566d752c795fab689b0ed3303563015a7fd603c9cdf8d5f61b9d026a3 |
| renders/m11-multiview-capture.json | 9 image pins | 4fddec2ab5887f24362b75af96da4ba4747536fd1f01b9d10a46d09372576b77 |

The M06 comparison is bounded by the five exact originals inspected in this reviewer's earlier historical review, 2026-10-18_successor-native-art.md. It does not rely on a latest-file alias or a worker summary.
