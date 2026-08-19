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
import { unitAttackRange, unitVisionRadius } from '../../prototypeUnitRules';
import {
  autoEngageRadius,
  defaultStanceFor,
  engagesBuildings,
} from '../../unitStance';
import {
  aiStatesCodec,
  combatStatesCodec,
  unitCommandsCodec,
  unitStancesCodec,
} from '../bridgeStateSerialize';

export interface AutoAggressionSystemDeps {
  world: GameWorld;
  humanPlayerId: number;
  // Phase 2D: combatStates + aiStates migrated to world.state.aoe2.* via accessor.
  // Sentinel: reading accessor.get(aiStatesCodec).has(owner) gates whether
  // auto-aggression runs for that owner.
  accessor: import('../bridgeStateAccessor').BridgeStateAccessor;
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
  // Phase 1B unit.attack: returns true if a `unit.move`/`unit.attack` intention
  // is already queued in pendingCommands for the given unit (preserves the
  // pre-1B priority where aiSystem's strategic target won when both AI systems
  // wanted to command the same unit on the same tick — see `wireBridgeOps.ts`
  // for the closure body).
  hasPendingUnitCommand: (unitId: number) => boolean;
  // Phase 1C + iter-1 R2-D4: contract is push-intention, not synchronous
  // facade. Renamed to make the boolean return obvious (always true =
  // queued; not a synchronous accept/reject).
  submitUnitAttackIntention: (
    attackerId: number,
    targetId: number,
    targetKind: 'unit' | 'building' | 'resource',
  ) => boolean;
}

export function registerAutoAggressionSystem(deps: AutoAggressionSystemDeps): void {
  const {
    world,
    humanPlayerId,
    accessor,
    isGarrisonedUnit,
    findPreferredEnemyUnitInRadius,
    findPreferredEnemyBuildingInRadius,
    hasPendingUnitCommand,
    submitUnitAttackIntention,
  } = deps;

  world.registerSystem({
    name: 'prototypeAutoAggression',
    phase: 'update',
    after: ['prototypeAi'],
    before: ['prototypePlayerCommands'],
    execute(activeWorld) {
      const unitCommands = accessor.get(unitCommandsCodec);
      for (const id of activeWorld.query('position', 'unit')) {
        // A unit executing an ATTACK-MOVE is the one case where a standing
        // order does not silence auto-aggression: the order is precisely
        // "go there and fight what you meet".
        const activeCommand = unitCommands.get(id);
        const onAttackMove = activeCommand?.type === 'attack-move';
        if (activeCommand && !onAttackMove) {
          continue;
        }
        // Phase 1B unit.attack (post review-impl-3): if aiSystem already
        // pushed a strategic intention for this unit THIS tick, skip auto-
        // aggression to preserve pre-1B priority (aiSystem strategic target
        // wins over autoAggression's local target). Without this guard, the
        // dispatcher's FIFO drain would let autoAggression's intention
        // overwrite aiSystem's at start of next step's processCommands.
        if (hasPendingUnitCommand(id)) {
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

        if (unit.owner !== humanPlayerId && !accessor.get(aiStatesCodec).has(unit.owner)) {
          continue;
        }

        const combat = accessor.get(combatStatesCodec).get(id);
        if (!combat || combat.currentHp <= 0) {
          continue;
        }

        if (unit.unitType === 'villager') {
          const gatherer = activeWorld.getComponent<GathererComponent>(id, 'gatherer');
          if (gatherer && (gatherer.task !== 'idle' || gatherer.hasExplicitGatherOrder)) {
            continue;
          }
        }

        // M6 control: the stance decides how far this unit looks for a fight
        // and whether it starts one with a building. The old hardcoded
        // behaviour (military scans its vision, villagers scan their own cell)
        // is exactly what the default stances reproduce.
        // An attack-move overrides the standing stance for its duration —
        // including No Attack, which is what makes it an ORDER rather than a
        // suggestion.
        const stance = onAttackMove
          ? 'aggressive'
          : accessor.get(unitStancesCodec).get(id) ?? defaultStanceFor(unit.unitType);
        const visionSource = activeWorld.getComponent<VisionSourceComponent>(id, 'visionSource');
        const radius = autoEngageRadius(
          stance,
          visionSource?.radius ?? unitVisionRadius(unit.unitType),
          unitAttackRange(unit.unitType),
        );
        if (radius <= 0) {
          continue;
        }

        const enemyUnitId = findPreferredEnemyUnitInRadius(unit.owner, position, radius);
        if (enemyUnitId !== null) {
          submitUnitAttackIntention(id, enemyUnitId, 'unit');
          continue;
        }

        if (!engagesBuildings(stance)) {
          continue;
        }

        const enemyBuildingId = findPreferredEnemyBuildingInRadius(
          unit.owner,
          position,
          radius,
        );
        if (enemyBuildingId !== null) {
          submitUnitAttackIntention(id, enemyBuildingId, 'building');
        }
      }
    },
  });
}
