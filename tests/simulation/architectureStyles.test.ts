// Per-civilization architecture (v0.3.105): every roster civilization maps to
// one of six building sets; buildings project the style; the renderer re-keys
// the two canonical roof colours per set while everything else passes
// through, so a castle is a castle in every architecture.

import { describe, it, expect } from 'vitest';

import { architectureStyleFor } from '../../src/game/simulation/architectureStyles';
import { CIVILIZATION_NAMES } from '../../src/game/simulation/civilizationNames';
import { architectureRoofTint, architectureWallTint } from '../../src/rendering/voxel/aoeVoxelArchitecture';
import { VOXEL_COLORS } from '../../src/rendering/voxel/aoeVoxelRecipeTypes';
import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';

describe('architectureStyleFor', () => {
  it('maps every roster civilization to a set, with sane anchors', () => {
    for (const name of CIVILIZATION_NAMES) {
      expect(typeof architectureStyleFor(name)).toBe('string');
    }
    expect(architectureStyleFor('Britons')).toBe('western-european');
    expect(architectureStyleFor('Teutons')).toBe('central-european');
    expect(architectureStyleFor('Saracens')).toBe('middle-eastern');
    expect(architectureStyleFor('Chinese')).toBe('east-asian');
    expect(architectureStyleFor('Byzantines')).toBe('mediterranean');
    expect(architectureStyleFor('Aztecs')).toBe('mesoamerican');
    // Unknown and absent read the default - also the pre-v0.3.105 look.
    expect(architectureStyleFor(undefined)).toBe('western-european');
    expect(architectureStyleFor('Atlanteans')).toBe('western-european');
  });
});

describe('architectureRoofTint', () => {
  it('re-keys only the two canonical roof slots, identity for the default set', () => {
    expect(architectureRoofTint('western-european', VOXEL_COLORS.thatch)).toBe(VOXEL_COLORS.thatch);
    expect(architectureRoofTint(undefined, VOXEL_COLORS.thatch)).toBe(VOXEL_COLORS.thatch);
    expect(architectureRoofTint('east-asian', VOXEL_COLORS.thatch)).not.toBe(VOXEL_COLORS.thatch);
    expect(architectureRoofTint('east-asian', VOXEL_COLORS.roofTile)).not.toBe(VOXEL_COLORS.roofTile);
    // The dark ridge/cap tile re-keys too; a non-roof colour never does.
    expect(architectureRoofTint('east-asian', VOXEL_COLORS.roofTileDark)).not.toBe(VOXEL_COLORS.roofTileDark);
    expect(architectureRoofTint('east-asian', VOXEL_COLORS.stone)).toBe(VOXEL_COLORS.stone);
    // The six sets are pairwise distinct on the thatch slot.
    const styles = ['western-european', 'central-european', 'middle-eastern', 'east-asian', 'mediterranean', 'mesoamerican'] as const;
    const thatches = new Set(styles.map((s) => architectureRoofTint(s, VOXEL_COLORS.thatch)));
    expect(thatches.size).toBe(styles.length);
  });
});

describe('architectureWallTint', () => {
  it('re-keys the two plaster slots, passes everything else, identity for the default', () => {
    expect(architectureWallTint('western-european', VOXEL_COLORS.plaster)).toBe(VOXEL_COLORS.plaster);
    expect(architectureWallTint(undefined, VOXEL_COLORS.plasterLight)).toBe(VOXEL_COLORS.plasterLight);
    expect(architectureWallTint('middle-eastern', VOXEL_COLORS.plaster)).not.toBe(VOXEL_COLORS.plaster);
    expect(architectureWallTint('middle-eastern', VOXEL_COLORS.plasterLight)).not.toBe(VOXEL_COLORS.plasterLight);
    // Stone and timber are universal — a castle is a castle in every set.
    expect(architectureWallTint('middle-eastern', VOXEL_COLORS.stone)).toBe(VOXEL_COLORS.stone);
    expect(architectureWallTint('east-asian', VOXEL_COLORS.timber)).toBe(VOXEL_COLORS.timber);
    const styles = ['western-european', 'central-european', 'middle-eastern', 'east-asian', 'mediterranean', 'mesoamerican'] as const;
    const walls = new Set(styles.map((s) => architectureWallTint(s, VOXEL_COLORS.plaster)));
    expect(walls.size).toBe(styles.length);
  });
});

describe('buildings project their architecture', () => {
  it('a Saracen town projects middle-eastern; the default projects western-european', () => {
    const saracen = createSimulationBridge('aoe2-prototype', {
      civilizationsByOwner: new Map([[1, 'Saracens']]),
    });
    saracen.step(100);
    const tc = saracen
      .getRenderState()
      .entities.find((e) => e.entityType === 'town-center' && e.owner === 1);
    expect(tc?.architecture).toBe('middle-eastern');

    const plain = createSimulationBridge('aoe2-prototype');
    plain.step(100);
    const tc2 = plain
      .getRenderState()
      .entities.find((e) => e.entityType === 'town-center' && e.owner === 1);
    expect(tc2?.architecture).toBe('western-european');
    // Units carry no architecture.
    const villager = plain
      .getRenderState()
      .entities.find((e) => e.entityType === 'villager' && e.owner === 1);
    expect(villager?.architecture).toBeUndefined();
  });
});
