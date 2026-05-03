// Slice 5 Monk subsystem. Heal / convert / pickup / deposit task lifecycle,
// plus the AI-side auto-assignment and human-side context-click routing.
// Factored out of `createSimulationBridge.ts` so the bridge file only keeps
// the plumbing (map declarations, save/load hydration, destroy-entity cleanup
// hooks). The factory closes over every side map and collaborator function
// these ops mutate; side-map ownership still lives in createWorld so
// save/load and destroy hooks continue to work through the same references.
//
// See `createSimulationBridge.ts` for the MonkTask type and the
// MONK_* / AI_MONK_* constants; the factory accepts both as deps rather
// than importing the constants so tests could tweak them if needed later.
//
// Design note on dep-bag size: this subsystem has more dependencies than the
// other bridge extractions because convert / deposit / pickup mutate across
// population, unitCommands, visibility sources, and multiple Monk-specific
// side maps. The deps object stays flat for parity with the other bridge
// factories; the shape is named (`MonkTaskDeps`) so readers can navigate it
// in one jump.

import type { EntityRef, Position, World } from 'civ-engine';

import type {
  BuildingComponent,
  ResourceComponent,
  UnitComponent,
  UnitType,
} from '../types';
import type { MonkTask } from './sharedTypes';
import type { GameCommands, GameEvents, GameWorld } from './pureHelpers';
import { createMonkAiSearchHelpers } from './monkAiSearchHelpers';
import { createMonkTaskAppliers } from './monkTaskAppliers';
import { monkCarriedRelicCodec } from './bridgeStateSerialize';

export interface MonkTaskDeps {
  world: GameWorld;
  state: import('./bridgeState').BridgeState;
  // Phase 2D — accessor for migrated slots (monkHealCounters via appliers).
  accessor: import('./bridgeStateAccessor').BridgeStateAccessor;
  // Collaborators. Thin wrappers around bridge-local helpers; the factory
  // just calls them — the implementations still live in createWorld because
  // they touch other side maps this subsystem intentionally does not own.
  clearUnitCommand: (unitId: number) => void;
  clearGathererOrder: (unitId: number) => void;
  markOutOfBandRenderChange: () => void;
  getEntityRef: (id: number) => EntityRef | null;
  destroyResourceEntity: (id: number) => void;
  buildingOccupiesCell: (
    buildingId: number,
    x: number,
    y: number,
    activeWorld?: World<GameEvents, GameCommands>,
  ) => boolean;
  isAiMilitaryUnit: (unitType: UnitType) => boolean;
  isVisibleToOwner: (owner: number, x: number, y: number) => boolean;
  currentEntityId: (
    activeWorld: World<GameEvents, GameCommands>,
    ref: EntityRef | undefined | null,
  ) => number | null;
  unitTint: (unitType: UnitType, owner: number) => number;
  // Constants passed through as deps so tests could tweak them without
  // rewiring the module-level imports here.
  aiMonkHealHpFraction: number;
  monkHealTickInterval: number;
  monkHealHpPerInterval: number;
  monkConvertProgressPerTick: number;
  monkConvertFlipThreshold: number;
}

export interface MonkTaskOps {
  // AI-side per-decision-tick task assignment. Walks every owned Monk and
  // routes it to the highest-priority idle task (deposit > pickup > heal).
  assignAiMonkTasks(owner: number): void;
  // Search helpers used by `assignAiMonkTasks` and save/load tests.
  findNearestOwnedMonasteryToDeposit(owner: number, origin: Position): number | null;
  findNearestVisibleNeutralRelic(owner: number, origin: Position): number | null;
  findNearestWoundedFriendlyMilitary(owner: number, origin: Position): number | null;
  // Task-apply handlers invoked by `prototypeMonkBehavior` once the Monk is
  // within action range of its target.
  applyMonkHeal(monkId: number, targetId: number, monkUnit: UnitComponent): void;
  applyMonkConvert(
    monkId: number,
    targetId: number,
    monkUnit: UnitComponent,
    activeWorld: World<GameEvents, GameCommands>,
  ): void;
  applyMonkPickup(monkId: number, relicId: number): void;
  applyMonkDeposit(
    monkId: number,
    monasteryId: number,
    monkUnit: UnitComponent,
    activeWorld: World<GameEvents, GameCommands>,
  ): void;
  // Task bookkeeping primitives. Used by apply* and by the context-click
  // routing helpers.
  setMonkTask(monkId: number, kind: MonkTask['kind'], targetEntityRef: EntityRef): boolean;
  clearMonkTask(monkId: number): void;
  // Human-side click routing.
  findMonkContextTargetAtCell(x: number, y: number, monkOwner: number): number | null;
  // Phase 1B (DESIGN v17 §6.4) bridge facade: submits `monk.contextAtEntity`.
  // Validator runs synchronously inside `submitWithResult`; handler runs at
  // start of NEXT step's `processCommands` and delegates to
  // `routeMonkContextAtEntityCommandDirect` (in unitCommandOps).
  issueMonkContextCommandAtEntity(monkId: number, targetEntityId: number): boolean;
}

