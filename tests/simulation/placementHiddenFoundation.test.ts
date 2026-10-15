// What the frame hides on unexplored ground does not decide a placement there
// either (work 122 with work 121; spec §12.1, §12.2).
//
// Work 122 counts on an unexplored cell what the frame draws there: anyone
// else's building once one cell of it is seen, and buildings from fog memory
// (placementDrawnClaims.test.ts). Work 121 stopped the frame drawing an enemy's
// foundation nobody has started building, however much of it is lit, live or
// from memory (unstartedFoundations.ts, Definitive Edition update 61321 and
// forum report 199626). Counted anyway, such a foundation would turn the ghost
// red over unexplored ground the moment one of its cells is lit, and the ghost
// would show what the frame hides. So the verdict over its unexplored cells
// must be the same with the foundation as without it.
//
// The first case is the live half, at boot on the lookout layout with the
// enemy House an unstarted foundation: every footprint that covers one of its
// unexplored cells, and none of its explored ones, gets the same verdict before
// and after the foundation is removed. The second is the memory half: an older
// save that remembers the foundation is loaded, and before the first tick,
// while that entry is still held, the verdicts match a save without it. The
// third is the start check (update 46295): a House the player places over the
// foundation's unexplored cell is cancelled when its villager arrives, since
// the ground is not clear, and the message names nothing the frame does not
// draw (review round 2: it named "a house (building) at (24,18)").
//
// Since work 126 the same holds over the foundation's lit, explored cell: an
// enemy's foundation nobody has started refuses nothing the player places
// (update 185872, foundationClaims.ts), so the fourth case compares footprints
// over that cell with and without it too.
//
// Bound: one 2x2 foundation, one lit cell of it, House and Barracks footprints
// near it, at boot.
import { describe, expect, it } from 'vitest';

import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import { lastSeenStaticCodec } from '../../src/game/simulation/bridge/bridgeStateSerialize';
import { buildingFootprint } from '../../src/game/simulation/bridge/pureHelpers';
import {
  ENEMY_HOUSE,
  UNEXPLORED_PLACEMENT_LOOKOUT_FOUNDATION_SEED,
  UNEXPLORED_PLACEMENT_LOOKOUT_SEED,
} from '../../src/game/simulation/fixtures/unexploredPlacement';
import type { BuildableBuildingType, ProjectedEntityView } from '../../src/game/simulation/types';
import { asSchema2Blob, worldStateOf } from './saveBlobTestUtils';

type Bridge = ReturnType<typeof createSimulationBridge>;
type Cell = { x: number; y: number };
type SerializedMemory = Array<[number, Array<[number, Record<string, unknown>]>]>;

const HUMAN = 1;
const TYPES: readonly BuildableBuildingType[] = ['house', 'barracks'];

function humanVillager(bridge: Bridge): number {
  const villager = bridge.getEconomyState().units
    .find((unit) => unit.owner === HUMAN && unit.unitType === 'villager');
  expect(villager, 'the fixture moved: the human has no villager').toBeDefined();
  return villager!.id;
}

function enemyBuildingAt(bridge: Bridge, cell: Cell): number {
  const id = [...bridge.world.query('building', 'position')].find((candidate) => {
    const position = bridge.world.getComponent<Cell>(candidate, 'position');
    const building = bridge.world.getComponent<{ owner: number }>(candidate, 'building');
    return building?.owner === 2 && position?.x === cell.x && position?.y === cell.y;
  });
  expect(id, 'the fixture moved: no enemy building at the House').toBeDefined();
  return id!;
}

function exploredCells(bridge: Bridge): Set<number> {
  return new Set(bridge.getRenderState().frame?.exploredCells ?? []);
}

/** Footprints that cover an unexplored cell of the foundation, none of its
 *  explored ones, and at least one explored cell; or, with `overLit`, footprints
 *  that cover one of its explored cells. */
