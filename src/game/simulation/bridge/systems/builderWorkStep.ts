// One tick of a villager's work ON A BUILDING: repairing a finished one, or
// putting up an unfinished one. Extracted from ./playerCommandsSystem.ts for
// the 500-LOC budget; the two share every input (the building, its health, its
// construction state, and the approach plan) and neither is about commands in
// general, which is what the rest of that file is.
//
// Returns `null` when the caller should move on to the next unit, and the
// construction state it advanced when the caller still has to check whether the
// building is finished. Returning the STATE rather than a marker is what lets
// the caller read `buildProgressTicks` without re-proving it exists — the step
// only reaches that path when the state is there.

import type { Position } from 'civ-engine';

import { teamHasCivilization } from '../../teamBonuses';
import { buildRateMultiplier } from '../../buildingTechEffects';
import { buildingBuildTimeTicks } from '../../prototypeBuildingRules';
import type {
  BuildingComponent,
  RenderableComponent,
  UnitComponent,
} from '../../types';
import type { BridgeStateAccessor } from '../bridgeStateAccessor';
import {
  buildingHealthStatesCodec,
  constructionStatesCodec,
  playerCivilizationsCodec,
  playerTeamsCodec,
  playerResourcesCodec,
  repairAccrualCodec,
  researchedTechnologiesCodec,
  unitCommandsCodec,
} from '../bridgeStateSerialize';
import { repairCost } from '../../prototypeEconomyRules';
import { chargeRepairTick, clearRepairAccrual } from '../../repairCharging';
import type { ConstructionState, UnitCommand } from '../sharedTypes';
import { currentEntityId, type GameWorld } from '../pureHelpers';

const EMPTY_TECH_SET: ReadonlySet<never> = new Set();

// AoE2's multi-builder curve (spec §7/§16): a crew of n builds in
// 3 * base_time / (n + 2), so the crew's combined rate is (n + 2) / 3 of one
// villager's. Expressed per builder that gets credited within one tick, that
// is a FULL share for the first and a THIRD for each of the rest — the sum
// telescopes to (n + 2) / 3 exactly, with no need to count the crew.
//
// `index` is how many builders have already worked THIS site THIS tick.
export function builderProgressShare(index: number): number {
  return index === 0 ? 1 : 1 / 3;
}

export interface BuilderWorkStepContext {
  world: GameWorld;
  accessor: BridgeStateAccessor;
  id: number;
  unit: UnitComponent;
  command: UnitCommand;
  buildingId: number;
  building: BuildingComponent;
  construction: ConstructionState | undefined;
  approachPlan: { destination: Position; nextStep: Position };
  isUnitAtTarget: (unitId: number, target: Position, world: GameWorld) => boolean;
  moveUnitOneSubgridStep: (unitId: number, step: Position, world: GameWorld) => void;
  clearUnitCommand: (unitId: number) => void;
  // Building ids already credited a builder this tick, so the second and later
  // builders on one site take the reduced share above. Owned by the caller's
  // per-tick pass; a fresh set every tick is what makes the curve stateless.
  buildersCreditedThisTick: Map<number, number>;
}

export type BuilderWorkResult = ConstructionState | null;

