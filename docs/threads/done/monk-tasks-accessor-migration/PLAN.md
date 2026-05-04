# Monk tasks accessor migration plan

1. Add a failing replay/snapshot test proving an active Monk task is serialized to `world.state.aoe2.monkTasks` after the output flush.
2. Add `monkTasksCodec` to the incremental migrated-codec snapshot equivalence list.
3. Replace direct `state.monkTasks` reads/writes with `accessor.get/mutate(monkTasksCodec)` in monk task ops, monk behavior, unit movement cleanup, entity destroy cleanup, save, hydrate, and selection activity wiring.
4. Remove `monkTasks` from `BridgeState`.
5. Update architecture/devlog/roadmap docs and close this review thread after mandatory review.
6. Run targeted monk/replay tests, then full gates: `npm.cmd test`, `npm.cmd run typecheck`, `npm.cmd run lint`, `npm.cmd run build`.
