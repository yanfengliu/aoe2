// Canonical-AoE2 stance defaults. Runs after `prototypeAi` (so the AI owns
// the wider planner-style aggression for its push) and before
// `prototypePlayerCommands` (so commands the AI / auto-aggression issued
// this tick are processed in the same tick). The rule is per-unit, not
// per-player: any unit whose `unitCommands` slot is empty, not garrisoned,
// and alive, scans for an enemy in its personal LOS and engages. Military
// uses `unitVisionRadius` (Aggressive Stance); villager uses melee attack
// range = 1 (Defensive Stance: counter-attack adjacent only). Monks and
// wildlife are skipped — Monks have their own task subsystem, and wildlife
// is not in the `unit` query. Players whose AI is explicitly disabled
// (`disableAi: true` on the start spec) are also skipped here so test
// fixtures can spawn a fully-passive enemy without the planner OR
// auto-aggression animating its units.

import type { Position } from 'civ-engine';
import type {
  GathererComponent,
  UnitComponent,
  VisionSourceComponent,
} from '../../types';
import type { GameWorld } from '../pureHelpers';
import { unitVisionRadius } from '../../prototypeUnitRules';
import type { CombatState, UnitCommand } from './systemTypes';

export interface AutoAggressionSystemDeps {
  world: GameWorld;
  humanPlayerId: number;
  unitCommands: Map<number, UnitCommand>;
  // Sentinel: reading aiStates.has(owner) gates whether auto-aggression runs
  // for that owner. The bridge owns the AiState shape.
  aiStates: Map<number, unknown>;
  combatStates: Map<number, CombatState>;
  isGarrisonedUnit: (id: number) => boolean;
  findPreferredEnemyUnitInRadius: (
    owner: number,
    position: Position,
    radius: number,
  ) => number | null;
  findPreferredEnemyBuildingInRadius: (
    owner: number,
    position: Position,
    radius: number,
  ) => number | null;
  issueUnitAttackCommand: (
    attackerId: number,
    targetId: number,
    targetKind: 'unit' | 'building' | 'resource',
  ) => boolean;
}

export function registerAutoAggressionSystem(deps: AutoAggressionSystemDeps): void {
  const {
    world,
    humanPlayerId,
    unitCommands,
    aiStates,
    combatStates,
    isGarrisonedUnit,
    findPreferredEnemyUnitInRadius,
    findPreferredEnemyBuildingInRadius,
    issueUnitAttackCommand,
  } = deps;

  world.registerSystem({
    name: 'prototypeAutoAggression',
    phase: 'update',
    after: ['prototypeAi'],
    before: ['prototypePlayerCommands'],
    execute(activeWorld) {
      for (const id of activeWorld.query('position', 'unit')) {
        if (unitCommands.has(id)) {
          continue;
        }
        if (isGarrisonedUnit(id)) {
          continue;
        }

        const unit = activeWorld.getComponent<UnitComponent>(id, 'unit');
        const position = activeWorld.getComponent<Position>(id, 'position');
        if (!unit || !position) {
          continue;
        }
        if (unit.unitType === 'monk') {
          continue;
        }

        if (unit.owner !== humanPlayerId && !aiStates.has(unit.owner)) {
          continue;
        }

        const combat = combatStates.get(id);
        if (!combat || combat.currentHp <= 0) {
          continue;
        }

        if (unit.unitType === 'villager') {
          const gatherer = activeWorld.getComponent<GathererComponent>(id, 'gatherer');
          if (gatherer && (gatherer.task !== 'idle' || gatherer.hasExplicitGatherOrder)) {
            continue;
          }
        }

        const visionSource = activeWorld.getComponent<VisionSourceComponent>(id, 'visionSource');
        const radius =
          unit.unitType === 'villager'
            ? 1
            : visionSource?.radius ?? unitVisionRadius(unit.unitType);

        const enemyUnitId = findPreferredEnemyUnitInRadius(unit.owner, position, radius);
        if (enemyUnitId !== null) {
          issueUnitAttackCommand(id, enemyUnitId, 'unit');
          continue;
        }

        if (unit.unitType === 'villager') {
          continue;
        }

        const enemyBuildingId = findPreferredEnemyBuildingInRadius(
          unit.owner,
          position,
          radius,
        );
        if (enemyBuildingId !== null) {
          issueUnitAttackCommand(id, enemyBuildingId, 'building');
        }
      }
    },
  });
}
