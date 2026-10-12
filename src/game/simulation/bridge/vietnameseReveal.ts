// Vietnamese: "Enemy Town Centers are revealed at the start of the game" —
// Definitive Edition's own civilization text (string 120180, the Vietnamese
// help text in SiegeEngineers/aoe2techtree at 3bb43b14, DE update 185872).
//
// For every Vietnamese owner, the ground around each OTHER player's Town Center
// is stamped EXPLORED by parking temporary vision sources over it and updating
// the map — explored is monotonic in the engine, so the knowledge survives the
// sources' removal. For the HUMAN player (fog memory is human-only today) the
// Town Centers are also written into fog memory, so the reveal renders as the
// familiar last-seen ghost, not just bare ground.
//
// The ground is the cells within REVEAL_RADIUS of the MIDDLE of the footprint,
// measured as building sight is (buildingVisionSources.ts): an even footprint
// is four circles on its central cells with one shared radius. Until work 117
// (2026-10-11) it was one circle on the top-left cell, which reached five
// cells past the west and north edges and two past the east and south.
//
// It runs ONCE, when a fresh match is seeded (wirePostSeedOps, on the flag
// wireBridgeOps sets only when there is no save). A loaded save and a replay
// world never run it: the cells it explored are in `aoe2.visibility` and the
// memory it wrote in `aoe2.lastSeenStatic`, both saved and recorded, so they
// come back exactly as they were. Until work 117 it ran on every load and in
// every replay world too, and revealed Town Centers the enemy had built
// mid-game. A save or a recording made before then keeps whatever its old
// corner-measured reveal explored.

import type { VisibilityMap } from 'civ-engine';
import type { Position } from 'civ-engine';

import type { BuildingComponent, RenderableComponent } from '../types';
import type { MemoryEntry } from './memoryTypes';
import { architectureStyleFor } from '../architectureStyles';
import { footprintVisionSources } from '../buildingVisionSources';
import { HUMAN_PLAYER_ID } from '../prototypeScenario';
import type { BridgeStateAccessor } from './bridgeStateAccessor';
import {
  lastSeenStaticCodec,
  playerCivilizationsCodec,
} from './bridgeStateSerialize';
import { buildingFootprint, type GameWorld } from './pureHelpers';

/** How far the reveal reaches from the middle of a Town Center's footprint:
 *  this game's choice. DE's text says the Town Centers are revealed and gives
 *  no radius. */
export const REVEAL_RADIUS = 5;

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

  const townCenters: Array<{ id: number; owner: number; position: Position; building: BuildingComponent }> = [];
  for (const id of world.query('building', 'position')) {
    const building = world.getComponent<BuildingComponent>(id, 'building');
    const position = world.getComponent<Position>(id, 'position');
    if (!building || !position || building.buildingType !== 'town-center') continue;
    townCenters.push({ id, owner: building.owner, position, building });
  }

  for (const revealOwner of revealOwners) {
    const sourceIds: string[] = [];
    for (const townCenter of townCenters) {
      if (townCenter.owner === revealOwner) continue;
      const placed = footprintVisionSources(
        townCenter.position,
        buildingFootprint(townCenter.building.buildingType),
        REVEAL_RADIUS,
        world.grid,
      );
      placed.cells.forEach((cell, index) => {
        const sourceId = `vietnamese-reveal-${String(townCenter.id)}:${String(index)}`;
        visibility.setSource(revealOwner, sourceId, { x: cell.x, y: cell.y, radius: placed.radius });
        sourceIds.push(sourceId);
      });

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
    if (sourceIds.length > 0) {
      // One update marks the covered cells visible → explored; removing the
      // sources afterwards leaves them explored-but-not-visible, which is
      // exactly the state fog memory renders from.
      visibility.update();
      for (const sourceId of sourceIds) visibility.removeSource(revealOwner, sourceId);
    }
  }
  visibility.update();
}
