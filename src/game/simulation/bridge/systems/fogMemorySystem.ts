// Fog-of-war memory: every tick, take a snapshot of every static building
// or static memorable resource (trees, berries, gold mines, stone mines)
// the human player currently sees. Snapshots persist after vision loss so
// the renderer can render last-known state under fog.
//
// The human's OWN buildings are not remembered (vNEXT; defect register
// 2026-10-11; spec §12.1). The render state draws every entity the human
// owns whatever the fog (renderStateOps' owner pass), so an entry for one is
// never read while it stands. It was read once the building was gone: a
// House the player deleted, or lost where nothing else of theirs could see,
// stayed on the map as a ghost, because its own sight went with it and an
// entry is forgotten only when its ground is seen empty. The entries also
// cost every tick, since the engine fingerprints the whole slot twice a tick.
// So: no entry for a building the human owns; an entry recorded as the
// human's is forgotten on the first pass after its building goes; and the one
// exception, a building an enemy has started to convert, is remembered until
// it changes hands and is then drawn in its new owner's look.

import { VisibilityMap, type Position } from 'civ-engine';
import type {
  BuildingComponent,
  RenderableComponent,
  ResourceComponent,
} from '../../types';
import { isEnemyOwner } from '../../alliances';
import type { GameWorld } from '../pureHelpers';
import type { BridgeStateAccessor } from '../bridgeStateAccessor';
import { conversionStateCodec, playerTeamsCodec } from '../bridgeStateSerialize';
import { isCellSeen, isFootprintSeen, readSightOwners } from '../humanSight';
import { isStaticMemorableResourceType } from '../../prototypeUnitRules';
import type { MemoryEntry } from '../memoryTypes';
import { architectureStyleFor } from '../../architectureStyles';

export interface FogMemorySystemDeps {
  world: GameWorld;
  humanPlayerId: number;
  visibility: VisibilityMap;
  /** Reads the teams and technologies that decide whose eyes the human
   *  sees through (humanSight.ts). */
  accessor: BridgeStateAccessor;
  getOrCreateMemoryMap: (owner: number) => Map<number, MemoryEntry>;
  /** Announce that this tick actually wrote to the memory map. */
  noteMemoryChanged: () => void;
  /** Owner → civilization, for the building-set snapshot (v0.3.105). */
  getCivilizationOf: (owner: number) => string | undefined;
}

