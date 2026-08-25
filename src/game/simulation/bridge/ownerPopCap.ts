// The hard population limit as one OWNER experiences it: the match setting
// (default 200) plus the Goth "+10 to population limit in Imperial Age".
// Every deriveCap call site reads through this so the cap an owner trains
// against, the cap the HUD shows, and the cap a load re-derives are the same
// number — the ownerConstructionCost pattern applied to population.

import { civImperialPopulationBonus } from '../civBonusEffects';
import type { BridgeStateAccessor } from './bridgeStateAccessor';
import { POP_HARD_CAP } from './bridgeConstants';
import {
  matchSettingsCodec,
  playerAgesCodec,
  playerCivilizationsCodec,
} from './bridgeStateSerialize';

export function ownerHardPopCap(accessor: BridgeStateAccessor, owner: number): number {
  return (accessor.get(matchSettingsCodec).popCap ?? POP_HARD_CAP)
    + civImperialPopulationBonus(
      accessor.get(playerCivilizationsCodec).get(owner),
      accessor.get(playerAgesCodec).get(owner) ?? 'dark-age',
    );
}
