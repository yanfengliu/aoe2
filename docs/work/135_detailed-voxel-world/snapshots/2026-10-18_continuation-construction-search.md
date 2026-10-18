# Subject-first construction search

2026-10-18. Owner: `art_construction_search`, bounded independent read-only worker. One authored report; no art, source, engine, capture, browser or gate changes. All 23 native PNGs in frozen M13 were inspected: reference, eleven M12 and eleven M13 views. Their actual SHA256 values match the packet manifest. Manifest SHA256: `912d18e9f06f7002a26cd21bc33a9aeaa26d662a04c5df06ce9c7cb102e963c6`; frozen reference: `83bea5c03c0293710b27578bc0b2d6cf86fbb47bbe987695f9a3a7b1861016ef`. Evidence root: `C:/Users/38909/Documents/Codex/2026-10-18/voxel-art-reference-proof/outputs/packets/m13-one-pass-20261018/`.

**The human's subject correction is authoritative: this is a dragon head emerging from the ground, not a small dragon person with arms and feet. M12/M13 are the wrong subject.** My initial message proposing a flame-only prototype while retaining the caster is withdrawn. It was sent before that correction reached this worker. Flame/pad improvements cannot rescue the humanoid interpretation. A single view leaves unseen anatomy ambiguous; that uncertainty does not override the user's intended subject.

## Fixed result and disqualifiers

Keep this same 685×419 reference, matched camera `[264,188,300]`, target `[64,48,0]`, span165, existing palette, lighting, raster, build and renderer. Construct original, genuinely volumetric authored occupancy. The result must read as one emerging dragon head, with an upper cranial mass, brow/eyes, projecting muzzle, open jaw, horns/scutes and a continuous emergence base grounded in the glowing patch. The flame and the forked vertical feature remain reference content; this correction supplies no basis for insisting that feature be held by a hand.

Reject a bipedal silhouette, paired boots, pelvis, shoulder–elbow–wrist chains, fingers, a humanoid torso with a dragon head, or those same shapes renamed as roots/plates. Also reject a screen-mask extrusion, imported artist model, generated image, camera/light change, close-only rescue, or geometry counts presented as art acceptance. The unseen back needs a coherent continuation, not an invented claim of exact source anatomy.

## Counterevidence and why another local repair is insufficient

M13's `source/m13-author.mjs` explicitly constructs `near-left-leg`, `far-right-leg`, `pelvis-waist-and-ribcage`, `near-folded-arm-and-pauldron`, `casting-arm-upper-elbow-forearm`, and `gauntlet-palm-knuckles-fingers`. The side and caster-close originals show the corresponding two boots, narrow waist and bent reaching arm. This is a whole-subject schema error, not merely a label or shade problem. Its existing head uses independently changing skull sections, real jaw branches and carved sockets; another instruction to “use anatomical sweeps” would repeat an already implemented mechanism without correcting the subject.

Secondary findings remain useful only after subject correction. M13's flame adds broad lobes with radii14–20, then white folds with radii3–6; the actual matched/end/overhead images show the folds largely swallowed by the pale envelope. Its floor source fills radial heat bands and a few rectangular white regions; the images show rings and large tiles. These are concrete construction failures, not proof of a renderer limit. No new rendering or capability experiment was run.

## Three feasible constructions

