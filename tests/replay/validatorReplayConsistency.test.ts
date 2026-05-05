import { describe, expect, it } from 'vitest';

import { createReplayWorldOnly } from '../../src/game/simulation/replay/createReplayWorldOnly';
import { recordCommandReplayFixture } from './replayCommandHelpers';
import type { GameCommands } from '../../src/game/simulation/bridge/pureHelpers';

describe('Phase 3A.5 - validator replay consistency', () => {
  it('re-submits each recorded command with the same byte-for-byte validation result', () => {
    const { bundle } = recordCommandReplayFixture();
    const world = createReplayWorldOnly(bundle.initialSnapshot);
    const commandsByTick = new Map<number, typeof bundle.commands>();

    for (const command of bundle.commands) {
      const bucket = commandsByTick.get(command.submissionTick);
      if (bucket) {
        bucket.push(command);
      } else {
        commandsByTick.set(command.submissionTick, [command]);
      }
    }
    for (const bucket of commandsByTick.values()) {
      bucket.sort((left, right) => left.sequence - right.sequence);
    }

    const replayExecutions: unknown[] = [];
    world.onCommandExecution((execution) => {
      replayExecutions.push(execution);
    });

    for (
      let tick = bundle.metadata.startTick;
      tick < bundle.metadata.endTick;
      tick += 1
    ) {
      for (const command of commandsByTick.get(tick) ?? []) {
        const result = world.submitWithResult(
          command.type as keyof GameCommands,
          command.data as GameCommands[keyof GameCommands],
        );
        expect(result).toEqual(command.result);
      }
      world.step();
    }

    expect(replayExecutions).toEqual(bundle.executions);
  });
});
