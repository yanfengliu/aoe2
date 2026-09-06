// Debug-overlay snapshot. Aggregates per-unit move targets, per-owner AI
// summaries, and the coarse-vs-fine position probe into a single
// `SimulationDebugSnapshot`. Pure read-only over the bridge's side maps.

import type { Position } from 'civ-engine';
import type {
  SimulationDebugSnapshot,
  UnitTransformComponent,
} from '../types';
import { UNIT_SUBGRID_RESOLUTION, type GameWorld } from './pureHelpers';
import type { BridgeStateAccessor } from './bridgeStateAccessor';
import { aiStatesCodec, unitCommandsCodec } from './bridgeStateSerialize';
import type { DropOffWalkFieldStats } from './dropOffWalkField';
import type { BuilderReachabilityStats } from './builderReachability';

export interface DebugSnapshotOpsDeps {
  world: GameWorld;
  // Phase 2D: aiStates migrated to world.state.aoe2.* via accessor.
  accessor: BridgeStateAccessor;
  /** The drop-off walk field's rebuild count and cost (dropOffWalkField.ts),
   *  read lazily because the field is wired after this snapshot is. */
  walkFieldStats?: () => DropOffWalkFieldStats | null;
  /** The placement-reachability labelling cost, read lazily for the same
   *  reason: it is wired after this snapshot is. */
  builderReachStats?: () => BuilderReachabilityStats | null;
}

export function createDebugSnapshotOps(deps: DebugSnapshotOpsDeps): {
  getDebugSnapshot(): SimulationDebugSnapshot;
} {
  const { world, accessor } = deps;

  function getDebugSnapshot(): SimulationDebugSnapshot {
    const unitPaths: SimulationDebugSnapshot['unitPaths'] = [];
    for (const [unitId, command] of accessor.get(unitCommandsCodec).entries()) {
      const position = world.getComponent<Position>(unitId, 'position');
      if (!position) continue;
      unitPaths.push({
        id: unitId,
        fromX: position.x,
        fromY: position.y,
        toX: command.target.x,
        toY: command.target.y,
        commandType: command.type,
      });
    }

    const aiSummaries: SimulationDebugSnapshot['aiSummaries'] = [];
    for (const [owner, aiState] of accessor.get(aiStatesCodec).entries()) {
      aiSummaries.push({
        owner,
        difficulty: aiState.difficulty,
        plan: aiState.plan,
        villagerTargets: { ...aiState.villagerTargets } as Partial<Record<string, number>>,
        attackGroupSize: aiState.attackGroup.length,
      });
    }

    const coarseVsFine: SimulationDebugSnapshot['coarseVsFine'] = [];
    for (const unitId of world.query('position', 'unit', 'unitTransform')) {
      const position = world.getComponent<Position>(unitId, 'position');
      const transform = world.getComponent<UnitTransformComponent>(unitId, 'unitTransform');
      if (!position || !transform) continue;
      coarseVsFine.push({
        id: unitId,
        coarseX: position.x,
        coarseY: position.y,
        fineX: transform.fineX / UNIT_SUBGRID_RESOLUTION,
        fineY: transform.fineY / UNIT_SUBGRID_RESOLUTION,
      });
    }

    const walkFieldStats = deps.walkFieldStats?.() ?? null;
    const builderReachStats = deps.builderReachStats?.() ?? null;
    return {
      tick: world.tick,
      tickDurationMs: 0,
      entityCount: 0,
      unitPaths,
      aiSummaries,
      coarseVsFine,
      ...(walkFieldStats ? { walkFields: { ...walkFieldStats } } : {}),
      ...(builderReachStats ? { builderReach: { ...builderReachStats } } : {}),
    };
  }

  return { getDebugSnapshot };
}
