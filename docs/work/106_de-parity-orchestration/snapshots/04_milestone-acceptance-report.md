# Work 106 independent final acceptance review

Author: `/root/milestone_acceptance_review`. Read-only acceptance of the prepared integration files in `C:/Users/38909/Documents/github/aoe2-worktrees/parity-integration-0930`, 2026-09-30 local date / 2026-10-01 UTC. Integration owner: `/root`. This explicitly authorized ignored report is my only authored output.

**Verdict: accept the reviewed final delta, conditional on the integration owner's remaining gate, play and shipping checks. FINAL-R1 and FINAL-R2 are resolved within their stated bounds. No new material finding was identified. This is not a GREEN full-gate result, a committed-revision approval or completed milestone acceptance.**

## Exact target and unchanged coverage

The immutable base is `99749eb12004cabf7d049abeddc2f84a0177d3db`; prepared game version is 0.3.242. I independently hashed every row in both manifests at entry and completion: all 40 product paths and all 43 canonical paths matched, with zero mismatches. The separate final dependency lock and package metadata also matched their reviewed identities.

| Input | SHA-256 | Bound |
|---|---|---|
| `tmp/parity-106/final-source-copy-check.json` | `d16d241ac23f1be72fd8b00e7cca3bfe49d420f755781aa1406e5dcae7904a66` | 40 final product paths; 12,410 manifest bytes |
| `tmp/parity-106/canonical-docs-manifest.json` | `4546e2768e5e766ba4f4d92793da903e2e94793ef0e571079b40631d65dd258e` | 43 canonical paths; 16,956 manifest bytes |
| `package-lock.json` | `d0ab92d91f3210f904da14fdf3f0aa7be62a990947e1b9d3b3d55ef6f1d42581` | 146,755 bytes; separate review 3 target |
| `package.json` | `54a99d265626f4b61dad8bdb84958631c44b581a3a2bf14b9e064b8f5cf8b701` | 2,635 bytes; game 0.3.242 |

This round carries forward the unchanged source acceptance and explicitly bounded inspections in reviews 0–2, plus review 3's separate dependency acceptance. I did not repeat the whole combat census, projectile extraction, source discovery, package archive inspection or runtime verification. The final source has not changed since review 2. Its accepted COMBAT-R1, INTEGRATED-R1/R2/R3 and CL-1/2/3/5 dispositions therefore remain applicable. The changed canonical claims and new visual supplement are the substantive delta in this round.

## Report retention and recoverability

I compared the actual retained authored text, not only the summaries describing it.

- Review 0 contains the complete original 5,031-byte combat report, SHA-256 `c4c02a50e10353ab96b543a2e8d0cb98669e00a3a34a48b8067c1573435094bc`, and complete 7,559-byte integrated report, SHA-256 `be99e28df5f06caa61fa09ff177a994a009717629205ae6ad662cd1cc2b41041`. Both are exact substrings of the live review and equal the ignored original report contents.
- Review 1 preserves the substantive original Claude report as an exact prefix. The original is 9,692 bytes, SHA-256 `62dd7a2f6271524de24328938e6bae0a3b629df5e127219e0fece5e86d6458f0`; the retained body, excluding its trailing newline, is 9,487 bytes, SHA-256 `b9081828ee85e06ff064a31d5a010daba424bc4b4ea9dc263c4cd750f71321fc`. The stated omission remains the final unrelated private connector-status paragraph. The report retains its incomplete test-sweep and no-execution bounds. The earlier waiting-only Claude run remains an abstention.
- `snapshots/02_final-independent-report.md` is byte-identical to the original ignored 9,418-byte report, SHA-256 `4102fed51e44c27edfad6ba3af11ae85bd2d9bb437e7a5d601a5c66496942d69`. Replacing only the 14 Markdown citation destinations from the integration-worktree prefix with the primary-checkout prefix yields SHA-256 `4e0465c61a4701cbff71c899ab42700cf780163a5ba4e699cd8ac98e0eb1ef30`; that entire normalized body is present in review 2.
- `snapshots/03_final-dependency-report.md` is byte-identical to the original ignored 10,501-byte report, SHA-256 `ad8a8bbbc95d48df94abd1a1c7e74a8026c2aa49f5ff73457560002c62d2c5e3`. The same citation-only operation on six destinations yields SHA-256 `3ea8ae2068bd23fad52740adbf4e07a8c3aa14a09e31a3c53b2777504a3a992f`; that entire normalized body is present in review 3. Neither live normalized body is falsely claimed byte-identical to its original.
- All 15 historical Markdown snapshots match the individual hashes in review 0. Both promoted authored patches equal their ignored originals: 85,114-byte `00_combat-target.patch.txt`, SHA-256 `1eac61cb3f30d8a288820e08c538434b8f7d6e1e6470a632b150a0096528ce50`; and 270,941-byte `01_integrated-target.patch.txt`, SHA-256 `7c3312c6e097b2bd8501488d18bfbbfb1c3c49aab7761d39974bc683e6fa1791`. Their immutable recovery base and large-input retention reasons are explicit. I verified the retained bytes; I did not apply the patches or create a recovery checkout.

