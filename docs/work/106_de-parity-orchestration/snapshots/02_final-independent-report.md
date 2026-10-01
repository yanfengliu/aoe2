**Verdict: the reviewed product repairs are sound on source inspection, but final acceptance remains pending.** I found no new material runtime defect. One required visual check and one low-severity status correction remain.

Reviewed `C:/Users/38909/Documents/github/aoe2-worktrees/parity-integration-0930` against base `99749eb12004cabf7d049abeddc2f84a0177d3db`, prepared version `0.3.242`. This verdict covers the frozen working files, not the stale index or an eventual commit.

All 40 product hashes matched at entry and completion. Product manifest SHA-256: `d16d241ac23f1be72fd8b00e7cca3bfe49d420f755781aa1406e5dcae7904a66`. Canonical manifest SHA-256: `2aab576b91ee4c44a0c766ed842d2e313887bdd0082683fe36c0ac0085c1d228`; all 39 non-lock paths remained unchanged. **The concurrent package-lock repair is excluded from this verdict.**

**FINAL-R1 — P2, verification: required style/framing coverage remains incomplete.**

Location: [hud-handoff.md:38](C:/Users/38909/Documents/github/aoe2-worktrees/parity-integration-0930/docs/work/106_de-parity-orchestration/snapshots/hud-handoff.md:38).

The retained visual proof explicitly uses Natural, tick 1 and the default camera. I verified the 39 final visual artifacts and their hashes; this inventory provides three widths, ordinary values, larger values/tooltips and gather/walk/build states, but no demonstrated Moebius or alternate-zoom/framing sweep.

This leaves [plan.md:50](C:/Users/38909/Documents/github/aoe2-worktrees/parity-integration-0930/docs/work/106_de-parity-orchestration/plan.md:50) incomplete under [local-rules.md:65](C:/Users/38909/Documents/github/aoe2-worktrees/parity-integration-0930/docs/policies/local-rules.md:65) and its maintained-capture instructions at line 69. It is a missing acceptance check, not an observed rendering defect.

**Required correction:** complete the maintained headless supplementary sweep in both styles and the required framing/zoom states, inspect each retained result and bind the evidence to the final source. Root has accepted this remaining check.

**FINAL-R2 — P3, documentation: active H4 status still presents the intermediate pixel count as current.**

Location: [de-look/PLAN.md:3](C:/Users/38909/Documents/github/aoe2-worktrees/parity-integration-0930/docs/threads/current/de-look/PLAN.md:3).

The newest H4 status describes frozen integration evidence with **1,983 changed pixels**, without identifying this as the initial H4 layout. The retained direct base-to-final proof instead records **3,187 pixels**, confined to `x33..335/y28..64`, at each width.

A reader consulting the active thread receives the wrong attribution for the current visual result. **Correction:** identify 1,983 as initial history and reference the final 3,187-pixel result. Preserve immutable reviewed snapshots. Root has accepted this correction.

**Prior finding dispositions**

| Finding | Final disposition |
|---|---|
| COMBAT-R1 | Resolved on source inspection. [attackDamageTypes.test.ts:119](C:/Users/38909/Documents/github/aoe2-worktrees/parity-integration-0930/tests/simulation/attackDamageTypes.test.ts:119) retains the terminal snapshot, requires an off-boundary impact, checks every snapshot interval with zero skips and requires coverage through impact. It then removes the endpoint, re-executes the tail and compares target HP. |
| INTEGRATED-R1 | Repaired. [hudIcons.css:40](C:/Users/38909/Documents/github/aoe2-worktrees/parity-integration-0930/src/hudIcons.css:40) separates stockpile/workforce rows within fixed chips; the controller preserves full DOM, accessible and tooltip text. Browser checks now measure containing chips, neighbors, clipping and unchanged geometry. Native images support seven-digit readability and explicit long-value ellipsis. FINAL-R1 remains a separate coverage obligation. |
| INTEGRATED-R2 | Resolved. Spec and changelog consistently bind replay workforce to player 1. [makeReplayBridge.ts:215](C:/Users/38909/Documents/github/aoe2-worktrees/parity-integration-0930/src/game/simulation/replay/makeReplayBridge.ts:215) matches the `fogOwner: 2` regression. |
| INTEGRATED-R3 | Changed-file violation resolved: `hudChrome.css` is 487 lines; rules moved coherently into existing `hudIcons.css`, now 189. Automatic CSS size coverage remains absent, and the unchanged oversized command-panel stylesheet remains a broader bound. |
| CL-1 | Resolved. I independently hashed the retained 965,553 source bytes to `66a439979afe62f71541cff05280837abfb04e7732e364e2eae2f318862ade6d`. Current fixture/reference/CSV provenance agrees; historical reports preserve and explicitly supersede their old attribution. The new test is correctly labeled an offline metadata pin. |
| CL-2 | Resolved. Corrected comments distinguish melee siege damage, contact role, exports and common/base gunpowder identities. |
| CL-3 | Resolved. [unitAttackAnimationFeedPersistence.test.ts:59](C:/Users/38909/Documents/github/aoe2-worktrees/parity-integration-0930/tests/simulation/unitAttackAnimationFeedPersistence.test.ts:59) checks both owner fields against player membership; strict equality requires legacy participant-key absence. |
| CL-4 | **Inherited eligibility defect remains OPEN.** The misleading intended-behavior comment is removed, and the defect is recorded. No garrison behavior fix is claimed. |
| CL-5 | Resolved. [projectileStats.test.ts:67](C:/Users/38909/Documents/github/aoe2-worktrees/parity-integration-0930/tests/content/projectileStats.test.ts:67) compares the independent fixture population with actual runtime `firesProjectile` identities as well as CSV identities. |

