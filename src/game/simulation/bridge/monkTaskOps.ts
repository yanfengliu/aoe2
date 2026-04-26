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
  GathererComponent,
  PopulationState,
  RenderableComponent,
  ResourceComponent,
  UnitComponent,
  UnitType,
  VisionSourceComponent,
} from '../types';
import type {
  MonkTask,
  UnitCommand,
} from '../createSimulationBridge';
import type { GameCommands, GameEvents, GameWorld } from './pureHelpers';
import { manhattanDistance } from './pureHelpers';

interface CombatStateLike {
  currentHp: number;
  maxHp: number;
}

interface ConstructionStateLike {
  isComplete: boolean;
}

interface ConversionStateEntry {
  byOwner: number;
  progress: number;
}

export interface MonkTaskDeps {
  world: GameWorld;
  // Side maps. Owned by createWorld so save/load hydration and destroy-entity
  // cleanup can share the same references without routing through the ops
  // factory.
  monkTasks: Map<number, MonkTask>;
  monkCarriedRelic: Map<number, number>;
  monkHealCounters: Map<number, number>;
  monkConvertProcessedThisTick: Set<number>;
  conversionState: Map<number, ConversionStateEntry>;
  relicsInMonastery: Map<number, number>;
  combatStates: Map<number, CombatStateLike>;
  constructionStates: Map<number, ConstructionStateLike>;
  unitCommands: Map<number, UnitCommand>;
  population: Map<number, PopulationState>;
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
  issueUnitMoveCommand: (unitId: number, target: Position) => boolean;
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
  issueMonkContextCommandAtEntity(
    monkId: number,
    targetEntityId: number,
    monkUnit: UnitComponent,
    targetPosition: Position,
  ): boolean;
}

