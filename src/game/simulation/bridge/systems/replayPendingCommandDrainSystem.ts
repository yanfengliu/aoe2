// Replay mode only: empties the bridge's pending-command queue each tick,
// before the AI system runs. Moved verbatim from `registerAllSystems.ts` for
// its 500-line budget when the attack warning's hit recorder was wired there
// (v0.3.235).

import type { RegisterAllSystemsDeps } from '../registerAllSystemsTypes';

export function registerReplayPendingCommandDrainSystem(
  world: RegisterAllSystemsDeps['world'],
  pendingCommands: RegisterAllSystemsDeps['pendingCommands'],
): void {
  world.registerSystem({
    name: 'aoe2ReplayPendingCommandDrain',
    phase: 'update',
    before: ['prototypeAi'],
    execute() {
      pendingCommands.length = 0;
    },
  });
}
