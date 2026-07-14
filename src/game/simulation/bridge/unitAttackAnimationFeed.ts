import { type Position, type VisibilityMap } from 'civ-engine';

import type {
  ProjectedEntityView,
  ProjectedUnitAttackAnimationView,
  ProjectedUnitAttackView,
  RenderableComponent,
  UnitComponent,
  UnitTransformComponent,
} from '../types';
import { MAP_HEIGHT, MAP_WIDTH } from '../prototypeScenario';
import type { BridgeState, UnitAttackFeedRuntime } from './bridgeState';
import type { BridgeStateAccessor } from './bridgeStateAccessor';
import { populationCodec } from './bridgeStateSerialize';
import {
  isFootprintVisible,
  projectUnitTransformCoordinate,
  type GameWorld,
} from './pureHelpers';

export const ATTACK_FEED_TICKS = 10;
const MAX_ATTACK_FEED_ENTRIES = 1_024;
export const MAX_ATTACK_PLAYER_ID = 8;

export function unitAttackKey(attackerId: number, attackerGeneration: number): string {
  return `${attackerId}:${attackerGeneration}`;
}

function markUnitAttackFeedChanged(feed: UnitAttackFeedRuntime): void {
  feed.materializedDirty = true;
  feed.persistenceDirty = true;
}

export function getUnitAttackFeedEntries(
  feed: UnitAttackFeedRuntime,
): readonly ProjectedUnitAttackView[] {
  if (feed.materializedDirty) {
    feed.materialized.length = 0;
    for (const attack of feed.byAttacker.values()) {
      feed.materialized.push(attack);
    }
    feed.materializedDirty = false;
  }
  return feed.materialized;
}

export function initializeUnitAttackFeed(
  feed: UnitAttackFeedRuntime,
  attacks: readonly ProjectedUnitAttackView[],
  currentTick: number,
): void {
  feed.byAttacker.clear();
  for (const attack of attacks) {
    const key = unitAttackKey(attack.attackerId, attack.attackerGeneration);
    feed.byAttacker.delete(key);
    feed.byAttacker.set(key, attack);
  }
  feed.materialized.length = 0;
  for (const attack of feed.byAttacker.values()) feed.materialized.push(attack);
  feed.materializedDirty = false;
  feed.persistenceDirty = false;
  feed.lastPrunedTick = currentTick;
}

export function pruneUnitAttackFeed(
  feed: UnitAttackFeedRuntime,
  currentTick: number,
): boolean {
  if (feed.lastPrunedTick === currentTick) return false;
  feed.lastPrunedTick = currentTick;
  const minTick = currentTick - ATTACK_FEED_TICKS;
  let changed = false;
  for (const [key, attack] of feed.byAttacker) {
    if (attack.tick < minTick) {
      feed.byAttacker.delete(key);
      changed = true;
    }
  }
  if (changed) markUnitAttackFeedChanged(feed);
  return changed;
}

export function upsertUnitAttack(
  feed: UnitAttackFeedRuntime,
  attack: ProjectedUnitAttackView,
  currentTick: number,
): void {
  pruneUnitAttackFeed(feed, currentTick);
  const canonical: ProjectedUnitAttackView = {
    attackerId: attack.attackerId,
    attackerGeneration: attack.attackerGeneration,
    tick: attack.tick,
    targetX: attack.targetX,
    targetY: attack.targetY,
    witnessedBy: [...attack.witnessedBy],
  };
  const key = unitAttackKey(canonical.attackerId, canonical.attackerGeneration);
  feed.byAttacker.delete(key);
  feed.byAttacker.set(key, canonical);
  while (feed.byAttacker.size > MAX_ATTACK_FEED_ENTRIES) {
    const oldestKey = feed.byAttacker.keys().next().value as string | undefined;
    if (oldestKey === undefined) break;
    feed.byAttacker.delete(oldestKey);
  }
  markUnitAttackFeedChanged(feed);
}

