# Combined census diagnosis — 2026-10-17

Status: read-only investigation complete; snapshot acceptance belongs to the integration owner and independent reviewer. No AI purchasing logic, producer assertion, horizon, configuration, or expected snapshot was changed by this investigation.

The combined tree reproduces owner 2's silent research producer because its sole affordable Siege Workshop research intention loses the existing spending-order race, then food stays below every remaining siege upgrade's price. The evidence supports a legitimate changed match under the inherited purchasing policy, rather than a new research-menu or producer-dispatch failure. It does not attribute the trajectory to one branch without a separate controlled comparison.

## Instrument, inputs, and native result

The question was whether owner 2 ever had an available complete Workshop and an affordable hosted technology, and what happened to that opportunity. The failed maintained test had not saved a bundle or terminal world, so no recorded run existed for `bundleHotspots`, `snapshotAtTick`, or replay inspection. A scratch copy of `tests/simulation/selfPlayContentCoverage.test.ts` imported the integrated sources and original expectation by absolute path, preserving its original assertions and simulation. `WorldHistoryRecorder` plus `summarizeWorldHistoryRange` retained 180 complete 250-tick chunks, command submissions/results, and compact Imperial decision evidence; a passive `preUpdate` observer read the live public economy before `prototypeAi`, after prior command execution, without changing update-system order. The census and terminal save were written before assertions. The final raw history retains the last 250 ticks only; the folded summaries cover all 45,000 ticks and are not a replayable full-session bundle.

An instrument positive control ran `imperial-siege-fixture` for 60 ticks with and without the recorder: saved games were deeply equal, 10 commands and eight Imperial owner decisions were captured, and an affordable siege opportunity plus an actual `onager-upgrade` submission were observed. Vitest collection found exactly the copied maintained test. The 45,000-tick census ran once, on `aoe2-prototype`, hard difficulty, high resources, attacks off, conquest only, both seats AI, render projection on read, and 250-tick content samples.

The integrated checkout was `C:/Users/38909/Documents/github/aoe2-worktrees/branch-completion-1017`, HEAD `af328ae641165def6622029ae6af6f617bd0085a` with the pending branch merge and recovery overlays. SHA-256 over 735 product, design, configuration, expectation, and maintained-test input digests was `f2f9faf24f237ce933304ab1b607d2ec1c64bf0c2c08a26d2dafc9236b0bea52` before and after; no input changed. Product diff digest against HEAD was `d498ce4964f46ddb02d73b6fab6074d670b3b3a04f6d5f58bfb4dcbdeabfbfce`. The maintained test digest was `c7c37d55657c7e1a17c6e88e89fab3db1aa3f00fc750492d4e2e9acf8c9a5363`; original expectation digest was `8e387a9ecc5f29e661e3f2b1dc9af104a6a0cc0f1ed55cfc1233cc6691280455`.

Native result: exit 1, no timeout, one failed test at the unchanged owner-2 Siege Workshop producer assertion. The test took 350.43 s; Vitest took 356.39 s. The lab reached tick 45,000, remained running, both owners were Imperial, and its union contained 15/25 building types, 21/93 unit types, and 34/143 technologies. All six printed `COVERAGE` rows match the original failed run exactly, including the complete union gaps and per-owner producer lists. No history chunk truncated. The owned wrapper's `finally` cleaned its PID tree (49684, 42988, 55408); a subsequent process inventory found no remaining owned process. No browser or game GUI was launched. Recorder overhead makes this duration unsuitable as a product performance comparison.

Retained ignored evidence is under `C:/Users/38909/Documents/github/aoe2-worktrees/ai-relics/tmp/probes/work133-census/`: `run/census.json` (SHA-256 `269a2e5b064905d7ae9ef2c438e2cd57f170ef4aece69ecc413699767b267dc2`), `run/history-summary.jsonl` (`d6b3cc5a520733d3082f15a694664de0dd1a8bef94adc220950d352429da2693`), `run/terminal-save.json` (`13bf109463f65fbc2113aaaf9d020fe976dd82e0e6fa8c3e80038fec8cae798b`), `run/history-last.json`, `analysis.json`, `source-receipt.json`, `inputs-before.json`, `inputs-after.json`, `input-variance.json`, `instrumented-census.log`, and `instrumented-census-exit.json`. The pre-existing failed `branch-completion-1017/tmp/work133/census.log` and `census-exit.json` remain intact. Reproduction from the AI checkout: `node tmp/probes/work133-census/prepare.mjs`, then `node tmp/probes/work133-census/input-digest.mjs before`, `node tmp/probes/work133-census/run-owned.mjs instrumented-census node_modules/vitest/vitest.mjs run --config tmp/probes/work133-census/vitest.config.mjs`, and `node tmp/probes/work133-census/input-digest.mjs after`. The scratch wrapper is copied from the integration's owned runner with only its output directory changed. Reproduction requires the pinned source inputs and overwrites this scratch run's evidence, so preserve needed evidence first.