function probes(bridge: Bridge, overLit = false): Array<{ type: BuildableBuildingType; anchor: Cell }> {
  const { width } = bridge.getMapSize();
  const explored = exploredCells(bridge);
  const known = (x: number, y: number): boolean => explored.has(y * width + x);
  const onFoundation = (x: number, y: number): boolean => (
    x >= ENEMY_HOUSE.x && x < ENEMY_HOUSE.x + 2 && y >= ENEMY_HOUSE.y && y < ENEMY_HOUSE.y + 2
  );
  const out: Array<{ type: BuildableBuildingType; anchor: Cell }> = [];
  for (const type of TYPES) {
    const footprint = buildingFootprint(type);
    for (let y = ENEMY_HOUSE.y - 3; y <= ENEMY_HOUSE.y + 2; y += 1) {
      for (let x = ENEMY_HOUSE.x - 3; x <= ENEMY_HOUSE.x + 2; x += 1) {
        let coversHidden = false;
        let coversLit = false;
        let anyKnown = false;
        for (let cellY = y; cellY < y + footprint.height; cellY += 1) {
          for (let cellX = x; cellX < x + footprint.width; cellX += 1) {
            if (known(cellX, cellY)) anyKnown = true;
            if (!onFoundation(cellX, cellY)) continue;
            if (known(cellX, cellY)) coversLit = true;
            else coversHidden = true;
          }
        }
        if (overLit ? coversLit : coversHidden && !coversLit && anyKnown) out.push({ type, anchor: { x, y } });
      }
    }
  }
  return out;
}

/** The ghost's verdict on each probe: valid or refused. The refusal's words over
 *  an enemy's hidden foundation are unbuiltFoundationPlacement.test.ts's. */
function verdicts(bridge: Bridge, villagerId: number, cases: ReturnType<typeof probes>): string[] {
  return cases.map(({ type, anchor }) => {
    expect(bridge.selectUnitsByIds([villagerId])).toBe(true);
    expect(bridge.beginBuildingPlacement(type)).toBe(true);
    const valid = bridge.getPlacementPreview(anchor.x, anchor.y)?.isValid === true;
    return `${type} at (${anchor.x},${anchor.y}): ${valid ? 'valid' : 'refused'}`;
  });
}

