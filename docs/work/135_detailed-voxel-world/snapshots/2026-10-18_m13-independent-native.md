# M13 independent native art review — 2026-10-18

## Target

Verdict: **REJECT** for the standalone reference art proof. The flame and pad do not meet the fixed style-and-content criteria at the matched 685×419 camera. This verdict makes no claim about game production or performance readiness.

Reviewed root: `C:/Users/38909/Documents/Codex/2026-10-18/voxel-art-reference-proof/outputs/`. The target is the reference and eleven M13 PNG originals named below, bound to `renders/m13-capture.json` SHA256 `b4a5320c7a0bbcf951e1a7667ea0388f4bdb9de47cf03d62f4a26424285252ad`. The integration owner owns binding these bytes to the retained immutable M13 packet and assigning the permanent round/dispositions.

## Reviewers and coverage

Reviewer: Codex native-image subagent `/root/m13_fresh_native_review`, independent of M13 authorship. One bounded read-only art acceptance round. No source, engine, harness, camera, lighting, UI or game changes; only this report was authored.

I inspected the frozen reference and every M13 original individually through `view_image(detail="original")`. I formed and reported the M13-only rejection before opening either M12 image or any prior/current authored review. I then inspected the actual M12 packet's matched and detail originals at native resolution. No worker review was read. No montage, thumbnail, voxel count or runtime metric supplied the artistic judgment.

The fixed criteria were anatomy and casting gesture; head/jaw/voids and armor organization; purposeful fine interlocking volume and material/value grouping; uneven directional flame tongues and fragmented bright core; a narrower asymmetric pad; and coherent authored volume across the fitted angles. I did not require an exact reconstruction of surfaces absent from the single reference.

## Reports

### Native pixel judgment

**Flame — material blocker.** At 685×419, M13 reads as a bulbous mass of nested orange/yellow lobes with a short dark red neck. Its broad continuous value faces dominate the shape. The bright end has a few small white cuts, but these do not create the reference's broken bright core or uneven angular tongues. The two-times detail view makes the small voxel steps visible without changing this large-form read. The opposite-side, low-up and exploratory views expose the same smooth stacked-lobe construction; the spell-end view reads as a broad solid disk. This is a coarse volume with fine edges, rather than the requested purposeful flame form.

**Pad — material blocker.** The matched pad is smaller and its rim has small irregular steps, but the dominant design is concentric red/orange/yellow bands around four large pale center tiles. Overhead confirms the regular nested organization. The reference's unequal interleaved patches and uneven footprint create a more authored broken platform. M13's smaller footprint satisfies the narrowing direction only partially; it does not satisfy the asymmetric interlocking form criterion.

**Caster — readable construction, incomplete style/content match.** The large head, open mouth, bright eye and teeth, bent forward arm, open hand, separated legs and layered shoulder identify the intended caster. The mouth opening and the gap below the head remain actual readable voids across close and side views. The shoulder/chest overlaps are meaningful shaped volumes. However, the head still resolves chiefly as a long, low red shell with parallel bright ridges over it and an extended horizontal mouth slot. At the matched scale, those ridges do not supply the reference's more staggered face/jaw planes and closely interlocking armor masses. The close view confirms additional authored contours, but the fine surface strips cannot substitute for that organization. This is a secondary shortfall beside the decisive flame and pad blockers.

**Volume across angles — positive evidence with a bound.** All eleven views consistently show one volumetric figure and effect. I found no view-dependent facade or failure to present the main forms. Front, rear, opposite, overhead, low-up and exploratory views provide useful coverage; the isolated caster views preserve the arm and jaw gaps. Coherence in space is established for these rendered views. It does not turn the broad flame or regular pad into the requested art style, and the unseen reference surfaces remain unknown.

### M12 comparison after the independent judgment

The frozen M12 packet is under `packets/m12-visual-20261018/`. Its matched camera and detail camera have the same recorded position `[264,188,300]`, target `[64,48,0]`, span `165` and `daylight:false` as M13. Both matched PNGs are 685×419; both detail PNGs are 1370×838.

M13 gives the near shoulder and chest more articulated overlaps and reduces the pad footprint. These are visible gains. The flame becomes rounder and more continuous; M12's larger white breaks at the tip were closer to the reference's bright breakup. The pad also loses M12's interleaved tiles in favor of larger center squares and clearer concentric bands. The head changes do not materially resolve the matched-scale shell-and-ridges read. This comparison confirms mixed changes and does not alter the rejection formed from M13 alone.

