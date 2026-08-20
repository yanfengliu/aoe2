import { describe, expect, it } from 'vitest';

import type { ProjectedEntityView, UnitType } from '../../src/game/simulation/types';
import { ALL_UNIT_TYPES } from '../../src/input/unitTypeMap';
import { AoeVoxelAdapter } from '../../src/rendering/voxel/aoeVoxelAdapter';
import { voxelPartWorldCorners } from '../../src/rendering/voxel/aoeVoxelGeometry';
import type { AoeUnitAnimationState } from '../../src/rendering/voxel/aoeVoxelUnitAnimation';
import { matrixForPart, type VoxelPart } from '../../src/rendering/voxel/aoeVoxelRecipeTypes';
import { createUnitParts } from '../../src/rendering/voxel/aoeVoxelUnitRecipes';

interface WeaponExpectation {
  readonly kind: string;
  readonly parts: readonly string[];
}

const WEAPONS = {
  villager: { kind: 'tool', parts: ['villager-tool-handle', 'villager-tool-head'] },
  militia: { kind: 'sword', parts: ['infantry-sword', 'infantry-sword-hilt'] },
  'man-at-arms': { kind: 'sword', parts: ['infantry-sword', 'infantry-sword-hilt'] },
  'long-swordsman': { kind: 'sword', parts: ['infantry-sword', 'infantry-sword-hilt'] },
  'two-handed-swordsman': { kind: 'greatsword', parts: ['infantry-greatsword', 'infantry-greatsword-hilt'] },
  champion: { kind: 'greatsword', parts: ['infantry-greatsword', 'infantry-greatsword-hilt'] },
  spearman: { kind: 'polearm', parts: ['infantry-polearm-shaft', 'infantry-polearm-head'] },
  pikeman: { kind: 'polearm', parts: ['infantry-polearm-shaft', 'infantry-polearm-head'] },
  halberdier: { kind: 'halberd', parts: ['infantry-polearm-shaft', 'infantry-halberd-blade', 'infantry-halberd-hook'] },
  archer: { kind: 'bow', parts: ['archer-bow-upper', 'archer-bow-lower', 'archer-bow-grip'] },
  crossbowman: { kind: 'crossbow', parts: ['archer-crossbow-stock', 'archer-crossbow-bow', 'archer-crossbow-bolt'] },
  arbalest: { kind: 'crossbow', parts: ['archer-crossbow-stock', 'archer-crossbow-bow', 'archer-crossbow-bolt'] },
  skirmisher: { kind: 'javelin', parts: ['archer-javelin-shaft', 'archer-javelin-head'] },
  longbowman: { kind: 'longbow', parts: ['archer-longbow-upper', 'archer-longbow-lower', 'archer-longbow-grip'] },
  'elite-longbowman': { kind: 'longbow', parts: ['archer-longbow-upper', 'archer-longbow-lower', 'archer-longbow-grip'] },
  scout: { kind: 'mounted-sword', parts: ['cavalry-sword', 'cavalry-sword-hilt'] },
  'light-cavalry': { kind: 'mounted-sword', parts: ['cavalry-sword', 'cavalry-sword-hilt'] },
  hussar: { kind: 'mounted-sword', parts: ['cavalry-sword', 'cavalry-sword-hilt'] },
  camel: { kind: 'mounted-sword', parts: ['cavalry-sword', 'cavalry-sword-hilt'] },
  'heavy-camel': { kind: 'mounted-polearm', parts: ['cavalry-polearm-shaft', 'cavalry-polearm-head'] },
  knight: { kind: 'lance', parts: ['cavalry-lance', 'cavalry-lance-tip'] },
  cavalier: { kind: 'lance', parts: ['cavalry-lance', 'cavalry-lance-tip'] },
  paladin: { kind: 'lance', parts: ['cavalry-lance', 'cavalry-lance-tip'] },
  'cavalry-archer': { kind: 'mounted-bow', parts: ['cavalry-archer-bow-upper', 'cavalry-archer-bow-lower', 'cavalry-archer-bow-grip'] },
  'heavy-cavalry-archer': { kind: 'mounted-bow', parts: ['cavalry-archer-bow-upper', 'cavalry-archer-bow-lower', 'cavalry-archer-bow-grip'] },
  mangonel: { kind: 'stone-thrower', parts: ['siege-throwing-arm', 'siege-bucket'] },
  onager: { kind: 'stone-thrower', parts: ['siege-throwing-arm', 'siege-bucket'] },
  scorpion: { kind: 'bolt-thrower', parts: ['siege-scorpion-rail', 'siege-scorpion-bolt'] },
  'heavy-scorpion': { kind: 'bolt-thrower', parts: ['siege-scorpion-rail', 'siege-scorpion-bolt'] },
  'battering-ram': { kind: 'ram', parts: ['siege-ram-beam', 'siege-ram-head'] },
  'siege-ram': { kind: 'ram', parts: ['siege-ram-beam', 'siege-ram-head'] },
  'bombard-cannon': { kind: 'cannon', parts: ['siege-cannon-barrel', 'siege-cannon-muzzle', 'siege-cannon-breech'] },
  trebuchet: { kind: 'trebuchet', parts: ['siege-trebuchet-arm', 'siege-trebuchet-sling', 'siege-trebuchet-counterweight'] },
  monk: { kind: 'staff', parts: ['monk-staff', 'monk-staff-crossbar'] },
  // M5 naval: a Fishing Ship's identifying prop is its net, not a weapon.
  'fishing-ship': { kind: 'net', parts: ['ship-fishing-net', 'ship-net-float'] },
  'galley': { kind: 'ship-bow', parts: ['ship-bow-stave', 'ship-bow-rack-left'] },
  'war-galley': { kind: 'ship-bow', parts: ['ship-bow-stave', 'ship-bow-rack-left'] },
  'galleon': { kind: 'ship-bow', parts: ['ship-bow-stave', 'ship-bow-rack-left'] },
  'fire-ship': { kind: 'ship-fire', parts: ['ship-fire-siphon', 'ship-fire-flame'] },
  'fast-fire-ship': { kind: 'ship-fire', parts: ['ship-fire-siphon', 'ship-fire-flame'] },
  'demolition-ship': { kind: 'ship-powder', parts: ['ship-powder-keg', 'ship-powder-fuse'] },
  'heavy-demolition-ship': { kind: 'ship-powder', parts: ['ship-powder-keg', 'ship-powder-fuse'] },
  'cannon-galleon': { kind: 'ship-cannon', parts: ['ship-cannon-barrel', 'ship-cannon-muzzle'] },
  'elite-cannon-galleon': { kind: 'ship-cannon', parts: ['ship-cannon-barrel', 'ship-cannon-muzzle'] },
  // M4 unique units. Two new weapon looks arrive with them: the Janissary
  // carries a matchlock on foot and the Conquistador one from the saddle.
  'jaguar-warrior': { kind: 'sword', parts: ['infantry-sword', 'infantry-sword-hilt'] },
  'elite-jaguar-warrior': { kind: 'sword', parts: ['infantry-sword', 'infantry-sword-hilt'] },
  'cataphract': { kind: 'mounted-sword', parts: ['cavalry-sword', 'cavalry-sword-hilt'] },
  'elite-cataphract': { kind: 'mounted-sword', parts: ['cavalry-sword', 'cavalry-sword-hilt'] },
  'woad-raider': { kind: 'sword', parts: ['infantry-sword', 'infantry-sword-hilt'] },
  'elite-woad-raider': { kind: 'sword', parts: ['infantry-sword', 'infantry-sword-hilt'] },
  'chu-ko-nu': { kind: 'crossbow', parts: ['archer-crossbow-stock', 'archer-crossbow-bow', 'archer-crossbow-bolt'] },
  'elite-chu-ko-nu': { kind: 'crossbow', parts: ['archer-crossbow-stock', 'archer-crossbow-bow', 'archer-crossbow-bolt'] },
  'throwing-axeman': { kind: 'javelin', parts: ['archer-javelin-shaft', 'archer-javelin-head'] },
  'elite-throwing-axeman': { kind: 'javelin', parts: ['archer-javelin-shaft', 'archer-javelin-head'] },
  'huskarl': { kind: 'sword', parts: ['infantry-sword', 'infantry-sword-hilt'] },
  'elite-huskarl': { kind: 'sword', parts: ['infantry-sword', 'infantry-sword-hilt'] },
  'tarkan': { kind: 'mounted-sword', parts: ['cavalry-sword', 'cavalry-sword-hilt'] },
  'elite-tarkan': { kind: 'mounted-sword', parts: ['cavalry-sword', 'cavalry-sword-hilt'] },
  'samurai': { kind: 'sword', parts: ['infantry-sword', 'infantry-sword-hilt'] },
  'elite-samurai': { kind: 'sword', parts: ['infantry-sword', 'infantry-sword-hilt'] },
  'war-wagon': { kind: 'mounted-bow', parts: ['cavalry-archer-bow-upper', 'cavalry-archer-bow-lower', 'cavalry-archer-bow-grip'] },
  'elite-war-wagon': { kind: 'mounted-bow', parts: ['cavalry-archer-bow-upper', 'cavalry-archer-bow-lower', 'cavalry-archer-bow-grip'] },
  'plumed-archer': { kind: 'bow', parts: ['archer-bow-upper', 'archer-bow-lower', 'archer-bow-grip'] },
  'elite-plumed-archer': { kind: 'bow', parts: ['archer-bow-upper', 'archer-bow-lower', 'archer-bow-grip'] },
  'mangudai': { kind: 'mounted-bow', parts: ['cavalry-archer-bow-upper', 'cavalry-archer-bow-lower', 'cavalry-archer-bow-grip'] },
  'elite-mangudai': { kind: 'mounted-bow', parts: ['cavalry-archer-bow-upper', 'cavalry-archer-bow-lower', 'cavalry-archer-bow-grip'] },
  'war-elephant': { kind: 'lance', parts: ['cavalry-lance', 'cavalry-lance-tip'] },
  'elite-war-elephant': { kind: 'lance', parts: ['cavalry-lance', 'cavalry-lance-tip'] },
  'mameluke': { kind: 'mounted-sword', parts: ['cavalry-sword', 'cavalry-sword-hilt'] },
  'elite-mameluke': { kind: 'mounted-sword', parts: ['cavalry-sword', 'cavalry-sword-hilt'] },
  'conquistador': { kind: 'mounted-gun', parts: ['cavalry-gun-stock', 'cavalry-gun-barrel', 'cavalry-gun-muzzle'] },
  'elite-conquistador': { kind: 'mounted-gun', parts: ['cavalry-gun-stock', 'cavalry-gun-barrel', 'cavalry-gun-muzzle'] },
  'teutonic-knight': { kind: 'sword', parts: ['infantry-sword', 'infantry-sword-hilt'] },
  'elite-teutonic-knight': { kind: 'sword', parts: ['infantry-sword', 'infantry-sword-hilt'] },
  'janissary': { kind: 'hand-cannon', parts: ['archer-cannon-stock', 'archer-cannon-barrel', 'archer-cannon-muzzle'] },
  'elite-janissary': { kind: 'hand-cannon', parts: ['archer-cannon-stock', 'archer-cannon-barrel', 'archer-cannon-muzzle'] },
  'berserk': { kind: 'greatsword', parts: ['infantry-greatsword', 'infantry-greatsword-hilt'] },
  'elite-berserk': { kind: 'greatsword', parts: ['infantry-greatsword', 'infantry-greatsword-hilt'] },
  'turtle-ship': { kind: 'ship-cannon', parts: ['ship-cannon-barrel', 'ship-cannon-muzzle'] },
  'elite-turtle-ship': { kind: 'ship-cannon', parts: ['ship-cannon-barrel', 'ship-cannon-muzzle'] },
  'longboat': { kind: 'ship-bow', parts: ['ship-bow-stave', 'ship-bow-rack-left'] },
  'elite-longboat': { kind: 'ship-bow', parts: ['ship-bow-stave', 'ship-bow-rack-left'] },
} as const satisfies Record<UnitType, WeaponExpectation>;

