import { describe, expect, it, vi } from 'vitest';

import type { BridgeStateAccessor } from '../../src/game/simulation/bridge/bridgeStateAccessor';
import {
  garrisonedByBuildingCodec,
  garrisonedUnitToBuildingCodec,
  garrisonedUnitVisionSourcesCodec,
} from '../../src/game/simulation/bridge/bridgeStateSerialize';
import type { GameWorld } from '../../src/game/simulation/bridge/pureHelpers';
import {
  createTrainingMarketOps,
  type TrainingMarketOpsDeps,
} from '../../src/game/simulation/bridge/trainingMarketOps';

describe('trainingMarketOps ungarrison placement', () => {
  it('keeps a villager contained when fresh placement fails, then releases it on retry', () => {
    const buildingId = 1;
    const villagerId = 2;
    const exit = { x: 12, y: 11 };
    const storedVision = { playerId: 1, radius: 4 };
    const storedTransform = { presentedX: 3.25, presentedY: 4.5 };
    const components = new Map<string, unknown>([
      [`${buildingId}:building`, { owner: 1, buildingType: 'town-center' }],
      [`${buildingId}:position`, { x: 8, y: 8 }],
      [`${villagerId}:unit`, { owner: 1, unitType: 'villager' }],
      [`${villagerId}:unitTransform`, storedTransform],
    ]);
    const garrisonedByBuilding = new Map([[buildingId, [villagerId]]]);
    const garrisonedUnitToBuilding = new Map([[villagerId, buildingId]]);
    const garrisonedVisionSources = new Map([[villagerId, storedVision]]);
    const states = new Map<string, unknown>([
      [garrisonedByBuildingCodec.slot, garrisonedByBuilding],
      [garrisonedUnitToBuildingCodec.slot, garrisonedUnitToBuilding],
      [garrisonedUnitVisionSourcesCodec.slot, garrisonedVisionSources],
    ]);
    const accessor = {
      get: (codec: { slot: string }) => states.get(codec.slot),
      mutate: (codec: { slot: string }, mutate: (value: unknown) => void) => {
        mutate(states.get(codec.slot));
      },
      markDirty: vi.fn(),
    } as unknown as BridgeStateAccessor;
    const world = {
      getComponent: (id: number, component: string) => components.get(`${id}:${component}`),
      addComponent: (id: number, component: string, value: unknown) => {
        components.set(`${id}:${component}`, value);
      },
    } as unknown as GameWorld;
    let placementAvailable = false;
    const placeFreshSpawnUnit = vi.fn((id: number, position: typeof exit) => {
      if (!placementAvailable) return null;
      components.set(`${id}:position`, position);
      return position;
    });
    const markOutOfBandRenderChange = vi.fn();
    const clearGathererOrder = vi.fn();
    const ops = createTrainingMarketOps({
      world,
      accessor,
      placementMode: { current: null },
      findBuildingSpawnPosition: () => exit,
      placeFreshSpawnUnit,
      clearGathererOrder,
      markOutOfBandRenderChange,
    } as unknown as TrainingMarketOpsDeps);

    expect(ops.ungarrisonBuilding(buildingId)).toBe(false);
    expect(garrisonedByBuilding.get(buildingId)).toEqual([villagerId]);
    expect(garrisonedUnitToBuilding.get(villagerId)).toBe(buildingId);
    expect(garrisonedVisionSources.get(villagerId)).toEqual(storedVision);
    expect(components.has(`${villagerId}:position`)).toBe(false);
    expect(components.has(`${villagerId}:visionSource`)).toBe(false);
    expect(components.get(`${villagerId}:unitTransform`)).toBe(storedTransform);
    expect(markOutOfBandRenderChange).not.toHaveBeenCalled();

    placementAvailable = true;
    expect(ops.ungarrisonBuilding(buildingId)).toBe(true);
    expect(garrisonedByBuilding.has(buildingId)).toBe(false);
    expect(garrisonedUnitToBuilding.has(villagerId)).toBe(false);
    expect(garrisonedVisionSources.has(villagerId)).toBe(false);
    expect(components.get(`${villagerId}:position`)).toEqual(exit);
    expect(components.get(`${villagerId}:visionSource`)).toEqual(storedVision);
    expect(clearGathererOrder).toHaveBeenCalledWith(villagerId);
    expect(markOutOfBandRenderChange).toHaveBeenCalledOnce();
  });
});
