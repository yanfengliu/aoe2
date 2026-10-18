# Review 32: design

## Target

M16 causal construction diagnosis and proposed M17 major-form experiment. Recoverable target: `C:/Users/38909/Documents/github/aoe2/tmp/visual-gallery/2026-10-18/60-emerging-dragon-m16-angular/`, manifest SHA256 `33deeb3086ecedc61765ca4cee7aabf87f3b43dcf4a763993362e3a9ee3bc771`. Frozen reference SHA256: `83bea5c03c0293710b27578bc0b2d6cf86fbb47bbe987695f9a3a7b1861016ef`.

The original 703-word ignored `tmp/work135-m17-construction-search/report.md`, SHA256 `e2d3e6ca833630fcc068ae9004d55b2f419fb1f493a8dbd5e7f724de1008aff5`, is embedded byte-for-byte once below. Its ignored source/image audit remains SHA256 `e3f1051c0452ed29f1ed80c5f371c7bec2eab68bc6ea62ae188241926fd0cac7`.

## Reviewers and coverage

`/root/art_construction_search`, 2026-10-18: five native M16 originals plus reference; four authoring modules read; eight source files hash-checked. No claim of eleven native inspections by this reviewer. No M17 source/render has been seen. The provisional datums are manual inference, not tracing or imported geometry; the proposed boundary must drive actual shape, not metadata.

## Reports

### /root/art_construction_search — verbatim original diagnosis

<!-- BEGIN EXACT ORIGINAL REPORT -->
# M17 bounded construction search

Decision: test one directly authored closed surface cage for the head and emergence root. Do not tune M16's independent clipped solids again. This is an untested construction hypothesis, not art approval or authorization to implement.

## Evidence and cause

I inspected the frozen reference and M16 matched, detail, caster-side, rear-oblique and overhead originals at native resolution; four authoring modules were read. The reference observation is a swept, broken crest with intersecting skull/jaw planes and an irregular ground transition. Its unseen anatomy is not recoverable from this image; the user's emerging-dragon-head interpretation remains authoritative.

M16's native side/overhead show a box-like skull roof, enormous rectangular brow/white eye, broad cheek blocks and a support-like root. In `m16-head-sculpt.mjs:5–6`, `datum` only enters `part` metadata; `m16-author.mjs:18` stores it but never uses it to place, orient or join geometry. Thus names such as “crooked root” do not constrain the shape.

The braincase/crown/temple/brow bounds at head lines67–101 still define large overlapping masses: the crown spans64 world units in X; the near brow44. Their clipped planes leave broad exposed quadrilaterals. The near-eye bounds at lines160–164 span25×14×13 and fill white after carving. At author lines16/25, later solids replace earlier occupancy/color. Interior cell boundaries disappear; unequal cells therefore need not produce unequal visible facets. The root remains successive broad vertical solids from y0 to82. This preserves the same macro despite replacing smooth envelopes with angular cells.

The same mechanism explains the effects: flame lines74–75 explicitly overwrite overlapping flow cells, while its hot peaks are clipped inside existing parents at117–118; branching names need not alter the outer envelope. Pad lines30/42–64 establish one orange bed plus four broad fields before a few islands, leaving the mostly uniform warm disc seen overhead.

## Different route and concrete datums

Author the actual external boundary first, as a small welded polygonal cage: shared ridge vertices, cheek edges, jaw hinges and root section corners. Voxelize its closed volume through the existing authoring `volume` predicate at unchanged pitch; use original geometry only, with no renderer or harness change. Do not union a braincase box or straight neck core behind it. Shared boundary edges must directly control the visible creases and undercuts.

Provisional world datums below are manual 3D inference, not traced pixels or artist geometry. Use +X toward the flame, +Y up, +Z toward the near cheek:

- Skull chain: occiput `[-8,94,-8]` → brow `[30,94,-8]` → descending muzzle `[66,83,-5]`.
- Crest ridge: `[-20,105,-13]` → `[8,103,-11]` → `[36,95,-8]`; narrow its section toward both ends and sweep short backward tips from its rear edges.
- Jaw: hinge `[6,77,-8]` → low ramus `[27,64,-5]` → chin `[54,65,-4]`. Near/far rami share this hinge but have independently authored depth.
- Emergence section centers: `[-21,0,-8]`, `[-26,28,-10]`, `[-16,51,-10]`, `[2,76,-8]`; orient each section by the bent path, not horizontal stacking.

