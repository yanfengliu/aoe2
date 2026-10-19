# Review 43: design

## Target

2026-10-18, main `142106f6cbf097cbc5db863a33b5f15a38f2633b`. Reassess M21's second source-stage connectivity failure before another correction. The target remains an emerging dragon head with four unequal visible neck bodies, a shorter upper transition and three real joints. M19/M20 remain rejected; M21 has no native render or art acceptance.

## Reviewers and coverage

Independent reviewer `/root/m21_structural_reassessment_43` read the local-surface contract, review 41, frozen worksheet, original neck failure, corrected-neck checkpoint and complete first-full source/checks. No model, check, engine, renderer, UI, Git or external proof file was changed. Only this report and ignored `tmp/work135-m21-structural-review/` receipts were written. No browser, server or subagent was launched.

## Reports

Independent recomputation reproduces all twelve retained component membership/color hashes and the resolved union/owner hashes. Jaw groups are 2,784/1; main crest 1,060/2/2; near crest 469/2/1/1/1. The final union is 57,178 grounded cells plus three singletons: jaw `[44,59,-2]`, near crest `[5,93,-1]` and `[1,101,4]`.

These are distinct failures. All four main-crest island cells also belong to skull and reach the grounded union. Three near-crest root island cells reach skull through face contacts. They still violate independent component connectivity. The three final singletons have no occupied face neighbor at all. Every isolated own-cell witness is Manhattan distance two from its component's main group; edge contact cannot satisfy six-neighbor continuity.

Independent oriented-solid-angle classification agrees with the source sampler at every bounded center for jaw (2,785), main crest (1,064) and near crest (474). Six analytic cube, orientation and translation controls pass. This extends the earlier N1 result: both methods agreed on 13,362 centers and groups 13,357/4/1. It weighs against a parity-only bug; it does not certify embeddedness or every mesh case.

The exact two-vertex N1 correction and its red predecessor remain preserved. Corrected N1 has 12,687 connected cells. The completed source retains the corrected neck prefix and all four neck membership/color hashes unchanged. The later head construction is a continuation, not another N1 correction or an allowance reset.

## Findings and disposition

The recurring failure class is a missing invariant between continuous authored boundaries and fixed-grid face connectivity. Closed, oblique polyhedra can include isolated boundary centers while excluding their six neighbors. Local coordinates and closed topology do not prevent this. The current mesh instrument checks two incident faces per edge, winding consistency, nonzero triangle area and selected transverse intersections. It explicitly excludes coplanar overlap and adjacent foldovers. Its qualified pass is not an embedded-solid certificate.

The neck-to-skull observation needs precise treatment. N4 and skull share zero cells but have five occupied face contacts. There is also a substantial N4-to-cheek-to-skull path, with 187 and 1,130 shared cells respectively. Thus the head is attached; the worksheet's stronger internal direct-overlap promise remains unmet. Preserve that red observation. Root should adjudicate the promise before changing geometry or versioning the declaration/check. A metadata amendment cannot repair the real islands.

Declarations also omit N4-to-jaw (651 cells) and skull-to-jaw (171). Near/far crest-to-skull overlaps are only one/four cells. These deserve native inspection for localized hinge and substantial roots; nonzero counts do not establish the intended anatomy. Exposed role names, empty-mouth counts and projected bounds likewise cannot prove shoulders, mouth depth or silhouette.

Three routes are distinguishable. Changing containment has no supporting disagreement. Accepting only final-union connectivity would conceal component failures and still leave three floating cells. Prefer one predeclared geometry batch limited to the jaw and main/near crest boundaries: replace grazing corners with intentionally authored finite caps and connected root transitions at the unchanged pitch. Preserve the neck and all other controls. This is a proposal, not authorization.

Before that batch, freeze the edited facets, intended occupied root-to-tip paths and forbidden regions. Afterward require each complete component to be six-connected independently, genuine attachment patches, one grounded full union, unchanged neck/control hashes and all 1,020 protected mouth cells empty. Reclassify every center of changed solids independently; retain all old observations. No island filtering, global backing, relaxed adjacency or repeated blind coordinate nudges. Freeze once, then request the unchanged eleven-view render; reject lost shoulders, broad backing, crest rails or single-view success there.

## Verification

Full-source SHA256: `4ea140e64a4c0bb5b2967eae2ac8ec3e456381a421420652c0457fe5bacff94c`. Contract, worksheet and review 41 match their assigned hashes. All 45 guarded inputs remained unchanged. Before/after manifests are `inputs-before.json` / `inputs-after.json`; independent evidence `structural-probe.json` SHA256 is `225bf502c266d10bb04ff9e568ea5c5a5b328a10001dd76500677af452ad71da`.

Session-start `npm run ci:status` exited 1: commit resolution UNKNOWN, not a CI failure diagnosis. Runtime gates and native rendering were not run. Read-only probe exited zero; artistic quality and complete embeddedness remain unverified. Compute and elapsed cost are unmeasured.

## Round outcome

M21 remains structurally red and visually untested. Preserve the corrected-neck gain. Root owns contract adjudication and any single bounded correction dispatch; the existing proof chat remains sole implementer. No engine limitation is established, and aggregate attempts remain counted.