## Verification

SHA256 values below were read before and after native viewing and remained identical. All eleven M13 file hashes match `m13-capture.json`; all PNG header dimensions match their recorded capture dimensions. The frozen reference matches the assigned SHA256.

| Original | Native size | SHA256, unchanged before/after |
|---|---|---|
| `reference/frozen-original.png` | 685×419 | `83bea5c03c0293710b27578bc0b2d6cf86fbb47bbe987695f9a3a7b1861016ef` |
| `renders/m13-matched.png` | 685×419 | `f301a4f0c3df9720de34b1601a8825d84cd683b7ae2ddff58e18c65abee1d67e` |
| `renders/m13-detail.png` | 1370×838 | `acc2f6d079b8a5c5f0ddbfd6787f00f37947181034f3d7acdf0d910d88efefcc` |
| `renders/m13-front-oblique.png` | 800×600 | `044b474a428a5687f9482691daf3235ee7a827287e7aa7e241f97cf8eb98bafe` |
| `renders/m13-rear-oblique.png` | 800×600 | `5d3a2162738cbd5cb97e09155978c92c7ee1c37b72cb96372751f08082f6ce44` |
| `renders/m13-spell-end.png` | 800×600 | `ff7c81871816dc7f6b5abf55fadf6836341e8d89bb3559b413e715aaab90d443` |
| `renders/m13-opposite-side.png` | 800×600 | `31755d53b8c528c32a8bf90736a97f16e5531ca7cd09a6a0e9039597413dc814` |
| `renders/m13-overhead.png` | 900×700 | `d3b977cbc1190fa7e8cf572c73d1a4947b24c1e53476860553911a82a5c0f01a` |
| `renders/m13-caster-close.png` | 700×700 | `a98db06fccb9f025a30763e4cc8f9886f9223a81a171750de8db0c0a0e29284f` |
| `renders/m13-caster-side.png` | 700×700 | `3627e4e472a95bdca720c833fa4d3f127ff98d0d8b2b0591d2af7858fba4c9e5` |
| `renders/m13-low-up.png` | 800×600 | `e5d9ed72016cec5af6a5b7c1e72a94b2d939ee8ec077f582512bd8ed9a4fca82` |
| `renders/m13-explore-seed-20261018.png` | 800×600 | `d9e36dfdc3445ba5c679c5eaec8610ebcf9ae52636ec50bd420bea7cd9555a9d` |
| `packets/m12-visual-20261018/renders/m12-matched.png` | 685×419 | `aec8a57ab66de22ee33b894ecbebbe6013371bc503733203d817ed5e86cadce4` |
| `packets/m12-visual-20261018/renders/m12-detail.png` | 1370×838 | `4c6a4066d31e7877f8fb665286dd8fc2240b169db92240877f8ca9d7988effc0` |

The pre-capture settings file's SHA256 `38d4ab8cb4c64f02bc545cc988fc3d5b32e24ecc8dfafc0b8f0d092061c3429f` matches `checks/m13-settings-and-occupancy-lock.json`. All render fields for all eleven views match its nested settings; the capture adds the view name to fitted-view settings. The matched settings are 685×419, position `[264,188,300]`, target `[64,48,0]`, span `165`, `daylight:false`. Detail keeps that camera at twice the pixel dimensions. I verified these pins as metadata; I did not re-execute the renderer or establish the reference camera from its pixels.

The candidate-freeze record SHA256 `339e2d6f9c2cd527df28bb7086bb03d6991ea504df1d98a15b23050834f37272` matches its lock. Its five source and three harness hashes match the files present. This supports target identity and does not establish art quality, engine correctness, build reproducibility or game cost. The capture reports no errors and browser/server cleanup; those are retained producer claims, not a fresh execution by this reviewer.

The mandated initial `npm run ci:status` returned exit 1 with `UNKNOWN — could not resolve the commit to report on`. A subsequent read-only Git call exposed the sandbox user's ownership mismatch; a command-scoped `safe.directory` override allowed status/worktree inspection without changing Git configuration. No remote gate result is claimed. Runtime gates and performance tests were not run for this read-only image review. No browser, server, GUI process, temporary capture or worktree was created by this reviewer.

## Round outcome

**REJECT.** The native matched view fails the flame and pad criteria, with an additional caster form/style shortfall. The fitted angles establish a coherent volume, not acceptance of its reference match. The comparison and metadata checks do not override the pixel findings. Final acceptance and immutable-packet binding remain with the integration owner; this report assigns no repair pass.