const UNIT_TYPES = Object.keys(ALL_UNIT_TYPES) as UnitType[];
const GROUND = 0.35;

function unit(entityType: UnitType, isMemory = false): ProjectedEntityView {
  return {
    id: 91,
    generation: 4,
    kind: 'unit',
    layer: 'unit',
    entityType,
    owner: 1,
    x: 4.25,
    y: 6.5,
    elevation: 0,
    tint: 0x3568c0,
    size: 0.72,
    footprintWidth: 1,
    footprintHeight: 1,
    visualVariant: 'default',
    selected: false,
    currentHp: 40,
    maxHp: 40,
    isMemory,
  };
}

function state(overrides: Partial<AoeUnitAnimationState> = {}): AoeUnitAnimationState {
  return {
    mode: 'idle',
    phaseRadians: 0.37,
    gaitPhaseRadians: 0.83,
    locomotionWeight: 0,
    speedWorldUnitsPerSecond: 0,
    directionX: 1,
    directionZ: 0,
    attackPhase: 0,
    attackWeight: 0,
    ambientSuppressionWeight: 0,
    workPhase: 0,
    workWeight: 0,
    targetDistance: 0,
    ...overrides,
  };
}

function suffix(part: VoxelPart): string {
  return part.key.slice(part.key.lastIndexOf(':') + 1);
}

