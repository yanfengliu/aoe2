# Review 67: implementation

## Target

M27 candidate 3 head sample against the frozen original reference and the previously inspected candidate 2. The retained native image paths and exact SHA256 digests appear in the authored report below; source code was outside this visual review.

## Reviewers and coverage

Independent reviewer `/root/fresh_art_reassessment` inspected the reference and all seven native candidate images. The integration owner supplied root's REJECT disposition for this preservation record; no additional root report or review coverage is inferred.

## Reports

### fresh_art_reassessment

2026-10-20. Verdict: FAIL for a finished-quality voxel dragon head. Candidate 3 of 5; no later candidate considered.
Viewed individually with view_image: frozen reference `C:/Users/38909/Documents/github/aoe2/tmp/visual-gallery/2026-10-18/56-fire-caster-m12-frozen/reference/frozen-original.png`; all seven native `m27-c3-astra-sculpted-head-{hero,side,opposite,rear,top,low,hero-reduced}.png` under `C:/Users/38909/Documents/Codex/2026-10-18/voxel-art-reference-proof/outputs/renders/`. Comparison uses C2's seven originals inspected for review-c2.md. No source/runtime inspection.
Clear anatomical-plane finding: NO, the new surfaces do not solve the problem. Some broader flat transitions now exist, but the brow, socket, cheek and hinge still fail to read as distinct interlocking anatomical planes.
Bounded gains over C2: the isolated spherical cheek is less obvious, the eye is smaller and more expressive, the small nostril is quieter, and the jaw has more consistent depth. The silhouette and open mouth remain legible from both sides and at reduced size.
Largest regression: the head is more slab-like. The hero shows a broad continuous roof above a long horizontal brow band; the rear shows a blunt barrel; the top shows near-parallel rear sides and a broad squared muzzle. C2's cheek was too round, but C3 largely replaces it with an undifferentiated side wall.
The eye is still principally a dark outline and white mark on that wall. There is no convincing visible cavity joining an overhanging brow to a projecting cheek and narrower hinge. Making the eye smaller improves expression without resolving its surroundings.
The lower jaw reads as a broad flat tray in the hero/low views. Its upper surface is largely empty, its underside is blunt, and its attachment does not establish a strong hinge. The teeth remain isolated bright pegs.
The rear roof has a conspicuous rectangular red region, while the broad side and underside receive little intentional articulation. The backward crests taper but their bases and surrounding skull are not convincingly resolved.
Regular terraces remain the dominant small-scale feature on the forehead, muzzle and jaw; checker-like surface speckles remain on the cheek. These visible marks do not explain anatomy and persist when reduced. The frozen reference has a stronger hierarchy of compact overlapping forms and unequal changes of direction.
A bounded next correction would need to visibly replace the long uniform brow band and side wall with an overhanging brow, recessed socket wall, projecting oblique cheek and pinched hinge, while narrowing the tray-like jaw. This is a precise unresolved shape relationship, not a request for more detail or a new general algorithm.
The new surface representation alone provides no artistic acceptance. The current rendered result remains a blockout with surface patterning; no expansion is supported.
SHA256 of inspected PNGs:
- frozen-original.png: 83BEA5C03C0293710B27578BC0B2D6CF86FBB47BBE987695F9A3A7B1861016EF
- m27-c3-astra-sculpted-head-hero.png: DE5B8AB6446AB7ABDE21D0A86EB6A6B15201B85029FC76411651BFDE7A5A9159
- m27-c3-astra-sculpted-head-side.png: 6075519CEBE41737F643AA8CB8E37AC2C0DCE809A2702DD25C86C5575682884E
- m27-c3-astra-sculpted-head-opposite.png: EB4ACBD58F3196794B59825ECA71070D247AFA9D5D1330DE2D759015834A3DC8
- m27-c3-astra-sculpted-head-rear.png: A04FFAD4F9F81D2C5FE2C889702ACE601BFAD95AA25E4A20914AB8EA5F54EE8C
- m27-c3-astra-sculpted-head-top.png: BEFA46FA0F92D2FF46FBED3E7C392457EF2D098B8DD854B2B516DC698CE7EA6D
- m27-c3-astra-sculpted-head-low.png: D42B9D2B9C92B53D9E037C1D3F0560549218227D53514D72A9CA6E526ACB5A8F
- m27-c3-astra-sculpted-head-hero-reduced.png: E683C13F504379E593828B903DC84A7125A9BAEC6735EEC496FEB5AAF0E16DD5

## Findings and disposition

| ID | Finding | Disposition and reason | Repair or follow-up |
|---|---|---|---|
| F11 | [Unfinished anatomical sculpture](#fresh_art_reassessment) | Unresolved; root REJECT and reviewer REJECT. Broader surfaces remain slab-like and do not resolve the brow, socket, cheek and hinge. | Retain this rejection; candidate 4 requires a distinct review of its actual images. |

## Verification

Individual image inspection and image hashing only, bounded to the listed bytes and viewpoints. No source or runtime verification; no new visual pass was performed during formatting.

## Round outcome

Root REJECT; independent reviewer REJECT. F11 remains open. Candidate 3 is not a finished sample and does not justify expansion.
