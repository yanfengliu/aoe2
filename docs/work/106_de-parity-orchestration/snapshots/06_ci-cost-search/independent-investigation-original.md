The strongest untried lead is **runtime overhead around the native comparator**, rather than another replacement equality algorithm. The retained interning measurements do not establish a fix. There is also a concrete coverage gap: the 120-tick proxy cannot exercise the selected villager’s full wood carry and deposit.

This is a read-only investigation artifact. I read the original Git blob first, confirmed HEAD is `c4024020a09c99f74728f2a880a86fbcbaef8e48`, inspected source and existing evidence, and ran no tests, profiles, builds, npm commands, browsers, servers, mutations, or subagents.

**1. Cost and lifecycle findings**

The hosted log records **31,647 ms for the failing case**, against 30,000 ms; 39,647 ms is the entire eight-test file. Thus the observed case exceeded its limit by 1,647 ms, about 5.2% of its elapsed time. That arithmetic is not a sufficient performance target: it describes one run without measuring variability. [Hosted failure, lines 178–182](C:/Users/38909/Documents/github/aoe2/tmp/parity-106/hosted-ci-failure.log:178)

The original test, `c4024020:tests/replay/resourceWorkerOccupation.test.ts:33–45,81–100`, already uses a per-source `WeakMap` and native `isDeepStrictEqual` before reusing a detached clone. Its timed body includes bootstrap, two saves, two replay-world constructions, command submission, 1,200 actual world steps, 1,200 instrumented serializations, and 600 final comparisons.

Several costs survive every cache hit:

- Engine serialization visits and validates every component and state value before calling `structuredClone`. It also constructs fresh component-entry arrays and snapshot containers. The installed **runtime JS**, not merely TypeScript declarations, establishes this. [Engine `dist/world.js:33`](C:/Users/38909/Documents/github/civ-engine/dist/world.js:33)
- Validation allocates a `WeakSet`, traverses arrays or `Object.entries`, checks prototypes and values, and constructs diagnostic paths. [Engine `json.ts:8`](C:/Users/38909/Documents/github/civ-engine/src/json.ts:8)
- The cache performs another exact comparison, followed by the final modern/legacy full-snapshot comparison.
- The scenario contains a real 60×36 map; terrain seeding adds terrain and renderable records for every cell. Those records remain within the required comparison population. [Map dimensions](C:/Users/38909/Documents/github/aoe2-worktrees/engine-coverage-adoption-1001/src/game/simulation/mapGeneration/constants.ts:13), [terrain seeding](C:/Users/38909/Documents/github/aoe2-worktrees/engine-coverage-adoption-1001/src/game/simulation/bridge/scenarioSeedOps.ts:219)

The last two AoE files, the replay factory, and runner configuration are **unchanged from the supplied base**, verified by Git diff. The replay factory deserializes the supplied snapshot and registers replay behavior; it does not regenerate a smaller scenario. [Replay factory](C:/Users/38909/Documents/github/aoe2-worktrees/engine-coverage-adoption-1001/src/game/simulation/replay/createReplayWorldOnly.ts:14)

The existing CPU profile supports an additional mechanism. I summed its recorded `timeDeltas` by sampled stack without executing the program:

| Recorded worker-profile category | Sampled time |
|---|---:|
| `World.serialize`, inclusive | 6,292 ms |
| Clone wrapper, inclusive | 3,715 ms |
| Native comparison functions, inclusive | 3,397 ms |
| JSON validation, inclusive | 1,606 ms |
| Vite import-proxy `get`, self time beneath the clone wrapper | 503 ms |

These categories overlap and **must not be added**. The worker recording spans 12,541 ms, including 2,333 ms sampled idle. [Raw profile, line 1](C:/Users/38909/Documents/github/aoe2-worktrees/engine-coverage-adoption-1001/tmp/work106-snapshot-profile/CPU.20260930.220919.65568.1.002.cpuprofile:1)

The getter’s source is Vite’s external-module interoperability proxy. Its sampled caller is the clone wrapper, where the baseline repeatedly accesses imported `isDeepStrictEqual`. This establishes real getter overhead in that recording and suggests capturing the function once. It does **not** measure the saving from doing so. [Vite proxy implementation](C:/Users/38909/Documents/github/aoe2-worktrees/engine-coverage-adoption-1001/node_modules/vite-node/dist/client.mjs:449)

The profile lacks an adjacent exact-source/runtime manifest, so I would not attribute its proportions to hosted engine 2.4.2 or treat them as a pinned baseline verdict.

The hash-bound proxy results establish why the current interning route remains unaccepted:

