# Review 39: implementation

## Target

Actual M19 coarse head/neck component blockout, reviewed on 2026-10-18 against the frozen original. Repository context is aoe2 main `5ae0396b482eb523defe826f7934e83839b13745`; this is a review of the identified rendered bytes, not a source audit. Inputs remain under `C:/Users/38909/Documents/Codex/2026-10-18/voxel-art-reference-proof/outputs/`: `reference/frozen-original.png`, `renders/m19-capture.json`, and its eleven actual PNGs. The digest table binds every inspected image.

The subject is a dragon head emerging from the ground. Four unequal neck components, three genuine shape joints, connected volume and distinct head components are required. Small red plates do not count as additional neck sections. Fine eyes, teeth and tiny scales are deferred. Unseen anatomy is inference.

## Reviewers and coverage

Fresh native visual reviewer `/root/m19_fresh_native_review` inspected the reference and every actual PNG individually through `view_image` with `detail: original`. Coverage included matched, detail, front-oblique, rear-oblique, spell-end, opposite-side, overhead, caster-close, caster-side, low-up and the seeded exploratory view. No contact sheet, source label, component count, connectivity probe or render metric supplied the art verdict.

The first verdict was sent after all eleven views, before reading source, earlier review prose or producer/root visual verdicts. No source was subsequently inspected. The integration owner supplied the existing F11 umbrella identifier after that verdict. Dispositions below are this reviewer's recommendations; final acceptance belongs to the integration owner.

## Reports

**Independent native report: reject the overall M19 component-form gate.** There are useful construction gains. The object reads as a grounded dragon neck, without paired feet or humanoid limbs. In caster-side, rear-oblique and opposite-side, four substantial masses can be followed through real contour pinches. The upper transition is shorter and partly covered by the head. This is more than a smooth stem with colour stripes. The neck remains visibly joined around the view sweep; no detached camera-facing facade is demonstrated.

The neck's visual rhythm remains a material failure. The three fuller lower masses repeat a similar square, horizontal shelf shape. Their offsets and heights are unequal, but the result still reads as stacked cuboids joined by narrow links. The reference instead gives these volumes different fullness, slope and overlap, producing a neck that rises and bends into the head. Small rear plates and cream panels do not repair the repeated primary mass shape. This objection concerns the large silhouette, not missing surface detail.

The head has separately visible parts, yet their hierarchy is weak. A wide, flat roof dominates the skull/brow. The orange cheek below it reads as a hanging block rather than a strong localized hinge that joins skull, neck and jaws. The descending upper muzzle and short bent lower jaw are present and should be preserved. They do not, by themselves, make the broad roof and supporting neck match the reference's compact, integrated head relationship. Caster-close and caster-side make this distinction clearest.

Several crest projections have unequal lengths and extend rearward, which passes presence. Their shared flat, parallel plank treatment produces a comb-like extension of the roof. The reference's crest has more varied projection shapes and sweeps. Overhead confirms the planks' broad alignment; low-up and explore retain the shelf-and-roof reading. Those views establish surviving volume, but do not cure its proportions or relationships.

## Findings and disposition

| Finding | Reviewer disposition | Required follow-up |
|---|---|---|
| F11: neck mass rhythm | Unresolved; count, unequal extent and real joints pass partially, but repeated cuboid construction fails the form target. | Reshape the three fuller masses and their overlaps; preserve four components and three joints. |
| F11: skull/hinge hierarchy | Unresolved; descending muzzle and bent lower jaw pass presence, while roof dominance and weak cheek connection fail. | Establish a compact skull/brow and stronger localized hinge before adding fine features. |
| F11: crest silhouette | Unresolved; several unequal projections exist, but parallel plank shapes fail the swept crown relationship. | Vary projection shape and direction within the reference's visible silhouette. |
| F12 flame; F13 pad; staff control | Outside this gate and unaccepted for full fidelity. | Preserve exact controls; judge their fidelity in their assigned gates. |

## Verification

Before and after SHA-256 checks match for the reference, manifest and all eleven actual captures. Manifest count, unique in-root paths, PNG signatures, dimensions, declared digests and empty error list pass. Ignored evidence is retained in `tmp/work135-m19-review/before.json` and `after.json`. These integrity checks identify the reviewed bytes; they do not pass art.

The work-document checker passes across 137 units. Required headings, zero CR bytes and a single final LF are checked before freezing this report's digest in the ignored evidence folder.

| Input | Native size | SHA-256, unchanged before/after |
|---|---|---|
| Frozen reference | 685 × 419 | `83bea5c03c0293710b27578bc0b2d6cf86fbb47bbe987695f9a3a7b1861016ef` |
| Capture manifest | JSON | `650239fcee31de52854683637912a5e096a931154d4046105bdde341ad745f56` |
| matched | 685 × 419 | `175cdef6551f10bc97bcd1d85d87ffff955fb4afb9c9f57295b10fe813ec0f7c` |
| detail | 1370 × 838 | `b3d5607841af76dbda21040b7ea88665cc0015cc0c3fa2028b0fc7217dce27fe` |
| front-oblique | 800 × 600 | `96c25c63d550370d71aa103264f0e7b7f1c272851223743d7733e7f05a63750d` |
| rear-oblique | 800 × 600 | `197a78e48597c6d6b038b5ec26320f177d3f58cdddf60674427e5521d081893a` |
| spell-end | 800 × 600 | `2279ae1a04aae019dac74b34d91a1fb2a684a7b23447b6efd5fb95055266dab4` |
| opposite-side | 800 × 600 | `84eaef33d7c2b8ce76977810c24233e506924cc4a9dacaf64714042dc7a50fa4` |
| overhead | 900 × 700 | `9a21fd71e9c555f47fee457fae660876ea40c15a4fdd6ea9648f08659ba4351b` |
| caster-close | 700 × 700 | `e43585bca1146bacd25320487a71c425bc61c0dc57ce36bf6cc521f24aaf5de2` |
| caster-side | 700 × 700 | `54f3a5140f1f6b3f1a5f82ab33f0c929dcdad9fc771976d1c63f827806ad6788` |
| low-up | 800 × 600 | `ecd3c4ec0c4308380bfd503d8816b013af34432dee20ad5d437367c21084438e` |
| explore-seed-20261018 | 800 × 600 | `6e0c693ebfafde24155a60b9e97c6bb7ae1cf33c140e495a4af27af9493fdcd0` |

`npm run ci:status` first could not resolve HEAD because of Git ownership protection; a retry with process-local safe-directory configuration resolved the assigned HEAD but could not reach GitHub. Remote CI and corpus are unknown, not failed or passed. Runtime gates were not run for this review-only document. No browser, GUI, server or watcher was launched. No source, capture, image or gallery was changed, and no Git mutation command was run.

## Round outcome

F11 remains open. Preserve the real four-part construction, continuous neck, descending muzzle and short bent jaw while repairing the primary mass rhythm, skull/hinge relationship and crest shapes. Re-review actual captures from the complete view set after those coarse changes. This rejection does not concern deferred fine detail, and neither a later component pass nor these partial gains would establish full art fidelity or game readiness.
