# Review 47: design

## Target

2026-10-18. Independent read-only hard-problem branch A, owner `/root/m21_surface_invariant_search`, at aoe2 main `45b0ff6f42dff7b246b663dbba589ff2114cf78c` in managed `work135-m21-search-a-1018`. The fixed reproduction and disqualifiers are the root's `tmp/work135-m21-correction2-search.md`. This report applies the canonical fleet hard-problem and self-improvement instructions. It does not select or implement a third M21 candidate.

## Reviewers and coverage

The corrected source is `outputs/checks/m21-selected-correction-2-first-red/m21-head-local-surfaces.mjs`, SHA256 `c18dbdbfeffc141cb3c533b9a16d587620f872ada596329c7e4ac7557cac718e`, under external proof root `C:/Users/38909/Documents/Codex/2026-10-18/voxel-art-reference-proof/`. The exact proposal is `77b56b10ca9f188c6e17865fe1b48ce2a011ff054554a43ecbccf67b4e5cd515`; its frozen predecessor is `4ea140e64a4c0bb5b2967eae2ac8ec3e456381a421420652c0457fe5bacff94c`. I read both source files, the proposal, worksheet, original instruments, retained maps/reports and review 43's preserved containment instrument before constructing bounded probes. I did not execute an external instrument or import an M21 source module.

The original checker reports main crest groups 824/1, near crest 391/1, and final union 56,776 grounded cells plus singleton `[3,102,5]`. Main singleton `[16,86,-8]` also belongs to skull, so whole-union connectivity alone would conceal that component failure. These are the original retained observations, not a new whole-head resampling.

The later immutable acceptance evidence, SHA256 `23dce1609119a18c2ec80649a0ecba4214f5661d57cd875843afb8eb3a7a8056`, reports agreement at all 36,778 bounded centers of four changed solids, six containment controls, all fixed paths and all attachment guards passing. It separately preserves the original two failed predicates. Eight untouched own-cell/color maps, all 1,020 mouth cells and old skull cells remain preserved; skull adds 13 cells with zero old-cell removal/recolor. I inspected these results without duplicating their full classification. The acceptance manifest is `f3f71611b723688177e8f8e8a5eda34731c8d9c292be838bbefc3c87c54ef7be`.

This branch independently traversed only the two retained crest graphs and classified 16 bounded observations: each singleton, its six face neighbors and one nearest main-group cell. It reused review 43's solid-angle formula and six cube/orientation/translation controls, and separately reproduced the unchanged source ray rule at those observations. Both classifications agree with every queried membership. They share the frozen geometry/frame/triangulation; agreement does not certify embeddedness or establish a sampler defect.

## Reports

### What the raw witnesses show

| Component | Included singleton | Nearest main-group cell | Both intermediate face centers are excluded | Nearest authored boundary |
|---|---|---|---|---|
| Main crest | `[16,86,-8]` | `[15,87,-8]` | `[15,86,-8]`, `[16,87,-8]` | Root cap, distance `0.04152568435` |
| Near crest | `[3,102,5]` | `[4,101,5]` | `[4,102,5]`, `[3,101,5]` | Back return, distance `0.02984558536` |

All six face neighbors of each singleton are outside its own component. Each nearest main-group cell is Manhattan distance two away. Thus neither of the shortest grid routes has an intermediate occupied center. Edge adjacency supplies no missing face connection.

The main singleton has local center `[5.8457163,-7.9584743,4.1521425]`, just inside the finite root cap at local Y=-8. The near singleton has local center `[-9.6110458,5.6532538,8.8554233]`, near the back return. Its forward face neighbor lies outside the finite terminal. A finite root cap and finite tip therefore leave other oblique boundaries able to admit boundary centers without admitting a face neighbor. This diagnoses a missing global constraint, rather than identifying one vertex that should move.

At the main singleton the source ray's occupied interval is approximately `[16.3208552,16.5831966]`; at the near singleton it is `[3.4669821,4.3484769]`. Both include the X center. The nearest-boundary distances are many orders larger than the existing ray offsets. These observations provide no reason to repair the failure through epsilon changes. They do not exclude unrelated mesh defects: coplanar intersections, adjacent foldovers and complete embeddedness remain outside the qualified original topology check.

A separate analytic counterexample isolates the class without M21 geometry. Intersect `0<=x<=3`, `0<=y<=3`, `0<=z<=1` with `abs(x-y)<=0.1`. This is a closed convex finite prism with finite end caps and a continuous interior diagonal route. Fixed-center sampling yields exactly three separate cells `[0,0,0]`, `[1,1,0]`, `[2,2,0]`. Increasing only the synthetic width to 1.1 yields seven face-connected cells. Convexity, closedness, finite caps and a continuous path therefore do not imply digital connectivity. The width result is a control, not an M21 thickness prescription.

### A sufficient invariant and its proof

