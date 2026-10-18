# Review 40: implementation

## Target

Actual M20 focused head/neck correction in `C:/Users/38909/Documents/Codex/2026-10-18/voxel-art-reference-proof/outputs`, against `reference/frozen-original.png`. Repository context is aoe2 main `5ae0396b482eb523defe826f7934e83839b13745`; the reviewed artifact is the external capture set, not product source at that commit. Manifest `renders/m20-capture.json` pins eleven originals. The digest table below binds this verdict to inspected bytes.

## Reviewers and coverage

Codex delegated reviewer `m20_fresh_native_review` performed a fresh independent visual review on 2026-10-18. The reference and all eleven originals were opened individually through `view_image` with `detail: original`. No gallery, source, prior review or producer/root visual opinion was consulted before the first verdict, which was sent after every image and both digest passes. Review access was read-only except this assigned report and ignored evidence. No subagents, browser, GUI session or server were launched.

## Reports

**Independent visual verdict: FAIL the coarse head/neck gate.** These are visual form findings, not a component-count or connectivity verdict.

The reference presents unequal neck masses that turn progressively into the head. M20's bright front bands can suggest four sections, but matched, detail and caster-close show repeated square ledges attached to one broad red column. Caster-side makes the forward progression visible, yet the long rectangular front edges still repeat. The shorter upper transition appears as a horizontal band under the head; it does not resolve into a convincing partly obscured turning mass. Rear-oblique, opposite-side, low-up and seeded exploration reinforce the continuous slab reading. Broad contacts are present, but three shallow genuine shape joints and the reference's varied mass rhythm remain unproven. Smaller red dorsal plates do not substitute for neck components.

The head is dominated by its broad terraced roof. In matched and caster-close, the brow/skull extends as a lid over a much smaller layered cheek support. Caster-side exposes the weak local hinge most clearly: the cheek lacks enough concentrated volume to unite the long upper projection with the lower jaw. The muzzle does descend in stepped form, and the lower jaw is short and bent; those are partial successes. They do not recover the reference's compact skull-to-cheek proportions.

The crest has visible volume and multiple tips, but side and overhead show long, nearly parallel planks following similar directions. It needs more variation in sweep, length and attachment to the compact skull. The matched base sits visibly farther right and lower than the reference's base, while the neck reads more upright. This changes the reference's leaning progression and composition even before fine ornament is considered.

Depth is a partial success in this submission, not a claimed improvement over an uninspected milestone. The opposite, rear, overhead and exploratory views show a coherent solid subject rather than a favorable-camera facade. No paired feet or humanoid limbs are evident. Front-oblique supports that reading; spell-end has substantial foreground flame occlusion and cannot independently settle hidden head anatomy. These successes do not cancel the anatomy failures.

## Findings and disposition

| ID | Finding | Disposition and follow-up |
|---|---|---|
| F11 | Neck rhythm/joints, dominant skull roof, weak cheek/hinge, parallel crest and matched placement remain material. | Unresolved; reviewer recommends rejection of this coarse gate. Preserve connected depth and bent jaw while correcting the masses. Integration owner owns final disposition. |
| F12 | Flame control. | Outside this focused review; remains unaccepted for full fidelity. |
| F13 | Pad control. | Outside this focused review; remains unaccepted for full fidelity. |

Fine eyes, teeth and tiny scales are deferred and are not rejection reasons. Staff controls are also outside this head gate. No new finding identifier is created for F11's anatomy subfindings.

## Verification

All twelve image hashes matched their pins before inspection and remained unchanged afterward. All eleven capture dimensions matched the manifest; PNG dimensions were read from IHDR bytes. The manifest also remained unchanged. Ignored evidence: `tmp/work135-m20-review/inputs-before.json` and `inputs-after.json`. Counts, capture metrics, component labels and geometry connectivity supplied no visual acceptance evidence.

| Input | Dimensions | SHA-256 |
|---|---|---|
| frozen-original.png | 685 x 419 | 83bea5c03c0293710b27578bc0b2d6cf86fbb47bbe987695f9a3a7b1861016ef |
| m20-capture.json | manifest | 512ea007b85a2c58b997e6f40182f53d5a7f56ff903f4441ef435aaa39e3cc8c |
| m20-matched.png | 685 x 419 | b67f248c63ea7526c147198cd8096b51d9139c07d4ec1f2dae2538509c31fe35 |
| m20-detail.png | 1370 x 838 | 499b6869ec94322568fb05dc94d694fce5d4def49bca1794b777cb6609f086b4 |
| m20-front-oblique.png | 800 x 600 | 98c3a291c7550af1701afdc4c0e30a0ce7ba54e136b219507b1c90d0b50c8015 |
| m20-rear-oblique.png | 800 x 600 | 4b030ee9594c358824ff9f2006689f400a20caa85f87b917c0f9f8f68089ba48 |
| m20-spell-end.png | 800 x 600 | 20f7f617490326623fa6e0354ff0c9a142b08b8d90df6af3a8347d2f07a18c8e |
| m20-opposite-side.png | 800 x 600 | a300383988cecd6f675a3f5cb240db1bd61d23098635bdab1e5b05753757ed4d |
| m20-overhead.png | 900 x 700 | 2f14d76df59f8bfcfab67f608c0336e0ae4760c301200037550acc628faa9f56 |
| m20-caster-close.png | 700 x 700 | 032df4f6a62619b11c5719c1bedbba468e4e334e5dc24e17625eabd428a458d4 |
| m20-caster-side.png | 700 x 700 | d351cfd166f410dea3468ab6bdc99715dc713531b953a3135f1dccb213989881 |
| m20-low-up.png | 800 x 600 | 82334f62b93777e3ffb966af664acc1595c7e54d70d437edd96f70e297842bab |
| m20-explore-seed-20261018.png | 800 x 600 | 29ab5fe616e5b7d33a5b92643ac2882c5af33fc4daaecef42e721e436d271255 |

Session-start `npm run ci:status` exited 1, UNKNOWN because it could not resolve the commit. Ordinary Git reads exposed this account's dubious-ownership refusal; a per-command safe-directory read confirmed the stated base without changing Git configuration. Runtime gates were not run for this report-only review. This limitation is separate from the visual rejection.

## Round outcome

F11 remains open. Partial connected-depth, muzzle and jaw successes are retained within the failed coarse form gate. This round grants no full art, game or flame/pad/staff acceptance. Root owns integration; the external proof chat remains the sole source implementer. Another native review must inspect the corrected actual renders across the same coverage.
