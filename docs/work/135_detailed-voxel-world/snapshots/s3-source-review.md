# S3 conifer forks — independent source review

2026-10-18. **ACCEPT for the bounded unchanged 14-case unit set, ordinary typecheck and ResourceVariation comparison attempt.** No material source blocker found. This does not accept rendered art, actual geometry counts, performance or release readiness. No product/dependency import, test, build, browser, server, Git, engine, product-source or gallery operation was performed. This report is the only file written.

## Exact reviewed bytes

S is `C:/Users/38909/Documents/github/aoe2-worktrees/sculpted-conifer-1018`; evidence is `S/tmp/work135-sculpted-forks`.

| Input | SHA-256 |
| --- | --- |
| after-source48.json | 12ab847e494079198b6a14949c269be8683b14fd16cdffed98fa227e4550e157 |
| s3-source-handoff.json | 4d1ca27133f4533b1f42c9631bbeee5a809124519e8b89b77b0bd060eb3fae71 |
| scoped.diff | 5708f0edcf9c18c4c07402c4f55a6c846018f7f6dc9cf507c25b136dcc28ae58 |
| s3-readonly-proposal.md | a2826c0c5e6bcc0a395a58db48b91aa25dfc4d03b1cbff71bc8d1d27ac12b1bf |
| src/rendering/voxel/aoeVoxelConiferConstruction.ts, 71 recorded lines | 14b8cd21adcc5b7442217fe8a22be8b80f1fa56355cec83338ac179b7ebec1b2 |
| Unchanged tests/rendering/aoeVoxelConiferSculpture.test.ts | 95af321fbc3b6e7a27d2b03c5b0cac6b6b9c5db5ed7fff7fc605870dacea3a31 |
| Retained S2 candidate-affected.report.json | b97f8e50461ce94e8d11de8d6c45c5ac5bc62269c91b79ba5afdb3a1f575fb5e |
| Retained S1 baseline-sculpture.report.json | a81dca1026ac5405807cc02bd688c6db0e88a83d02fcb38ae0f17133b2a3e8a5 |
| P/tmp/work135-effort-review.md | 97af4724f5ad863ffc133a1d75373847414b4c70543a168620ae75924738b759 |

I independently verified all 48 live files, 48 candidate copies and 48 archived S2 copies, plus every handoff record. Only ConiferConstruction changed; the other 47 are byte-exact. The complete stem/root block and palette tail also match S2 exactly. The broader owner-recorded 2,571-input closure was not independently repeated in this source review.

## Source judgment

This is a coherent construction change rather than a patch to S2's isolated cell. Eleven fixed inner foliage volumes and 49 fixed fork volumes replace vanishing continuous tips and global subtractive wedges. Every literal volume has positive integer half-open bounds inside the unchanged 40×84×40 lattice. Inner-volume minimum dimensions are 2×3×2 cells; fork-volume minima are 3×2×3. Membership is a union of those volumes, with corner clipping only on inner sections. No coordinate-specific exception, flood-fill deletion, disconnected-component cleanup, noise, failed-test-dependent branch or post-bake alteration exists.

The integer data makes full-face support possible without a last diagonal sample. It does not itself prove every final component joins the wood: overlap, inner corner clipping and ground-to-tip connectivity must pass the existing flood-fill test. The wood/root predicate still has priority, and no operation subsequently cuts it. Grid-to-physical conversion, the 2.15×4.6×2.15 envelope and the spatial foliage-region split remain unchanged.

Public mesh extraction, recipe/scale/yaw/ground placement, palette, lighting, actors, renderer and resource identity are exact context files. Existing limits remain 16,384 conifer vertices, 24,576 indices, 8,192 vertices for old tags, eight tree parts and 24 resources including reserve. The old-eight byte checks, physical dimensions, mass/depth/recess, both contour cases and all budgets are unchanged. No cap or test has been relaxed to admit S3.

Authoring state is fixed at 60 volume records with no new growing cache. A bake traverses 134,400 cells, each with at most 11 inner plus 49 fork membership checks and early exits. This gives a finite roughly 8.06-million-check upper bound, not measured speed. Existing mesh caching remains bounded by known tags; no per-voxel draw instances or per-entity bake path was added. Actual emitted counts, temporary allocation and first-bake/runtime cost remain unknown. The existing emission ceiling is an admission check, not a peak-memory measurement.

## Verification boundary and remaining risk

The retained reports support tests-first sensitivity without another old-code rerun: S1 has the old three sculpture cases passing and both new contour cases failing; S2 has 11/14 passing with the connectivity assertion 15,793 versus 15,794, zero left clefts at yaw144.39695390872657, and zero right clefts at yaw325.3581800032407. Later contour assertions were not reached. These are real failures, not art measurements. S2's exact source and reports remain preserved.

The next candidate denominator stays 14 in four files: Sculpture5, ConiferConstruction4, NaturalConstruction4 and VisualSpike1. Require a whole report and actual native exit, then ordinary typecheck with maintained voxel up-to-date SKIP. Compare ResourceVariation21 against the retained 17-pass/four-failure record by exact failing names/messages; those open failures must not be reported as a green gate. Stop on unexpected failure without automatic source repair, retuning, new predicates or cap increases.

The whole-effort review's main art risk remains: three dominant fork bands may become shelves, and rectangular finite volumes may read as chunky blocks. Integer authoring is neither a flaw by itself nor proof of craft. The first uncropped actual Normal view must decide whether there are convincing connected asymmetric boughs and purposeful gaps. Passing two contour minima cannot settle that judgment or the wider woodline/rock/animal/worker/ground family. S1 remains visually rejected; S2 and S3 have no rendered gain. Installed S dist is still S1 and must not be labeled S3. Build/native work needs root's separate grant; final art, picking, memory, shadows, motion, performance, full gates and publication remain open.
