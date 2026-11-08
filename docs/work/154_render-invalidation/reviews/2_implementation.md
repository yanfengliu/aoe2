# Review 2: implementation

## Target

AoE2 work154 selected render invalidation in `C:/Users/38909/Documents/github/aoe2-worktrees/engine-pin-1107`. Base commit `a0e10435912d97078ee033112d49926a36807fde`; final prepared staged tree `8785d2c40db93c9448afd8c69c53c9e830eb6517`, twenty changed paths. The implementation and tests were previously reviewed at tree `3de9f60dc0b0a5f2338aa8633dfb2966fa63002d`. This round inspects the native visual evidence, capture provenance, final documentation/metadata and exact source continuity. It does not replace the complete source and performance reports in rounds 0 and 1.

The capture receipts identify baseline commit `a0e10435912d97078ee033112d49926a36807fde` and candidate tree `3de9f60dc0b0a5f2338aa8633dfb2966fa63002d`. Original evidence is under `output/playwright/work154`, `output/playwright/work154-wide` and `tmp/render-invalidation/measurement` in that worktree. The verified retained visual copy is `C:/Users/38909/Documents/github/aoe2/tmp/work154-retained/visual`; the gallery is `C:/Users/38909/Documents/github/aoe2/tmp/visual-gallery/index.md`.

## Reviewers and coverage

Independent native Astra/xhigh reviewer `publisher_review`, assigned by root. I inspected local files, exact Git diffs, retained logs/receipts, native-resolution PNGs and artifact hashes. I launched no browser, build, test, benchmark, install, network query or external reviewer CLI. No product/test files were changed. The only authorized write in this round is this report; root owns staging, final gates and delivery.

## Reports

### Independent native Astra/xhigh: visual evidence and final claims

No material rendering regression or materially overstated new evidence claim was found within this bounded review.

**Exact target and source continuity.** Read-only Git comparisons confirmed that the index equals final tree `8785d2c40db93c9448afd8c69c53c9e830eb6517` and the tracked worktree equals the index. Relative to previously reviewed `3de9f60d`, the only source change is explanatory prose at `src/game/simulation/createSimulationBridgeOptions.ts:61`; the runtime implementation and both new tests are unchanged. The comment correctly distinguishes same-tick selected invalidation from the retained full refresh for between-tick changes. The remaining changes are documentation/review records and package metadata. `package.json` changes only the game version to `0.3.278`; `package-lock.json` changes only its two root version fields. Dependency, integrity and engine-pin entries do not change. The actual installed/locked engine remains 2.9.0, as independently established in round 1, with no new runtime API or persistent format in this work.

**Actual images inspected.** I personally viewed sixteen original 1280x800 PNGs, without cropping or downsampling: ten useful candidate images, five baseline partners and one deliberately excluded fog-only candidate. Relative paths below are under the original `output/playwright` root and retain the same paths under the primary retained visual root.

| Scene | Candidate PNGs inspected | Baseline PNG inspected |
|---|---|---|
| Default opening | `work154/opening-default-de-after.png`; `work154/opening-default-moebius-after.png` | `work154/opening-default-de-before.png` |
| Selected Town Center and queued training | `work154/opening-train-close-de-after.png`; `work154/opening-train-close-moebius-after.png` | `work154/opening-train-close-moebius-before.png` |
| Loaded Castle Age base | `work154/late24-focus-de-after.png`; `work154/late24-focus-moebius-after.png` | `work154/late24-focus-de-before.png` |
| Loaded Imperial Age random focus | `work154/late36-random-de-after.png`; `work154/late36-random-moebius-after.png` | `work154/late36-random-moebius-before.png` |
| Corrected useful wide opening | `work154-wide/opening-wide-visible-de-after.png`; `work154-wide/opening-wide-visible-moebius-after.png` | `work154-wide/opening-wide-visible-de-before.png` |

The sixteenth inspected image was `work154/opening-wide-de-after.png`. Its framing is predominantly black fog and a world corner; it does not count as useful gameplay coverage. I did not personally view all twenty-four before/after PNGs. I did independently compare all twelve pairs: every pair has identical SHA-256 hashes, every after PNG declares 1280x800 dimensions, and every corresponding maintained diff log reports zero changed pixels out of 1,024,000. Thus twelve artifact pairs are identical, of which ten are useful views. Hash equality supports exact image identity without relying on a pixel-diff threshold.

The inspected useful views cover the default base and surrounding fog, selection ring and training queue, dense late buildings/units, a forest/villager focus, HUD/minimap and wider base framing in both DE and Moebius styles. The opening training views visibly show food reduced from 200 to 150 and a queued Villager at 0%. I observed no missing geometry, new selection/HUD discrepancy or other change regression in these images. The Castle Age selected-Town-Center command area has the existing ORDERS/TRAIN label and bell/training-card overlap. It is present identically in the inspected baseline/candidate pair; all pair hashes agree. This inherited layout defect is explicitly disclosed in the new records and is not repaired or newly introduced by this change.

**Capture inputs and actual GPU.** I read the two capture receipts, wrapper scripts and the maintained capture path. Both arms use `aoe2-prototype`, 1280x800, one advance tick and their stated art style. The close view uses zoom 2.4 and Town Center selection plus real H/Q key presses; the corrected wide view uses zoom 0.7 and H recentering. The late views load the retained 120x120 saves at tick 24000 and 36000 through the maintained HUD-load helper, with zoom/focus as recorded. The late random focus is the reproducible seeded choice 59,58 at zoom 1.60; it is one sampled framing, not broad random exploration. The original wide 40,40 framing is excluded.

