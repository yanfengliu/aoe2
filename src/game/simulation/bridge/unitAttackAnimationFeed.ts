import { type Position, type VisibilityMap } from 'civ-engine';

import type {
  ProjectedEntityView,
  ProjectedUnitAttackAnimationView,
  ProjectedUnitAttackView,
  RenderableComponent,
  UnitComponent,
  UnitTransformComponent,
} from '../types';
import type { BridgeState } from './bridgeState';
import type { BridgeStateAccessor } from './bridgeStateAccessor';
import { populationCodec } from './bridgeStateSerialize';
import {
  isFootprintVisible,
  projectUnitTransformCoordinate,
  type GameWorld,
} from './pureHelpers';

export const ATTACK_FEED_TICKS = 10;
const MAX_ATTACK_FEED_ENTRIES = 1_024;

export function unitAttackKey(attackerId: number, attackerGeneration: number): string {
  return `${attackerId}:${attackerGeneration}`;
}

export function pruneUnitAttacks<Attack extends ProjectedUnitAttackView>(
  attacks: Attack[],
  currentTick: number,
): Attack[] {
  const minTick = currentTick - ATTACK_FEED_TICKS;
  let write = 0;
  for (let read = 0; read < attacks.length; read += 1) {
    const attack = attacks[read]!;
    if (attack.tick >= minTick) {
      attacks[write] = attack;
      write += 1;
    }
  }
  attacks.length = write;
  return attacks;
}

export function hydrateUnitAttacks(
  value: unknown,
  currentTick: number,
): ProjectedUnitAttackView[] {
  if (!Array.isArray(value)) return [];
  const attacks = value.filter((candidate): candidate is ProjectedUnitAttackView => {
    if (!candidate || typeof candidate !== 'object') return false;
    const attack = candidate as Partial<ProjectedUnitAttackView>;
    return (
      Number.isInteger(attack.attackerId)
      && Number.isInteger(attack.attackerGeneration)
      && Number.isInteger(attack.tick)
      && (attack.tick ?? Number.POSITIVE_INFINITY) <= currentTick
      && Number.isFinite(attack.targetX)
      && Number.isFinite(attack.targetY)
      && Array.isArray(attack.witnessedBy)
      && attack.witnessedBy.every(Number.isInteger)
    );
  }).slice(-MAX_ATTACK_FEED_ENTRIES);
  return pruneUnitAttacks(structuredClone(attacks), currentTick);
}

export function visibleUnitAttacks<Attack extends ProjectedUnitAttackView>(
  attacks: readonly Attack[],
  currentTick: number,
  playerId: number,
): Attack[] {
  return attacks.filter((attack) => {
    const age = currentTick - attack.tick;
    return (
      age >= 0 &&
      age <= ATTACK_FEED_TICKS &&
      attack.witnessedBy.includes(playerId)
    );
  });
}

export function attackAnimationForEntity(
  attacks: readonly ProjectedUnitAttackView[],
  currentTick: number,
  playerId: number,
  entity: Pick<ProjectedEntityView, 'id' | 'generation'>,
): ProjectedEntityView['attackAnimation'] {
  if (entity.generation === undefined) return undefined;
  for (let index = attacks.length - 1; index >= 0; index -= 1) {
    const attack = attacks[index]!;
    const age = currentTick - attack.tick;
    if (
      attack.attackerId === entity.id &&
      attack.attackerGeneration === entity.generation &&
      age >= 0 &&
      age <= ATTACK_FEED_TICKS &&
      attack.witnessedBy.includes(playerId)
    ) {
      return {
        tick: attack.tick,
        targetX: attack.targetX,
        targetY: attack.targetY,
      };
    }
  }
  return undefined;
}

