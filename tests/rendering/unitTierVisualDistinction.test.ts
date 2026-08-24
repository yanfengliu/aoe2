// An upgraded unit must LOOK upgraded.
//
// v0.3.45 added Capped Ram and Siege Onager and both shipped invisible: the
// ram recipe branched only on `tier === 3`, so the tier-2 Capped Ram drew the
// battering ram's leather roof while its part was NAMED `iron-roof`, and the
// Siege Onager was given the Onager's own tier and signature, so the two were
// the same object with different names. The recipe characterization test could
// not see either, because it hashes part NAMES — and the names were the one
// thing that did differ. So this gate hashes only what reaches the screen:
// surface, colour, position, size and rotation, never a name.
//
// The rule is the whole class rather than those two units: for every upgrade
// line the game has, no two tiers may render the same pixels. Adding a tier to
// a line without giving it a look now fails here.

import { createHash } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import { UNIT_LINE_UPGRADES } from '../../src/game/simulation/bridge/unitLineUpgrades';
import type { ProjectedEntityView, UnitType } from '../../src/game/simulation/types';
import { createUnitParts } from '../../src/rendering/voxel/aoeVoxelUnitRecipes';

function unit(entityType: UnitType): ProjectedEntityView {
  return {
    id: 41,
    generation: 2,
    kind: 'unit',
    layer: 'unit',
    entityType,
    owner: 1,
    x: 4,
    y: 6,
    elevation: 0,
    tint: 0x3568c0,
    size: 0.72,
    footprintWidth: 1,
    footprintHeight: 1,
    visualVariant: 'default',
    selected: false,
    currentHp: 30,
    maxHp: 30,
    isMemory: false,
  };
}

/**
 * The part list reduced to what a player can see. Deliberately drops `key`:
 * a name is not a pixel, and naming a leather roof `iron-roof` is exactly the
 * defect this gate exists to catch.
 */
function visualDigest(unitType: UnitType): string {
  const parts = createUnitParts(unit(unitType), '41:0', 0);
  const visible = parts.map((part) => [
    part.surface,
    part.tint,
    part.centerX, part.centerY, part.centerZ,
    part.width, part.height, part.depth,
    part.yaw ?? 0, part.pitch ?? 0, part.roll ?? 0,
  ]);
  return createHash('sha256').update(JSON.stringify(visible)).digest('hex');
}

/** Every upgrade line, as the set of unit types that share it. */
function upgradeLines(): UnitType[][] {
  const parent = new Map<UnitType, UnitType>();
  const find = (unitType: UnitType): UnitType => {
    const seen = parent.get(unitType);
    if (seen === undefined || seen === unitType) {
      parent.set(unitType, unitType);
      return unitType;
    }
    const root = find(seen);
    parent.set(unitType, root);
    return root;
  };
  const union = (a: UnitType, b: UnitType): void => {
    const rootA = find(a);
    const rootB = find(b);
    if (rootA !== rootB) {
      parent.set(rootA, rootB);
    }
  };
  for (const upgrade of Object.values(UNIT_LINE_UPGRADES)) {
    for (const from of upgrade.from) {
      union(from, upgrade.to);
    }
  }
  const lines = new Map<UnitType, UnitType[]>();
  for (const unitType of parent.keys()) {
    const root = find(unitType);
    const members = lines.get(root) ?? [];
    members.push(unitType);
    lines.set(root, members);
  }
  return [...lines.values()].filter((members) => members.length > 1);
}

describe('unit tier visual distinction', () => {
  it('finds the upgrade lines the game actually has', () => {
    const lines = upgradeLines();
    expect(lines.length).toBeGreaterThan(10);
    const ramLine = lines.find((members) => members.includes('battering-ram'));
    expect(ramLine?.slice().sort()).toEqual(['battering-ram', 'capped-ram', 'siege-ram']);
  });

  it.each(upgradeLines().map((members) => [members.slice().sort().join(' -> '), members] as const))(
    'renders every tier of %s differently',
    (_label, members) => {
      const byDigest = new Map<string, UnitType[]>();
      for (const unitType of members) {
        const digest = visualDigest(unitType);
        byDigest.set(digest, [...(byDigest.get(digest) ?? []), unitType]);
      }
      const collisions = [...byDigest.values()].filter((group) => group.length > 1);
      expect(collisions).toEqual([]);
    },
  );
});