The final product's eventual committed-source binding remains required. Hashes identify this working target; they do not substitute for committing the final reviewed files. Historical worktree citations remain explicitly historical. Live normalized links are navigation into the intended primary paths, not evidence that those primary files already contain the unmerged result.

## FINAL-R1: visual supplement accepted

I read the maintained capture/diff instruments, the supplementary runner, source/dist binding, capture logs, cleanup record and handoff. The runner invokes `scripts/captureMapScreenshot.mjs` and `scripts/diffMapScreenshots.mjs`; its independent pixel-bounds reader neither masks nor modifies an image. This is the existing maintained instrument, not a replacement screenshot path. The actual logs identify the RTX 4090 through ANGLE Direct3D11, with blend ground for DE.

The six pairs cover DE and Moebius, each at close zoom 2.4/focus 8,8/villager selection; base zoom 1.3/focus 10,10/Town Center selection; and shore zoom 0.7/focus 12,10/mixed selection. Both arms use `aoe2-prototype`, tick 1 and 800×600. This supplies the missing both-style and varied-framing/zoom coverage required by [local-rules.md:65](C:/Users/38909/Documents/github/aoe2-worktrees/parity-integration-0930/docs/policies/local-rules.md:65). The fixed isometric angle is respected.

I personally inspected all 12 original before/after PNGs at native resolution using `view_image`, plus the DE-close diff. The six diff PNGs have identical bytes, so that one native diff inspection covers their shared visual content; I do not claim six separate diff-image tool calls. The worker's broader 18-image inspection remains separately attributed.

| Pair | Personally inspected before SHA-256 | Personally inspected after SHA-256 |
|---|---|---|
| DE close | `1b0eff508de55e02db49625fd5bbac4e1d7d7d73e4afebd43d2c7867480fd06c` | `7c1751cf1d782b2a2f10a93e06e72f8b566e8c47c894c64d9cd45a9b5381808f` |
| DE base | `67097daee06008e2685e9322dee77019715fda83bca8de9d58ef2256b5133f34` | `f4296a2d7575538e66940a1d61315ffcd9fc4a179497f35d2ddeb8fbd99c6888` |
| DE shore | `36b263684d87b0b27315e8a495c5f13c9ceaf91a1cae406dda8a620b1025ea70` | `aafb216fb8f123b2f84c21f1b672499f6b6779bee3a65fee886e8943d0395791` |
| Moebius close | `e352de764c639a9bbca434b79ba6170897f5010f87b06b1c69cf5b10afe1f382` | `2fdd754ddcc74af7fb005f16074cc9a5c44ea33479086ba24a98c11c568d13e2` |
| Moebius base | `a6211317343c64783657aee8e90a4c3d707b83289d91e6665b304a35fe38a9e1` | `877d86526cbc69547827d3aa7fb1f665dede06a4a5d30ea93883520c8ee43152` |
| Moebius shore | `1d6febcccbbddb35f07d6c66fb2b64a318859c753a67fbe87737288502133f26` | `7ac437e9ee858355b965a2d452adc1f1450a81dc197007f9f8339f6019e70439` |

The shared diff SHA-256 is `1b7cfc76d4e3a206fa59cab9dedc2730adb9defd816e3cbf95382a24dbca9865`. I independently decoded every before/after/diff PNG in memory and compared the actual RGB pixels. Each pair has exactly 3,187 changed pixels, bounding box x33..335/y28..64, zero changed pixels outside the enclosing resource-chip area, and zero disagreements between actual before/after changes and the maintained diff's red mask. The native results show readable opening resource totals and zero workforce counts, with the villager/Town Center/mixed-selection panels, minimap and surrounding world unchanged within each pair.

I rehashed all 779 file references in the binding plus 62 manifest/preparation references: 841 artifact references, zero missing files, hash mismatches or size mismatches. Together with the separately verified 40 product and 43 canonical rows, this is 924 checked references, not 924 distinct files. I also freshly read the baseline Git revision as `99749eb12004cabf7d049abeddc2f84a0177d3db` and its tracked status as clean.

| Supplement identity | SHA-256 |
|---|---|
| `style-framing-final/manifest.json` | `115a754907b2ee887868369247d131074d7efe768c0622e50656cfdaa92e0fd5` |
| `style-framing-final/source-dist-binding.json` | `382c6d50bacd1e77cec89da685d73acec619ffe0807bb5ff2d3506b2ae815e2d` |
| `style-framing-final/handoff.md` | `301fec755ba011cd46e9b4ee5b99f0cf2b20e9f8fdcdbd059ff70745678e8356` |
| `final-root-visual-acceptance.json` | `82e430794ac2624e43f28b1db59aa954b7de094c6627f62620e254d2b10a8803` |

