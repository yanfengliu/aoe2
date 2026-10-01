# Review 2: integration — independent repaired-tree review

## Target

AoE2 working files in integration against immutable base `99749eb12004cabf7d049abeddc2f84a0177d3db`, prepared version0.3.242. Product manifest SHA-256 `d16d241ac23f1be72fd8b00e7cca3bfe49d420f755781aa1406e5dcae7904a66` binds all40 product paths, verified unchanged at entry/completion. Canonical manifest `2aab576b91ee4c44a0c766ed842d2e313887bdd0082683fe36c0ac0085c1d228` binds the reviewed authored target; all39 non-lock rows stayed unchanged. Concurrent package-lock repair is explicitly excluded and requires its own four-row dependency audit/review. This verdict covers working files, not stale index or an eventual commit. Recoverability still needs the integration owner's eventual committed-source binding after the final gate; no candidate SHA is asserted.

The complete original9418-byte authored report is retained exactly in [02_final-independent-report.md](../snapshots/02_final-independent-report.md), SHA-256 `4102fed51e44c27edfad6ba3af11ae85bd2d9bb437e7a5d601a5c66496942d69`. That is a historical review input; its original worktree citation links are not current navigation. In the live report below, only 14 Markdown citation destinations change from the integration worktree prefix to the durable primary checkout prefix. Every substantive word, claim, line number, finding and coverage bound remains unchanged under this deterministic path-only normalization. The normalized report is not byte-identical to the original; normalized-body SHA-256 `4e0465c61a4701cbff71c899ab42700cf780163a5ba4e699cd8ac98e0eb1ef30`. Existing15 immutable snapshots and reviewed-source patches remain unchanged.

## Reviewers and coverage

An independent fleet-pinned Astra/xhigh collaboration reviewer completed source-grounded repaired-tree inspection. It carried forward the unchanged attributed combat/content coverage, inspected all19 changed source/test/data paths since the earlier integrated target, and traced occupation/save/replay/HUD callers and the bounded serializer instrument. It verified40 product and39 non-lock canonical rows plus39 visual/22 evidence files; it personally inspected eight native images, with the broader per-image review attributed to the worker. It ran no test, gate, audit, browser, server, external CLI reviewer, CI query or mutation. Package-lock and whole-game parity are outside its verdict. Root owns the heavy capture/gate resource; no additional reviewer CLI is dispatched by this docs lane.

## Reports

### Astra/xhigh: complete independent integration report

The full substantive report follows, with citation-only normalization described above and no redaction or summarized replacement.

**Verdict: the reviewed product repairs are sound on source inspection, but final acceptance remains pending.** I found no new material runtime defect. One required visual check and one low-severity status correction remain.

Reviewed `C:/Users/38909/Documents/github/aoe2-worktrees/parity-integration-0930` against base `99749eb12004cabf7d049abeddc2f84a0177d3db`, prepared version `0.3.242`. This verdict covers the frozen working files, not the stale index or an eventual commit.

All 40 product hashes matched at entry and completion. Product manifest SHA-256: `d16d241ac23f1be72fd8b00e7cca3bfe49d420f755781aa1406e5dcae7904a66`. Canonical manifest SHA-256: `2aab576b91ee4c44a0c766ed842d2e313887bdd0082683fe36c0ac0085c1d228`; all 39 non-lock paths remained unchanged. **The concurrent package-lock repair is excluded from this verdict.**

**FINAL-R1 — P2, verification: required style/framing coverage remains incomplete.**

Location: [hud-handoff.md:38](C:/Users/38909/Documents/github/aoe2/docs/work/106_de-parity-orchestration/snapshots/hud-handoff.md:38).

The retained visual proof explicitly uses Natural, tick 1 and the default camera. I verified the 39 final visual artifacts and their hashes; this inventory provides three widths, ordinary values, larger values/tooltips and gather/walk/build states, but no demonstrated Moebius or alternate-zoom/framing sweep.

This leaves [plan.md:50](C:/Users/38909/Documents/github/aoe2/docs/work/106_de-parity-orchestration/plan.md:50) incomplete under [local-rules.md:65](C:/Users/38909/Documents/github/aoe2/docs/policies/local-rules.md:65) and its maintained-capture instructions at line 69. It is a missing acceptance check, not an observed rendering defect.

