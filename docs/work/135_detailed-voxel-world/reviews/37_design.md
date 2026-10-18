# Review 37: design

## Target

2026-10-18. Independently assess direct authored voxel occupancy for the emerging dragon head, especially its four visible neck sections and three principal joints. The fixed contract is `tmp/work135-component-reassessment/contract.md`, SHA256 `d7c896a3e124f76340e4d789cb544db8120706867a7d5b16b50afd1e757634a3`. Stated base: `67e5493abdcee9e5343226ee8bf16a4324179a7b`. The external proof chat remains sole implementer.

Propose one occupancy experiment. Four separately authored, overlapping neck volumes can form one connected emergence without a backing column. Skull, crest, brow, muzzle, cheek/hinge and jaw must likewise own actual volume. This is a materially different mechanism from tuning the existing shell, but its fidelity is untested. This report supplies no model or implementation authorization.

## Reviewers and coverage

Reviewer: `/root/direct_occupancy_components`. Proof root: `C:/Users/38909/Documents/Codex/2026-10-18/voxel-art-reference-proof/outputs/`. Native inspection covers the frozen original, all eleven M18 originals, M15/M17 detail, and M16 detail, side, opposite, rear and overhead: nineteen image files. Full source reads cover `source/m18-head-cage.mjs`, `m18-author.mjs` and `m16-head-sculpt.mjs`; earlier loft reads were partial.

Ignored evidence: `tmp/work135-occupancy-route/inspection-manifest.json`, SHA256 `815e4525b218042c8da3d69795f8ee5bc7f53bcf73571528de8bd7bffc672213`. It binds those inspected bytes and records coverage. No competing investigator's new report was read or requested.

## Reports

The reference shows four large, unequal neck masses divided by oblique shoulders and overlaps. Small red plates sharpen those masses; they do not increase the count. The crest, localized brow, descending muzzle, cheek/hinge and jaw have distinct spatial roles. Exact hidden anatomy remains an inference.

M16 has real mouth depth, but its component union leaves a box skull, huge white eye and columnar neck. M17/M18 show one roof/fin above an uninterrupted stem and small jaw tray. M18 side, rear and overhead expose those relationships. Better names or more cells cannot establish separate visible components.

In `m18-head-cage.mjs:37–49`, ground/low/bend/hinge are rings bridged into one root wall. `authorHead` at line 154 fills that shell through odd/even containment; line 140 assigns nearby-face color. Reusing those rings would continue the stopped cage route. M16's halfspace solids can also merge into broad exposed planes. Converting either old result into row data would preserve the failure.

Use component-local maps of integer cells. Compact records contain component ID, local Y interval, local Z interval, explicit X runs and material-region ID. Half-open integer intervals expand only to their specified cells; group identical adjacent rows solely for storage. Translation by an integer origin suffices. Do not interpolate slices, fit a hull, smooth a field, rotate/rasterize a coarse mask or sample reference pixels.

The following worksheet describes original construction to test, not populated model data or claimed unseen anatomy.

| Component | Occupancy-producing form and connection | Diagnostic native views |
|---|---|---|
| N0: ground section | Broad unequal ground-cut body, stout depth, offset bright front mass and shorter rear shoulder. Taper inward unevenly; overlap N1 internally. No paired feet. | Matched, low-up, rear. |
| N1: lower middle | Stronger forward lean than N0, wider near shoulder and narrower rear upper end. Its lower lip projects outside N0 while its interior overlaps both neighbors. | Matched, side, opposite. |
| N2: upper middle | Shorter flared section, different near/far offset, with rear taper beginning before the front taper. Its angled shoulder must survive union with N1/N3. | Matched, side, rear, overhead. |
| N3: cranial neck section | Compact upper body with its own shoulder and throat end, turning into skull/cheek. Overlap N2 and skull; omit the ambiguous small collar from this first experiment. | Matched, close, opposite, rear. |
| Skull | Compact deep cranial body with rear and lateral bulges, below/behind the brow. Embed N3 and cheek; attach muzzle at the front. | Detail, side, overhead, opposite. |
| Crest | Swept uneven wedge with changing depth, broken upper/back edge and broad fused rear-skull base. It cannot occupy the entire roof as one triangular fin. | Matched, overhead, rear. |
| Brow | Local thick oblique ridge, modest bright region and actual recess below. Fuse into skull/upper muzzle; avoid the large horizontal visor. | Matched, detail, side. |
| Muzzle | Separate descending solid, thick at its root with narrower end and independent depth taper. Embed in skull/brow; its underside bounds the mouth. | Matched, side, overhead, opposite. |
| Cheek/hinge | Local angular buttress below/behind brow, projecting near face and authored far return. Connect skull/N3 to jaw through one broad hinge; never an arm. | Detail, side, rear, low-up. |
| Jaw | Compact bent lower mass, deeper at hinge and short at forward tip. Leave air through the mouth depth; avoid the long scoop and disconnected tray. | Matched, side, opposite, low-up. |