Let a sampling lattice be `L_s = Z^3 + s`. A continuous patch P has an anchor `r in P intersect L_s`. Require that, for every point p in P, the complete axis-aligned box with opposite corners r and p lies in P. This is a property of the continuous patch; it does not inspect an island and add its missing neighbors.

For any sampled p other than r, choose a coordinate where p differs from r and move one grid unit toward r. The next center is still in that box and therefore in P. Its Manhattan distance to r decreases by one. Repetition reaches r in finitely many face steps. Hence every center in P reaches the same anchor, with no boundary exceptions left outside a preselected path.

For a component S, additionally require exact equality `S = union(P_j)`. Each patch has the contraction property and an anchor. Require a connected graph on these patches whose every edge has a witnessed center in both patches. Each patch's sampled set is connected by the argument above, and each graph edge joins two such sets. The complete sampled component is therefore connected. Exact coverage is essential: certifying only a central tube or selected subset would leave the original off-path difficulty untouched. Continuous overlap without a sampled witness is insufficient.

The condition uses the fixed world grid axes. Rotating an arbitrary patch and its proof in a local component frame does not preserve it relative to that grid. The diagonal prism is a counterexample to silently making that substitution. Ground clipping is safe only when retained anchors are at or above the retained first Y-center; contractions between retained centers then do not cross below ground.

The original sampler uses exact X centers but ray coordinates `y+0.5000001`, `z+0.5000003`; nearest-face material assignment and independent containment use exact centers. The theorem must cover both translated lattices, or a rigorous margin argument must show their memberships coincide. No offset is changed here. The bounded synthetic control uses a tiny rectangular anchor kernel containing both translations and proves contraction toward every anchor point in that kernel.

A concrete analytic family is `sum(max(p_i-Bmax_i,0)/a_i + max(Bmin_i-p_i,0)/b_i) <= 1`, with positive unequal radii a and b and rectangular kernel B. Moving a coordinate toward any root in B weakly decreases its penalty while leaving other penalties unchanged. The inequality proves contraction directly. It yields faceted asymmetric continuous patches; it does not prescribe copying these shapes into the head.

Two synthetic patches with different positive/negative radii produce 22 and 13 sampled cells, share three cells and form one 32-cell union. Exhaustive bounded checks exercise 46 directed contractions with zero violations on each of the exact and unchanged offset lattices. These controls validate the proof's basic mechanism and instrument translation; two small synthetic shapes do not establish art transfer or certify a mesh implementation.

## Findings and disposition

### Authoring discipline, contracts and remaining gap

The useful change is to settle an all-points construction certificate before tuning coordinates. An author could supply a finite continuous patch cover, anchors, a connected witnessed overlap graph and a proof of each patch's contraction property. A source represented directly as that union makes coverage explicit. Retaining the existing single boundary mesh instead requires a genuine equality proof between that mesh's interior and the certified union. Merely declaring a cover or testing some centers does not establish equality.

This discipline preserves fixed-center sampling, pitch, six-neighbor meaning, complete component membership, positive declared overlaps, deterministic ownership and the need for a grounded final union. It supplies no license to alter the four protected necks, other frozen components, mouth air, controls or prior failures. Shared-center attachment witnesses would still need the existing original and additive attachment checks; a theorem about internal connectivity does not certify substantial roots or anatomy.

The current worksheet deliberately authors independent closed local polyhedra and excludes profile sweeps or an additional core. Substituting continuous union primitives, changing facet/material resolution, adding a cover representation or introducing mesh Boolean machinery would change that experiment's authoring contract. Root must adjudicate such a change before any implementation; neither this report nor the theorem supplies that grant. A diagnostic certificate on an otherwise unchanged source is a distinct choice from replacing the constructor.

The hard gap is finding a low-complexity continuous shape that satisfies this world-axis contraction cover while retaining the desired swept unequal crests, compact cranium, descending muzzle, localized hinge, short jaw and genuine four-volume neck articulation. One box-closed patch can force large axis-aligned interior envelopes; many small patches can hide the same broadening or turn into sampled filler. Neither solution is accepted. The exact failed component cannot simply receive a valid certificate: its retained disconnected center sets contradict the certificate's conclusion.

Consequently this is a sufficient connectivity route with unproved artistic feasibility. It is not nearly completed art, a proof that the current polyhedral approach is impossible, or evidence of an engine limitation. Prior failures remain counted, and no repair allowance resets.

### Falsifiable next discriminator and cost

Before any separately authorized actual candidate, test a held-out generic bent, tapered continuous solid whose orientation and asymmetric terminal differ from the controls above. Freeze its intended envelope, patch count, anchors, exact/offset-lattice contract and overlap witnesses before inspecting memberships. Require an explicit complete union or independently checked mesh/union equality, analytic contraction proofs and one exact occupied overlap witness per connected cover edge. Preserve a rotated thin-prism negative control. No M21 coordinates, failed-cell anchors, added backing or adjustable post-result stations belong in that generic discriminator.