describe('an enemy foundation the frame hides decides nothing on unexplored ground (works 121 and 122)', () => {
  it('a foundation nobody has started, one cell of it lit, gives every footprint over its unexplored cells the same verdict as no foundation', () => {
    const bridge = createSimulationBridge(UNEXPLORED_PLACEMENT_LOOKOUT_FOUNDATION_SEED);
    const villagerId = humanVillager(bridge);
    const foundationId = enemyBuildingAt(bridge, ENEMY_HOUSE);
    expect(bridge.getEconomyState().buildings.find((b) => b.id === foundationId)?.buildProgressTicks ?? 0,
      'the premise: nobody has started it').toBe(0);
    expect(bridge.getRenderState().entities.some((e) => e.id === foundationId), 'the premise: the frame hides it').toBe(false);
    const { width } = bridge.getMapSize();
    expect(exploredCells(bridge).has(ENEMY_HOUSE.y * width + ENEMY_HOUSE.x), 'the premise: a cell of it is lit').toBe(true);
    const cases = probes(bridge);
    expect(cases.length, 'too few footprints over the foundation to say anything').toBeGreaterThan(3);
    const withFoundation = verdicts(bridge, villagerId, cases);
    bridge.world.runMaintenance(() => bridge.world.destroyEntity(foundationId));
    expect(verdicts(bridge, villagerId, cases)).toEqual(withFoundation);
    // And the comparison can fail: the same footprints over the drawn House refuse.
    const drawn = createSimulationBridge(UNEXPLORED_PLACEMENT_LOOKOUT_SEED);
    expect(verdicts(drawn, humanVillager(drawn), cases).filter((line) => line.endsWith('refused')).length)
      .toBe(cases.length);
  });

  it('over its lit, explored cell too, every footprint gets the verdict it would get without it (work 126)', () => {
    const bridge = createSimulationBridge(UNEXPLORED_PLACEMENT_LOOKOUT_FOUNDATION_SEED);
    const villagerId = humanVillager(bridge);
    const foundationId = enemyBuildingAt(bridge, ENEMY_HOUSE);
    const cases = probes(bridge, true);
    expect(cases.length, 'too few footprints over the lit cell to say anything').toBeGreaterThan(3);
    const withFoundation = verdicts(bridge, villagerId, cases);
    bridge.world.runMaintenance(() => bridge.world.destroyEntity(foundationId));
    expect(verdicts(bridge, villagerId, cases)).toEqual(withFoundation);
    // And the comparison can fail: the same footprints over the drawn House refuse.
    const drawn = createSimulationBridge(UNEXPLORED_PLACEMENT_LOOKOUT_SEED);
    expect(verdicts(drawn, humanVillager(drawn), cases).filter((line) => line.endsWith('refused')).length)
      .toBe(cases.length);
  });

  it('an older save that remembers the foundation gives the same verdicts before its first tick', () => {
    // The entry is built from how the same House is drawn when it is finished.
    const drawn = createSimulationBridge(UNEXPLORED_PLACEMENT_LOOKOUT_SEED);
    const view = drawn.getRenderState().entities.find((entity) => entity.id === enemyBuildingAt(drawn, ENEMY_HOUSE));
    expect(view, 'the premise: the finished House is drawn').toBeDefined();
    const entryFrom = (source: ProjectedEntityView, generation: number): Record<string, unknown> => ({
      kind: 'building',
      entityType: source.entityType,
      ...(source.architecture ? { architecture: source.architecture } : {}),
      generation,
      position: { x: source.x, y: source.y },
      footprintWidth: source.footprintWidth,
      footprintHeight: source.footprintHeight,
      tint: source.tint,
      owner: source.owner,
      size: source.size,
      visualVariant: source.visualVariant,
    });

    const plain = createSimulationBridge(UNEXPLORED_PLACEMENT_LOOKOUT_FOUNDATION_SEED);
    const foundationId = enemyBuildingAt(plain, ENEMY_HOUSE);
    const blob = asSchema2Blob(plain.saveGame());
    const state = worldStateOf(blob);
    const memory = new Map((state[lastSeenStaticCodec.slot] ?? []) as SerializedMemory);
    const human = new Map(memory.get(HUMAN) ?? []);
    human.set(foundationId, entryFrom(view!, plain.world.getEntityGeneration(foundationId)));
    memory.set(HUMAN, [...human]);
    state[lastSeenStaticCodec.slot] = [...memory];
    const loaded = createSimulationBridge(UNEXPLORED_PLACEMENT_LOOKOUT_FOUNDATION_SEED, { savedGame: blob });
    const held = (loaded.world.getState(lastSeenStaticCodec.slot) ?? []) as SerializedMemory;
    expect(new Map(held.find(([owner]) => owner === HUMAN)?.[1] ?? []).has(foundationId),
      'the premise: the save carries the entry').toBe(true);
    expect(loaded.getRenderState().entities.some((e) => e.id === foundationId), 'the premise: the frame hides it').toBe(false);

    const cases = probes(plain);
    expect(cases.length).toBeGreaterThan(3);
    expect(verdicts(loaded, humanVillager(loaded), cases)).toEqual(verdicts(plain, humanVillager(plain), cases));
  });

  it('a House placed over it is cancelled on arrival, and the message names nothing the frame hides', () => {
    const bridge = createSimulationBridge(UNEXPLORED_PLACEMENT_LOOKOUT_FOUNDATION_SEED);
    const villagerId = humanVillager(bridge);
    const foundationId = enemyBuildingAt(bridge, ENEMY_HOUSE);
    const site: Cell = { x: 23, y: 18 };
    expect(bridge.selectUnitsByIds([villagerId])).toBe(true);
    expect(bridge.beginBuildingPlacement('house')).toBe(true);
    expect(bridge.getPlacementPreview(site.x, site.y)?.isValid, 'the premise: the ghost is green').toBe(true);
    expect(bridge.confirmBuildingPlacement(site.x, site.y)).toBe(true);
    const messages: string[] = [];
    for (let i = 0; i < 300 && !messages.some((message) => message.includes('cancelled')); i += 1) {
      bridge.step(100);
      for (let message = bridge.consumeCommandRejection(); message !== null; message = bridge.consumeCommandRejection()) {
        messages.push(message);
      }
    }
    const toast = messages.find((message) => message.includes('cancelled'));
    expect(toast, 'the start check never cancelled the House over the foundation').toBeDefined();
    expect(bridge.getRenderState().entities.some((e) => e.id === foundationId), 'the premise: the frame still hides it').toBe(false);
    // It may name another blocker the player now sees (the fixture hides
    // forest beside it), never the foundation the frame does not draw.
    expect(toast).not.toContain('house (building)');
    expect(toast).not.toContain('(24,18)');
  });
});