| Runtime, engine 2.5.0 | Baseline serialization + final comparison | Interning serialization + final comparison | Recorded difference |
|---|---:|---:|---:|
| Node 20.20.2 | 1,986.310 ms | 1,930.717 ms | −55.592 ms, −2.8% |
| Node 24.12.0 | 1,200.826 ms | 1,366.164 ms | +165.338 ms, +13.8% |

On Node 20, serialization grows from 1,330.293 to 1,684.049 ms while final comparison falls from 656.017 to 246.668 ms. It largely relocates work. Each arm makes 1,798,530 clone requests over 120 snapshot pairs; baseline reuse is already approximately 99%. [Node 20 evidence](C:/Users/38909/Documents/github/aoe2-worktrees/engine-coverage-adoption-1001/tmp/work106-snapshot-profile/final-intern-v20.20.2.json:6), [Node 24 evidence](C:/Users/38909/Documents/github/aoe2-worktrees/engine-coverage-adoption-1001/tmp/work106-snapshot-profile/final-intern-v24.12.0.json:6)

I verified that the three current source hashes match both final measurement files. Earlier descriptor/shallow results lack that binding and cannot establish the exact rejected implementations.

**2. Mechanism families and the two remaining attempts**

| Family | Smallest concrete change | False-green risk and decision |
|---|---|---|
| **Runtime access overhead — attempt 1** | Capture `isDeepStrictEqual` into a local constant when constructing the serializer; call that native function inside the hot clone wrapper. Leave the final native comparator and synchronous `try/finally` restoration intact. | Low semantic risk. Verify the actual Vitest path loses repeated proxy accesses; a standalone native-ESM proxy may never contain this overhead. Retain all prospective controls: a binding-only change is not permission to discard them or endorse the experimental interning implementation. |
| **Exact structural reuse — conditional attempt 2** | Replace global JSON-fingerprint pooling with a bounded correspondence cache: one candidate for the corresponding clone position in the paired serialization. Reuse only after an exact native comparison against the current source and conservative eligibility checks; mismatch falls back. | Position identifies a candidate, never equality. Different state-slot ordering, the extra modern marker, output edits, accessors, aliases and unsupported shapes must cause safe rejection or fallback. This differs from scanning content pools, but remains speculative. Spend this attempt only if attempt 1’s complete measurement leaves comparison/allocation cost dominant. |
| **Fixture/setup lifecycle — inspect, do not spend an attempt yet** | Potentially replace two identical boot-time save operations with one saved input and independently detached constructions. | Must prove identical inputs and preserve save flushing. Moving setup into hooks or module scope merely moves time outside the case and is not an accepted saving. Existing evidence does not show setup large enough to justify this route. |
| **Specialized equality or descriptor scanning** | Another custom shallow comparison guard. | Already-recorded variants were slower. Do not spend the remaining budget repeating this family without a newly identified, source-backed difference. |

Current interning performs native cloning before classification, fingerprinting, pool lookup and another exact comparison on misses. That sequence explains an obvious source of added work, without proving any replacement faster. [Experimental helper, lines 45–69](C:/Users/38909/Documents/github/aoe2-worktrees/engine-coverage-adoption-1001/tests/replay/exactSnapshotSerializer.ts:45)

Neither proposed attempt may bypass engine validation, weaken the final comparator, reduce snapshots, change gameplay, or use fingerprint equality. Two unsuccessful attempts would exhaust the stated repair allowance, not prove impossibility.

**3. Discriminator and measurement design**

The execution owner should retain the original baseline and use two distinct measurements:

- **Mechanism measurement:** alternate baseline/candidate order on the same stepped worlds, under the same runtime and runner. Keep independent native snapshot checks. Record clone requests, native clones, reuse, candidate misses, fallback counts, and each comparison phase. For the runtime-binding hypothesis, measure through Vitest/Vite; otherwise the suspected proxy cost is absent.
- **Acceptance measurement:** run the actual focused tests with the unchanged 30,000 ms timeout. Measure complete test-body and process elapsed time, including setup, stepping, validation/serialization, stripping, comparison, assertions and allocation/GC effects. Preserve the full 600-tick case and separate native-120 control.

The mandatory work census is:

- **600-tick equivalence case:** 1,200 world steps, 1,200 full validated serializations and 600 independent native modern/legacy comparisons.
- **Native-120 control:** 240 world steps, 240 instrumented plus 240 native serializations, and **240** unstripped full native comparisons.
- All transfer, exception/restoration, returned-output mutation, nested mutation, alias and fallback controls.

