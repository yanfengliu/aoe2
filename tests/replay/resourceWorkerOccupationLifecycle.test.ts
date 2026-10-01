// Bound: unchanged woodline-clearing-fixture, 700 actual ticks in each world,
// all full non-cosmetic snapshots compared by native equality on every tick.
// This adds a literal gather/full-carry/deposit proof; it does not replace or
// score the separate 600-tick default-map prefix or native-120 instrument gate.
import { isDeepStrictEqual } from 'node:util';
import type { WorldSnapshot } from 'civ-engine';
import { expect, it } from 'vitest';
import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import { createReplayWorldOnly } from '../../src/game/simulation/replay/createReplayWorldOnly';
import type { GathererComponent, PlayerResources, ResourceComponent, UnitComponent } from '../../src/game/simulation/types';
import { createExactSnapshotSerializer } from './exactSnapshotSerializer';

type SnapshotParts = { state: Record<string, unknown>; components: Record<string, Array<[number, Record<string, unknown>]>> };
function stripOccupation(snapshot: WorldSnapshot) {
  const parts = snapshot as unknown as SnapshotParts;
  delete parts.state['aoe2.resourceOccupationVersion'];
  for (const [, unit] of parts.components.unit) delete unit.resourceOccupation;
}

it('keeps full modern and legacy state identical through real wood gathering, full carry and deposit', () => {
  const bridge = createSimulationBridge('woodline-clearing-fixture');
  const workers = bridge.getEconomyState().units.filter((unit) => unit.unitType === 'villager');
  expect(workers).toHaveLength(1);
  const worker = workers[0]!;
  expect(worker).toMatchObject({ owner: 2, x: 9, y: 10 });
  const tree = bridge.getEconomyState().resources.find((resource) => resource.x === 10 && resource.y === 10)!;
  expect(tree).toMatchObject({ resourceType: 'tree', baseOwner: 2, amount: 12 });
  const towns = bridge.getEconomyState().buildings.filter((building) => building.owner === 2 && building.buildingType === 'town-center');
  expect(towns).toHaveLength(1);
  const town = towns[0]!;
  expect(town).toMatchObject({ x: 4, y: 8 });
  const modern = createReplayWorldOnly(bridge.saveGame().worldSnapshot);
  const oldSnapshot = bridge.saveGame().worldSnapshot; stripOccupation(oldSnapshot);
  const legacy = createReplayWorldOnly(oldSnapshot);
  // Untouched construction slots are absent; their codec reads an empty map.
  expect(modern.getState('aoe2.constructionStates'), 'the fixture has no incomplete Town Center foundation').toBeUndefined();
  const worlds = [modern, legacy];
  const progress = (world: typeof modern) => ({
    worker: { ...world.getComponent<GathererComponent>(worker.id, 'gatherer')! },
    treeAmount: world.getComponent<ResourceComponent>(tree.id, 'resource')?.amount ?? 0,
    wood: (world.getState('aoe2.playerResources') as Array<[number, PlayerResources]>).find(([owner]) => owner === 2)![1].wood,
    score: (world.getState('aoe2.playerScoreCounters') as Array<[number, { resourcesGathered: number }]> | undefined)?.find(([owner]) => owner === 2)?.[1].resourcesGathered ?? 0,
  });
  let before = worlds.map(progress);
  for (const [index, world] of worlds.entries()) {
    expect(before[index]!.worker).toMatchObject({ carriedAmount: 0, carriedResource: null, carryCapacity: 10 });
    expect(world.submitWithResult('unit.gather', { unitId: worker.id, resourceId: tree.id }).accepted).toBe(true);
  }
  const phases = worlds.map(() => ({ gatheredAt: 0, fullAt: 0, depositedAt: 0 }));
  const initialTicks = worlds.map((world) => world.tick);
  const serialize = createExactSnapshotSerializer();
  let comparedTicks = 0;
  for (let tick = 0; tick < 700; tick++) {
    legacy.step(); modern.step();
    const after = worlds.map(progress);
    const snapshots = worlds.map(serialize);
    for (const [index, world] of worlds.entries()) {
      expect(world.tick).toBe(initialTicks[index]! + tick + 1);
      const previous = before[index]!; const next = after[index]!; const phase = phases[index]!;
      let observedPhase = false;
      if (!phase.gatheredAt && previous.worker.task === 'gathering' && previous.worker.targetResourceId === tree.id
        && next.worker.carriedResource === 'wood' && next.worker.carriedAmount > previous.worker.carriedAmount
        && next.treeAmount < previous.treeAmount) {
        expect(next.worker.carriedAmount - previous.worker.carriedAmount).toBe(1);
        expect(previous.treeAmount - next.treeAmount).toBe(1);
        phase.gatheredAt = tick + 1; observedPhase = true;
      }
      if (!phase.fullAt && next.worker.carriedResource === 'wood' && next.worker.carriedAmount === 10) {
        phase.fullAt = tick + 1; observedPhase = true;
      }
      if (!phase.depositedAt && previous.worker.task === 'to-dropoff' && previous.worker.carriedResource === 'wood'
        && previous.worker.carriedAmount === 10 && next.worker.carriedAmount === 0) {
        expect(previous.worker.dropOffBuildingId).toBe(town.id);
        expect(next.wood - previous.wood, 'the selected full wood load credits its owner').toBe(10);
        expect(next.score - previous.score, 'the selected full wood load credits resources-gathered score').toBe(10);
        phase.depositedAt = tick + 1; observedPhase = true;
      }
      if (observedPhase) {
        const unit = world.getComponent<UnitComponent>(worker.id, 'unit')!;
        const state = (snapshots[index]! as unknown as SnapshotParts).state;
        expect(Object.hasOwn(unit, 'resourceOccupation')).toBe(index === 0);
        expect(Object.hasOwn(state, 'aoe2.resourceOccupationVersion')).toBe(index === 0);
        if (index === 0) {
          expect(unit.resourceOccupation).toBe('wood');
          expect(state['aoe2.resourceOccupationVersion']).toBe(1);
        }
      }
    }
    stripOccupation(snapshots[0]!);
    expect(isDeepStrictEqual(snapshots[0], snapshots[1]), `full woodline state at tick ${tick + 1}`).toBe(true);
    before = after; comparedTicks++;
  }
  expect(comparedTicks).toBe(700);
  for (const phase of phases) {
    expect(phase.gatheredAt, 'selected worker really gathers from the commanded near tree').toBeGreaterThan(0);
    expect(phase.fullAt, 'selected worker reaches a 10-wood full carry').toBeGreaterThan(phase.gatheredAt);
    expect(phase.depositedAt, 'selected full carry deposits with exact stockpile and score credit').toBeGreaterThan(phase.fullAt);
  }
  if (process.env.SNAPSHOT_LIFECYCLE_REPORT === '1') console.info(JSON.stringify({ comparedTicks, phases }));
});