**Substantive coverage**

I read the two prior complete reports, carried forward their unchanged grounded combat/content coverage and inspected all 19 source/test/data paths changed since reviewed tree `fcfa79a05a2fd1233ee46d601e01be7660941316`. I also inspected the integrated occupation implementation and its creation, gathering, movement, save/replay and HUD connections. I did not independently repeat the full 93-row/44-row extraction or fetch changing web sources.

The occupation writer clones Unit metadata, requires marker exactly `1` and leaves existing Gatherer mutation intact. Replay initialization preserves legacy absence; spawning uses the same marker boundary. Counts exclude foreign/garrisoned units, follow active desired resource, retain remembered ordinary walking and bind replay to player 1.

The serializer optimization at [resourceWorkerOccupation.test.ts:33](C:/Users/38909/Documents/github/aoe2-worktrees/parity-integration-0930/tests/replay/resourceWorkerOccupation.test.ts:33) compares each current source against its detached cached clone before reuse. It wraps synchronous serialization only, forwards transfer options and restores native cloning in `finally`. The installed engine still validates every serialized component/state value. Permanent controls cover nested mutation, deletion, arrays, negative zero, returned-output mutation, transfer and exceptions. The test still compares complete states at **every one of 600 ticks**, deleting only occupation and its marker. I read the retained 120-tick native-versus-cached instrument and result; neither establishes an unrestricted serialization/performance guarantee.

Grounded outside-diff checks included:

- [projectileOps.ts:291](C:/Users/38909/Documents/github/aoe2-worktrees/parity-integration-0930/src/game/simulation/bridge/projectileOps.ts:291): direct impacts consume saved `attackType`.
- [blastDamage.ts:60](C:/Users/38909/Documents/github/aoe2-worktrees/parity-integration-0930/src/game/simulation/bridge/blastDamage.ts:60): blasts derive family from attacker type.
- [prototypeBuildingRules.ts:344](C:/Users/38909/Documents/github/aoe2-worktrees/parity-integration-0930/src/game/simulation/prototypeBuildingRules.ts:344): the fallback explains the recorded inherited mounted-unit eligibility gap.
- [fileSizeBudget.test.ts:33](C:/Users/38909/Documents/github/aoe2-worktrees/parity-integration-0930/tests/architecture/fileSizeBudget.test.ts:33): the automatic scan excludes CSS.

**Evidence and limits**

All 39 final visual files and 22 accompanying evidence files matched manifest `ecd7a738a4ccfe2e5de912f0ed99a5654a596bab650cd769bc37f840ddfe86c9`. All nine direct base-to-final image hashes matched proof `870831aea100c2784d05e4c5bd35b57fec2c60415f98e4099c90908e55328716`.

I personally inspected eight native-resolution images: final ordinary frames at all three widths; the 800px baseline and direct diff; seven-digit fixtures at 800/1920; and the 1280 full-value tooltip. I did not personally inspect all 39 images. The broader per-image inspection remains attributed to the worker.

I read retained logs reporting 75 affected tests and six browser checks passed. **I ran no tests, gate, audit, browser, server, CLI reviewer, CI query or mutation.** The assignment kept runtime work with integration. No task-owned files or persistent processes were created.

The last whole-gate result remains the reported failed attempt until root completes its replacement. Dependency review/audits, final combined verification, required visual supplement, representative play, committed-source binding, main/push/remote acceptance and cleanup remain pending. The inherited M7 long-walk replay divergence and broad DE parity queue remain open. This report does not establish whole-game determinism or full DE parity.