The current native-120 test does perform both-world comparisons per tick; “120 comparisons” would undercount it. [Native control](C:/Users/38909/Documents/github/aoe2-worktrees/engine-coverage-adoption-1001/tests/replay/exactSnapshotSerializer.test.ts:16)

Pin before and after each measurement: source revision and dirty diff, helper/test/driver hashes, loaded engine **dist** hashes/version, generated content, Node executable/version, runner versions/configuration, and command. The existing driver hashes only three files; its linked engine and game inputs are outside that protection. [Measurement driver](C:/Users/38909/Documents/github/aoe2-worktrees/engine-coverage-adoption-1001/tmp/work106-snapshot-profile/full-state-comparison-cost.mjs:48)

Keep the existing digest as provenance, never the equality decision. Alternate complete baseline/candidate executions within each Node version, record foreign load and both CPU and elapsed costs, and do not compare a Node 20 baseline against a Node 24 candidate. Require improvement in complete cost, not just the phase the implementation targeted.

The unchanged runner checks elapsed time even after synchronous test completion. Therefore this failure need not mean assertions stopped midway, and changing yields would not remove the underlying elapsed-time requirement. [Vitest timeout lifecycle](C:/Users/38909/Documents/github/aoe2-worktrees/engine-coverage-adoption-1001/node_modules/@vitest/runner/dist/chunk-hooks.js:1852), [unchanged configuration](C:/Users/38909/Documents/github/aoe2-worktrees/engine-coverage-adoption-1001/vitest.config.ts:23)

**4. Measurement validity, precise corrections and remaining gaps**

The 120-tick instrument is a useful **prefix microbenchmark**, not a complete lifecycle or total-test measurement:

- It times setup nowhere and defines `beforeTotalMs`/`afterTotalMs` as serialization plus final comparison only. Stepping, native-oracle comparisons, digesting and other overhead are excluded. These are valid phase totals but must not be reported as whole-test totals. [Driver, lines 39–78](C:/Users/38909/Documents/github/aoe2-worktrees/engine-coverage-adoption-1001/tmp/work106-snapshot-profile/full-state-comparison-cost.mjs:39)
- A villager starts with carry capacity 10; wood gives one unit per 26 gathering ticks. Owner 1 starts as Britons, whose gathering bonus applies to sheep. Consequently the selected worker needs **260 actual gathering ticks before travel**, so this 120-tick prefix cannot include its first full wood carry and deposit. [Gather cadence](C:/Users/38909/Documents/github/aoe2-worktrees/engine-coverage-adoption-1001/src/game/simulation/prototypeEconomyRules.ts:47), [carry initialization](C:/Users/38909/Documents/github/aoe2-worktrees/engine-coverage-adoption-1001/src/game/simulation/bridge/entityCreateOps.ts:228), [starting civilizations](C:/Users/38909/Documents/github/aoe2-worktrees/engine-coverage-adoption-1001/src/game/simulation/mapGeneration/applyStandardPlayerOpening/patches.ts:27), [Britons bonus](C:/Users/38909/Documents/github/aoe2-worktrees/engine-coverage-adoption-1001/src/game/simulation/civBonusTable.ts:129)
- The original 600-tick case checks accepted commands, equality and loop count, but has no explicit witnesses that gathering, full carry and deposit occurred. Equality alone could pass if both worlds failed to progress identically.

**Proposed correction for independent review:** preserve the original input and all 600 comparisons; add read-only witnesses for actual tick advancement, selected-worker gathering, full carry, and subsequent deposit. Bind deposit evidence to that worker’s carry transition and the corresponding resource/score update, accounting for same-tick reassignment and other workers. The implementation explicitly transitions full carriers to drop-off and then clears cargo while crediting resources. [Gather transition](C:/Users/38909/Documents/github/aoe2-worktrees/engine-coverage-adoption-1001/src/game/simulation/bridge/systems/villagerEconomySystem.ts:354), [deposit transition](C:/Users/38909/Documents/github/aoe2-worktrees/engine-coverage-adoption-1001/src/game/simulation/bridge/systems/dropOffStep.ts:147)

This strengthens observation without changing the fixture. If those witnesses fail, report the baseline coverage defect before rescoring; do not silently choose another tree, shorten travel, change rates, or shrink the world.

Finally, preserve the runtime distinction: **hosted failure used engine 2.4.2; prospective local evidence uses 2.5.0**. The supplied hosted excerpt independently establishes the timeout, but does not itself identify the engine artifact. Its version attribution remains supplied context.

Still required: actual focused Node 20/24 results, explicit lifecycle witnesses, independent acceptance of the exact final source, the full gate, and a new hosted result on the intended engine artifact. None is established by this investigation.