This discriminator fails the proposed authoring mechanism if a claimed proof admits a disconnected sampled set, if coverage leaves uncertified surface regions, or if it cannot express the frozen envelope without broadening it. Failure would refine the route's assumptions, not prove that no other construction can meet the user's art target. A pass would justify root considering an authoring-contract proposal; it would still grant no M21 correction or capture. Actual future source work must retain the original complete-component/union predicates and independently classified changed solids, followed by the unchanged eleven native views and independent art judgment.

The control cost is small here: only two current retained crest graphs, 16 actual-source center observations and bounded analytic controls. Synthetic patch scans use 2,197 integer indices per patch per lattice; finite proof checking still needs bounds/certified arithmetic if generalized. A naive cover with k patches can multiply containment work and overlap tests, and robust boundary extraction/material ownership can add substantial implementation cost. No timing, total compute saving or general efficiency claim is established. Total elapsed work and compute are unmeasured; failed prior corrections and this search remain part of aggregate cost.

### False-pass audit

Filtering islands, filler/singleton writes and relaxed adjacency are absent. A complete continuous cover is required, so a path-only certificate or global backing/core cannot stand in for full coverage. An overlap graph has exact sample witnesses, not mere touching declarations. Neither historical thresholds nor protected inputs changed. The negative convex-prism case goes red despite continuous connectivity and finite caps. Exact and ray-offset lattices are treated separately. No retry, cache, timeout, ordering or partial full-suite summary supplies the result. The current source remains red, and no third M21 shape was constructed or sampled.

The main risk of this route is relocating the hard part into an unproved cover/equality claim or into choosing a shape that satisfies the theorem but fails the art. Both are explicitly unresolved. A family with arbitrary rotation is not certified. No renderer, favorable projection, source count or native image is used to claim form; no M21 native image exists. Importing, tracing or generating artist geometry was not done. Broad fidelity, flame, pad and game-baseline acceptance remain outside this result.

## Verification

Owned evidence is `tmp/work135-m21-search-a/` in this assigned managed worktree. `structural-evidence.json` SHA256 is `f97bb70842e00816160d94b0f6787089a03e65dd0ba696647b82716dafa623bf`; `synthetic-offset-evidence.json` is `9cf1c6a2d0a5aaae236e6bc9fae4fe417ec32d01e2e59c772a022186b20d4edb`. Both `inputs-before.json` and `inputs-after.json` are `68a8714e1e2224707d849c1908223b804e7ebc828c91920f16abb534f1bb795f`. They guard 21 inspected external inputs with exact paths, lengths and hashes; all remain unchanged. Initial hash observations also pin the first source/checks/memberships before the bounded probes. Normalizing receipt whitespace does not change any recorded observation.

`inspect.mjs` SHA256 is `b7b1290572f6dea753ebcc5e6ee39f3b2ac3cc7155e5cfcd01b6ea51743d8575`; `synthetic-offsets.mjs` is `3f1a944c22594ab4f3294e052fe72f88bb8d7e8891bc23c56185fb83102c2e90`. Each names its harness and scope. Both probes exited zero. Inputs were not imported as executable modules. The original and alternative containment controls were inspected/reused, not amended.

Required first `npm run ci:status` exited 1 with commit resolution UNKNOWN. Retrying with process-scoped `safe.directory` resolved the correct revision but GitHub network access was denied; CI and corpus remain UNKNOWN in this branch. No global Git setting changed. Runtime/full verify, browser/render/engine gates, independent full four-solid classification and native visual review were deliberately not run under this bounded read-only assignment. Root owns any remote status escalation and integration checks.

Only this authored review and its owned ignored evidence were written. No source, checker, declaration, control, plan, spec, gallery, product, sibling repository or Git history/stage was changed. No subagent, browser, GUI, server, watcher or persistent process was launched. Root retains ownership of the evidence and managed worktree for synthesis, integration and safe retirement.

Final cleanup check: the initial sandboxed process query was access-denied and supplied no valid census. The explicit read-only retry succeeded and found no Node/browser commands carrying this investigation name. No process was terminated. Git status contains only this new review; owned evidence is ignored and unstaged. The assigned checkout is intentionally retained for root integration/retirement, with no commit or push.

## Round outcome

A sufficient continuous authoring invariant exists: cover each whole component exactly with patches closed under grid-axis contraction toward interior lattice anchors, and connect those patches through actual shared sample centers. This proves six-neighbor connectivity for every included center, including centers outside a chosen root-to-tip path. A bounded analytic construction demonstrates that the invariant is nonempty and supports unequal oblique facets. No evidence yet shows that it can produce the required M21 crest/head form within the fixed protections. That authoring problem remains open; the theorem is neither a repaired source nor art acceptance.
