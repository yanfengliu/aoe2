// agent-affordances B: per-building-type options payload for the agent
// snapshot ("what can each of my buildings do right now, and why is the
// rest locked"). Campaign-1 evidence: the agent reverse-engineered the
// feudal-age prerequisite rule from 8 bare rejections; this surface
// states it up front.

import { describe, expect, it } from 'vitest';

import { World } from 'civ-engine';
import {
  createBuildingOptionsOps,
  type BuildingOptionsDeps,
} from '../../src/game/simulation/bridge/buildingOptionsOps';
import { BridgeStateAccessor } from '../../src/game/simulation/bridge/bridgeStateAccessor';
import { constructionStatesCodec } from '../../src/game/simulation/bridge/bridgeStateSerialize';
import type {
  GameCommands,
  GameComponents,
  GameEvents,
} from '../../src/game/simulation/bridge/pureHelpers';
import type {
  BuildingType,
  ResearchableTechnologyType,
  TrainableUnitType,
} from '../../src/game/simulation/types';
import type { ConstructionState } from '../../src/game/simulation/bridge/sharedTypes';
import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';

function makeUnitFixture() {
  const world = new World<GameEvents, GameCommands, GameComponents>({
    gridWidth: 8,
    gridHeight: 8,
    seed: 'building-options',
    tps: 10,
  });
  world.registerComponent('building');
  const accessor = new BridgeStateAccessor(() => world);

  const addBuilding = (buildingType: BuildingType, owner: number, isComplete = true) => {
    const id = world.createEntity();
    world.addComponent(id, 'building', { buildingType, owner });
    if (!isComplete) {
      accessor.mutate(constructionStatesCodec, (m) => {
        m.set(id, { isComplete: false } as unknown as ConstructionState);
      });
    }
    return id;
  };

  addBuilding('town-center', 2);
  addBuilding('house', 2); // no options at all -> omitted from payload
  addBuilding('barracks', 2, false); // under construction -> excluded
  addBuilding('blacksmith', 3); // other owner -> excluded

  const researchByType: Partial<Record<BuildingType, ResearchableTechnologyType[]>> = {
    'town-center': [],
  };
  const visibleByType: Partial<Record<BuildingType, ResearchableTechnologyType[]>> = {
    'town-center': ['feudal-age'],
  };
  const trainByType: Partial<Record<BuildingType, TrainableUnitType[]>> = {
    'town-center': ['villager'],
  };

  const deps: BuildingOptionsDeps = {
    world,
    accessor,
    getResearchOptions: (_owner, buildingType) => researchByType[buildingType] ?? [],
    getVisibleResearchOptions: (_owner, buildingType) => visibleByType[buildingType] ?? [],
    getTrainOptions: (_owner, buildingType) => trainByType[buildingType] ?? [],
    getBuildOptions: () => ['house', 'barracks'],
    inFlightTechsFor: () => new Set<ResearchableTechnologyType>(),
    researchUnavailableReason: (_owner, _buildingType, tech) => `reason for ${tech}`,
  };
  return { deps, researchByType, visibleByType };
}

describe('createBuildingOptionsOps', () => {
  it('lists completed own building types only, with locked research carrying reasons', () => {
    const { deps } = makeUnitFixture();
    const ops = createBuildingOptionsOps(deps);
    const payload = ops.getAgentBuildingOptions(2);

    expect(payload.byBuildingType.map((entry) => entry.buildingType)).toEqual(['town-center']);
    const tc = payload.byBuildingType[0]!;
    expect(tc.train).toEqual(['villager']);
    expect(tc.research).toEqual([]);
    expect(tc.researchLocked).toEqual([{ tech: 'feudal-age', reason: 'reason for feudal-age' }]);
  });

  it('moves in-flight techs from available to locked', () => {
    const { deps, researchByType, visibleByType } = makeUnitFixture();
    researchByType['town-center'] = ['feudal-age'];
    visibleByType['town-center'] = ['feudal-age'];
    deps.inFlightTechsFor = () => new Set<ResearchableTechnologyType>(['feudal-age']);
    const ops = createBuildingOptionsOps(deps);
    const tc = ops.getAgentBuildingOptions(2).byBuildingType[0]!;
    expect(tc.research).toEqual([]);
    expect(tc.researchLocked).toEqual([
      { tech: 'feudal-age', reason: 'feudal-age is already being researched.' },
    ]);
  });

  it('carries research costs and clones them', () => {
    const { deps, researchByType, visibleByType } = makeUnitFixture();
    researchByType['town-center'] = ['feudal-age'];
    visibleByType['town-center'] = ['feudal-age'];
    const ops = createBuildingOptionsOps(deps);
    const tc = ops.getAgentBuildingOptions(2).byBuildingType[0]!;
    expect(tc.research).toEqual([{ tech: 'feudal-age', cost: { food: 500 } }]);
    // mutating the returned cost must not poison the rules table
    tc.research[0]!.cost.food = 1;
    const again = createBuildingOptionsOps(deps).getAgentBuildingOptions(2);
    expect(again.byBuildingType[0]!.research[0]!.cost).toEqual({ food: 500 });
  });

  it('describes the villager build menu with footprints and costs', () => {
    const { deps } = makeUnitFixture();
    const ops = createBuildingOptionsOps(deps);
    const { villagerCanBuild } = ops.getAgentBuildingOptions(2);
    expect(villagerCanBuild).toEqual([
      { buildingType: 'house', footprint: '2x2', cost: { wood: 25 } },
      { buildingType: 'barracks', footprint: '3x3', cost: { wood: 175 } },
    ]);
  });
});

describe('getAgentBuildingOptions via the live bridge (campaign-1 case)', () => {
  it('tells a dark-age player WHY feudal-age is locked at the town center', () => {
    const bridge = createSimulationBridge('aoe2-prototype');
    const payload = bridge.getAgentBuildingOptions(2);

    const tc = payload.byBuildingType.find((entry) => entry.buildingType === 'town-center');
    expect(tc).toBeDefined();
    expect(tc!.train).toContain('villager');
    const feudal = tc!.researchLocked.find((entry) => entry.tech === 'feudal-age');
    expect(feudal).toBeDefined();
    expect(feudal!.reason).toContain('2 completed Dark Age buildings');
    expect(feudal!.reason).toContain('you have 0');

    const house = payload.villagerCanBuild.find((entry) => entry.buildingType === 'house');
    expect(house).toEqual({ buildingType: 'house', footprint: '2x2', cost: { wood: 25 } });
  });

  it('finds deterministic open placement anchors near the agent town center', () => {
    const bridge = createSimulationBridge('aoe2-prototype');
    const tc = bridge.getEconomyState().buildings.find(
      (b) => b.owner === 2 && b.buildingType === 'town-center',
    );
    expect(tc).toBeDefined();
    const a = bridge.findOpenPlacementAnchorsNear(2, tc!.x, tc!.y, 2, 2, 6);
    const b = bridge.findOpenPlacementAnchorsNear(2, tc!.x, tc!.y, 2, 2, 6);
    expect(a).toEqual(b);
    expect(a.length).toBeGreaterThan(0);
    for (const anchor of a) {
      expect(Math.max(Math.abs(anchor.x - tc!.x), Math.abs(anchor.y - tc!.y))).toBeLessThanOrEqual(12);
    }
  });
});
