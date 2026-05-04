# `unitCommandOps` file-size split review

Iteration 1.

## Reviewers

- Codex (`gpt-5.5`, xhigh, read-only): no issues found. Verified the moved selection and sheep command bodies against live wiring: `createUnitCommandOps` still composes the same public surface, `wireBridgeOps` / `registerBridgeSystems` / `humanInputOps` still receive the expected functions, and the file-size budget exemption removal matches the current split. Codex could not run `npm.cmd run typecheck` inside its read-only review shell because local policy rejected npm execution; main-session verification covers that.
- Claude (`claude-opus-4-7[1m]`, max): unreachable. CLI returned quota limit: "resets May 5, 7pm (America/Los_Angeles)". Per AGENTS.md, proceed with available reviewer and retry unreachable CLIs on the next iteration/session.

## Findings

- None.

## Verification Evidence

- `npm.cmd test -- tests/architecture/fileSizeBudget.test.ts`: pass.
- `npm.cmd test -- tests/commands/unitMove.test.ts tests/commands/unitAttack.test.ts tests/commands/unitGather.test.ts tests/commands/unitContext.test.ts tests/commands/unitContextAtEntity.test.ts tests/commands/sheepMove.test.ts`: pass.
- `npm.cmd run typecheck`: pass.
- `npm.cmd run lint`: pass.

## Final Disposition

Accepted pending full repository gates. No review-driven code changes required in this iteration.