All twenty-four capture stdout logs report the actual renderer `ANGLE (NVIDIA, NVIDIA GeForce RTX 4090 (0x00002684) Direct3D11 vs_5_0 ps_5_0, D3D11)`. This is read from the page's graphics context, rather than inferred solely from requested launch flags. Baseline and candidate previews use separate explicit ports 43154 and 43155 with strict-port binding and their respective working directories. Both preview logs show those ports. The wrapper checks the baseline's 822 source blobs and candidate source continuity, verifies the retained baseline build, builds the candidate once and propagates its exact preview port to each capture. I independently rehashed all eleven retained baseline build files: zero mismatches.

An unchanged surrounding safeguard at `scripts/captureMapScreenshot.mjs:83` rejects a dist older than source; at line 110 it compares the served HTML's hashed asset set with that checkout's local build. The same script launches headlessly at line 129, uses the HUD save loader at line 280, emits real keyboard presses at line 474 and closes the browser in `finally` at line 498. These checks make the arm/build association and interaction evidence materially stronger than a screenshot filename alone.

**Commands and cleanup evidence.** The main receipt records thirty-one successful commands: one candidate build, twenty captures and ten diffs. The supplementary receipt records six successful commands: four captures and two diffs, reusing the candidate build. The outer process receipts report 149 and 36 observed owned processes, exit code zero and no final cleanup stops or leftovers. I inspected the wrapper's descendant tracking by PID/creation identity, hidden launch and owned-process cleanup, and the inner preview-server `finally` cleanup. “Zero cleanup stops” refers to the outer receipt; it does not mean the preview servers were intentionally left alive or that no inner cleanup termination occurred. These are retained run-time censuses, not an independent live-machine census performed by this reviewer.

**Retention and gallery.** I independently rehashed all 116 entries in the primary visual retention manifest and checked file sizes: 9,424,130 bytes, zero missing files and zero mismatches. Manifest SHA-256 is `BB0D625E4A90928859708AFE84ABC4594DB5F168FD4CAB5756D05DFF26AFCFCD`. All thirty links in the new Work154 gallery section resolve: before, after and diff for each of the ten useful pairs. The gallery explicitly excludes the fog-only framing, discloses the inherited HUD overlap and states that full local/hosted delivery is pending.

**Final claims and metadata.** I read every final documentation/metadata delta against the previously reviewed tree, including spec, architecture/drift log, changelog, both devlogs, feedback current/past and work153/work154 plans. The implementation description matches the reviewed listener order, candidate classification, selection handling and fallback. The archived feedback preserves the original limitation while distinguishing shipped producer support from this game's pending delivery. The patch version and unchanged-save/recording-format statement match the executable scope.

The cost statements at `docs/work/154_render-invalidation/plan.md:45` and `docs/devlog/detailed/2026-11-07_2026-11-07.md:56` agree with round 1's independently checked arithmetic: adapter inclusive shares about 54–75% become 23–25%, and process CPU/tick falls 45.4%, 71.6% and 56.4% in three loaded windows. They retain the short-window, sampling, A/A and foreign-load limitations, distinguish zero observed refresh samples from zero cost, and make no whole-game, FPS or visibility-specific attribution. The observed A/A total ratio is 3.57% higher in its second arm; it is not a universal noise bound. The documentation does not add overlapping inclusive shares.

The work153 local clean-receipt/process evidence independently supports base `a0e10435`, tree `3cc8351b01dc04fe07dc971a02946467eed7cc0c`, 5,504 unit passes/3 skips, 345 browser passes/2 skips, unchanged clean endpoints and 400 tracked processes with no leftovers. I did not query hosted services in this read-only round; the cited terminal CI/corpus statuses remain root-observed delivery evidence, not a fresh reviewer network verification. Work154's own full verify, audits, clean receipt, landing and hosted acceptance are explicitly pending at `docs/work/154_render-invalidation/plan.md:37` and in the new devlog/gallery text.

## Findings and disposition

No new material finding requires a source or documentation repair. The inherited Castle Age HUD overlap is an observed limitation already disclosed by the owner, not a work154 regression. The fog-only pair is excluded from useful coverage; the supplementary wide pair supplies the requested visible framing. Final landing/hosted acceptance remains the integration owner's separate obligation.

## Verification

This review performed only source/document reads, exact read-only Git comparisons, JSON/log inspection, original-resolution image viewing, SHA-256/size comparisons and gallery-link existence checks. It inspected sixteen PNGs, checked equality for twelve pairs and validated all 116 retained visual files. It ran no tests, gates, builds, benchmarks, browsers, installs or network checks. Source/performance results are attributed to the earlier complete authored reviews; this round verifies their continued applicability to unchanged executable/test bytes and checks final claims against them.

The visual result is limited to still images from one opening scenario, selected/queued input and two retained 120x120 late saves, in two styles at one viewport size with fixed and one seeded-random framing. It is not exhaustive gameplay, temporal animation/shimmer, cross-device/browser, arbitrary resolution, 168x168 GPU, FPS or whole-match validation. Later product/source edits require their own appropriate verification. Root's planned final plan/evidence-path append is not part of the frozen documentation tree reviewed here.

## Round outcome

Accepted for the bounded visual-evidence and final documentation/metadata scope, with no material findings. The original implementation remains exact apart from a comment and the game patch version. Ten useful before/after pairs show no image change; the retained evidence and documented claim limits are consistent. Full required gates, clean receipt and delivery are still pending and are not conferred by this review.