export function registerFogMemorySystem(deps: FogMemorySystemDeps): void {
  const {
    world, humanPlayerId, visibility, accessor, getOrCreateMemoryMap, noteMemoryChanged,
    getCivilizationOf,
  } = deps;

  // Everything a memory entry says about how the thing LOOKS — which since
  // 2026-09-02 is every field it has. An entry is rewritten only when this
  // changes, because a dirty slot is re-serialised WHOLE into that tick's
  // replay diff: refreshing identical entries every tick was 358 MB of a
  // 537 MB corpus bundle, past V8's string ceiling. (The field that made them
  // differ, `lastSeenTick`, had no consumer and is gone; see memoryTypes.ts.)
  const sameAppearance = (a: MemoryEntry | undefined, b: MemoryEntry): boolean =>
    a !== undefined
    && a.kind === b.kind
    && a.entityType === b.entityType
    && a.architecture === b.architecture
    && a.generation === b.generation
    && a.position.x === b.position.x
    && a.position.y === b.position.y
    && a.footprintWidth === b.footprintWidth
    && a.footprintHeight === b.footprintHeight
    && a.tint === b.tint
    && a.owner === b.owner
    && a.size === b.size
    && a.visualVariant === b.visualVariant;

  world.registerSystem({
    name: 'prototypeFogMemory',
    phase: 'update',
    after: ['prototypeVisibility'],
    execute(activeWorld) {
      const humanMemory = getOrCreateMemoryMap(humanPlayerId);
      // What the human sees through its own eyes AND its allies' is what it
      // remembers (DE: an ally's base, and an enemy building an ally spotted,
      // stay on your map as last seen). Read once per tick, from world state,
      // so a replay remembers exactly what the live match did.
      const sight = readSightOwners(accessor, humanPlayerId);
      let changed = false;
      const remember = (id: number, entry: MemoryEntry): void => {
        if (sameAppearance(humanMemory.get(id), entry)) return;
        humanMemory.set(id, entry);
        changed = true;
      };

      // A building of the human's an enemy has started to convert is the
      // exception: one whose id carries an enemy's progress record in
      // `aoe2.conversionState`. The record is made on the first tick a Monk
      // works on the building and a fresh flip takes at least 50, so the
      // entry exists before any flip. The record also outlives a Monk called
      // off or killed, and a Monk of that owner sent back resumes it and can
      // flip the building in one tick, before this pass would see a new order;
      // so a convert ORDER would not do. A record the engine leaves on a
      // destroyed building's id (it never deletes one there) makes a building
      // of the human's that takes the id remembered too, and can flip it at
      // once, so that is right in live play; but a load prunes such a record
      // while the id is free, so a replay opened then can remember less than
      // the live match (work 116's plan, F10).
      const conversions = accessor.get(conversionStateCodec);
      const teams = accessor.get(playerTeamsCodec);

      // Refresh every building the human player currently sees. Visibility is
      // tested over the full footprint to match the projector and the iter-2
      // M2-1 target-finding fix.
      for (const id of activeWorld.query('position', 'building', 'renderable')) {
        const position = activeWorld.getComponent<Position>(id, 'position');
        const building = activeWorld.getComponent<BuildingComponent>(id, 'building');
        const renderable = activeWorld.getComponent<RenderableComponent>(id, 'renderable');
        if (!position || !building || !renderable) {
          continue;
        }
        const generation = activeWorld.getEntityGeneration(id);
        const held = humanMemory.get(id);
        const heldForThis = held !== undefined && held.generation === generation;
        if (building.owner === humanPlayerId) {
          // The human's own building, foundation or finished (header). With an
          // enemy's conversion record on it (above) it is remembered whatever
          // the fog — the human knows its own building, and a foundation sees
          // nothing — so a flip finds an entry. Otherwise an entry held for
          // this very building (the one it had as an enemy's, an older save's)
          // is dropped; one under the same id with another generation is a
          // destroyed building's ghost, not this one's, and stays.
          const record = conversions.get(id);
          if (record === undefined || !isEnemyOwner(teams, humanPlayerId, record.byOwner)) {
            if (heldForThis) {
              humanMemory.delete(id);
              changed = true;
            }
            continue;
          }
        } else if (
          !isFootprintSeen(
            visibility,
            sight,
            position.x,
            position.y,
            renderable.footprintWidth,
            renderable.footprintHeight,
          )
          // Unseen, a building is still refreshed once if its entry says the
          // human owned it: it has just changed hands (or an older save holds
          // such an entry). Showing it in its new owner's look is a rule
          // chosen here (DE is not verified, and it tells the human which
          // enemy took it), and it keeps the pass below from forgetting it as
          // the human's.
          && !(heldForThis && held.owner === humanPlayerId)
        ) {
          continue;
        }
        remember(id, {
          kind: 'building',
          entityType: building.buildingType,
          architecture: architectureStyleFor(getCivilizationOf(building.owner)),
          generation,
          position: { x: position.x, y: position.y },
          footprintWidth: renderable.footprintWidth,
          footprintHeight: renderable.footprintHeight,
          tint: renderable.tint,
          owner: building.owner,
          size: renderable.size,
          visualVariant: renderable.visualVariant,
        });
      }

      // Refresh every static resource the human player currently sees.
      // V4-21: anchor-only visibility is correct here only because every
      // memorable static resource (tree, berry-bush, gold-mine, stone-mine)
      // is 1x1 — `isFootprintSeen(... 1, 1)` reduces to `isCellSeen`. If
      // a future memorable resource has a multi-cell footprint, switch to
      // `isFootprintSeen` here.
      for (const id of activeWorld.query('position', 'resource', 'renderable')) {
        const position = activeWorld.getComponent<Position>(id, 'position');
        const resource = activeWorld.getComponent<ResourceComponent>(id, 'resource');
        const renderable = activeWorld.getComponent<RenderableComponent>(id, 'renderable');
        if (!position || !resource || !renderable) {
          continue;
        }
        if (!isStaticMemorableResourceType(resource.resourceType)) {
          continue;
        }
        if (!isCellSeen(visibility, sight, position.x, position.y)) {
          continue;
        }
        remember(id, {
          kind: 'resource',
          entityType: resource.resourceType,
          generation: activeWorld.getEntityGeneration(id),
          position: { x: position.x, y: position.y },
          footprintWidth: renderable.footprintWidth,
          footprintHeight: renderable.footprintHeight,
          tint: renderable.tint,
          owner: resource.owner,
          size: renderable.size,
          visualVariant: renderable.visualVariant,
        });
      }

      // Forget memories of entities that no longer exist AND whose last-known
      // footprint is currently visible — i.e. the player saw it disappear.
      // Footprint-aware match keeps a multi-cell castle from leaving a permanent
      // ghost when only a non-anchor cell of its old footprint is in vision
      // (mirrors the iter-3 V3-1 write/select footprint-visibility fix).
      for (const [entityId, entry] of humanMemory) {
        // Generation-aware existence: isCurrent is false on BOTH death and id
        // recycle (a new entity reusing this id has a bumped generation), so a
        // recycled id no longer masks a destroyed-under-fog building as "still
        // there" (the M5 bug — a raw `getComponent(id,'position')` probe was
        // fooled by the recycled entity's position).
        const stillExists = activeWorld.isCurrent({ id: entityId, generation: entry.generation });
        if (stillExists) {
          continue;
        }
        // A building that was the human's when last remembered is forgotten
        // on the first pass after it goes, seen or not: the human knows what
        // it has lost. This is the entry an enemy's conversion record kept
        // when the building is deleted or razed before any flip, and an older
        // save's. (This pass runs before projectiles land, so a building one
        // destroys is forgotten a tick later — never, if that ends the match.)
        if (entry.kind === 'building' && entry.owner === humanPlayerId) {
          humanMemory.delete(entityId);
          changed = true;
          continue;
        }
        if (
          isFootprintSeen(
            visibility,
            sight,
            entry.position.x,
            entry.position.y,
            entry.footprintWidth,
            entry.footprintHeight,
          )
        ) {
          humanMemory.delete(entityId);
          changed = true;
        }
      }

      if (changed) noteMemoryChanged();
    },
  });
}