**Required correction:** complete the maintained headless supplementary sweep in both styles and the required framing/zoom states, inspect each retained result and bind the evidence to the final source. Root has accepted this remaining check.

**FINAL-R2 — P3, documentation: active H4 status still presents the intermediate pixel count as current.**

Location: [de-look/PLAN.md:3](C:/Users/38909/Documents/github/aoe2/docs/threads/current/de-look/PLAN.md:3).

The newest H4 status describes frozen integration evidence with **1,983 changed pixels**, without identifying this as the initial H4 layout. The retained direct base-to-final proof instead records **3,187 pixels**, confined to `x33..335/y28..64`, at each width.

A reader consulting the active thread receives the wrong attribution for the current visual result. **Correction:** identify 1,983 as initial history and reference the final 3,187-pixel result. Preserve immutable reviewed snapshots. Root has accepted this correction.

**Prior finding dispositions**

| Finding | Final disposition |
|---|---|
| COMBAT-R1 | Resolved on source inspection. [attackDamageTypes.test.ts:119](C:/Users/38909/Documents/github/aoe2/tests/simulation/attackDamageTypes.test.ts:119) retains the terminal snapshot, requires an off-boundary impact, checks every snapshot interval with zero skips and requires coverage through impact. It then removes the endpoint, re-executes the tail and compares target HP. |
| INTEGRATED-R1 | Repaired. [hudIcons.css:40](C:/Users/38909/Documents/github/aoe2/src/hudIcons.css:40) separates stockpile/workforce rows within fixed chips; the controller preserves full DOM, accessible and tooltip text. Browser checks now measure containing chips, neighbors, clipping and unchanged geometry. Native images support seven-digit readability and explicit long-value ellipsis. FINAL-R1 remains a separate coverage obligation. |
| INTEGRATED-R2 | Resolved. Spec and changelog consistently bind replay workforce to player 1. [makeReplayBridge.ts:215](C:/Users/38909/Documents/github/aoe2/src/game/simulation/replay/makeReplayBridge.ts:215) matches the `fogOwner: 2` regression. |
| INTEGRATED-R3 | Changed-file violation resolved: `hudChrome.css` is 487 lines; rules moved coherently into existing `hudIcons.css`, now 189. Automatic CSS size coverage remains absent, and the unchanged oversized command-panel stylesheet remains a broader bound. |
| CL-1 | Resolved. I independently hashed the retained 965,553 source bytes to `66a439979afe62f71541cff05280837abfb04e7732e364e2eae2f318862ade6d`. Current fixture/reference/CSV provenance agrees; historical reports preserve and explicitly supersede their old attribution. The new test is correctly labeled an offline metadata pin. |
| CL-2 | Resolved. Corrected comments distinguish melee siege damage, contact role, exports and common/base gunpowder identities. |
| CL-3 | Resolved. [unitAttackAnimationFeedPersistence.test.ts:59](C:/Users/38909/Documents/github/aoe2/tests/simulation/unitAttackAnimationFeedPersistence.test.ts:59) checks both owner fields against player membership; strict equality requires legacy participant-key absence. |
| CL-4 | **Inherited eligibility defect remains OPEN.** The misleading intended-behavior comment is removed, and the defect is recorded. No garrison behavior fix is claimed. |
| CL-5 | Resolved. [projectileStats.test.ts:67](C:/Users/38909/Documents/github/aoe2/tests/content/projectileStats.test.ts:67) compares the independent fixture population with actual runtime `firesProjectile` identities as well as CSV identities. |

**Substantive coverage**

I read the two prior complete reports, carried forward their unchanged grounded combat/content coverage and inspected all 19 source/test/data paths changed since reviewed tree `fcfa79a05a2fd1233ee46d601e01be7660941316`. I also inspected the integrated occupation implementation and its creation, gathering, movement, save/replay and HUD connections. I did not independently repeat the full 93-row/44-row extraction or fetch changing web sources.