Manually place non-radial corners around these datums. The occiput-to-brow ridge must narrow the crown; cheek edges turn inward into the hinge instead of continuing as a full-width plate. Reserve a mouth wedge and cheek notch before closing the cage. Give the bent root eccentric near/far sections that merge into one irregular ground contact. These relations change the boundary itself; adding bevels or subdividing M16's same box would not.

## One bounded native experiment

Replace only head/root with this coarse cage; freeze M16 staff, flame and pad as controls, retaining F12/F13 as rejected. Use existing palette, camera/light/raster/build/pitch and the existing eleven-view capture batch. No decorative scutes, purpose-graph expansion or fine inlays before this form test. The existing art worker remains sole source owner.

Reject if matched/side still show a broad rectangular roof/eye panel, generic rounded helmet or straight support column; if the crest sweep and jaw hinge are only colored facades; or if rear/overhead expose a box backing that fills the intended undercuts. Require the fixed five subject angles as well as side/detail; one attractive projection cannot pass. A smaller eye or more triangles alone is no improvement. This experiment can establish a changed major-form mechanism, not full fidelity.

Only this ignored report and its audit are written. Five native M16 views, not all eleven, were inspected. Eight source hashes, five image hashes, capture record and reference were checked against retained pins; see `source-image-sha-audit.json`. No source, engine, Git state, gallery index, capture or browser was changed.

<!-- END EXACT ORIGINAL REPORT -->

## Findings and disposition

| ID | Finding | Disposition and reason | Repair or follow-up |
| --- | --- | --- | --- |
| F11 | Metadata-only datums and broad overlapping solids preserve wrong major relations. | Root accepted causal diagnosis; cage route remains untested. | Actual M17 eleven-view form gate. |
| F12 | Flame remains rejected. | Frozen control; no closure claimed. | Separate fidelity work. |
| F13 | Pad remains rejected. | Frozen control; no closure claimed. | Separate fidelity work. |

## Verification

The fourteen audited files, reference and manifest were read back unchanged when this wrapper was authored. Relevant exact pins follow; the audit retains all eight source rows. No capture, source change, runtime gate or engine verification occurred.

| Target-relative path | SHA256 |
| --- | --- |
| `renders/m16-capture.json` | `4cbe5cbfc2a6ef21e65b9c898cea7030f76db84e105db06491fda768f9b73b4e` |
| `renders/m16-caster-side.png` | `24d09cce2a1f8c747a4a67821585a263bed4d20896359c9c1e856d55323fe34b` |
| `renders/m16-detail.png` | `95fe625b41be95299fa9e80c44084f32affe8bd6be71d45bb7ea6bc8479e6d25` |
| `renders/m16-matched.png` | `382bd91a74470712912b02e43a7d7032976472780a833fb2602e95360913d986` |
| `renders/m16-overhead.png` | `14b535501fe42354d08dd881df1a9a9a4b675d6598b2c15fd089a9653a293baa` |
| `renders/m16-rear-oblique.png` | `4aa66181d9927dc6c04af5e627dfb57e16eb2f3a562f5d79b58e7e5f40eae209` |
| `source/m16-author.mjs` | `8d0733843a3aa3f630a0e5ea483af5fd04e174ed3c8488241528c76e435b6751` |
| `source/m16-flame-volume.mjs` | `fab3e94c2664dbbec89d35faf6cf97a161f5e29747c53cd4db2f87b8cdf8444d` |
| `source/m16-floor-pad.mjs` | `6a22c3abe6dd8efcde70e131ec624f0d1576132546706d299503aa338b1f80d9` |
| `source/m16-head-sculpt.mjs` | `c2f47149a0ed188e8f66d2e3a2ff0a565bef3c9bc32fd6c235167c7b9ab14737` |

## Round outcome

Root later separately dispatched one coarse M17 head/root experiment under the human's renewed keep-going mandate; the original proposal itself was not authorization. The predeclared contract is `tmp/work135-m17-comparison/predeclared-contract.json`, SHA256 `cc43577b949c1264837b39ad64efdedc5441e1f04f9beaff4b2858b9cfa40173`. Its original head/root ROI is x80–425/y5–335. This records the dispatch, not a new threshold or a passed result. F12/F13 remain rejected controls. No M17 form, full-reference art or game readiness is approved.

