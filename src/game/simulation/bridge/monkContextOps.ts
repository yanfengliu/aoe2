// Monk context routing extracted from `unitCommandOps.ts` to keep that file
// under the 500-LOC budget. `routeMonkContextAtEntityCommandDirect` is the
// direct-mutation routing helper used by the `monk.contextAtEntity` handler.
// Body is verbatim from the prior unitCommandOps location, modulo: it accepts
// `setUnitMoveCommandDirect` as a dep (callback) so the move-fallback branch
// can stay inside the new file without circular imports.

import { canCarryRelics } from '../monasticUnits';
import type { EntityRef, Position } from 'civ-engine';
import type { BuildingComponent, ResourceComponent, UnitComponent } from '../types';
import type { GameCommands, GameWorld } from './pureHelpers';
import type { MonkTask } from './sharedTypes';
import {
  combatStatesCodec,
  monkCarriedRelicCodec,
} from './bridgeStateSerialize';
import type { BridgeStateAccessor } from './bridgeStateAccessor';

type CivWorld = GameWorld;

export type MonkContextRouteOptions = Pick<
  GameCommands['monk.contextAtEntity'],
  'expectedOwner' | 'intendedTaskKind'
>;

export interface MonkContextOpsDeps {
  world: CivWorld;
  accessor: BridgeStateAccessor;
  setMonkTask: (
    monkId: number,
    kind: MonkTask['kind'],
    targetEntityRef: EntityRef,
  ) => boolean;
  getEntityRef: (id: number) => EntityRef | null;
  setUnitMoveCommandDirect: (unitId: number, target: Position) => boolean;
}

export interface MonkContextOps {
  routeMonkContextAtEntityCommandDirect(
    monkId: number,
    targetEntityId: number,
    options?: MonkContextRouteOptions,
  ): boolean;
}

export function createMonkContextOps(deps: MonkContextOpsDeps): MonkContextOps {
  const {
    world,
    accessor,
    setMonkTask,
    getEntityRef,
    setUnitMoveCommandDirect,
  } = deps;

  function routeMonkContextAtEntityCommandDirect(
    monkId: number,
    targetEntityId: number,
    options: MonkContextRouteOptions = {},
  ): boolean {
    const monkUnit = world.getComponent<UnitComponent>(monkId, 'unit');
    if (!monkUnit) return false;
    if (options.expectedOwner !== undefined && monkUnit.owner !== options.expectedOwner) {
      return false;
    }
    const targetPosition = world.getComponent<Position>(targetEntityId, 'position');
    if (!targetPosition) return false;
    const targetEntityRef = getEntityRef(targetEntityId);
    if (!targetEntityRef) return false;

    const targetUnit = world.getComponent<UnitComponent>(targetEntityId, 'unit');
    const targetBuilding = world.getComponent<BuildingComponent>(targetEntityId, 'building');
    const targetResource = world.getComponent<ResourceComponent>(targetEntityId, 'resource');
    const matchesIntendedTask = (kind: MonkTask['kind']): boolean =>
      options.intendedTaskKind === undefined || options.intendedTaskKind === kind;
    const suppressFallback = options.intendedTaskKind !== undefined;

    if (targetUnit) {
      if (targetUnit.owner === monkUnit.owner) {
        const combat = accessor.get(combatStatesCodec).get(targetEntityId);
        if (combat && combat.currentHp < combat.maxHp) {
          return matchesIntendedTask('heal') ? setMonkTask(monkId, 'heal', targetEntityRef) : false;
        }
        return suppressFallback ? false : setUnitMoveCommandDirect(monkId, targetPosition);
      }
      return matchesIntendedTask('convert') ? setMonkTask(monkId, 'convert', targetEntityRef) : false;
    }

    if (
      targetResource
      && targetResource.resourceType === 'relic'
      // The horse says no: only the Monk carries relics (units.csv on the
      // Missionary), so a mounted monastic right-clicking one just rides over.
      && canCarryRelics(monkUnit.unitType)
      && accessor.get(monkCarriedRelicCodec).get(monkId) === undefined
    ) {
      return matchesIntendedTask('pickup') ? setMonkTask(monkId, 'pickup', targetEntityRef) : false;
    }

    if (
      targetBuilding
      && targetBuilding.owner === monkUnit.owner
      && targetBuilding.buildingType === 'monastery'
      && accessor.get(monkCarriedRelicCodec).get(monkId) !== undefined
    ) {
      return matchesIntendedTask('deposit') ? setMonkTask(monkId, 'deposit', targetEntityRef) : false;
    }

    return suppressFallback ? false : setUnitMoveCommandDirect(monkId, targetPosition);
  }

  return { routeMonkContextAtEntityCommandDirect };
}