The occupation writer clones Unit metadata, requires marker exactly `1` and leaves existing Gatherer mutation intact. Replay initialization preserves legacy absence; spawning uses the same marker boundary. Counts exclude foreign/garrisoned units, follow active desired resource, retain remembered ordinary walking and bind replay to player 1.

The serializer optimization at [resourceWorkerOccupation.test.ts:33](C:/Users/38909/Documents/github/aoe2/tests/replay/resourceWorkerOccupation.test.ts:33) compares each current source against its detached cached clone before reuse. It wraps synchronous serialization only, forwards transfer options and restores native cloning in `finally`. The installed engine still validates every serialized component/state value. Permanent controls cover nested mutation, deletion, arrays, negative zero, returned-output mutation, transfer and exceptions. The test still compares complete states at **every one of 600 ticks**, deleting only occupation and its marker. I read the retained 120-tick native-versus-cached instrument and result; neither establishes an unrestricted serialization/performance guarantee.

Grounded outside-diff checks included:

- [projectileOps.ts:291](C:/Users/38909/Documents/github/aoe2/src/game/simulation/bridge/projectileOps.ts:291): direct impacts consume saved `attackType`.
- [blastDamage.ts:60](C:/Users/38909/Documents/github/aoe2/src/game/simulation/bridge/blastDamage.ts:60): blasts derive family from attacker type.
- [prototypeBuildingRules.ts:344](C:/Users/38909/Documents/github/aoe2/src/game/simulation/prototypeBuildingRules.ts:344): the fallback explains the recorded inherited mounted-unit eligibility gap.
- [fileSizeBudget.test.ts:33](C:/Users/38909/Documents/github/aoe2/tests/architecture/fileSizeBudget.test.ts:33): the automatic scan excludes CSS.

**Evidence and limits**

All 39 final visual files and 22 accompanying evidence files matched manifest `ecd7a738a4ccfe2e5de912f0ed99a5654a596bab650cd769bc37f840ddfe86c9`. All nine direct base-to-final image hashes matched proof `870831aea100c2784d05e4c5bd35b57fec2c60415f98e4099c90908e55328716`.

I personally inspected eight native-resolution images: final ordinary frames at all three widths; the 800px baseline and direct diff; seven-digit fixtures at 800/1920; and the 1280 full-value tooltip. I did not personally inspect all 39 images. The broader per-image inspection remains attributed to the worker.

I read retained logs reporting 75 affected tests and six browser checks passed. **I ran no tests, gate, audit, browser, server, CLI reviewer, CI query or mutation.** The assignment kept runtime work with integration. No task-owned files or persistent processes were created.

The last whole-gate result remains the reported failed attempt until root completes its replacement. Dependency review/audits, final combined verification, required visual supplement, representative play, committed-source binding, main/push/remote acceptance and cleanup remain pending. The inherited M7 long-walk replay divergence and broad DE parity queue remain open. This report does not establish whole-game determinism or full DE parity.

## Findings and disposition

| Finding | Accepted disposition | Remaining acceptance |
|---|---|---|
| FINAL-R1 P2 | CLOSED by independent review4 and root within six-pair style/framing/zoom bounds: each3,187 RGB changes, outside0/mask mismatch0. Worker all18 native inspection, independent12before/after plus shared diff and root sixafter plus shared diff are separately attributed. | Full gate and milestone shipping remain pending; exact preclosure wrapper is retained under snapshots/04_reviewed. |
| FINAL-R2 P3 | CLOSED by independent review4: live de-look status correctly labels initial1,983/intermediate3,393 history and direct-final3,187 at each width, within x33..335/y28..64. | Full gate/main acceptance pending. Historical report body and exact reviewed wrapper input unchanged. |
| Prior COMBAT-R1, INTEGRATED-R1/R2/R3, CL-1/CL-2/CL-3/CL-5 | Source-reviewed repairs accepted within the report's bounds. Changed CSS complies; automatic CSS coverage/legacy oversized stylesheet remain broader bounds. | Final combined runtime/dependency/visual/play/main acceptance still required. |
| CL-4 and M7 | Inherited mounted-unique garrison eligibility and long-walk replay divergence remain OPEN. | Future sourced class/live controls and replay diagnosis; no closure or full determinism/parity claim. |

