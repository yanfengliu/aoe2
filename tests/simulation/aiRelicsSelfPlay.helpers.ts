// Bound: transport/conservation in the two declared matches. Each tick reads
// tiny relic/carry/store sets; newly created relics are tracked through diffs,
// so legitimate spills and erroneous duplicates also enter conservation.
import type { EntityRef, Position, TickDiff } from 'civ-engine';
import {
  constructionStatesCodec, monkCarriedRelicCodec, monkTasksCodec,
  relicCountdownsCodec, relicsInMonasteryCodec,
} from '../../src/game/simulation/bridge/bridgeStateSerialize';
import { LayeredVisibilityMap } from '../../src/game/simulation/bridge/layeredVisibilityMap';
import { visibilityStateFromSlots } from '../../src/game/simulation/bridge/visibilitySlots';
import type { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import type { BuildingComponent, ResourceComponent, UnitComponent } from '../../src/game/simulation/types';

export type Bridge = ReturnType<typeof createSimulationBridge>;
// Independent contract value: spec §6.9 gives pickup/deposit reach four.
const DEPOSIT_RANGE = 4;
export function slot<T>(bridge: Bridge, codec: { slot: string; deserialize: (json: never) => T }): T {
  return codec.deserialize(bridge.world.getState(codec.slot) as never);
}
function footprintDistance(position: Position, building: Position): number {
  // The authoritative Monastery occupies 2x2 cells.
  const x = Math.max(building.x, Math.min(position.x, building.x + 1));
  const y = Math.max(building.y, Math.min(position.y, building.y + 1));
  return Math.abs(position.x - x) + Math.abs(position.y - y);
}
interface Carry {
  relic: number;
  relicRef: EntityRef;
  monk: number;
  monkRef: EntityRef;
  owner: number;
  pickup: Position;
  last: Position;
  distanceAtPickup: number;
  travel: number;
  monastery: EntityRef | null;
}
export interface Delivery extends Carry { tick: number }

export function createRelicOracle(bridge: Bridge) {
  const initial = bridge.getEconomyState();
  const initialRelics = initial.resources.filter((resource) => resource.resourceType === 'relic');
  const key = (ref: EntityRef) => `${ref.id}:${ref.generation}`;
  const relicRefs = new Map(initialRelics.map((resource) => {
    const ref = bridge.world.getEntityRef(resource.id)!;
    return [key(ref), ref];
  }));
  const monasteryRefs = new Map(initial.buildings.filter((building) => building.buildingType === 'monastery').map((building) => {
    const ref = bridge.world.getEntityRef(building.id)!;
    return [key(ref), ref];
  }));
  const carries = new Map<string, Carry>();
  const picked = new Set<number>();
  const deliveries: Delivery[] = [];
  const stores: string[] = [];
  let previousStored = new Map<number, number>();
  let currentTick = 0;
  function fail(message: string): never { throw new Error(`Relic contract at tick ${currentTick}: ${message}`); }
  const onDiff = (diff: TickDiff): void => {
    for (const [id, value] of diff.components.resource?.set ?? []) {
      if ((value as unknown as ResourceComponent).resourceType === 'relic') {
        const ref = bridge.world.getEntityRef(id);
        if (ref) relicRefs.set(key(ref), ref);
      }
    }
    for (const [id, value] of diff.components.building?.set ?? []) {
      if ((value as unknown as BuildingComponent).buildingType === 'monastery') {
        const ref = bridge.world.getEntityRef(id);
        if (ref) monasteryRefs.set(key(ref), ref);
      }
    }
  };
  bridge.world.onDiff(onDiff);
  const monastery = (id: number, ref = bridge.world.getEntityRef(id)) => {
    if (!ref || !bridge.world.isCurrent(ref)) return null;
    const building = bridge.world.getComponent<BuildingComponent>(id, 'building');
    const position = bridge.world.getComponent<Position>(id, 'position');
    const construction = slot(bridge, constructionStatesCodec).get(id);
    if (!building || building.buildingType !== 'monastery' || !position || (construction && !construction.isComplete)) return null;
    return { owner: building.owner, ...position };
  };
  function observe(tick: number): void {
    currentTick = tick;
    const stored = slot(bridge, relicsInMonasteryCodec);
    const carried = slot(bridge, monkCarriedRelicCodec);
    const tasks = slot(bridge, monkTasksCodec);
    const countdowns = slot(bridge, relicCountdownsCodec);
    const heldByOwner = new Map<number, number>();
    const increments = new Map<number, number>();
    let storedTotal = 0;
    for (const [id, count] of stored) {
      const home = monastery(id);
      if (!home || !Number.isInteger(count) || count < 0) fail(`stored count ${count} references no live complete Monastery ${id}`);
      storedTotal += count;
      heldByOwner.set(home.owner, (heldByOwner.get(home.owner) ?? 0) + count);
      const increase = count - (previousStored.get(id) ?? 0);
      if (increase > 0) { increments.set(id, increase); stores.push(`t=${tick} o${home.owner}x${count}`); }
    }
    let liveRelics = 0;
    for (const ref of relicRefs.values()) {
      if (bridge.world.isCurrent(ref) && bridge.world.getComponent<ResourceComponent>(ref.id, 'resource')?.resourceType === 'relic') liveRelics += 1;
    }
    if (liveRelics + storedTotal !== initialRelics.length) fail(`${liveRelics} relic resource entities (carried included) + ${storedTotal} stored differs from initial ${initialRelics.length}`);
    const uniqueHeld = new Set<number>();
    const heldReferences = new Set<string>();
    for (const [monkId, relicId] of carried) {
      if (uniqueHeld.has(relicId)) fail(`relic ${relicId} has multiple carriers`);
      uniqueHeld.add(relicId);
      const unit = bridge.world.getComponent<UnitComponent>(monkId, 'unit');
      const position = bridge.world.getComponent<Position>(monkId, 'position');
      const monkRef = bridge.world.getEntityRef(monkId);
      const relicRef = bridge.world.getEntityRef(relicId);
      if (!monkRef || !unit || !['monk', 'missionary'].includes(unit.unitType) || !position) fail(`carrier ${monkId} of relic ${relicId} is not a live positioned monastic unit`);
      if (!relicRef || !relicRefs.has(key(relicRef)) || bridge.world.getComponent<ResourceComponent>(relicId, 'resource')?.resourceType !== 'relic') fail(`carried relic ${relicId} is not a live tracked relic resource`);
      const referenceKey = key(relicRef);
      heldReferences.add(referenceKey);
      let trace = carries.get(referenceKey);
      if (!trace) {
        const distances = [...monasteryRefs.values()].flatMap((ref) => {
          const home = monastery(ref.id, ref);
          return home?.owner === unit.owner ? [footprintDistance(position, home)] : [];
        });
        trace = { relic: relicId, relicRef, monk: monkId, monkRef, owner: unit.owner, pickup: { ...position }, last: { ...position },
          distanceAtPickup: distances.length > 0 ? Math.min(...distances) : -1, travel: 0, monastery: null };
        carries.set(referenceKey, trace);
        picked.add(relicId);
      }
      if (trace.monk !== monkId || !bridge.world.isCurrent(trace.monkRef)) fail(`relic ${relicId} switched directly from carrier ${trace.monk} to ${monkId}`);
      trace.owner = unit.owner;
      trace.last = { ...position };
      trace.travel = Math.max(trace.travel, Math.abs(position.x - trace.pickup.x) + Math.abs(position.y - trace.pickup.y));
      const task = tasks.get(monkId);
      if (task?.kind === 'deposit') trace.monastery = task.targetEntityRef;
    }
    for (const [referenceKey, trace] of carries) {
      if (heldReferences.has(referenceKey)) continue;
      if (!bridge.world.isCurrent(trace.relicRef)) {
        const target = trace.monastery;
        const home = target === null ? null : monastery(target.id, target);
        if (target === null || !home || home.owner !== trace.owner || (increments.get(target.id) ?? 0) < 1) fail(`carried relic ${trace.relic} disappeared without its owner's matching Monastery store increment`);
        increments.set(target.id, (increments.get(target.id) ?? 0) - 1);
        if (footprintDistance(trace.last, home) > DEPOSIT_RANGE) fail(`carrier ${trace.monk} stored relic ${trace.relic} outside deposit range`);
        deliveries.push({ ...trace, tick });
      }
      carries.delete(referenceKey);
    }
    for (const owner of countdowns.keys()) {
      if (heldByOwner.get(owner) !== initialRelics.length) fail(`owner ${owner} has a premature countdown with ${heldByOwner.get(owner) ?? 0}/${initialRelics.length} stored`);
    }
    for (const [owner, count] of heldByOwner) {
      const match = bridge.getMatchState();
      const resolvedRelicWin = match.winCondition === 'relic'
        && match.outcome === (owner === 1 ? 'victory' : 'defeat');
      if (count === initialRelics.length && !countdowns.has(owner) && !resolvedRelicWin) fail(`owner ${owner} holds all ${count} relics without its countdown or resolved Relic victory`);
    }
    previousStored = new Map(stored);
  }
  return {
    initialRelics, picked, deliveries, stores, observe,
    transported: () => deliveries.filter((delivery) => delivery.distanceAtPickup > DEPOSIT_RANGE && delivery.travel > 0),
    residualKnowledge() {
      const collectors = [...bridge.world.query('unit', 'position')].flatMap((id) => {
        const unit = bridge.world.getComponent<UnitComponent>(id, 'unit');
        return unit && ['monk', 'missionary'].includes(unit.unitType) ? [unit.owner] : [];
      });
      const owners = [...new Set(collectors)];
      const map = LayeredVisibilityMap.fromState(visibilityStateFromSlots({
        'aoe2.visibility': bridge.world.getState('aoe2.visibility'),
        'aoe2.buildingVisibility': bridge.world.getState('aoe2.buildingVisibility'),
      }, (name) => new Error(`Missing visibility slot ${name}`)));
      const carried = new Set(slot(bridge, monkCarriedRelicCodec).values());
      const ground = [...relicRefs.values()].flatMap((ref) => {
        const position = bridge.world.getComponent<Position>(ref.id, 'position');
        if (!bridge.world.isCurrent(ref) || carried.has(ref.id) || !position) return [];
        return [{ id: ref.id, ...position, knownByCollectors: owners.filter((owner) => [owner, ...bridge.getSharedVisionOwners(owner)].some((viewer) => map.isExplored(viewer, position.x, position.y))) }];
      });
      return { owners, ground };
    },
    close() { bridge.world.offDiff(onDiff); },
  };
}
