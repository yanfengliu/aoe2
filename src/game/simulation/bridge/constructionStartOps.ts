// Construction start (extracted from trainingMarketOps for the 500-LOC cap):
// eligibility is decided BEFORE the site exists (the build menu changes the
// moment a Wonder goes down), the charge goes through ownerConstructionCost,
// and from v0.3.126 a `queue` start APPENDS the new site to a builder already
// mid-build instead of tearing him off his current roof.

import type { EntityRef, Position } from 'civ-engine';

import type { BuildableBuildingType, UnitComponent } from '../types';
import { buildingFootprint } from './pureHelpers';
import type { GameWorld } from './pureHelpers';
import { canAfford, spendResources } from '../prototypeEconomyRules';
import { ownerConstructionCost } from './ownerCosts';
import type { BridgeStateAccessor } from './bridgeStateAccessor';
import { playerResourcesCodec, unitCommandsCodec } from './bridgeStateSerialize';
import type { UnitCommand } from './sharedTypes';

function clamp(value: number, low: number, high: number): number {
  return Math.max(low, Math.min(high, value));
}

export function createConstructionStart(deps: {
  world: GameWorld;
  accessor: BridgeStateAccessor;
  mapWidth: number;
  mapHeight: number;
  getBuildOptions: (owner: number, unitType: UnitComponent['unitType']) => readonly BuildableBuildingType[];
  isPlacementBlocked: (x: number, y: number, w: number, h: number, type?: BuildableBuildingType) => boolean;
  addBuildingEntity: (owner: number, type: BuildableBuildingType, anchor: Position, complete: boolean) => number;
  getEntityRef: (id: number) => EntityRef | null;
  clearGathererOrder: (id: number) => void;
  setUnitCommand: (unitId: number, command: UnitCommand) => void;
  markOutOfBandRenderChange: () => void;
}) {
  const {
    world, accessor, mapWidth, mapHeight,
    getBuildOptions, isPlacementBlocked, addBuildingEntity, getEntityRef,
    clearGathererOrder, setUnitCommand, markOutOfBandRenderChange,
  } = deps;
  return function startConstructionWithBuildersDirect(
    builderIds: readonly number[],
    buildingType: BuildableBuildingType,
    anchor: Position,
    queue = false,
  ): boolean {
    if (builderIds.length === 0) return false;
    const primaryId = builderIds[0];
    const primary = world.getComponent<UnitComponent>(primaryId, 'unit');
    if (!primary) return false;

    // What a unit may build is the build MENU's answer, not a unit-type test —
    // a Fishing Ship builds Fish Traps out on the water, where no villager can
    // stand. The menu already refuses everything else.
    //
    // Every builder is decided HERE, before the site exists, because putting the
    // building down CHANGES the menu: `wonder` leaves it the moment the owner
    // has one, so re-asking after `addBuildingEntity` rejected every builder for
    // the Wonder they had just started and left it standing at zero progress
    // forever (the AI wonder-victory test hung on exactly that).
    const eligibleBuilderIds = builderIds.filter((id) => {
      const unit = world.getComponent<UnitComponent>(id, 'unit');
      return unit !== undefined
        && unit.owner === primary.owner
        && getBuildOptions(unit.owner, unit.unitType).includes(buildingType);
    });
    if (eligibleBuilderIds.length === 0) return false;

    const clampedAnchor = {
      x: clamp(anchor.x, 0, mapWidth - 1),
      y: clamp(anchor.y, 0, mapHeight - 1),
    };
    const footprint = buildingFootprint(buildingType);
    if (isPlacementBlocked(
      clampedAnchor.x,
      clampedAnchor.y,
      footprint.width,
      footprint.height,
      buildingType,
    )) {
      return false;
    }

    const stockpile = accessor.get(playerResourcesCodec).get(primary.owner);
    if (!stockpile) return false;

    const cost = ownerConstructionCost(accessor, primary.owner, buildingType);
    if (!canAfford(stockpile, cost)) return false;

    spendResources(stockpile, cost);
    accessor.markDirty(playerResourcesCodec);
    const buildingId = addBuildingEntity(primary.owner, buildingType, clampedAnchor, false);
    const buildingRef = getEntityRef(buildingId);
    if (!buildingRef) {
      throw new Error(`Expected a current EntityRef for new ${buildingType} construction.`);
    }
    for (const id of eligibleBuilderIds) {
      // Shift-queue (v0.3.126): a builder already mid-BUILD keeps his site and
      // takes this one as the next link in the chain instead.
      if (queue) {
        const standing = accessor.get(unitCommandsCodec).get(id);
        if (standing?.type === 'build') {
          const queued = standing.queuedBuildRefs ?? [];
          if (queued.length < 8) {
            standing.queuedBuildRefs = [...queued, buildingRef];
            accessor.markDirty(unitCommandsCodec);
          }
          continue;
        }
      }
      clearGathererOrder(id);
      setUnitCommand(id, {
        type: 'build',
        target: clampedAnchor,
        buildingRef,
      });
    }
    markOutOfBandRenderChange();
    return true;
  }
}