export function runBuilderWorkStep(ctx: BuilderWorkStepContext): BuilderWorkResult {
  const {
    world: activeWorld,
    accessor,
    id,
    unit,
    command,
    buildingId,
    building,
    construction,
    approachPlan: buildingApproachPlan,
    isUnitAtTarget,
    moveUnitOneSubgridStep,
    clearUnitCommand,
  } = ctx;

  // REPAIR (spec §8.1): only a COMPLETE building (not under construction);
  // resources were charged up front at command issue. Walk adjacent and
  // restore HP over time at the build rate; finish at full HP. A stale
  // BUILD command on a now-complete building instead clears below, so it
  // never becomes a free repair.
  if (command.type === 'repair') {
    if (construction && !construction.isComplete) {
      clearUnitCommand(id);
      return null;
    }
    const health = accessor.get(buildingHealthStatesCodec).get(buildingId);
    if (!health || health.currentHp >= health.maxHp) {
      clearUnitCommand(id);
      return null;
    }
    if (!isUnitAtTarget(id, buildingApproachPlan.destination, activeWorld)) {
      moveUnitOneSubgridStep(id, buildingApproachPlan.nextStep, activeWorld);
      return null;
    }
    const buildTicks = buildingBuildTimeTicks(building.buildingType);
    const repairPerTick = buildTicks > 0 ? health.maxHp / buildTicks : health.maxHp;
    const deltaHp = Math.min(repairPerTick, health.maxHp - health.currentHp);
    // Continuous charging (v0.3.122): pay for THIS tick's hit points before
    // they apply; a stockpile that cannot cover a due unit stalls the repair
    // — the villager keeps standing at the wall, mending nothing for free.
    const stockpile = accessor.get(playerResourcesCodec).get(unit.owner);
    const paid = stockpile !== undefined && chargeRepairTick({
      accrualByTarget: accessor.get(repairAccrualCodec),
      targetId: buildingId,
      costPerFullRepair: repairCost(
        building.buildingType as import('../../types').BuildableBuildingType,
        health.maxHp,
        health.maxHp,
      ),
      maxHp: health.maxHp,
      deltaHp,
      stockpile,
    });
    if (!paid) return null;
    accessor.markDirty(playerResourcesCodec);
    accessor.markDirty(repairAccrualCodec);
    health.currentHp = Math.min(health.maxHp, health.currentHp + deltaHp);
    accessor.markDirty(buildingHealthStatesCodec);
    activeWorld.patchComponent<RenderableComponent>(buildingId, 'renderable', (r) => r);
    if (health.currentHp >= health.maxHp) {
      health.currentHp = health.maxHp;
      clearRepairAccrual(accessor.get(repairAccrualCodec), buildingId);
      clearUnitCommand(id);
    }
    return null;
  }

  // CONSTRUCTION (command.type === 'build'): a complete or absent
  // construction state clears (an over-assigned builder after completion
  // does NOT continue as a free repair) — unless a build CHAIN (v0.3.126)
  // has a next site queued, in which case the builder walks on to it.
  if (!construction || construction.isComplete) {
    if (!advanceQueuedBuild(ctx)) clearUnitCommand(id);
    return null;
  }
  if (!isUnitAtTarget(id, buildingApproachPlan.destination, activeWorld)) {
    moveUnitOneSubgridStep(id, buildingApproachPlan.nextStep, activeWorld);
    return null;
  }

  // Treadmill Crane makes a builder work 20% faster. The progress
  // counter is compared with `>=` and never displayed as a whole number,
  // so a fractional step is the honest way to express it — rounding the
  // multiplier to a whole tick would be a silent no-op (the v0.1.26
  // gather-rate lesson).
  const alreadyCredited = ctx.buildersCreditedThisTick.get(buildingId) ?? 0;
  ctx.buildersCreditedThisTick.set(buildingId, alreadyCredited + 1);
  construction.buildProgressTicks += builderProgressShare(alreadyCredited) * buildRateMultiplier(
    accessor.get(researchedTechnologiesCodec).get(unit.owner) ?? EMPTY_TECH_SET,
    accessor.get(playerCivilizationsCodec).get(unit.owner),
    {
      // Incas: "Farms built 50% faster" — scoped to the farm, so the
      // multiplier needs to be told what is under construction.
      // Short-circuited on the building type: `teamHasCivilization` scans the
      // whole civilization map and calls `areAllied`, and this runs for every
      // builder every tick. The multiplier discards it for anything but a
      // farm anyway.
      farmTeamBonus: building.buildingType === 'farm' && teamHasCivilization(
        accessor.get(playerTeamsCodec),
        accessor.get(playerCivilizationsCodec),
        unit.owner,
        'Incas',
      ),
      buildingType: building.buildingType,
    },
  );
  accessor.markDirty(constructionStatesCodec);
  const buildingHealth = accessor.get(buildingHealthStatesCodec).get(buildingId);
  if (buildingHealth && construction.totalBuildTicks > 0) {
    const startHp = Math.max(1, Math.floor(buildingHealth.maxHp * 0.1));
    const hpPerTick = (buildingHealth.maxHp - startHp) / construction.totalBuildTicks;
    buildingHealth.currentHp = Math.min(
      buildingHealth.maxHp,
      buildingHealth.currentHp + hpPerTick,
    );
    accessor.markDirty(buildingHealthStatesCodec);
  }
  // Side-map mutations don't mark the entity dirty; patchComponent in
  // strict mode does, so the projector re-runs and the HP bar fills.
  activeWorld.patchComponent<RenderableComponent>(buildingId, 'renderable', (r) => r);

  return construction ?? null;
}

// Shift-queued construction (v0.3.126): rewrite the finished build command to
// the next still-in-progress queued site, dropping refs whose site vanished
// or already finished. Returns false when nothing usable is queued.
function advanceQueuedBuild(ctx: BuilderWorkStepContext): boolean {
  return advanceQueuedBuildCommand(ctx.world, ctx.accessor, ctx.command);
}

export function advanceQueuedBuildCommand(
  activeWorld: GameWorld,
  accessor: BridgeStateAccessor,
  command: UnitCommand,
): boolean {
  const queued = [...(command.queuedBuildRefs ?? [])];
  while (queued.length > 0) {
    const nextRef = queued.shift()!;
    const nextId = currentEntityId(activeWorld, nextRef);
    if (nextId === null) continue;
    const nextConstruction = accessor.get(constructionStatesCodec).get(nextId);
    if (!nextConstruction || nextConstruction.isComplete) continue;
    const position = activeWorld.getComponent<Position>(nextId, 'position');
    if (!position) continue;
    command.type = 'build';
    command.target = { x: position.x, y: position.y };
    command.buildingRef = nextRef;
    command.queuedBuildRefs = queued;
    accessor.markDirty(unitCommandsCodec);
    return true;
  }
  return false;
}
