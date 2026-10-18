# Work 130 — corrected proof preparation review

## Target

Round 9 reviews the unexecuted CP1–CP3 corrections under `C:/Users/38909/Documents/github/aoe2-worktrees/software-culling-proof-1017/tmp/probes/work130-culling/`, at clean commit `63443d0dfe9eaefe900be02b10f0e46e94235dbc`, tree `661cf37ec42d514c09a976bc167e6e7dce6491c1`.

Exact preparation SHA256: `556c8acf065444d770262a8b5c4e13e6d6f0ac8b0d8c3f2b2bc953ae51aed22a`. Review-8 diff SHA256: `9ffb425323f95fc0c2a3268c9c595c328b829916dd627f85f9d64fdc485ec4f5`. Original archive manifest SHA256: `822d6cea1070a21d17815fed09418ef2f1974c60957f014197788f3d86e902ac`.

## Reviewers and coverage

Independent Codex reviewer, using the prescribed Astra/xhigh review pin. Read-only inspection covered all six prepared files, their changes from the preserved originals, pin manifests, and relevant public runtime, ingestion, capture and rollback implementations. No external source export or Claude review occurred.

## Reports

The revised instrument addresses the three review-8 preparation findings. The compaction algorithm’s visibility/extrema selection and full-frame policy remain unchanged. The principal verdict still compares two actual public runtime/presenter instances against unfiltered B; it does not derive expected capacities, bounds or visible omissions from the candidate.

Five ignored proof files changed; `vitest.config.ts` is unchanged. The original seven archived files remain byte-identical to their manifest.

## Findings and disposition

No material preparation finding remains open for this bounded execution.

- **CP1 — addressed in source.** `fixtures.ts:13` defines independent lifecycle expectations. `runtimeProof.ts:191` checks both arms against expected public `runtimeStatus`, completed draws, frame commits, attempts, individual throws, device generation, context counters and presented identity. Both injected failures must contain the intended renderer error. Loss fixtures change visual keys (`fixtures.ts:115`), preventing an empty metadata transaction from masquerading as the intended lost-frame case. `runtimeProof.ts:233` also requires the compactor’s committed watermark to remain unchanged without a matching completed draw.
- **CP2 — addressed in source.** `fixtures.ts:61` retains identical source batch objects and revisions while outer revisions advance; `lifecycle.test.ts:30` verifies that premise. Healthy cases require actual membership changes and compaction. The camera mutation at `candidate.ts:36` withholds the emitted revision only after a camera change with stable source revision. Its required failure is the independent actual-geometry/frustum `VISIBLE_OMISSION` assertion, not candidate self-agreement.
- **CP3 — addressed with the justified pre-observation correction.** `runtimeProof.ts:135` requires terminal rejection of frame, snapshot, delta, view and capture operations, unavailable manifest capture, and no revival or new draw/commit after context events. `runtimeProof.ts:173` disposes both runtimes, checks removal of their owned meshes, constructs new runtimes/scenes, resets the compactor and requires a full first committed draw with unchanged source epoch, resources and batch content. Omitting reset must fail actual capacity.
- **Terminal-graph criterion — correction remains sound.** The original assumption treated failed-draw rollback capacity as a future-order falsifier. Actual `runtimeHostFrameRestore.ts:86` restores the graph and then terminally fails; `ThreeRenderRuntime.ts:1100` rejects continued use, while its context handlers cannot revive failure. That graph’s capacity is diagnostic only. Strict capacity, bounds, retained order, replacement cadence, relative object-ID order and sorting checks remain on completed usable frames.
- **Scope note.** `runtimeProof.ts:38` invokes Three’s real sorter over the flat fixture meshes with group order `0`. This supports the stated fixture comparison, not arbitrary group hierarchy, renderer traversal or real WebGL behavior.

The four mutation controls require their intended assertion failures and a subsequent healthy restoration on fixed inputs (`lifecycle.test.ts:50`). Their sensitivity has not yet been observed.

## Verification

Independently rehashed all **6 proof files, 13 source inputs and 160 installed voxel JavaScript files**: zero mismatches. All **7 archived originals** match. Installed dist hashes are unchanged from review 8. Git reports no tracked changes; the preparation directory is ignored; no `run-receipt.json` exists.

No harness, tests, typecheck, build, browser or profile ran during this review. Runtime input digests, healthy/mutant/restored results and execution success remain unavailable.

The preparation explicitly binds installed voxel `5d6d4c911c6d05b62a5a81ad62f05993cf44e9de`. It does **not** establish execution equivalence to shipping pin `08398b573ad54bcb5c764ad0c2ef3cedc3cce33f`. Real context loss/GPU resources, host/bridge lifecycle, browser controls, pixels and equal-work performance remain outside this proof.

## Round outcome

**Accepted for the single bounded no-GL execution once the integration owner releases the lane.** A healthy capacity, bounds, order or lifecycle counterexample must stop the route and be retained; an unintended mutation failure does not establish sensitivity.

This approves the prepared experiment only. No product candidate is approved. The stronger software criterion remains **UNMET**; the ≤1.25 interval ratio, ≥55 GPU FPS, pixel preservation and unchanged simulation-work requirements remain unchanged.
