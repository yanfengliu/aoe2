# Movement checkpoint proof and bounds

Status: prepared; frozen runtime focused checks only. Independent review, engine 2.5 retest, full gate and main/hosted acceptance are pending.

## Inputs and independent expectations

Base is game c4024020a09c99f74728f2a880a86fbcbaef8e48 with frozen engine 2.4.2 and voxel 1.2.0. The exact inherited instrument SHA-256 is `52564fa57bf1aeda2e383358e50dbd805a20be99eb319d8590dbe905f23e01c8`: default seed `aoe2-prototype`, AI owners1/2 disabled, occupation-only legacy field removal, one gathering tick and 280 movement ticks to (16,12), checkpoint interval70 and terminal snapshot. Before repair it checked five intervals, skipped zero and diverged70→140 on unit2205 position. After repair it checks the same five intervals with no state/event/execution divergence.

The cause control starts at an equal serialized tick70 snapshot. Actual continuously stepped and hydrated worlds first differ at tick89 in traffic direction, south versus east at coarse(12,7), fine(48,30), carry16 before that tick. A scoped observer finds the retained original path suffix south and the checkpoint's fresh equal-cost suffix east. Clearing only the warm path map at70 makes full actual worlds equal through140 while changing original live pacing, so clearing/replanning would conceal the cause instead of preserving play.

The checked expectations are actual continuous world states, not the path solver's output table. The independent original pacing checkpoints remain70(10,7),89(12,7),140(14,9),281(16,12); tick89 direction is(0,1) with carry48. The separate folded Gatherer discrepancy prevents a claim that every folded full snapshot already matches live state.

## Contract and checks

Version1 `aoe2.movePaths` contains routes `[unitId,{generation,orderedTarget,destination,path}]`. New worlds and user-loaded old saves enable it. Historical replay worlds without it retain absence and cannot reconstruct earlier path choices. Valid paths use finite integer in-bounds cells, cardinal adjacency, no repeated cell, a matching current unit generation and standing move/attack-move target, and include the current coarse cell. The requested target is separate from a blocked-target fallback destination. Route metadata is detached; cursor is derived on load and is never persisted per tick. Invalid individual routes discard safely; unsupported slot formats reject with an actionable message.

`movementCheckpointContinuation.test.ts` checks two occupation-format recordings, full actual world equality at checkpoint41/70/88/100 until150 (109/80/62/50 executed comparisons), two actual user-loaded move/attack-move continuations (80 comparisons each), and independent original pacing. `movementRoutePersistence.test.ts` checks both old save schemas, historical absence, valid fallback routes, input/world alias isolation, corrupt route fields/entries/duplicates, recycled generation, unsupported formats, exact queued-waypoint transition, retarget/nonmove/completion/manual engine destruction, and event-only writes. This does not independently exercise every combat death, sea path, map seed or historical recording.

The exact eight-file focused run passed87/87 tests: both new files, existing replay accessor/snapshot equivalence and simulation path caching/cache-key/save/load/integrity. Later schema-1/2 migration checks passed2/2 (the schema-2 case repeats coverage already in the87); direct `tsc --noEmit` passed after the schema addition. No full `npm run verify`, browser/build, supported engine 2.5 run or independent review is claimed.

## Sensitivity

Before production changes, seven initial cases yielded five assertion failures and two passing controls. The queued-waypoint checkpoint test later failed while the command was changed without clearing the persisted previous route. Four post-repair mutants produced observed assertion failures, never merely nonzero tool exits:

| Reintroduced defect | Checked tests | RED assertion count | Passing/skipped controls |
| --- | ---: | ---: | --- |
| Omit loaded route hydration | 9 checkpoint cases | 8 | 1 passed,0 skipped |
| Accept stale unit generation | 1 selected boundary | 1 | 20 deliberately skipped |
| Enable persistence in historical absent-slot replay | 1 selected boundary | 1 | 20 deliberately skipped |
| Omit route deletion persistence | 1 selected lifecycle | 1 | 20 deliberately skipped |

The mutation runner restores the exact original wrapper bytes in finally. Original and restored SHA-256 are `cd439fb4a25173d23f61ce495bf2e46843b2ece635b3372a4104c95c6af0138a`. Reports, stdout and original bundle remain under ignored `tmp/parity-107`; the recorded multi-megabyte bundle is not promoted to Git.

## Cost and resource bounds

The maintained interleaved tick tool's core and successful-tick accounting compare two trees in one process, with both installed runtimes2.4.2 and foreign CPU load beside each chunk. Equality strips only `aoe2.movePaths`; all other serialized world data stays equal. The initial adapter's wrong StepReport field produced zero measured ticks and was rejected, never counted as a result.

The default all-AI opening executed16,000 ticks in each arm,46 units/31 buildings at the measured snapshot, and16 equal chunk digests. It had no standing move route yet: empty slot adds43 snapshot bytes and258 exact route-field bytes to a further280-tick bundle. Steady total candidate/baseline CPU ratio was0.993, wall0.975, with15 comparable chunks and median3.06 foreign busy cores. An earlier valid sample wasCPU1.020/wall1.012; these are noisy observations, not a speedup.

An equally disabled-AI movement phase used the same grown worlds and26 actual owner1 move commands, then1,000 successful equal ticks plus a280-tick retarget recording. Full initial/final non-route worlds compare equal. Active snapshot size is620,781→632,451 bytes (delta11,670,1.88%); the route slot payload is11,652 bytes. Actual recording sizes are8,283,955→8,372,941 bytes; independent metrics make their raw88,986-byte difference unsuitable as the exact slot cost. Stripping route fields from that same candidate bundle measures89,104 bytes (1.06% of the candidate bundle) across initial/checkpoint snapshots and29 route-change diff ticks. The wrapper publishes74 route-slot writes over1,281 actual ticks including the initial cohort, retarget, refresh and completion; a lone uninterrupted walker publishes once over70 ticks. Each dirty tick publishes the full current route table through the existing accessor, so event-only writes do not imply constant bytes or free fingerprinting.

Active-phase steady CPU total ratio is0.905 while wall ratio is1.052 over9 comparable100-tick chunks; CPU timing granularity and warm-up make this short phase noisy. All step timings include the engine's state fingerprinting, but do not isolate its separate share, and no zero-cost claim follows from the write count. Root accepted no material measured CPU regression within this bound. The expensive slot was released; the owned c402 control checkout/branch were removed through the safe controller, which verified its former junction target was intact. The frozen mirror remains retained for outstanding checks.
