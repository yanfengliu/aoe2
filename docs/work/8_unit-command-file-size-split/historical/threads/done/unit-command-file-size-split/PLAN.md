# `unitCommandOps` file-size split plan

Status: Executed.

1. Use the existing failing `tests/architecture/fileSizeBudget.test.ts` result as the RED gate: `unitCommandOps.ts` at 594 lines, above the 588-line legacy cap.
2. Extract selected-entity/sheep query helpers and selection mutators into `unitSelectionOps.ts`.
3. Extract `sheep.move` facade/direct helper code into `sheepCommandOps.ts`.
4. Compose those helper factories from `createUnitCommandOps` so existing call sites keep the same methods.
5. Remove the `unitCommandOps.ts` legacy exemption from `tests/architecture/fileSizeBudget.test.ts`.
6. Run targeted file-size, command, typecheck, and lint gates.
7. Run multi-CLI review; document unreachable reviewers and real findings.
8. Run full gates, fold review into the devlog, then commit and push.