## Measured opportunity and cause

Owner 1 first decided in Imperial at pre-step tick 19,620 and first had a complete Workshop at 26,700. At 26,700 it had 573 food, 51 wood and six gold, chose the affordable 300-food Capped Ram upgrade, and eventually completed it. Its 26 Capped Ram submissions include 25 in-flight rejections while that successful research was pending; this existing duplicate-intention behavior was not changed.

Owner 2 first decided in Imperial at pre-step tick 26,670, with Workshop 2200 complete and empty, 812 food, 602 wood, 1,280 gold, and 509 stone. Both Onager (800 food/500 gold) and Capped Ram (300 food) were affordable against that initial purse. The unchanged producer-order loop emitted Blast Furnace (275 food/225 gold), Halberdier (300 food/600 gold), Cavalier (300 food/300 gold), Onager (800 food/500 gold), then Conscription (150 food/150 gold). Submissions at tick 26,671, sequences 1973–1977, were all accepted by best-effort validation before authoritative spending. Blast Furnace and Halberdier alone leave 237 food, so Onager cannot execute at its later place in that command order. At the next decision, 26,685, the seat has two food and its Workshop queue contains a Battering Ram, with no technology. Onager takes 750 ticks and cannot have completed within those 15 ticks; it is absent from the terminal researched set as well.

Across owner 2's 1,222 Imperial decisions through pre-step tick 44,985, the Workshop had queue capacity on 1,183, and affordability plus capacity coincided only once: that first decision. Every subsequent decision had at most 101 food, below Capped Ram's 300-food minimum; all four other hosted upgrades require at least 800 food. There were zero decisions with affordable siege research and capacity but no siege research intention. The later silence therefore follows the purse, not a missing offer or permanently blocked queue. At the final pre-decision sample it held 21 food, 101 wood, 393 gold, and 1,036 stone.

The source explicitly documents this advisory over-acceptance contract in `src/game/simulation/bridge/systems/aiSystem.ts`: intentions share the raw stockpile and authoritative handlers select the affordable subset. `aiSystemProductionPhase.ts` visits producers and offered technologies in fixed order without reserving earlier intention prices; `trainingMarketOps.ts` rechecks and charges the live purse in `enqueueResearch`. Compared with main, this branch set changes the production phase only to supply monk reachability callbacks; its research choice, availability, affordability, queue gating, and handler logic are unchanged. This bounds the conclusion: the census moved with the combined economy and placement trajectory; the investigation does not establish a new purchasing defect or justify a purchasing-policy rewrite to recover a snapshot.

## Exact census differences against the untouched expectation

An em dash means an empty set. These are measured names, not a proposal to remove assertions. The integration owner must independently accept or reject the changed match before replacing the expectation.

| Scope | Set | Gained | Lost |
| --- | --- | --- | --- |
| Union | buildings | — | — |
| Union | units | arbalest | champion, elite-skirmisher, skirmisher |
| Union | technologies | arbalest-upgrade, bracer, ring-archer-armor | champion-upgrade, hoardings, plate-barding |
| Owner 1 | buildings | siege-workshop | watch-tower |
| Owner 1 | units | arbalest, capped-ram, monk | halberdier, skirmisher |
| Owner 1 | technologies | arbalest-upgrade, bracer, capped-ram-upgrade, ring-archer-armor | halberdier-upgrade, plate-barding |
| Owner 1 | researchProducers | siege-workshop | — |
| Owner 1 | trainProducers | monastery, siege-workshop | — |
| Owner 2 | buildings | watch-tower | — |
| Owner 2 | units | — | capped-ram, champion, elite-skirmisher, two-handed-swordsman |
| Owner 2 | technologies | — | capped-ram-upgrade, champion-upgrade, hoardings, plate-barding, plate-mail-armor, sappers, two-handed-swordsman-upgrade |
| Owner 2 | researchProducers | — | siege-workshop |
| Owner 2 | trainProducers | — | — |

The raw census is retained separately because the producer assertion fails before the maintained test reaches its two-way diff assertion. No expected file was refreshed during diagnosis. Final acceptance, any measured snapshot update, and the normal gate remain outstanding at this handoff.