function suffixes(parts: readonly VoxelPart[]): string[] {
  return parts.map(suffix).sort();
}

function requirePart(parts: readonly VoxelPart[], expectedSuffix: string): VoxelPart {
  const match = parts.find((candidate) => suffix(candidate) === expectedSuffix);
  if (!match) throw new Error(`Missing unit part ${expectedSuffix}`);
  return match;
}

function expectMatrixChanged(left: VoxelPart, right: VoxelPart): void {
  expect(matrixForPart(left).some(
    (value, index) => Math.abs(value - matrixForPart(right)[index]!) > 1e-6,
  )).toBe(true);
}

function attachmentDistances(first: VoxelPart, second: VoxelPart): number[] {
  return voxelPartWorldCorners(first).flatMap((a) => voxelPartWorldCorners(second).map((b) => (
    Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z)
  )));
}

function expectSamePoseDelta(
  resting: readonly VoxelPart[],
  impact: readonly VoxelPart[],
  anchorSuffix: string,
  attachmentSuffixes: readonly string[],
): void {
  const beforeAnchor = requirePart(resting, anchorSuffix);
  const afterAnchor = requirePart(impact, anchorSuffix);
  const anchorDelta = {
    x: afterAnchor.centerX - beforeAnchor.centerX,
    y: afterAnchor.centerY - beforeAnchor.centerY,
    z: afterAnchor.centerZ - beforeAnchor.centerZ,
    pitch: (afterAnchor.pitch ?? 0) - (beforeAnchor.pitch ?? 0),
    roll: (afterAnchor.roll ?? 0) - (beforeAnchor.roll ?? 0),
  };
  for (const attachmentSuffix of attachmentSuffixes) {
    const before = requirePart(resting, attachmentSuffix);
    const after = requirePart(impact, attachmentSuffix);
    expect(after.centerX - before.centerX, attachmentSuffix).toBeCloseTo(anchorDelta.x, 6);
    expect(after.centerY - before.centerY, attachmentSuffix).toBeCloseTo(anchorDelta.y, 6);
    expect(after.centerZ - before.centerZ, attachmentSuffix).toBeCloseTo(anchorDelta.z, 6);
    expect((after.pitch ?? 0) - (before.pitch ?? 0), attachmentSuffix).toBeCloseTo(anchorDelta.pitch, 6);
    expect((after.roll ?? 0) - (before.roll ?? 0), attachmentSuffix).toBeCloseTo(anchorDelta.roll, 6);
    expect(after.animation?.translationAmplitude, attachmentSuffix).toEqual({ x: 0, y: 0, z: 0 });
    expect(after.animation?.rotationAmplitude, attachmentSuffix).toEqual({ x: 0, y: 0, z: 0 });
    expect(after.animation?.scaleAmplitude, attachmentSuffix).toEqual({ x: 0, y: 0, z: 0 });
  }
}

