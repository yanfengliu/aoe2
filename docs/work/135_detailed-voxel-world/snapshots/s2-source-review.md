# S2 conifer boughs — independent source review

2026-10-18. **ACCEPT for the bounded meaningful S1 RED, restored S2 units and ordinary typecheck attempt only.** No material source-review blocker found. This is not geometry, performance, native-image or art acceptance. No product import, test, build, browser, server, Git, engine or gallery operation was performed; only source/evidence reads and this report write.

## Exact evidence

| Input | SHA-256 |
| --- | --- |
| S2 handoff.json | 1108a52f2a6fb9cc673e93938512a368aca2eab0767ad6a3d07b5f0be7375087 |
| S2 proposal.md | 6d1090c423aea4e99499d4d40ad84bf24d3d2f656db9a321b7b74ec4352c7ebe |
| S2 after-source48.json | 0c2d4ebbed7321ddb104060b7c50b8d12ab423287cb26dfbd94b85719b9e3672 |
| S2 scoped.diff | b1e97fc300ba212be1fae5db713d6f522392d8e175a95577185a5ec2dbe16b9b |
| ConiferConstruction, 89 recorded lines | 0d2a6745c037ad9d07d5a23c136d78b4fb82f5678d5d4249e0ae2d52d21ae270 |
| ConiferSculpture.test, 149 recorded lines | 95af321fbc3b6e7a27d2b03c5b0cac6b6b9c5db5ed7fff7fc605870dacea3a31 |
| Archived S1 construction for RED | a567afb621282c59056b0aaad7ec6b3e66cb514c3d5259c92932b3e6ee72d753 |
| Archived S1 three-test contract | 25186e748a388ef968d9a7fbb739cb3bfcb1f3de5d978d53c25db74f0b2778c5 |
| Independent first-Normal S1 rejection | 5252deab5b93123e062ec2c1dd7961843e7a54d44c8c149c1931a97dde5b7283 |
| Read public orthographicView.ts | 262021718a0eb6a156bdd3cbbae9f16b80b818c2683aaba4ea8804b7a7a040a2 |

S is `C:/Users/38909/Documents/github/aoe2-worktrees/sculpted-conifer-1018`; S2 evidence is `tmp/work135-sculpted-boughs`. I independently hashed all 48 live paths, all 48 candidate copies and all 48 archived S1 copies against the manifest, and every record listed by handoff.json. Exactly the construction and sculpture test changed; the other 46 are exact. The new test starts with the complete old three-test bytes, its tests-first copy matches, and the complete coniferColor tail is exact. The owner's separate 2,571-input check is retained evidence, not an independently repeated census in this review.

## Construction and bounds

The replacement directly addresses the rejected smooth-envelope mechanism: eight inner-crown sections support 12 primary lobes and five smaller tips, with six staggered wedge cuts. Bough axes are nonzero; fixed positive widths/rise/drop and the t<1 guard keep profile divisors positive. Heart section heights increase and half-extents stay positive. Wood/root classification occurs before the cuts, preserving the authored support formula. Connectivity after discretization and cuts still requires the unchanged flood-fill check; overlapping authoring coordinates alone are not proof.

The 40×84×40 lattice, 2.15×4.6×2.15 physical envelope, wood/root formula, spatial foliage-region split, palette, recipe and transforms are unchanged. No renderer, material, light, actor or resource change is hidden in this patch. Existing ceilings remain 16,384 vertices/24,576 indices for the conifer, 8,192 vertices for each retained old tag, 24 resources including the reserve and eight tree parts. Their tests and production guard remain exact. Actual S2 counts are unknown until the authorized run.

S2 removes S1's row cache. Retained authoring state is fixed at eight heart rows and 17 bough records. One 134,400-cell bake has at most seven heart-segment checks and 17 bough checks per cell, with early exits; this is finite, not measured speed. Existing mesh caching remains one entry per known tag and returns defensive copies. There is no new growing cache or per-entity voxel bake. Temporary mesh arrays and first-bake allocation/time still need measurement; the mesh ceiling is checked after emission, so it is not a peak-allocation guarantee.

## Independent oracle and denominator

The preserved three tests reconstruct area/volume, depth/fill and recesses from emitted triangles, rather than importing occupancy answers. The two new cases likewise transform actual indexed mesh positions and intersect their projected triangle edges with scan rows. Taking the outer extrema gives the crown's projected union boundary; interior shading or color variation cannot manufacture an outline recess. Wood is excluded by the frozen palette's red>green classification, valid because each emitted face has one region color.

The test's Y rotation agrees with matrixForPart. Its horizontal basis `(x-z)/sqrt(2)` and upward vertical basis `sqrt(3)*y/2-(x+z)/(2*sqrt(2))` agree with the public orthographic camera: runtime 64×32 tiles give asin(32/64)=30 degrees. Translation and uniform entity scale are omitted deliberately because the thresholds use full-size physical recipe units. This verifies the local projection math, not camera wiring, HUD clearance, lighting or scene occlusion.

The 56 rows span projected heights .85–3.60 at .05 spacing. A qualifying contour run needs at least three sampled rows recessed .13 beyond shoulders on both sides in height, with separate left/right requirements, at least three total runs and more than .9 height spread. Empty output fails; an uninterrupted monotone taper cannot satisfy the shoulder comparison. This is a non-vacuous sampled contour contract, not a continuous silhouette or reference-quality metric. It does not grade the crown apex outside that band, fine tip craft, interleaving branch structure, perceived shape or whole-world coherence. The old mass/depth tests and physical/connectivity checks remain complementary safeguards.

The new two yaws retain the corrected identities: 2352:0 at cell (12,16), 144.39695390872657 degrees is the already inspected Normal subject; 2363:0 at (7,17), 325.3581800032407 degrees is the proposed different facing. Do not relabel the former as new held-out coverage. Static envelope plans remain unexecuted; actual emitted bounds, identity, HUD and occlusion checks are still required before accepting images. The old yaw178 cropped finding remains unchanged.

The candidate denominator is **14 cases in four files**: Sculpture 5 (original 3 plus two parameterized yaws), ConiferConstruction 4, NaturalConstruction 4 and VisualSpike 1. This count is source-derived, not a run result. No case, cap or assertion was weakened.

## Meaningful execution boundary

For RED, retain the new five-case sculpture test and replace only the construction with the exact archived S1 bytes in a fresh ordinary test process. Require the original three cases to pass and failure in the newly added projected macro-cleft assertions. Import, collection, missing-file, cap or old-safeguard failures do not establish the intended RED. Restore the exact S2 construction in the same command's guaranteed finally path and verify all 48 current pins even on error. A fresh process avoids reusing either version's module mesh cache.

Then run the four-file 14-case candidate set with whole JSON/native exits, followed by ordinary typecheck and voxel up-to-date SKIP. Unexpected failure stops the affected stage for root review; this acceptance authorizes no source repair or threshold tuning. The retained S1 ResourceVariation report is 17 pass/4 fail of 21: form mix, rotated envelope (1.5178774546733766 versus <1), adjacent-canopy centerX TypeError, and tree-part set. Compare a fresh report's exact failing names/messages; these remain open failures, never a green gate.

S1's first Normal view remains rejected for a smooth cone/teardrop and shallow ribbing. S2 has no native result, and installed S dist still belongs to S1. A unit pass can admit a new build/capture decision only. Actual Normal/close craft, both styles, different facing, picking, memory, shadows, motion, performance and full release acceptance remain open.
