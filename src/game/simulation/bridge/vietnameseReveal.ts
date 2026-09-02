// Vietnamese: "Reveals enemy positions at game start" (civilizations.csv).
// Runs once at post-seed. For every Vietnamese owner, each OTHER player's
// Town Center area is stamped EXPLORED by parking a temporary vision source
// over it and updating the map — explored is monotonic in the engine, so the
// terrain knowledge survives the source's removal (no engine change needed).
// For the HUMAN player (fog memory is human-only today) the enemy Town
// Centers are also written into fog memory, so the reveal renders as the
// familiar last-seen ghost, not just bare ground.

import type { VisibilityMap } from 'civ-engine';
import type { Position } from 'civ-engine';

import type { BuildingComponent, RenderableComponent } from '../types';
import type { MemoryEntry } from './memoryTypes';
import { architectureStyleFor } from '../architectureStyles';
import { HUMAN_PLAYER_ID } from '../prototypeScenario';
import type { BridgeStateAccessor } from './bridgeStateAccessor';
import {
  lastSeenStaticCodec,
  playerCivilizationsCodec,
} from './bridgeStateSerialize';
import type { GameWorld } from './pureHelpers';

const REVEAL_RADIUS = 5;

export function applyVietnameseReveal(
  world: GameWorld,
  accessor: BridgeStateAccessor,
  visibility: VisibilityMap,
): void {
  const civilizations = accessor.get(playerCivilizationsCodec);
  const revealOwners = [...civilizations.entries()]
    .filter(([, civilization]) => civilization === 'Vietnamese')
    .map(([owner]) => owner);
  if (revealOwners.length === 0) return;

  const townCenters: Array<{ id: number; owner: number; position: Position }> = [];
  for (const id of world.query('building', 'position')) {
    const building = world.getComponent<BuildingComponent>(id, 'building');
    const position = world.getComponent<Position>(id, 'position');
    if (!building || !position || building.buildingType !== 'town-center') continue;
    townCenters.push({ id, owner: building.owner, position });
  }

  for (const revealOwner of revealOwners) {
    let stamped = 0;
    for (const townCenter of townCenters) {
      if (townCenter.owner === revealOwner) continue;
      visibility.setSource(revealOwner, `vietnamese-reveal-${townCenter.id}`, {
        x: townCenter.position.x,
        y: townCenter.position.y,
        radius: REVEAL_RADIUS,
      });
      stamped += 1;

      if (revealOwner === HUMAN_PLAYER_ID) {
        const renderable = world.getComponent<RenderableComponent>(townCenter.id, 'renderable');
        if (renderable) {
          const entry: MemoryEntry = {
            kind: 'building',
            entityType: 'town-center',
            architecture: architectureStyleFor(civilizations.get(townCenter.owner)),
            generation: world.getEntityGeneration(townCenter.id),
            position: { x: townCenter.position.x, y: townCenter.position.y },
            footprintWidth: renderable.footprintWidth,
            footprintHeight: renderable.footprintHeight,
            tint: renderable.tint,
            owner: townCenter.owner,
            size: renderable.size,
            visualVariant: renderable.visualVariant,
          };
          accessor.mutate(lastSeenStaticCodec, (outer) => {
            const inner = outer.get(revealOwner) ?? new Map<number, MemoryEntry>();
            inner.set(townCenter.id, entry);
            outer.set(revealOwner, inner);
          });
        }
      }
    }
    if (stamped > 0) {
      // One update marks the covered cells visible → explored; removing the
      // sources afterwards leaves them explored-but-not-visible, which is
      // exactly the state fog memory renders from.
      visibility.update();
      for (const townCenter of townCenters) {
        if (townCenter.owner === revealOwner) continue;
        visibility.removeSource(revealOwner, `vietnamese-reveal-${townCenter.id}`);
      }
    }
  }
  if (revealOwners.length > 0) visibility.update();
}