describe('concrete unit visual recipes', () => {
  it('gives every UnitType its independently expected weapon compound', () => {
    const missing = UNIT_TYPES.flatMap((unitType) => {
      const actual = new Set(suffixes(createUnitParts(unit(unitType), `weapon:${unitType}`, GROUND, state())));
      return WEAPONS[unitType].parts
        .filter((partName) => !actual.has(partName))
        .map((partName) => `${unitType}:${partName}`);
    });

    expect(missing).toEqual([]);
  });

  it('gives the halberdier a concrete armored polearm signature instead of the infantry fallback', () => {
    const actual = new Set(suffixes(createUnitParts(unit('halberdier'), 'signature:halberdier', GROUND, state())));

    expect([...actual]).toEqual(expect.arrayContaining([
      'infantry-mail-skirt',
      'infantry-polearm-shaft',
      'infantry-halberd-blade',
      'infantry-halberd-hook',
    ]));
    expect(actual.has('infantry-sword')).toBe(false);
    expect(actual.has('infantry-sword-hilt')).toBe(false);
  });

  it('keeps all recipes bounded, deterministic, keyed stably, and memory-safe', () => {
    for (const unitType of UNIT_TYPES) {
      const entity = unit(unitType);
      const identity = `contract:${unitType}`;
      const idle = createUnitParts(entity, identity, GROUND, state());
      const repeat = createUnitParts(entity, identity, GROUND, state());
      const moving = createUnitParts(entity, identity, GROUND, state({
        mode: 'moving',
        locomotionWeight: 0.8,
        speedWorldUnitsPerSecond: 2.4,
      }));
      const attacking = createUnitParts(entity, identity, GROUND, state({
        mode: 'attacking',
        attackPhase: 0.586,
        attackWeight: 1,
        ambientSuppressionWeight: 1,
        targetDistance: 1.25,
      }));
      const memory = createUnitParts(unit(unitType, true), identity, GROUND, state());
      const keys = idle.map((part) => part.key);
      const visible = idle.filter((part) => part.surface !== 'shadow');
      const corners = visible.flatMap(voxelPartWorldCorners);
      const rootX = entity.x + 0.5;
      const rootZ = entity.y + 0.5;

      expect(repeat, unitType).toEqual(idle);
      expect(idle.length, unitType).toBeLessThanOrEqual(32);
      expect(new Set(keys).size, unitType).toBe(keys.length);
      expect(suffixes(moving), unitType).toEqual(suffixes(idle));
      expect(suffixes(attacking), unitType).toEqual(suffixes(idle));
      expect(suffixes(memory), unitType).toEqual(suffixes(visible));
      expect(memory.every((part) => part.surface === 'memory' && part.animation === undefined), unitType).toBe(true);
      expect(idle.flatMap(matrixForPart).every(Number.isFinite), unitType).toBe(true);
      expect(corners.flatMap(({ x, y, z }) => [x, y, z]).every(Number.isFinite), unitType).toBe(true);
      expect(Math.min(...corners.map(({ y }) => y)), unitType).toBeGreaterThanOrEqual(GROUND - 0.15);
      expect(Math.min(...corners.map(({ y }) => y)), unitType).toBeLessThanOrEqual(GROUND + 0.08);
      expect(Math.max(...corners.map(({ y }) => y)), unitType).toBeLessThanOrEqual(GROUND + 2.6);
      expect(Math.max(...corners.map(({ x, z }) => Math.hypot(x - rootX, z - rootZ))), unitType).toBeLessThanOrEqual(1.75);
    }
  });

  it('keeps malformed legacy unit projections shadow-only during an active attack pose', () => {
    const malformed = { ...unit('villager'), entityType: 'grass' } as ProjectedEntityView;
    const parts = createUnitParts(malformed, 'malformed:attack', GROUND, state({
      mode: 'attacking',
      attackPhase: 0.586,
      attackWeight: 1,
      ambientSuppressionWeight: 1,
      targetDistance: 1.25,
    }));

    expect(suffixes(parts)).toEqual(['unit-shadow']);
    expect(parts[0]?.animation).toBeUndefined();
  });

  it.each([
    ['armored infantry', 'champion', 'infantry-tunic', [
      'infantry-belt', 'infantry-head', 'infantry-helmet', 'infantry-helmet-crest',
      'infantry-mail-skirt', 'infantry-breastplate', 'infantry-pauldrons',
      'detail-champion-gold-pauldrons',
    ]],
    ['armored rider', 'knight', 'cavalry-rider-tunic', [
      'cavalry-rider-head', 'cavalry-rider-helmet', 'cavalry-rider-mail',
    ]],
  ] as const)('keeps %s body detail attached and attack-suppressed', (
    _label, unitType, anchorSuffix, attachmentSuffixes,
  ) => {
    const entity = unit(unitType);
    const identity = `body-attachment:${unitType}`;
    const resting = createUnitParts(entity, identity, GROUND, state());
    const impact = createUnitParts(entity, identity, GROUND, state({
      mode: 'attacking', attackPhase: 0.586, attackWeight: 1,
      ambientSuppressionWeight: 1, targetDistance: 1.25,
    }));

    expectSamePoseDelta(resting, impact, anchorSuffix, attachmentSuffixes);
  });

  it('keeps the spear shield attached to the left arm through target-reach correction', () => {
    const entity = unit('spearman');
    const resting = createUnitParts(entity, 'shield-reach:spearman', GROUND, state());
    const impact = createUnitParts(entity, 'shield-reach:spearman', GROUND, state({
      mode: 'attacking', attackPhase: 0.586, attackWeight: 1,
      ambientSuppressionWeight: 1, targetDistance: 1.9,
    }));
    const beforeArm = requirePart(resting, 'infantry-arm-left');
    const afterArm = requirePart(impact, 'infantry-arm-left');
    const armDelta = {
      x: afterArm.centerX - beforeArm.centerX,
      y: afterArm.centerY - beforeArm.centerY,
      z: afterArm.centerZ - beforeArm.centerZ,
    };

    for (const shieldSuffix of ['infantry-shield', 'infantry-shield-boss']) {
      const before = requirePart(resting, shieldSuffix);
      const after = requirePart(impact, shieldSuffix);
      expect(after.centerX - before.centerX, shieldSuffix).toBeCloseTo(armDelta.x, 6);
      expect(after.centerY - before.centerY, shieldSuffix).toBeCloseTo(armDelta.y, 6);
      expect(after.centerZ - before.centerZ, shieldSuffix).toBeCloseTo(armDelta.z, 6);
    }
  });
});

