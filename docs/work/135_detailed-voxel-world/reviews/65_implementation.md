# Review 65: implementation

## Target

M27 candidate 1 head sample against the frozen original reference. The retained native image paths and exact SHA256 digests appear in the authored report below; source code was outside this visual review.

## Reviewers and coverage

Independent reviewer `/root/fresh_art_reassessment` inspected the reference and all seven native candidate images. The integration owner supplied root's REJECT disposition for this preservation record; no additional root report or review coverage is inferred.

## Reports

### fresh_art_reassessment

2026-10-20. Verdict: FAIL for a finished-quality original voxel dragon head sample. This is a bounded form improvement over M25/M26, not artistic acceptance.
Viewed the frozen original at `C:/Users/38909/Documents/github/aoe2/tmp/visual-gallery/2026-10-18/56-fire-caster-m12-frozen/reference/frozen-original.png` and all seven native candidate PNGs under `C:/Users/38909/Documents/Codex/2026-10-18/voxel-art-reference-proof/outputs/renders/`: `m27-c1-implicit-head-{hero,side,opposite,rear,top,low,hero-reduced}.png`. Images were inspected individually with view_image. No source, runtime, Git or browser inspection informed the verdict.
Gains: the head now has continuous volume, a recognizable projecting cheek, an attached lower jaw, two-sided eyes and nostrils, and narrowing backward projections. The open mouth and dragon-like silhouette survive reduced display size. It no longer reads primarily as M26's assembled shelves.
Largest gap: broad rounded masses still read as a preliminary sculpt. The long blunt muzzle and swollen lower jaw have little secondary shaping; the rounded rear cranium dominates the hero and rear views. The reference's compact, forceful, layered skull hierarchy is missing.
The brow is substantial but reads as a large smooth band. The eye reads mainly as a dark circular patch with a white center; its enclosing socket and lid are not convincingly resolved. The cheek-to-jaw transition is a rounded swelling rather than a purposeful change of planes.
The rear is especially unfinished: a large uninterrupted red mass receives thin pointed extensions. Their roots have little sculpted integration. The top view exposes a broad slab-like rear plan and simple pinching into the muzzle, without convincing secondary skull structure.
Terraced surface bands remain prominent across the brow/muzzle and low cheek. Regular speckles and striped color interruptions add visual noise without describing anatomy. These marks remain visible at reduced size. The palette has fewer overwhelming white areas, but its boundaries do not yet consistently explain form.
The mouth has real space and an attached jaw, but the broad lip contours remain too smooth and uniform. The sparse bright teeth read as isolated pegs rather than a deliberately composed mouth.
Most useful bounded correction: reshape the existing cheek, socket, jaw hinge and rear crest roots into distinct interlocking anatomical volumes, with sharper transitions and tapered terminations; then simplify surface color. More fine voxels or more surface marks alone will not close this gap.
The views support a genuine 3D improvement, but not a finished head. No neck, effects, whole composition, game-readiness or unseen reference geometry is accepted by this review.
SHA256 of inspected PNGs:
- frozen-original.png: 83BEA5C03C0293710B27578BC0B2D6CF86FBB47BBE987695F9A3A7B1861016EF
- m27-c1-implicit-head-hero.png: 53C0D1D692F5B0BCDE8C86FBA4FF60CAF0F0F4A3639278FBE18BE7E8B5EB671A
- m27-c1-implicit-head-side.png: 3264BE1E24B9118428BE5CE16D0DEE91CE86F937AA4ABDF0AB273D166BF43612
- m27-c1-implicit-head-opposite.png: 4BA76745D3080715A8506FDAC9D72A19B7A65E68C21C71CDAA41AB5479C2D1DC
- m27-c1-implicit-head-rear.png: 347D480138DF44B3CB238D0CF7111D41DBDA4DFA53A6CF7375D2B02F3D9EFE63
- m27-c1-implicit-head-top.png: 28FAD39EF8708EC6CD18A8938EA4E5E1004FF80A8EEAC88155E3C83D38131ED1
- m27-c1-implicit-head-low.png: 6F68975CE1CA80B2B6F8D9F05E617268DA2E5333A6E9FBAE8CA73CB425607F31
- m27-c1-implicit-head-hero-reduced.png: 0A290FA43AE31EA9DAAE59D2264CECEF61B561B76871ED48D2C6A864A08AE1ED

## Findings and disposition

| ID | Finding | Disposition and reason | Repair or follow-up |
|---|---|---|---|
| F11 | [Unfinished anatomical sculpture](#fresh_art_reassessment) | Unresolved; root REJECT and reviewer REJECT. Continuous volume has not resolved the socket, cheek, jaw and crest relationships. | Retain this rejection; later candidates require their own review. |

## Verification

Individual image inspection and image hashing only, bounded to the listed bytes and viewpoints. No source, runtime, Git or browser verification; no new visual pass was performed during formatting.

## Round outcome

Root REJECT; independent reviewer REJECT. F11 remains open. No finished sample or expansion accepted.