export function hydrateUnitAttacks(
  value: unknown,
  currentTick: number,
  validPlayerIds: ReadonlySet<number>,
): ProjectedUnitAttackView[] {
  if (!Array.isArray(value)) return [];
  const attacks = new Map<string, ProjectedUnitAttackView>();
  const start = Math.max(0, value.length - MAX_ATTACK_FEED_ENTRIES);
  const minTick = currentTick - ATTACK_FEED_TICKS;
  for (let index = start; index < value.length; index += 1) {
    const candidate = value[index];
    if (!candidate || typeof candidate !== 'object') continue;
    const attack = candidate as Partial<ProjectedUnitAttackView>;
    if (
      !Number.isSafeInteger(attack.attackerId)
      || (attack.attackerId ?? -1) < 0
      || !Number.isSafeInteger(attack.attackerGeneration)
      || (attack.attackerGeneration ?? -1) < 0
      || !Number.isSafeInteger(attack.tick)
      || (attack.tick ?? Number.NEGATIVE_INFINITY) < minTick
      || (attack.tick ?? Number.POSITIVE_INFINITY) > currentTick
      || !Number.isFinite(attack.targetX)
      || (attack.targetX ?? -1) < 0
      || (attack.targetX ?? MAP_WIDTH) >= MAP_WIDTH
      || !Number.isFinite(attack.targetY)
      || (attack.targetY ?? -1) < 0
      || (attack.targetY ?? MAP_HEIGHT) >= MAP_HEIGHT
      || !Array.isArray(attack.witnessedBy)
      || attack.witnessedBy.length === 0
      || attack.witnessedBy.length > MAX_ATTACK_PLAYER_ID
    ) {
      continue;
    }
    const witnessedBy: number[] = [];
    for (const playerId of attack.witnessedBy) {
      if (
        Number.isSafeInteger(playerId)
        && playerId >= 1
        && playerId <= MAX_ATTACK_PLAYER_ID
        && validPlayerIds.has(playerId)
        && !witnessedBy.includes(playerId)
      ) {
        witnessedBy.push(playerId);
      }
    }
    if (witnessedBy.length === 0) continue;
    const canonical: ProjectedUnitAttackView = {
      attackerId: attack.attackerId!,
      attackerGeneration: attack.attackerGeneration!,
      tick: attack.tick!,
      targetX: attack.targetX!,
      targetY: attack.targetY!,
      witnessedBy,
    };
    const key = unitAttackKey(canonical.attackerId, canonical.attackerGeneration);
    attacks.delete(key);
    attacks.set(key, canonical);
  }
  return [...attacks.values()];
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
  let visibilitySnapshotTick = Number.NEGATIVE_INFINITY;

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
    const tick = world.tick + 1;
    // Player commands resolve sequentially inside one atomic simulation tick.
    // The first successful impact refreshes visibility; later impacts in that
    // observable tick share that snapshot, avoiding one full source scan per
    // attacker. The normal visibility system still publishes final positions.
    if (visibilitySnapshotTick !== tick) {
      ensureVisibilityCurrent?.();
      visibilitySnapshotTick = tick;
    }
    const witnessedBy: number[] = [];
    for (const owner of accessor.get(populationCodec).keys()) {
      if (!Number.isSafeInteger(owner) || owner < 1 || owner > MAX_ATTACK_PLAYER_ID) {
        continue;
      }
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
    if (
      Number.isSafeInteger(attacker.owner)
      && attacker.owner >= 1
      && attacker.owner <= MAX_ATTACK_PLAYER_ID
      && !witnessedBy.includes(attacker.owner)
    ) {
      witnessedBy.push(attacker.owner);
    }
    if (witnessedBy.length === 0) return;

    // civ-engine advances `world.tick` after update systems finish, so the
    // hit being resolved belongs to the in-flight observable tick `+ 1`.
    upsertUnitAttack(state.unitAttackFeed, {
      attackerId,
      attackerGeneration: attackerRef.generation,
      tick,
      // Entity roots use cell-origin coordinates. `(footprint - 1) / 2`
      // captures a multi-cell target's visual center in that same space.
      targetX: targetRootX + (targetRenderable.footprintWidth - 1) / 2,
      targetY: targetRootY + (targetRenderable.footprintHeight - 1) / 2,
      witnessedBy,
    }, tick);
  };
}