const HUMANOID_PLANT = ['infantry-boot-left', 'infantry-boot-right'] as const;
const ARCHER_PLANT = ['archer-boot-left', 'archer-boot-right'] as const;
const HORSE_PLANT = ['cavalry-horse-leg-front-left', 'cavalry-horse-leg-front-right', 'cavalry-horse-leg-back-left', 'cavalry-horse-leg-back-right'] as const;
const SIEGE_PLANT = ['siege-wheel-left', 'siege-wheel-right'] as const;

const ATTACK_CASES = [
  ['villager chop', 'villager', 'villager-tool-head', ['villager-boot-left', 'villager-boot-right'], ['villager-tool-handle', 'villager-tool-head']],
  ['sword slash', 'militia', 'infantry-sword', HUMANOID_PLANT, ['infantry-sword', 'infantry-sword-hilt']],
  ['greatsword slash', 'champion', 'infantry-greatsword', HUMANOID_PLANT, ['infantry-greatsword', 'infantry-greatsword-hilt']],
  ['polearm thrust', 'halberdier', 'infantry-halberd-blade', HUMANOID_PLANT, ['infantry-polearm-shaft', 'infantry-halberd-blade']],
  ['bow release', 'archer', 'archer-bow-upper', ARCHER_PLANT, ['archer-bow-upper', 'archer-bow-lower']],
  ['crossbow recoil', 'arbalest', 'archer-crossbow-bow', ARCHER_PLANT, ['archer-crossbow-stock', 'archer-crossbow-bow']],
  ['javelin throw', 'skirmisher', 'archer-javelin-shaft', ARCHER_PLANT, ['archer-javelin-shaft', 'archer-javelin-head']],
  ['mounted sword slash', 'hussar', 'cavalry-sword', HORSE_PLANT, ['cavalry-sword', 'cavalry-sword-hilt']],
  ['mounted polearm thrust', 'heavy-camel', 'cavalry-polearm-shaft', HORSE_PLANT, ['cavalry-polearm-shaft', 'cavalry-polearm-head']],
  ['lance thrust', 'paladin', 'cavalry-lance', HORSE_PLANT, ['cavalry-lance', 'cavalry-lance-tip']],
  ['mounted bow release', 'heavy-cavalry-archer', 'cavalry-archer-bow-upper', HORSE_PLANT, ['cavalry-archer-bow-upper', 'cavalry-archer-bow-lower']],
  ['stone release', 'onager', 'siege-throwing-arm', SIEGE_PLANT, ['siege-throwing-arm', 'siege-bucket']],
  ['scorpion recoil', 'heavy-scorpion', 'siege-scorpion-rail', SIEGE_PLANT, ['siege-scorpion-rail', 'siege-scorpion-bolt']],
  ['ram thrust', 'siege-ram', 'siege-ram-beam', SIEGE_PLANT, ['siege-ram-beam', 'siege-ram-head']],
  ['cannon recoil', 'bombard-cannon', 'siege-cannon-barrel', SIEGE_PLANT, ['siege-cannon-barrel', 'siege-cannon-muzzle']],
  ['trebuchet release', 'trebuchet', 'siege-trebuchet-arm', SIEGE_PLANT, ['siege-trebuchet-arm', 'siege-trebuchet-sling', 'detail-trebuchet-stone-sling']],
] as const satisfies ReadonlyArray<readonly [string, UnitType, string, readonly string[], readonly string[]]>;

