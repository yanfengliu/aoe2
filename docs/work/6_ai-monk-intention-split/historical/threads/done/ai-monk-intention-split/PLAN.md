# AI monk intention split plan

Status: Executed.

1. Add a failing AI monk regression in `tests/simulation/aiPlayer.test.ts` showing same-tick direct assignment currently lets an AI monk pick up a relic on the decision step.
2. Extract shared AI monk task-candidate selection in `monkTaskOps.ts` and add `pushAiMonkTaskIntentions(...)`.
3. Thread a `monk.contextAtEntity` intention pusher through `wireBridgeOps`, `registerBridgeSystems`, `registerAllSystems`, and `aiSystem`.
4. Replace `aiSystem`'s direct `assignAiMonkTasks(owner)` call with `pushAiMonkTaskIntentions(owner, pushMonkContextAtEntityIntention)`.
5. Carry AI-only `expectedOwner` / `intendedTaskKind` through the command and persist pending AI intentions across save/load.
6. Run targeted monk/AI command tests, typecheck, and the full required gates.
7. Update KAD/architecture/devlog docs to reflect that AI monk assignment now uses the command boundary.
8. Run multi-CLI review; document unreachable reviewers and real findings.
9. Move the thread to `docs/threads/done/ai-monk-intention-split/`, commit, and push.