Give every neck set several genuinely different cross sections. Change front, rear, near and far limits independently. Offset the hot throat subset from the structural center. Vary row-group Y endpoints across depth so a lip crosses obliquely instead of becoming four horizontal slab tops. The proposed differences in the worksheet are authoring hypotheses, not measurements extracted from the image.

Build all component maps before union and preserve their memberships for inspection. Neighboring neck bodies overlap through broad interior patches; their union provides the continuous core, with no fifth tube. An exposed shoulder should continue onto the near or rear surface. Never carve a thin circumferential seam through the core. Resolve material priority explicitly in overlaps; emit the same resolved color regardless of component emission order. A color boundary alone cannot prove a section.

The existing `authorHead({part, volume})` seam is sufficient. A membership predicate at `floor(x), floor(y), floor(z)` accepts authored cells through the current cell-center sampler; color uses the same key. Each component set actually emits occupancy through `part`. This requires no triangle containment, nearest-surface coloring, renderer feature or anatomical generator.

## Findings and disposition

Retain `m18-author.mjs:13` and `:19` as the integer sink/sampling path, `:55` as the public mesh/render path and `:91` as the occupancy export. The next immutable attempt replaces the head import at `:5`, leaving M18 unchanged. Keep +X muzzle, +Y up, +Z near and scene landmarks as framing guides.

Replace every present head/neck occupied shape. M15's continuous loft, M16's existing halfspace blocks and M18's single shell are unsuitable backing solids. Their anatomical names and the requirement for real mouth/cheek air remain useful; no inspected head/neck component is strong enough to freeze as accepted geometry.

Keep exact M16 flame, pad, staff and sparks as controls, with their fidelity still unaccepted. Preserve palette values, pitch, build, renderer, light, rasterizer and all eleven views; matched/detail framing remains exact. Hidden-side geometry must be labeled authored inference.

## Verification

Propose one coarse attempt with four neck and six head sets, approximately 28–36 neck slice bands and 20–28 head bands, generally four to seven grouped runs each: about 200–450 explicit records plus a small material/overlap table. This is a planning estimate, not an acceptance count. A component worksheet should freeze origins, occupied extents, first/middle/last slices, junctions and materials before expansion.

The discriminator is whether physical component volume restores four unequal overlapping neck sections and distinct head masses simultaneously in matched, side, rear and overhead views. Do not add eyes, teeth, thin scutes or red plates before that judgment. One source snapshot and one existing eleven-view capture batch answer this first question. It grants no new repair allowance.

Freeze the intended changed region before capture. Use the maintained before/after diff, inspect it and every native original, and bind source/image hashes to the verdict. Root and an independent reviewer judge the actual output. Side tests hinge, descending muzzle and jaw; opposite/rear expose shallow staging or a backing wall; overhead distinguishes crest/skull/muzzle width; low-up exposes jaw attachment, mouth air and ground continuity. Other existing angles remain surrounding/occlusion checks.

Fail for painted joints, fewer than four visible large sections, four equal boxes, a plain supporting column, one roof with ornament, long tray jaw, disconnected/camera-dependent anatomy, lost proportions, changed controls or any fixed disqualifier. Connectivity, overlap volume, integer counts and watertightness are necessary instrument checks only; they cannot establish art acceptance.

Costs are manual 3D authoring and larger data edits when proportions change. Risks are horizontal bands from over-grouping, overlap erasing shoulders, material priority faking seams and a correct matched silhouette with shallow depth. The fixed diagnostic angles expose these failures. No isolated shading cause, speedup or cost advantage has been measured.

The first command, `npm run ci:status`, exited 1: `UNKNOWN — could not resolve the commit to report on.` Runtime gates did not run for this prose-only proposal. No model, source change, Git operation, engine edit, gallery write, browser, GUI, server or subagent was used.

## Round outcome

Underexplored route with a concrete bounded experiment; no art pass or impossibility claim. Parent is the fixed reassessment contract and immutable M18 evidence. Actual outcome is source/image investigation only. Model authoring/capture work was zero; research compute and elapsed cost are unmeasured. Aggregate attempts do not reset.

Root must compare this proposal with the independent surface route before choosing implementation. The remaining gap is a rendered result preserving all four neck masses and head hierarchy across the fixed views. Full fidelity, unseen accuracy, animation, game integration and performance remain unproved.