describe('concrete unit attack rigs', () => {
  it.each(ATTACK_CASES)('%s moves its attached weapon while its root stays planted', (
    _label, unitType, weaponSuffix, plantedSuffixes, compound,
  ) => {
    const entity = unit(unitType);
    const identity = `attack:${unitType}`;
    const resting = createUnitParts(entity, identity, GROUND, state());
    const impact = createUnitParts(entity, identity, GROUND, state({
      mode: 'attacking', attackPhase: 0.586, attackWeight: 1,
      ambientSuppressionWeight: 1, targetDistance: 1.25,
    }));
    const start = createUnitParts(entity, identity, GROUND, state({
      mode: 'attacking', attackPhase: 0, attackWeight: 1, ambientSuppressionWeight: 1,
    }));
    const end = createUnitParts(entity, identity, GROUND, state({
      mode: 'attacking', attackPhase: 1, attackWeight: 1, ambientSuppressionWeight: 1,
    }));

    expectMatrixChanged(requirePart(impact, weaponSuffix), requirePart(resting, weaponSuffix));
    expect(matrixForPart(requirePart(start, weaponSuffix))).toEqual(matrixForPart(requirePart(resting, weaponSuffix)));
    expect(matrixForPart(requirePart(end, weaponSuffix))).toEqual(matrixForPart(requirePart(resting, weaponSuffix)));
    expect(matrixForPart(requirePart(impact, 'unit-shadow'))).toEqual(matrixForPart(requirePart(resting, 'unit-shadow')));
    for (const planted of plantedSuffixes) {
      expect(matrixForPart(requirePart(impact, planted))).toEqual(matrixForPart(requirePart(resting, planted)));
    }
    for (let first = 0; first < compound.length; first += 1) {
      for (let second = first + 1; second < compound.length; second += 1) {
        const restingDistances = attachmentDistances(
          requirePart(resting, compound[first]!), requirePart(resting, compound[second]!),
        );
        const impactDistances = attachmentDistances(
          requirePart(impact, compound[first]!), requirePart(impact, compound[second]!),
        );
        impactDistances.forEach((distance, index) => expect(distance).toBeCloseTo(restingDistances[index]!, 5));
      }
    }
  });
});