No dissent from FINAL-R1/R2 is asserted. The full game adoption audit previously exited1 with three high/three moderate existing development advisories; production audit exited0 with zero vulnerabilities. A separate gameplay-owned four-patch development dependency repair is underway, with three moderates likely retained until the actual audit proves the result. This report excludes that changing lock and supplies no dependency approval.

## Verification

This docs lane verified original report bytes/hash, exact historical snapshot equality and full substantive equivalence after the stated citation-only normalization. The live status correction uses root's maintained direct base99749eb→FINAL proof:800/1280/1920 each3,187 changed pixels inside x33..335/y28..64 and zero outside the four resource chips. Initial1,983 and initial-H4→R1 3,393 remain historical targets. No runtime, audit, capture, browser, build, external reviewer CLI or heavy gate ran for these authored edits. Existing static structure/live-pointer/status/attribute/version and immutable-input checks run separately and do not satisfy FINAL-R1. Source/dependency/fullgate evidence stays integration-owned.

## Round outcome

The reviewed product repairs are sound on source inspection; final acceptance remains pending. FINAL-R2 is locally corrected; FINAL-R1 required visual supplement, four-row dependency repair/audit/review, full verify, representative play, committed-source binding, main/push/remote acceptance and cleanup are pending. No whole-game replay determinism or full DE parity is established. Canonical plan owns subsequent observed outcomes.

**Supplementary runtime evidence after this source review.** The presentation worker completed six matching DE/Moebius × close2.4/villager, base1.3/Town Center and shore0.7/box pairs at800×600. Each maintained RGB diff changes3,187 pixels inside x33..335/y28..64, zero outside. The worker individually inspected all18 originals natively; this docs lane reads metadata and does not claim image inspection. Manifest SHA-256 `115a754907b2ee887868369247d131074d7efe768c0622e50656cfdaa92e0fd5`, handoff `301fec755ba011cd46e9b4ee5b99f0cf2b20e9f8fdcdbd059ff70745678e8356`, source/dist binding `382c6d50bacd1e77cec89da685d73acec619ffe0807bb5ff2d3506b2ae815e2d`. Both exact arms (base997/0.3.241 and final0.3.242) used the same validated private core2.4.2/voxel1.2.0 installation; all40 final source hashes stayed unchanged. Maintained builds/captures completed without source edits. Cleanup proof istrue, zero owned leftovers/listeners on4283/4284, exact lock released and baseline junction restored. This supplements the existing three-width and real-control evidence; it is tick1 on one GPU with fixed isometric angle, not all scenarios or input paths. FINAL-R1 is worker-verified; root native inspection/acceptance remains pending. The heavy slot is released for the root's next serialized full gate.

**Observed closure after the historical review (2026-10-01 UTC).** Independent review4 and root now accept FINAL-R1/FINAL-R2 within their recorded visual/status bounds, with no new material finding. Reviewer natively inspected all12 before/after images plus one shared diff and independently decoded all six raw pairs/masks: 3,187 changed pixels each, x33..335/y28..64, outside0/mask mismatch0. Root inspected six after images plus one identical diff and verified924 artifact references (40 product/43 canonical included, not distinct-file count). Worker all18 native inspection remains separately attributed. Root accepted visual record SHA-256 `82e430794ac2624e43f28b1db59aa954b7de094c6627f62620e254d2b10a8803`; full original14,412-byte report SHA `507c5b41e4b6c887fdbaef36013c21ede2f2acb665ac6db3955c11cd8e2a82bb` is retained in review4 and exact historical snapshot04. This closes the visual/status findings, not the full milestone or goal. [Review4](4_integration.md) preserves the full attributed report and exact preclosure wrapper. Gate attempt3 remains root-owned and running at this checkpoint:562 passed unit files/one skipped file,4,338 passed tests/three skipped in271.26s; typecheck/pre-browser build passed. The238-case browser suite had111 completed sequential cases with no failure reported yet. Final browser/lint/build results and direct overall exit are unavailable. No full verify, committed revision, main/push/remote acceptance or parity claim follows. Attempt2 native crash remains unexplained history; CL-4/M7 and dependency/lifecycle bounds remain OPEN.