export function createMonkTaskOps(deps: MonkTaskDeps): MonkTaskOps {
  const {
    world,
    monkTasks,
    monkCarriedRelic,
    monkHealCounters,
    monkConvertProcessedThisTick,
    conversionState,
    relicsInMonastery,
    combatStates,
    constructionStates,
    unitCommands,
    population,
    clearUnitCommand,
    clearGathererOrder,
    markOutOfBandRenderChange,
    getEntityRef,
    destroyResourceEntity,
    buildingOccupiesCell,
    issueUnitMoveCommand,
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
      if (monkCarriedRelic.has(monkId)) {
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
  function findNearestOwnedMonasteryToDeposit(owner: number, origin: Position): number | null {
    let bestId: number | null = null;
    let bestDistance = Number.POSITIVE_INFINITY;
    for (const id of world.query('building', 'position')) {
      const building = world.getComponent<BuildingComponent>(id, 'building');
      const position = world.getComponent<Position>(id, 'position');
      if (
        !building
        || !position
        || building.owner !== owner
        || building.buildingType !== 'monastery'
      ) {
        continue;
      }
      const construction = constructionStates.get(id);
      if (construction && !construction.isComplete) {
        continue;
      }
      const distance = manhattanDistance(origin, position);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestId = id;
      }
    }
    return bestId;
  }

  // FU4 AI helper. Returns the nearest neutral relic (resource entity
  // with `resourceType === 'relic'` and `owner === null`) currently
  // visible to the Monk's owner. Carried relics are excluded because
  // their position tracks the carrying Monk — we only want free relics
  // sitting on the map. Manhattan distance is enough — the pickup walk
  // uses the unit-range planner.
  function findNearestVisibleNeutralRelic(owner: number, origin: Position): number | null {
    const carriedRelicIds = new Set<number>(monkCarriedRelic.values());
    let bestId: number | null = null;
    let bestDistance = Number.POSITIVE_INFINITY;
    for (const id of world.query('resource', 'position')) {
      const resource = world.getComponent<ResourceComponent>(id, 'resource');
      const position = world.getComponent<Position>(id, 'position');
      if (
        !resource
        || !position
        || resource.resourceType !== 'relic'
        || resource.owner !== null
      ) {
        continue;
      }
      if (carriedRelicIds.has(id)) {
        continue;
      }
      if (!isVisibleToOwner(owner, position.x, position.y)) {
        continue;
      }
      const distance = manhattanDistance(origin, position);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestId = id;
      }
    }
    return bestId;
  }

  // FU4 AI helper. Returns the nearest owned military unit whose
  // current HP is below `AI_MONK_HEAL_HP_FRACTION` of its max (i.e.
  // wounded enough that the heal payoff is worth the Monk's attention).
  // Healthy and dead units are skipped. Villagers / Scouts / Monks are
  // intentionally excluded so the AI's heal allocation tracks the
  // actual military line.
  function findNearestWoundedFriendlyMilitary(owner: number, origin: Position): number | null {
    let bestId: number | null = null;
    let bestDistance = Number.POSITIVE_INFINITY;
    for (const id of world.query('unit', 'position')) {
      const unit = world.getComponent<UnitComponent>(id, 'unit');
      const position = world.getComponent<Position>(id, 'position');
      if (
        !unit
        || !position
        || unit.owner !== owner
        || !isAiMilitaryUnit(unit.unitType)
      ) {
        continue;
      }
      const combat = combatStates.get(id);
      if (!combat || combat.maxHp <= 0 || combat.currentHp <= 0) {
        continue;
      }
      if (combat.currentHp >= combat.maxHp * aiMonkHealHpFraction) {
        continue;
      }
      const distance = manhattanDistance(origin, position);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestId = id;
      }
    }
    return bestId;
  }

  function applyMonkHeal(monkId: number, targetId: number, monkUnit: UnitComponent): void {
    const targetUnit = world.getComponent<UnitComponent>(targetId, 'unit');
    const targetCombat = combatStates.get(targetId);
    if (!targetUnit || !targetCombat || targetUnit.owner !== monkUnit.owner) {
      clearMonkTask(monkId);
      monkHealCounters.delete(monkId);
      return;
    }
    if (targetCombat.currentHp >= targetCombat.maxHp) {
      clearMonkTask(monkId);
      monkHealCounters.delete(monkId);
      return;
    }
    const counter = (monkHealCounters.get(monkId) ?? 0) + 1;
    if (counter >= monkHealTickInterval) {
      targetCombat.currentHp = Math.min(
        targetCombat.maxHp,
        targetCombat.currentHp + monkHealHpPerInterval,
      );
      markOutOfBandRenderChange();
      monkHealCounters.set(monkId, 0);
    } else {
      monkHealCounters.set(monkId, counter);
    }
  }

  function applyMonkConvert(
    monkId: number,
    targetId: number,
    monkUnit: UnitComponent,
    activeWorld: World<GameEvents, GameCommands>,
  ): void {
    const targetUnit = activeWorld.getComponent<UnitComponent>(targetId, 'unit');
    if (!targetUnit || targetUnit.owner === monkUnit.owner) {
      clearMonkTask(monkId);
      conversionState.delete(targetId);
      return;
    }
    // Iter-3 V3-7: vision/LOS interrupt. Canonical AoE2 requires the
    // converting Monk's owner to actually see the target — moving the
    // converting unit out of vision interrupts the conversion. Pre-fix
    // the only gate was MONK_ACTION_RANGE (Manhattan ≤ 4); a Monk with
    // its visionSource component stripped (or any future debuff) could
    // still convert through fog. Preserve any in-flight progress (do
    // not delete) but skip incrementing this tick.
    const targetPosition = activeWorld.getComponent<Position>(targetId, 'position');
    if (
      targetPosition
      && !isVisibleToOwner(monkUnit.owner, targetPosition.x, targetPosition.y)
    ) {
      return;
    }
    const state = conversionState.get(targetId) ?? { byOwner: monkUnit.owner, progress: 0 };
    // Per-tick guard FIRST (review C-1): without this ordering, two enemy
    // Monks processed in the same tick would flip-flop the target's
    // progress to zero. The first-processed Monk this tick wins ownership
    // of the progress increment; later-processed Monks of any owner just
    // store the existing state and bail. Take-over across owners still
    // works — next tick's first-processed Monk runs the reset below.
    if (monkConvertProcessedThisTick.has(targetId)) {
      conversionState.set(targetId, state);
      return;
    }
    // If a different player's Monk is already converting this target, reset
    // progress in favor of the latest converter so the ownership handoff is
    // deterministic.
    if (state.byOwner !== monkUnit.owner) {
      state.byOwner = monkUnit.owner;
      state.progress = 0;
    }
    monkConvertProcessedThisTick.add(targetId);
    state.progress += monkConvertProgressPerTick;
    if (state.progress >= monkConvertFlipThreshold) {
      // Flip ownership. Move the living unit between population books: the
      // former owner loses a pop slot and the new owner gains one. Every
      // trainable unit we can realistically convert consumes exactly one pop
      // slot in `addUnitEntity`, so mirror that delta here.
      const previousOwner = targetUnit.owner;
      targetUnit.owner = monkUnit.owner;
      const previousPopulation = population.get(previousOwner);
      if (previousPopulation) {
        previousPopulation.current = Math.max(0, previousPopulation.current - 1);
      }
      const nextPopulation = population.get(monkUnit.owner);
      if (nextPopulation) {
        nextPopulation.current += 1;
      }
      // Reassign vision to the new owner. Without this, the converted unit
      // keeps lighting fog for its former owner and leaves the new owner
      // blind around it. `syncVisibilitySources` picks up the new playerId
      // on the next tick and re-maps the visibility source.
      const visionSource = activeWorld.getComponent<VisionSourceComponent>(
        targetId,
        'visionSource',
      );
      if (visionSource) {
        visionSource.playerId = monkUnit.owner;
      }
      const renderable = activeWorld.getComponent<RenderableComponent>(targetId, 'renderable');
      if (renderable) {
        renderable.tint = unitTint(targetUnit.unitType, monkUnit.owner);
      }
      // Post-conversion cleanup. Drop any order the now-friendly unit was
      // carrying out for its former owner and any task or command that
      // targeted it as an enemy:
      //   1. Its own unitCommands / monkTasks entries become meaningless
      //      (it no longer has an enemy to gather against or convert).
      //   2. Its GathererComponent resets to idle; a captured villager
      //      should not auto-resume harvesting a former-enemy resource.
      //   3. Any attack command from the NEW owner's units against this
      //      entity must be purged so they do not keep hitting a teammate.
      clearUnitCommand(targetId);
      monkTasks.delete(targetId);
      const targetGatherer = activeWorld.getComponent<GathererComponent>(targetId, 'gatherer');
      if (targetGatherer) {
        clearGathererOrder(targetId);
      }
      for (const [commanderId, command] of unitCommands) {
        if (command.type !== 'attack' || !command.targetEntityRef) {
          continue;
        }
        const resolved = currentEntityId(activeWorld, command.targetEntityRef);
        if (resolved !== targetId) {
          continue;
        }
        const commander = activeWorld.getComponent<UnitComponent>(commanderId, 'unit');
        if (commander && commander.owner === monkUnit.owner) {
          clearUnitCommand(commanderId);
        }
      }
      conversionState.delete(targetId);
      clearMonkTask(monkId);
      markOutOfBandRenderChange();
      return;
    }
    conversionState.set(targetId, state);
  }

  function applyMonkPickup(monkId: number, relicId: number): void {
    const relic = world.getComponent<ResourceComponent>(relicId, 'resource');
    if (!relic || relic.resourceType !== 'relic') {
      clearMonkTask(monkId);
      return;
    }
    // Record carry state; the per-tick follow loop keeps the relic glued to
    // the Monk. Clear any other Monk currently claiming this relic (should
    // not happen under v1 but guard for safety).
    for (const [otherMonkId, carriedId] of monkCarriedRelic.entries()) {
      if (carriedId === relicId && otherMonkId !== monkId) {
        monkCarriedRelic.delete(otherMonkId);
      }
    }
    monkCarriedRelic.set(monkId, relicId);
    clearMonkTask(monkId);
    markOutOfBandRenderChange();
  }

  function applyMonkDeposit(
    monkId: number,
    monasteryId: number,
    monkUnit: UnitComponent,
    activeWorld: World<GameEvents, GameCommands>,
  ): void {
    const relicId = monkCarriedRelic.get(monkId);
    const building = activeWorld.getComponent<BuildingComponent>(monasteryId, 'building');
    if (
      relicId === undefined
      || !building
      || building.buildingType !== 'monastery'
      || building.owner !== monkUnit.owner
    ) {
      clearMonkTask(monkId);
      return;
    }
    // Destroy the relic entity and credit the Monastery.
    destroyResourceEntity(relicId);
    monkCarriedRelic.delete(monkId);
    relicsInMonastery.set(monasteryId, (relicsInMonastery.get(monasteryId) ?? 0) + 1);
    clearMonkTask(monkId);
    markOutOfBandRenderChange();
  }

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

  function issueMonkContextCommandAtEntity(
    monkId: number,
    targetEntityId: number,
    monkUnit: UnitComponent,
    targetPosition: Position,
  ): boolean {
    const targetEntityRef = getEntityRef(targetEntityId);
    if (!targetEntityRef) {
      return false;
    }

    const targetUnit = world.getComponent<UnitComponent>(targetEntityId, 'unit');
    const targetBuilding = world.getComponent<BuildingComponent>(targetEntityId, 'building');
    const targetResource = world.getComponent<ResourceComponent>(targetEntityId, 'resource');

    if (targetUnit) {
      if (targetUnit.owner === monkUnit.owner) {
        const combat = combatStates.get(targetEntityId);
        if (combat && combat.currentHp < combat.maxHp) {
          return setMonkTask(monkId, 'heal', targetEntityRef);
        }
        return issueUnitMoveCommand(monkId, targetPosition);
      }

      // Enemy unit: convert. Skip conversion on other Monks (no canonical
      // rule against it but v1 keeps the target set simple — convert only
      // "normal" units).
      return setMonkTask(monkId, 'convert', targetEntityRef);
    }

    if (
      targetResource
      && targetResource.resourceType === 'relic'
      && monkCarriedRelic.get(monkId) === undefined
    ) {
      return setMonkTask(monkId, 'pickup', targetEntityRef);
    }

    if (
      targetBuilding
      && targetBuilding.owner === monkUnit.owner
      && targetBuilding.buildingType === 'monastery'
      && monkCarriedRelic.get(monkId) !== undefined
    ) {
      return setMonkTask(monkId, 'deposit', targetEntityRef);
    }

    return issueUnitMoveCommand(monkId, targetPosition);
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