| Family | Actual construction | Benefit and failure risk |
| --- | --- | --- |
| **Head-and-ground maquette with protected voids — recommended first** | Author a small, explicit 3D assembly of cranial vault, paired cheek masses, muzzle, jaw rami/chin, horns and one broad buried throat/root. Reserve the mouth opening and side jaw clearance before filling solids. Every mass is attached to the head or ground; there is no humanoid skeleton. Voxelize these angular masses through the current authoring/export path, then sculpt selected planes. | The cheapest way to falsify the wrong subject before spending on fine ornament. It can fail as another generic dragon skull or a head on a pillar; the ground transition and source-specific crest/muzzle/jaw relationships must be judged at matched size. |
| **Direct sectional occupancy sculpture** | Hand-author compact integer occupancy runs at multiple independently chosen world-space sections through skull, jaw and emergence base; define front, middle and rear sections with changing depth and actual cavities. Interpolate only between declared neighboring sections, then make selected local voxel edits. No reference pixels are sampled. | Precise, direct control of angular contour and asymmetry without smooth primitive envelopes. Labor is higher; parallel copies of one contour would recreate a slab. Side/overhead sections must contain independently authored structure and closed end volumes. |
| **Volumetric cell assembly with explicit ownership** | Partition the head and emergence base into unequal angular 3D cells with declared neighbors and single material ownership; reserve empty cells for mouth/cheek breaks. Separately build flame flow cells around a branched hot core and partition the pad into authored unequal patches, rather than applying radial bands. | Makes boundaries, hot passages and mosaic regions explicit instead of hoping overlapping primitives expose them. It risks a coarse collection of Lego blocks or a complicated tool replacing the art problem. It is a useful later refinement only if a small maquette already reads correctly. |

These are alternatives, not three implementations to dispatch. The recommendation changes the subject's topology first; it is not a renamed version of M13 with feet hidden under a larger pad. Do not build a general sculpting system for this one study.

## Concrete construction contract before detail

- The skull, brow, muzzle and jaw form the subject's dominant continuous head assembly. The reference's top crest/upper face, roughly x164–374/y29–154, anchors its direction and jagged shape; these approximate visually read landmarks are guidance, not a replacement pixel oracle.
- The lower subject region, roughly x142–281/y109–282, must read as head/throat/emergence structure flowing into the ground. It must not contain a waist above two separated columns with flat soles. No inter-leg gap reaches up beneath a pelvis.
- The lower jaw belongs to the skull: its hinge sits beneath/behind the eye, its rami frame an actual mouth void, and its visible continuation returns into the head/base. A detached diagonal reaching arm with a palm at its end fails even if colored like bone.
- The emergence base broadens or interlocks into the glowing ground region. It cannot end as two small contact pads. The ground overlap must survive side and overhead views; hiding humanoid feet from the matched camera fails.
- Horns and scutes follow skull planes. Bright insets cannot substitute for brow, cheek, jaw or ground attachment. Fine details are deferred until these relations are visible in the normal matched capture.

## Cheapest next prototype and acceptance

The existing implementer should author one coarse head-and-ground occupancy candidate with the unchanged render path and palette, omitting decorative ribs/inlays. Rebuild the whole subject schema; retain M12/M13 only as immutable rejected history. Keep scene framing and the ancillary reference content fixed so the subject change is reviewable. This report does not capture or dispatch that candidate.

First inspect its actual native matched capture. Reject immediately if an observer still sees a standing dragon person, a head attached to a narrow column, paired boot contacts, or a reaching hand. Do not compensate with a brighter flame or finer voxel pitch. If the subject reads correctly, inspect fixed-method side and overhead captures for a real mouth cavity, full cranial depth and one continuous ground attachment. Only then spend on source-specific planes, patch rhythm and the complete eleven-view final set. These three early views are a rejection filter, not final reference-quality acceptance.

Explicit false passes: removing part names while keeping the humanoid silhouette; burying unchanged feet behind a pad; replacing a hand with an unnamed protrusion; passing a single projection while the reverse remains a person; using colored stripes to imply a mouth with no cavity; calling a generic emerging skull faithful; or declaring success because occupancy is connected. The full target still requires native reference comparison and independent visual acceptance. No candidate has passed this contract in this search.

## Bounds and handoff

This search inspected existing pixels and source; it produced no prototype, performance measurement, fresh render reproduction or new evidence of an engine weakness. The packet's authored review and the earlier mechanism report were read; no concurrent diagnostic reviewer or implementer was consulted before the initial result. The human correction then superseded that initial result. One existing worker remains the sole art implementer. Total monetary/compute cost is unavailable; no render/gate/browser/server was started. Repository status was inspected with a command-scoped safe-directory setting; no global Git configuration or pre-existing dirty file was changed. No new task-owned process or temporary artifact needs cleanup.
