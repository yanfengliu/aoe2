// Initialize persisted bridge output after its resolution systems are wired.
// Replay worlds keep exactly the state slots their recording contained.
import { bootstrapFlush } from './bootstrapFlush';
import { TIER_3_SLOTS } from './bridgeStateSerialize';
import { registerOutputTail } from './registerOutputTail';

type OutputDeps = Omit<Parameters<typeof registerOutputTail>[0],
  'syncReplayUnitAttacks' | 'syncBuildingVisibility'> & { systemMode: 'live' | 'replay' };

export function initializeBridgeOutput({ systemMode, ...deps }: OutputDeps): void {
  const { world } = deps;
  const syncReplayUnitAttacks = systemMode !== 'replay'
    || world.getState(TIER_3_SLOTS.replayUnitAttacks) !== undefined;
  // The same for building sight: civ-engine refuses a replay world whose
  // state keys differ from its snapshot, and older recordings lack this slot.
  const syncBuildingVisibility = systemMode !== 'replay'
    || world.getState(TIER_3_SLOTS.buildingVisibility) !== undefined;
  const output = { ...deps, syncReplayUnitAttacks, syncBuildingVisibility };
  registerOutputTail(output);
  bootstrapFlush({ ...output, mapWidth: world.grid.width, mapHeight: world.grid.height });
}
