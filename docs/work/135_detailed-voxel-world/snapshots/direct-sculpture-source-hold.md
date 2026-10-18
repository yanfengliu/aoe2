# Direct conifer drawing — independent source review

2026-10-18. Integration owner: root. Read-only review of W at main E plus D controls. No product imports, cell-grid construction, mesh execution, tests, typecheck, build, browser, native capture, Git or source edits. Static text/manifest inspection only.

**HOLD the current50-file revision for the proposed affected-unit admission.** One named-coordinate expectation contradicts the literal drawing. The decoding mechanism itself is bounded and suitable for a narrow experiment, but this known contradiction should be resolved before spending the native lane. This is not an art verdict or permission to relax the silhouette/physical guards.

## F135-direct-1: predeclared occupied coordinate is empty

`tests/rendering/aoeVoxelConiferDrawnAsset.test.ts:26` requires `coniferCell(5,26,20)` to be greater than zero. In `DRAWN_CONIFER_LAYERS`, the y26 record starts at z5; its z20 row is exactly `9-31`. The only wood stroke covering y26/z20 is the leader's `19-21`. There is no other foliage record for y26. Light fields only recolor existing foliage and cannot create occupancy. Therefore x5 is empty under the source's own decoder. A tiny independent text extraction confirmed those two literal rows without constructing the asset or importing product code.

The owner must reconcile the declared west-shoulder intent and the drawing/test coordinate explicitly. If the coordinate is an inaccurate observation, preserve this failed source and explain the corrected check against the intended structure; if occupancy there is intentional, correct the data. Do not silently move the assertion merely to a known occupied voxel or weaken the existing output-mesh guards. No repair is made by this review. Root may separately authorize an intentional diagnostic RED, but the current revision is not ready for a claimed candidate GREEN.

## Mechanism, scope and evidence

The actual construction path is a fixed literal-data decoder, not a live cone/radius/ellipsoid sampler. The payload contains66 foliage records,26 wood strokes and9 light fields; independent static parsing found exactly3 arrays and1,157 inclusive runs. Every foliage y18..83 is explicitly represented, and depth rows vary across heights, including split runs and staggered edge removals. This is not one flat profile uniformly extruded through depth. Some neighboring layers are identical or smoothly vary, so literal representation does not itself rule out rounded stacked masses in the rendered result.

The handoff says the rows were manually authored and Python only wrote text and applied named erasures. The inspected source has no analytic sampling/import path and does not reference the rejected S/M drawings. Those facts support a different runtime representation. The final data cannot independently prove how each coordinate was originally produced; there is no basis to certify manual artistic provenance beyond the retained author record. No native craft result follows from the word “drawn.”

The decoder allocates one private40×84×40 Uint8Array (134,400 bytes) and paints finite literal intervals once. Indexing `(y*40+z)*40+x` is consistent with the existing mesher's cell order. Grammar rejects malformed intervals, descending/out-of-range endpoints, multi-depth starts and rows spilling beyond z39. Lookup rejects non-integer and out-of-grid coordinates, with constant-time reads. No input-sized/unbounded cache or new resource family is introduced. The existing mesher also allocates its own transient cell grid and cached geometry; the new retained grid is additional memory, not a cost reduction claim.

Painting foliage2, then light3 only over foliage2, then wood1 preserves intended wood precedence and prevents light from filling a void. The three RGB material colors match D. Wood strokes encode a continuous center leader and unequal stepped x/z-directed arm intent; foliage has authored splits at the right/front shoulder and upper/back recess. Whether all parts have face contact, adequate depth, convincing branches or useful visible voids remains unexecuted. Named branch records can still produce shelves or lobes; only the unchanged Normal view can assess that risk.

The new four-case test is an asset-integrity contract: explicit height coverage, sampled wood/void/span coordinates and out-of-grid behavior. Its expected coordinates are independent literals rather than results recomputed by the parser, but they are authored safeguards, not reference measurements or an art oracle. Its sampled leader positions alone do not prove all-layer connectivity. The unchanged Construction test supplies full occupied-cell flood connectivity and physical emitted-mesh dimensions/caps; the exact95af Sculpture test reconstructs mesh sections and both projected outlines without importing the drawing lookup. Its area/depth/recess/two-yaw thresholds are unchanged. The new tests have not run, and TDD sensitivity is unproved.

All50 current file hashes match the frozen manifest;46 D files remain byte-identical. The only changed/new paths are Construction, Drawing, DrawnAsset and the copied unchanged Sculpture test. Existing40×84×40/2.15×4.6×2.15 constants,16,384 conifer vertices/24,576 indices,24 resources including reserve and8 tree parts remain unchanged. Greedy mesh admission still throws if geometry exceeds caps. Actual counts, emitted bounds and connectivity must be measured by the bounded affected run; source size does not prove them. No old appearance hash, numerical threshold or unrelated family was changed.

The initial static census that found zero arrays is correctly retained as INVALID for literal bounds. The corrected three-array census is consistent with this review's text readback. Syntax/import checks are not typecheck or runtime. D's reported17/21 ResourceVariation result remains RED and must not become accepted through inheritance. After the coordinate conflict is resolved and independently rechecked, one affected attempt is appropriate; ordinary type/build remain separately granted stages. Native art, both styles/facings, same-art engine parity, shadows, memory/picking, motion, performance and full readiness stay open. No further M views or parameter hunt is proposed.

## Exact pins

- W: `C:/Users/38909/Documents/github/aoe2-worktrees/direct-conifer-1018`.
- Base: `1dc717882f76676894dd84c6d002087c77a51765`.
- `after-source50.json`: `036703a716929260b4c4e1c6221e4ea8bb40e9dcd98e534daa0ea5a23a9eca9c`.
- `handoff.md`: `777afaf449383115f14c9a8d653004216ce5201c2b387dbd918690200ed5dd68`.
- Construction: `4092fb07e3c33c3c242fbe72daa6c5df188bf389d9494663e3376824cc75b627` (49 lines).
- Drawing: `7648fbdf3e7d2b65a4b050f51475738343b8ff745960bb05b988f3e7da988602` (115 lines).
- DrawnAsset test: `88ae2068ac8381a8cb9bcb1cd06c97b72520865fb23fb9605eda4ec031f1cc0f` (37 lines).
- Preserved Sculpture test: `95af321fbc3b6e7a27d2b03c5b0cac6b6b9c5db5ed7fff7fc605870dacea3a31`.
- Corrected static literal census: `44004118d6ba636c84032fcb6d44449ff20d0dcef6dc89ef02ec6e68edd462ab`.