The binding and inspected files support two stable game arms, base 0.3.241 and final 0.3.242, using the same private core 2.4.2/voxel 1.2.0 artifacts. Cleanup records successful assignment before release, job close, no owned leftovers/listeners, restored baseline junction and released lock. I did not launch a build, browser or server to reproduce the captures.

This supplementary proof closes FINAL-R1. Its bound is tick 1, one GPU, one viewport and three fixed-angle framings; it proves no new input path, later match outcome or SwiftShader result. Existing three-width, large-number/accessibility and real lobby/gather/walk/build checks remain separately attributed evidence. Zero opening workforce counts do not exercise gathering.

## FINAL-R2 and canonical claims

The active [de-look/PLAN.md:3](C:/Users/38909/Documents/github/aoe2-worktrees/parity-integration-0930/docs/threads/current/de-look/PLAN.md:3) explicitly labels 1,983 pixels as the initial H4 layout and correctly assigns 3,187 pixels at each of 800/1280/1920 to the direct base-to-final result, x33..335/y28..64 with zero outside. This resolves FINAL-R2. The live handoff preserves initial 1,983 and intermediate 3,393 as historical targets and names the direct-final proof separately. Immutable reviewed inputs remain unchanged.

I inspected the final eight-path documentation change set named in the canonical manifest: debugging record, detailed and summary devlogs, plan, reviews 2/3, exact dependency report snapshot and current HUD handoff. Its new dependency/gate/evidence claims are consistent with the inspected artifacts. DEP-R1 correctly distinguishes direct development dependency js-yaml from the three transitive rows. Review 3 explicitly qualifies literal worker command labels, the failed baseline/final whole-locktree checks, Node-version/lifecycle bounds and retained moderate advisories. Source/dist metadata and worker/native-inspection attribution are not promoted into unperformed runtime checks.

The canonical freeze predates this acceptance and root's native-inspection record, so its pending FINAL-R1/root-acceptance wording is an earlier checkpoint. The integration owner should record this round's observed closure and subsequent actual gate/shipping outcomes while retaining the historical reports. That status update must not imply checks completed before they do.

## Remaining acceptance and risk bounds

I read root's actual `adoption-audits.json`, SHA-256 `c24f6d92c5c4a7e3d30170086cf5b997dfb7f7271a8ee38e09887e989976cc76`: fullExit 0, productionExit 0, full high/critical 0 and moderate 3, production vulnerabilities 0. I did not execute either audit. The unchanged lock's independent acceptance is review 3's 297-package/12-field, integrity/private-installation scope. Its three moderate development advisories, failed full-locktree checks with 20 inherited linked-sibling requirements, unexecuted Node20/22 runtime and default npm-ci lifecycle bounds remain.

Gate attempt 1 remains a failed historical run. I read attempt 2's actual Job Object result, SHA-256 `e31d839e412370a50e124a21d41cf4a8d2923d0d183bb384bb49102cbf95c692`: exit -1073741819 / Windows 0xC0000005, 55.96 seconds, cleanupProof true and zero leftovers. It is incomplete, with no successful overall verify result or later-stage acceptance. The stale-index check's separate five-test pass does not explain that native fault. Intentional retained authored whitespace still has its disclosed generic-check failure; it is not silently relabeled green.

At dispatch, full verify attempt 3 was integration-owned and running. I did not launch, interrupt, duplicate or claim its result. Remaining conditions are its successful direct exit and full-stage evidence; representative affected play acceptance; final canonical status and exact committed-source binding; commit/merge to main/push; hosted CI and corpus completion; and safe task-owned resource/worktree retirement. Any substantive change to this frozen target requires affected re-verification and focused review.

The prior 600-state equality, 1,500-tick recording/publication measurements, old-save/legacy-replay controls, 93-local-identity damage reference and 44-row projectile population retain their own bounds. They establish neither complete DE content nor unrestricted performance or determinism. Inherited CL-4 mounted-unique garrison eligibility and M7 long-walk replay divergence remain OPEN. The broader CSS size-mechanism/legacy-file limitation and full single-player DE parity queue also remain open. Historical combat results may change under corrected rules.

## Reviewer execution boundary

I used filesystem/Git reads, hashes, JSON/text comparisons, in-memory PNG decoding and native image inspection. The first JSON-only artifact inspection encountered a BOM; accepting the BOM in that reader completed the same read without changing evidence. No test, npm script, audit command, build, browser, server, external reviewer CLI, network query or sibling build ran. The integration owner's session-start/CI and heavy-gate work were not duplicated. No source, dependency, index, canonical document, wrapper or primary checkout was changed. No subagent or persistent process was created; there is no reviewer-owned browser/GUI/server cleanup obligation left. Only this ignored authored report is retained for canonical promotion by the integration owner.
