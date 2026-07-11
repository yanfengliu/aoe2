import { describe, expect, it } from 'vitest';

import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import { selectOwnedUnitDirect, stepBridgeUntil } from './createSimulationBridge.helpers';
import { codecSlotValue } from './saveBlobTestUtils';
import { townCenterRefsCodec } from '../../src/game/simulation/bridge/bridgeStateSerialize';

// Full-review M12: destroying the owner's REFERENCED Town Center used to just
// delete the per-owner ref, leaving TC-dependent AI logic (production / age-up)
// and the AI's attack targeting reference-less even when the owner still had
// another TC. It must re-select a surviving TC instead.

describe('town-center reference reselects on destroy (full-review M12)', () => {
  it('re-points the per-owner TC ref at a surviving TC when the referenced one is razed', () => {
    const bridge = createSimulationBridge('town-center-reselect-fixture');
    const owner2Tcs = () =>
      bridge
        .getEconomyState()
        .buildings.filter((b) => b.owner === 2 && b.buildingType === 'town-center');
    expect(owner2Tcs()).toHaveLength(2);

    // townCenterRefs is a flatMap codec → serialized as [[owner, EntityRef], …].
    const owner2Ref = (): { id: number } | undefined =>
      (
        codecSlotValue(bridge.saveGame(), townCenterRefsCodec) as Array<[number, { id: number }]>
      ).find(([owner]) => owner === 2)?.[1];

    const refBefore = owner2Ref();
    expect(refBefore).toBeDefined();
    const referencedId = refBefore!.id;
    const survivor = owner2Tcs().find((b) => b.id !== referencedId);
    expect(survivor).toBeDefined();

    // The human bombard razes owner 2's referenced TC (low HP, in range).
    expect(selectOwnedUnitDirect(bridge, 1, 'bombard-cannon')).toBe(true);
    expect(bridge.issueContextCommandAtEntity(referencedId)).toBe(true);
    expect(
      stepBridgeUntil(bridge, () => !owner2Tcs().some((b) => b.id === referencedId), {
        maxSteps: 400,
      }),
    ).toBe(true);

    // Pre-fix the ref was deleted; it must now re-select the surviving TC.
    expect(owner2Ref()?.id).toBe(survivor!.id);
  });
});
