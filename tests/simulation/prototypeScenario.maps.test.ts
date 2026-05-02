import { describe, expect, it } from 'vitest';

import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import { createPrototypeScenario } from '../../src/game/simulation/prototypeScenario';

describe('createPrototypeScenario — map variants', () => {
  it('builds the Black Forest map deterministically and with dense trees', () => {
    const left = createPrototypeScenario('black-forest-fixture');
    const right = createPrototypeScenario('black-forest-fixture');

    expect(left).toEqual(right);

    const treeCount = left.spawns.filter((spawn) => spawn.kind === 'tree').length;
    // Default Arabia-style map ships with 24 trees per player (48 total);
    // Black Forest should vastly exceed that baseline.
    expect(treeCount).toBeGreaterThan(200);

    // Each player still has a full opening set: one Town Center, six
    // villagers, one scout, one mill-ready berry patch, etc.
    for (const owner of [1, 2]) {
      expect(
        left.spawns.filter(
          (spawn) => spawn.owner === owner && spawn.kind === 'villager',
        ).length,
      ).toBe(3);
      expect(
        left.spawns.some(
          (spawn) =>
            spawn.kind === 'town-center' && spawn.owner === owner,
        ),
      ).toBe(true);
      expect(
        left.spawns.filter(
          (spawn) => spawn.baseOwner === owner && spawn.kind === 'berry-bush',
        ).length,
      ).toBe(6);

      // Iter-2 H2-3: standard opening seeds 4 stone, 4 gold, 2 boar
      // for every player, but the Black Forest carve-pocket was only
      // radius 6 — so cells like STARTING_STONE (1, 6) (distance ≈
      // 6.08), STARTING_GOLD (6, 0) (distance 6), and STARTING_BOARS
      // (4, -5) (distance ≈ 6.40) fell into forest cells that were
      // already seeded as a tree, and the standard-opening
      // applyResourcePatch silently dropped the rejected resource
      // spawn. Lock the per-owner counts so the regression cannot
      // come back.
      expect(
        left.spawns.filter(
          (spawn) => spawn.baseOwner === owner && spawn.kind === 'stone-mine',
        ).length,
      ).toBe(4);
      expect(
        left.spawns.filter(
          (spawn) => spawn.baseOwner === owner && spawn.kind === 'gold-mine',
        ).length,
      ).toBe(4);
      expect(
        left.spawns.filter(
          (spawn) => spawn.baseOwner === owner && spawn.kind === 'boar',
        ).length,
      ).toBe(2);
    }
  });

  it('builds the Arena map deterministically with a stone ring around each base', () => {
    const left = createPrototypeScenario('arena-fixture');
    const right = createPrototypeScenario('arena-fixture');

    expect(left).toEqual(right);

    const humanStart = left.starts.find((start) => start.owner === 1);
    expect(humanStart).toBeDefined();

    // Count stone-wall cells that sit on the ring perimeter (between
    // radius 6 and radius 7 from the human Town Center). Rings should
    // contain more than a handful of wall cells (gap is only 2 cells
    // wide). Post-FU3, the Arena ring is made of real `stone-wall`
    // buildings rather than the pre-FU3 stone-mine proxy.
    const ringWallCount = left.spawns.filter((spawn) => {
      if (spawn.kind !== 'stone-wall' || spawn.baseOwner !== humanStart?.owner) {
        return false;
      }
      const dx = spawn.x - (humanStart?.townCenter.x ?? 0);
      const dy = spawn.y - (humanStart?.townCenter.y ?? 0);
      const distSq = dx * dx + dy * dy;
      return distSq >= 36 && distSq <= 49;
    }).length;
    expect(ringWallCount).toBeGreaterThan(10);

    // The player's canonical STARTING_STONE patch still spawns as
    // gatherable stone mines inside the ring so the economy opening is
    // unchanged. Assert at least two stone-mine spawns beside whatever
    // the ring contributes.
    const humanStones = left.spawns.filter(
      (spawn) => spawn.kind === 'stone-mine' && spawn.baseOwner === humanStart?.owner,
    ).length;
    expect(humanStones).toBeGreaterThanOrEqual(2);
  });

  it('default map: forward enemy house anchor is never claimed by a forest cluster (V3-13)', () => {
    // Iter-3 V3-13: forest-cluster placement at owner-2's TC reaches
    // ring-12 cells around (39.5, 15.5); pre-fix some seeds dropped a
    // tree on FORWARD_ENEMY_HOUSE_POSITION (39, 18) and the bridge
    // bootstrap validator threw on the resource/building overlap.
    // Sample a small seed corpus to exercise the procedural variation.
    const seeds = [
      'aoe2-prototype',
      'iter3-corpus-1',
      'iter3-corpus-2',
      'iter3-corpus-3',
      'iter3-corpus-4',
      'iter3-corpus-5',
      'iter3-corpus-6',
      'iter3-corpus-7',
      'iter3-corpus-8',
      'iter3-corpus-9',
    ];

    for (const seed of seeds) {
      const scenario = createPrototypeScenario(seed);
      // Iter-3 verify follow-up: house is 2x2 — assert NO tree on any
      // of the 4 footprint cells, not just the anchor.
      const houseCells = [
        { x: 39, y: 18 },
        { x: 40, y: 18 },
        { x: 39, y: 19 },
        { x: 40, y: 19 },
      ];
      for (const cell of houseCells) {
        const treeOnCell = scenario.spawns.some(
          (spawn) =>
            spawn.kind === 'tree'
            && spawn.x === cell.x
            && spawn.y === cell.y,
        );
        expect(treeOnCell, `seed=${seed}: tree must not occupy forward house cell (${cell.x}, ${cell.y})`).toBe(false);
      }

      // Sanity: bridge boots cleanly with the same seed.
      expect(() => createSimulationBridge(seed)).not.toThrow();
    }
  });
});