describe('specialized unit adapter parity', () => {
  it.each(['halberdier', 'bombard-cannon'] as const)(
    'presents and picks the exact %s attack recipe',
    (unitType) => {
      const adapter = new AoeVoxelAdapter();
      const entity = {
        ...unit(unitType),
        attackAnimation: { tick: 1, sourceX: 4.25, sourceY: 6.5, targetX: 5.5, targetY: 6.5 },
      };
      const snapshot = adapter.createSnapshot([entity], 100);
      const prepared = adapter.latestHitState()!.entities[0]!;
      const presented = new Map<string, readonly number[]>();
      for (const batch of snapshot.batches) {
        batch.instanceKeys.forEach((key, index) => {
          presented.set(key, Array.from(batch.matrices.slice(index * 16, index * 16 + 16)));
        });
      }

      expect(prepared.parts.map((part) => part.key).sort()).toEqual(
        [...presented.keys()].filter((key) => key.startsWith('91:4:') && !key.endsWith(':unit-shadow')).sort(),
      );
      for (const preparedPart of prepared.parts) {
        const presentedMatrix = presented.get(preparedPart.key);
        const hitMatrix = matrixForPart(preparedPart);
        expect(presentedMatrix).toHaveLength(hitMatrix.length);
        hitMatrix.forEach((value, index) => {
          expect(presentedMatrix![index]).toBeCloseTo(value, 5);
        });
      }
      for (const expectedWeapon of WEAPONS[unitType].parts) {
        expect(prepared.parts.some((part) => suffix(part) === expectedWeapon)).toBe(true);
      }
    },
  );
});
