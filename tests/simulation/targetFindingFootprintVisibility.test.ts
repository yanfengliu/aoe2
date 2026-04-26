import { describe, expect, it } from 'vitest';

import { createTargetFindingOps } from '../../src/game/simulation/bridge/targetFindingOps';
import type { BuildingComponent } from '../../src/game/simulation/types';

// Mock minimal civ-engine world + visibility surfaces. The
// targetFindingOps factory only touches `query`, `queryInRadius`, and
// `getComponent` for unit/building lookups, plus `visibility.isVisible`.
function createMockWorld(entities: {
  buildings: Array<{
    id: number;
    x: number;
    y: number;
    owner: number;
    buildingType: BuildingComponent['buildingType'];
    footprint: { width: number; height: number };
  }>;
}) {
  const buildings = new Map<number, BuildingComponent>();
  const positions = new Map<number, { x: number; y: number }>();
  for (const b of entities.buildings) {
    positions.set(b.id, { x: b.x, y: b.y });
    buildings.set(b.id, {
      buildingType: b.buildingType,
      owner: b.owner,
      footprint: b.footprint,
    } as unknown as BuildingComponent);
  }

  return {
    *query(...components: string[]) {
      const wantsBuilding = components.includes('building');
      for (const id of buildings.keys()) {
        if (wantsBuilding && positions.has(id)) {
          yield id;
        }
      }
    },
    *queryInRadius() {
      // Unused for findPreferredVisibleEnemyBuilding; left as a noop
      // generator so the type checker is happy if anything probes it.
    },
    getComponent<T>(id: number, component: string): T | undefined {
      if (component === 'position') {
        return positions.get(id) as T | undefined;
      }
      if (component === 'building') {
        return buildings.get(id) as T | undefined;
      }
      return undefined;
    },
  } as unknown as Parameters<typeof createTargetFindingOps>[0]['world'];
}

function createMockVisibility(visibleCells: Set<string>) {
  return {
    isVisible(_playerId: number, x: number, y: number): boolean {
      return visibleCells.has(`${x},${y}`);
    },
  };
}

describe('iter-2 M2-1 — findPreferredVisibleEnemyBuilding uses footprint visibility', () => {
  it('returns a 4x4 castle when a non-anchor cell is visible but the anchor is not', () => {
    // Player-1 castle (4x4) anchored at (10, 10) — occupies (10,10) to
    // (13,13). Viewer (player 2) has visibility on (12, 12) only — a
    // non-anchor cell. createProjector treats this footprint as visible
    // (matches what the player sees on screen). The buggy
    // findPreferredVisibleEnemyBuilding only checked the anchor cell
    // visibility, so it would return null even though the building is
    // rendered.
    const world = createMockWorld({
      buildings: [
        {
          id: 1001,
          x: 10,
          y: 10,
          owner: 1,
          buildingType: 'castle',
          footprint: { width: 4, height: 4 },
        },
      ],
    });
    const visibility = createMockVisibility(new Set(['12,12']));

    const ops = createTargetFindingOps({
      world,
      visibility,
      state: { combatStates: new Map(), constructionStates: new Map() } as never,
    });

    const result = ops.findPreferredVisibleEnemyBuilding(2, { x: 16, y: 12 });
    expect(result).toBe(1001);
  });

  it('returns null when no cell of the building footprint is visible', () => {
    // Sanity case: viewer has no visibility on any cell of the castle.
    // Should return null both before and after the fix.
    const world = createMockWorld({
      buildings: [
        {
          id: 1001,
          x: 10,
          y: 10,
          owner: 1,
          buildingType: 'castle',
          footprint: { width: 4, height: 4 },
        },
      ],
    });
    const visibility = createMockVisibility(new Set(['25,25']));

    const ops = createTargetFindingOps({
      world,
      visibility,
      state: { combatStates: new Map(), constructionStates: new Map() } as never,
    });

    const result = ops.findPreferredVisibleEnemyBuilding(2, { x: 16, y: 12 });
    expect(result).toBeNull();
  });

  it('still returns a building when only the anchor cell is visible (regression for the fix)', () => {
    // Confirm the fix does not break the prior happy path — anchor-cell
    // visibility was the only path the original code accepted.
    const world = createMockWorld({
      buildings: [
        {
          id: 1001,
          x: 10,
          y: 10,
          owner: 1,
          buildingType: 'castle',
          footprint: { width: 4, height: 4 },
        },
      ],
    });
    const visibility = createMockVisibility(new Set(['10,10']));

    const ops = createTargetFindingOps({
      world,
      visibility,
      state: { combatStates: new Map(), constructionStates: new Map() } as never,
    });

    const result = ops.findPreferredVisibleEnemyBuilding(2, { x: 16, y: 12 });
    expect(result).toBe(1001);
  });
});