export function indexVisibleUnitAttackAnimations(
  attacks: readonly ProjectedUnitAttackView[],
  currentTick: number,
  playerId: number,
): Map<string, ProjectedUnitAttackAnimationView> {
  const indexed = new Map<string, ProjectedUnitAttackAnimationView>();
  for (const attack of attacks) {
    const age = currentTick - attack.tick;
    if (
      age < 0
      || age > ATTACK_FEED_TICKS
      || !attack.witnessedBy.includes(playerId)
    ) {
      continue;
    }
    indexed.set(
      unitAttackKey(attack.attackerId, attack.attackerGeneration),
      {
        tick: attack.tick,
        targetX: attack.targetX,
        targetY: attack.targetY,
      },
    );
  }
  return indexed;
}

export function createUnitAttackRecorder(deps: {
  world: GameWorld;
  state: BridgeState;
  accessor: BridgeStateAccessor;
  visibility: VisibilityMap;
  ensureVisibilityCurrent?: () => void;
}): (attackerId: number, targetId: number) => void {
  const {
    world,
    state,
    accessor,
    visibility,
    ensureVisibilityCurrent,
  } = deps;

  return (attackerId, targetId) => {
    const attackerRef = world.getEntityRef(attackerId);
    const attacker = world.getComponent<UnitComponent>(attackerId, 'unit');
    const attackerPosition = world.getComponent<Position>(
      attackerId,
      'position',
    );
    const attackerRenderable = world.getComponent<RenderableComponent>(
      attackerId,
      'renderable',
    );
    const targetPosition = world.getComponent<Position>(targetId, 'position');
    const targetRenderable = world.getComponent<RenderableComponent>(
      targetId,
      'renderable',
    );
    if (
      !attackerRef ||
      !attacker ||
      !attackerPosition ||
      !attackerRenderable ||
      !targetPosition ||
      !targetRenderable
    )
      return;

    const targetTransform = world.getComponent<UnitTransformComponent>(
      targetId,
      'unitTransform',
    );
    const targetRootX = targetTransform
      ? projectUnitTransformCoordinate(targetTransform.fineX)
      : targetPosition.x;
    const targetRootY = targetTransform
      ? projectUnitTransformCoordinate(targetTransform.fineY)
      : targetPosition.y;
    ensureVisibilityCurrent?.();
    const witnessedBy: number[] = [];
    for (const owner of accessor.get(populationCodec).keys()) {
      if (
        owner === attacker.owner ||
        (isFootprintVisible(
          visibility,
          owner,
          attackerPosition.x,
          attackerPosition.y,
          attackerRenderable.footprintWidth,
          attackerRenderable.footprintHeight,
        ) &&
          isFootprintVisible(
            visibility,
            owner,
            targetPosition.x,
            targetPosition.y,
            targetRenderable.footprintWidth,
            targetRenderable.footprintHeight,
          ))
      )
        witnessedBy.push(owner);
    }
    if (!witnessedBy.includes(attacker.owner)) witnessedBy.push(attacker.owner);

    // civ-engine advances `world.tick` after update systems finish, so the
    // hit being resolved belongs to the in-flight observable tick `+ 1`.
    const tick = world.tick + 1;
    const attacks = state.recentUnitAttacks;
    pruneUnitAttacks(attacks, tick);
    let write = 0;
    for (let read = 0; read < attacks.length; read += 1) {
      const attack = attacks[read]!;
      if (
        !(
          attack.attackerId === attackerId &&
          attack.attackerGeneration === attackerRef.generation
        )
      ) {
        attacks[write] = attack;
        write += 1;
      }
    }
    attacks.length = write;
    attacks.push({
      attackerId,
      attackerGeneration: attackerRef.generation,
      tick,
      // Entity roots use cell-origin coordinates. `(footprint - 1) / 2`
      // captures a multi-cell target's visual center in that same space.
      targetX: targetRootX + (targetRenderable.footprintWidth - 1) / 2,
      targetY: targetRootY + (targetRenderable.footprintHeight - 1) / 2,
      witnessedBy,
    });
    if (attacks.length > MAX_ATTACK_FEED_ENTRIES) {
      attacks.splice(0, attacks.length - MAX_ATTACK_FEED_ENTRIES);
    }
  };
}