export function createMonkTaskOps(deps: MonkTaskDeps): MonkTaskOps {
  const {
    world,
    state,
    accessor,
    clearUnitCommand,
    clearGathererOrder,
    markOutOfBandRenderChange,
    getEntityRef,
    destroyResourceEntity,
    buildingOccupiesCell,
    isAiMilitaryUnit,
    isVisibleToOwner,
    currentEntityId,
    unitTint,
    aiMonkHealHpFraction,
    monkHealTickInterval,
    monkHealHpPerInterval,
    monkConvertProgressPerTick,
    monkConvertFlipThreshold,
  } = deps;
  const { monkTasks, combatStates } = state;

  function assignAiMonkTasks(owner: number): void {
    for (const monkId of world.query('unit')) {
      const unit = world.getComponent<UnitComponent>(monkId, 'unit');
      if (!unit || unit.owner !== owner || unit.unitType !== 'monk') {
        continue;
      }
      // Skip Monks already on a task — let the existing one finish so
      // we don't thrash mid-walk.
      if (monkTasks.has(monkId)) {
        continue;
      }
      const monkPosition = world.getComponent<Position>(monkId, 'position');
      if (!monkPosition) {
        continue;
      }

      // Priority 1: deposit a carried relic.
      if (accessor.get(monkCarriedRelicCodec).has(monkId)) {
        const monasteryId = findNearestOwnedMonasteryToDeposit(owner, monkPosition);
        if (monasteryId !== null) {
          const monasteryRef = getEntityRef(monasteryId);
          if (monasteryRef) {
            setMonkTask(monkId, 'deposit', monasteryRef);
          }
        }
        continue;
      }

      // Priority 2: pick up the nearest visible neutral relic.
      const relicId = findNearestVisibleNeutralRelic(owner, monkPosition);
      if (relicId !== null) {
        const relicRef = getEntityRef(relicId);
        if (relicRef) {
          setMonkTask(monkId, 'pickup', relicRef);
          continue;
        }
      }

      // Priority 3: heal the nearest wounded friendly military unit.
      const woundedId = findNearestWoundedFriendlyMilitary(owner, monkPosition);
      if (woundedId !== null) {
        const woundedRef = getEntityRef(woundedId);
        if (woundedRef) {
          setMonkTask(monkId, 'heal', woundedRef);
        }
      }
    }
  }

  // FU4 AI helper. Returns the nearest owned, completed Monastery to a
  // Monk that needs to deposit a carried relic. Manhattan distance is
  // good enough — the deposit walk uses the building-approach planner
  // so the actual route is computed when the task is consumed. Returns
  // null if the owner has no completed Monastery (the Monk waits with
  // the relic until one is built).
  const aiSearch = createMonkAiSearchHelpers({
    world,
    state,
    accessor,
    isAiMilitaryUnit,
    isVisibleToOwner,
    aiMonkHealHpFraction,
  });
  const {
    findNearestOwnedMonasteryToDeposit,
    findNearestVisibleNeutralRelic,
    findNearestWoundedFriendlyMilitary,
  } = aiSearch;

  const appliers = createMonkTaskAppliers({
    world,
    state,
    accessor,
    clearUnitCommand,
    clearGathererOrder,
    markOutOfBandRenderChange,
    destroyResourceEntity,
    isVisibleToOwner,
    currentEntityId,
    unitTint,
    clearMonkTask,
    monkHealTickInterval,
    monkHealHpPerInterval,
    monkConvertProgressPerTick,
    monkConvertFlipThreshold,
  });
  const { applyMonkHeal, applyMonkConvert, applyMonkPickup, applyMonkDeposit } = appliers;

  function setMonkTask(
    monkId: number,
    kind: MonkTask['kind'],
    targetEntityRef: EntityRef,
  ): boolean {
    // Clear any lingering combat/move command on the Monk; the behaviour
    // system will drive movement for the duration of the task.
    clearUnitCommand(monkId);
    monkTasks.set(monkId, { kind, targetEntityRef });
    return true;
  }

  function clearMonkTask(monkId: number): void {
    monkTasks.delete(monkId);
  }

  // Context-click target selection for a Monk. A Monk clicking a cell
  // prefers: friendly wounded unit (heal) > enemy unit (convert) > friendly
  // Monastery (deposit, if carrying a relic) > neutral relic (pickup).
  // Buildings other than a friendly Monastery are intentionally skipped —
  // otherwise the Monk would consume the click and short-circuit the
  // convert pass, leaving the Monk with a useless move-fallback (Codex P2
  // review). Enemy targets are rejected if not currently visible to the
  // Monk's owner — the player shouldn't be able to convert fog-hidden
  // enemies. Friendly and owned targets skip the visibility guard (they're
  // the player's own units and always "visible" to them), and relic /
  // Monastery lookups likewise reference owned or world entities that fog
  // memory already surfaces.
  function findMonkContextTargetAtCell(
    x: number,
    y: number,
    monkOwner: number,
  ): number | null {
    // Pass 1: friendly wounded unit at this cell (heal priority). A
    // healthy friendly is skipped so an overlapping enemy can still be
    // picked up by pass 2.
    for (const id of world.query('position', 'unit')) {
      const position = world.getComponent<Position>(id, 'position');
      const unit = world.getComponent<UnitComponent>(id, 'unit');
      if (!position || !unit || position.x !== x || position.y !== y) {
        continue;
      }
      if (unit.owner !== monkOwner) {
        continue;
      }
      const combat = combatStates.get(id);
      if (!combat || combat.currentHp >= combat.maxHp) {
        continue;
      }
      return id;
    }

    // Pass 2: enemy unit at this cell (convert) — only if currently visible
    // to the Monk's owner.
    for (const id of world.query('position', 'unit')) {
      const position = world.getComponent<Position>(id, 'position');
      const unit = world.getComponent<UnitComponent>(id, 'unit');
      if (!position || !unit || position.x !== x || position.y !== y) {
        continue;
      }
      if (unit.owner === monkOwner) {
        continue;
      }
      if (!isVisibleToOwner(monkOwner, x, y)) {
        continue;
      }
      return id;
    }

    // Building: only interesting if it's a friendly Monastery (deposit).
    for (const id of world.query('position', 'building')) {
      const building = world.getComponent<BuildingComponent>(id, 'building');
      if (!building || building.owner !== monkOwner || building.buildingType !== 'monastery') {
        continue;
      }
      if (buildingOccupiesCell(id, x, y)) {
        return id;
      }
    }

    // Resource: relic.
    for (const id of world.query('position', 'resource')) {
      const position = world.getComponent<Position>(id, 'position');
      const resource = world.getComponent<ResourceComponent>(id, 'resource');
      if (!position || !resource || position.x !== x || position.y !== y) {
        continue;
      }
      if (resource.resourceType === 'relic') {
        return id;
      }
    }

    return null;
  }

  // Phase 1B (DESIGN v17 §6.4) bridge facade. Submits `monk.contextAtEntity`.
  // The pre-1B body lives as `routeMonkContextAtEntityCommandDirect` in
  // unitCommandOps.ts; the handler delegates to it at start of next step.
  function issueMonkContextCommandAtEntity(
    monkId: number,
    targetEntityId: number,
  ): boolean {
    const result = world.submitWithResult('monk.contextAtEntity', {
      unitId: monkId,
      targetEntityId,
    });
    return result.accepted;
  }

  return {
    assignAiMonkTasks,
    findNearestOwnedMonasteryToDeposit,
    findNearestVisibleNeutralRelic,
    findNearestWoundedFriendlyMilitary,
    applyMonkHeal,
    applyMonkConvert,
    applyMonkPickup,
    applyMonkDeposit,
    setMonkTask,
    clearMonkTask,
    findMonkContextTargetAtCell,
    issueMonkContextCommandAtEntity,
  };
}
