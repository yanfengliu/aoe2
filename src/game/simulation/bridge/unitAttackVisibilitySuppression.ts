import type { Position, VisibilityMap } from 'civ-engine';

import type { RenderableComponent, ResourceComponent, UnitComponent } from '../types';
import type { UnitAttackFeedRuntime } from './bridgeState';
import { isFootprintVisible, type GameWorld } from './pureHelpers';
import { markUnitAttackFeedChanged } from './unitAttackAnimationFeed';

export function suppressHiddenUnitAttacks(
  feed: UnitAttackFeedRuntime,
  world: GameWorld,
  visibility: VisibilityMap,
): boolean {
  let changed = false;
  for (const [key, attack] of feed.byAttacker) {
    const suppressedFor = new Set(attack.suppressedFor ?? []);
    if (suppressedFor.size >= attack.witnessedBy.length) continue;

    const attackerRef = world.getEntityRef(attack.attackerId);
    const attacker = world.getComponent<UnitComponent>(attack.attackerId, 'unit');
    // Wildlife retaliation (spec §14.5): a boar attacker exists as a resource
    // entity — treat its continued presence like a unit's for suppression.
    const attackerResource = attacker
      ? undefined
      : world.getComponent<ResourceComponent>(attack.attackerId, 'resource');
    const position = world.getComponent<Position>(attack.attackerId, 'position');
    const renderable = world.getComponent<RenderableComponent>(
      attack.attackerId,
      'renderable',
    );
    const isCurrentGeneration = attackerRef?.generation === attack.attackerGeneration;
    let attackChanged = false;
    for (const playerId of attack.witnessedBy) {
      if (suppressedFor.has(playerId)) continue;
      const remainsVisible = Boolean(
        isCurrentGeneration
        && (attacker || attackerResource)
        && position
        && renderable
        && (
          attacker?.owner === playerId
          || isFootprintVisible(
            visibility,
            playerId,
            position.x,
            position.y,
            renderable.footprintWidth,
            renderable.footprintHeight,
          )
        )
      );
      if (!remainsVisible) {
        suppressedFor.add(playerId);
        attackChanged = true;
      }
    }
    if (!attackChanged) continue;
    feed.byAttacker.set(key, {
      ...attack,
      suppressedFor: [...suppressedFor],
    });
    changed = true;
  }
  if (changed) markUnitAttackFeedChanged(feed);
  return changed;
}
