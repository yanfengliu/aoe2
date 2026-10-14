// What the frame draws on unexplored ground blocks a placement there, the way
// it would on explored ground (work 122, review round 1, finding A; spec §12.1;
// Definitive Edition update 50292).
//
// The defect: on an unexplored cell the placement read only the player's own
// claims. But the frame draws another player's building whole once one cell of
// its footprint is seen (renderStateOps, `isFootprintSeen`), and draws a
// remembered building whole from fog memory. So over the unexplored part of an
// enemy House the player could see, the ghost went green, the click was
// accepted, and the villager's arrival cancelled the foundation with "a house
// hidden under the fog of war" — the reviewer's shownForeignProbe and
// shownMemoryProbe on the hidden fixture. DE fixed the same in update 50292
// (2021-07-06): "players could place a foundation on top of other player's
// buildings on the edge of their line of sight".
//
// The remembered half has a second rule: it reads the footprint remembered,
// never the live claims under it, or the ghost would tell the player whether a
// building it cannot see still stands. The third case destroys the remembered
// House in the fog and requires the same refusal, word for word.
//
// The live and remembered halves overlap: fog memory records every building the
// player sees, each tick, so on a bridge that has stepped, either half alone
// refuses the first case. They part before the first step, when the frame draws
// a House the memory pass has not yet run on; the fourth case is that tick.
//
// Bound: the hidden fixture's one enemy House, a 2x2, seen from (21,15) with one
// of its cells explored, then remembered from (19,13); a House ghost at (23,18).
// The open fixture, walked the same way, is the control: nothing stands there.
import { describe, expect, it } from 'vitest';

import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import {
  ENEMY_HOUSE,
  LOOKOUT_CELL,
  UNEXPLORED_PLACEMENT_HIDDEN_SEED,
  UNEXPLORED_PLACEMENT_LOOKOUT_SEED,
  UNEXPLORED_PLACEMENT_OPEN_SEED,
} from '../../src/game/simulation/fixtures/unexploredPlacement';

type Bridge = ReturnType<typeof createSimulationBridge>;
type Cell = { x: number; y: number };

const HUMAN = 1;
const LOOKOUT: Cell = LOOKOUT_CELL;
const WAY_BACK: Cell = { x: 19, y: 13 };
const SITE: Cell = { x: 23, y: 18 };
/** The enemy House's cell the site covers, unexplored from both lookouts. */
const SHARED: Cell = { x: 24, y: 18 };

function humanVillager(bridge: Bridge): number {
  const villager = bridge.getEconomyState().units
    .find((unit) => unit.owner === HUMAN && unit.unitType === 'villager');
  expect(villager, 'the fixture moved: the human has no villager').toBeDefined();
  return villager!.id;
}

function walkTo(bridge: Bridge, villagerId: number, cell: Cell): void {
  expect(bridge.selectUnitsByIds([villagerId])).toBe(true);
  expect(bridge.issueMoveCommand(cell.x, cell.y)).toBe(true);
  const there = (): boolean => bridge.getEconomyState().units
    .some((unit) => unit.id === villagerId && unit.x === cell.x && unit.y === cell.y);
  for (let i = 0; i < 200 && !there(); i += 1) bridge.step(100);
  expect(there(), `the villager never reached (${cell.x},${cell.y})`).toBe(true);
}

function isExplored(bridge: Bridge, cell: Cell): boolean {
  const { width } = bridge.getMapSize();
  return new Set(bridge.getRenderState().frame?.exploredCells ?? []).has(cell.y * width + cell.x);
}

/** How the frame draws the enemy House: live, from memory, or not at all. */
function enemyHouseDrawn(bridge: Bridge): 'live' | 'memory' | 'no' {
  const house = bridge.getRenderState().entities.find((entity) => (
    entity.kind === 'building' && entity.owner === 2 && entity.x === ENEMY_HOUSE.x && entity.y === ENEMY_HOUSE.y
  ));
  if (!house) return 'no';
  return house.isMemory ? 'memory' : 'live';
}

/** The ghost's verdict at the site, and the refusal a click there gets. */
function placeAtSite(bridge: Bridge, villagerId: number): { valid: boolean; message: string } {
  expect(bridge.selectUnitsByIds([villagerId])).toBe(true);
  expect(bridge.beginBuildingPlacement('house')).toBe(true);
  const valid = bridge.getPlacementPreview(SITE.x, SITE.y)?.isValid === true;
  const accepted = bridge.confirmBuildingPlacement(SITE.x, SITE.y);
  const messages: string[] = [];
  for (let message = bridge.consumeCommandRejection(); message !== null; message = bridge.consumeCommandRejection()) {
    messages.push(message);
  }
  expect(accepted, 'the click and the ghost disagree').toBe(valid);
  return { valid, message: messages.join(' | ') };
}

describe('what the frame draws on unexplored ground blocks a placement there (work 122)', () => {
  it('an enemy House drawn because one of its cells is seen refuses a House over its unexplored cells', () => {
    const bridge = createSimulationBridge(UNEXPLORED_PLACEMENT_HIDDEN_SEED);
    const villagerId = humanVillager(bridge);
    walkTo(bridge, villagerId, LOOKOUT);
    expect(enemyHouseDrawn(bridge), 'the premise: the frame draws the House live').toBe('live');
    expect(isExplored(bridge, ENEMY_HOUSE)).toBe(true);
    expect(isExplored(bridge, SHARED), 'the premise: the shared cell is unexplored').toBe(false);
    const { valid, message } = placeAtSite(bridge, villagerId);
    expect(valid, 'the ghost over a House the player can see is green').toBe(false);
    expect(message).toContain(`blocked by a house (building) at (${SHARED.x},${SHARED.y})`);

    // The control: the same walk on the open fixture, where nothing stands there.
    const open = createSimulationBridge(UNEXPLORED_PLACEMENT_OPEN_SEED);
    const openVillager = humanVillager(open);
    walkTo(open, openVillager, LOOKOUT);
    expect(enemyHouseDrawn(open)).toBe('no');
    expect(placeAtSite(open, openVillager).valid).toBe(true);
  });

  it('a House drawn from fog memory refuses a House over its unexplored cells', () => {
    const bridge = createSimulationBridge(UNEXPLORED_PLACEMENT_HIDDEN_SEED);
    const villagerId = humanVillager(bridge);
    walkTo(bridge, villagerId, LOOKOUT);
    walkTo(bridge, villagerId, WAY_BACK);
    expect(enemyHouseDrawn(bridge), 'the premise: the frame draws the House from memory').toBe('memory');
    expect(isExplored(bridge, SHARED)).toBe(false);
    const { valid, message } = placeAtSite(bridge, villagerId);
    expect(valid, 'the ghost over a remembered House is green').toBe(false);
    expect(message).toContain(`blocked by a house (building) at (${SHARED.x},${SHARED.y})`);
  });

  it('a remembered House destroyed in the fog refuses the same, word for word', () => {
    const remembered = (): { bridge: Bridge; villagerId: number } => {
      const bridge = createSimulationBridge(UNEXPLORED_PLACEMENT_HIDDEN_SEED);
      const villagerId = humanVillager(bridge);
      walkTo(bridge, villagerId, LOOKOUT);
      walkTo(bridge, villagerId, WAY_BACK);
      return { bridge, villagerId };
    };
    const standing = remembered();
    const asRemembered = placeAtSite(standing.bridge, standing.villagerId);

    const razed = remembered();
    const houseId = [...razed.bridge.world.query('building', 'position')].find((id) => {
      const position = razed.bridge.world.getComponent<Cell>(id, 'position');
      const building = razed.bridge.world.getComponent<{ owner: number }>(id, 'building');
      return building?.owner === 2 && position?.x === ENEMY_HOUSE.x && position?.y === ENEMY_HOUSE.y;
    });
    expect(houseId, 'the fixture moved: no enemy House').toBeDefined();
    razed.bridge.world.runMaintenance(() => razed.bridge.world.destroyEntity(houseId!));
    razed.bridge.step(100);
    expect(enemyHouseDrawn(razed.bridge), 'the premise: the player still remembers the House').toBe('memory');
    const afterRazing = placeAtSite(razed.bridge, razed.villagerId);
    expect(asRemembered.valid).toBe(false);
    expect(afterRazing).toEqual(asRemembered);
  });

  it('at boot, before fog memory records it, the House the frame draws still refuses', () => {
    const bridge = createSimulationBridge(UNEXPLORED_PLACEMENT_LOOKOUT_SEED);
    const villagerId = humanVillager(bridge);
    expect(bridge.getHudState().tick).toBe(0);
    expect(enemyHouseDrawn(bridge), 'the premise: the frame draws the House live').toBe('live');
    const slot = (bridge.world.getState('aoe2.lastSeenStatic') ?? []) as Array<[number, Array<[number, unknown]>]>;
    const remembered = (slot.find(([owner]) => owner === HUMAN)?.[1] ?? []).map(([id]) => id);
    const house = bridge.getRenderState().entities.find((entity) => (
      entity.kind === 'building' && entity.owner === 2 && entity.x === ENEMY_HOUSE.x && entity.y === ENEMY_HOUSE.y
    ));
    expect(remembered, 'the premise: fog memory has not recorded the House yet').not.toContain(house!.id);
    expect(isExplored(bridge, SHARED)).toBe(false);
    const { valid, message } = placeAtSite(bridge, villagerId);
    expect(valid, 'the ghost over a House the frame draws at boot is green').toBe(false);
    expect(message).toContain(`blocked by a house (building) at (${SHARED.x},${SHARED.y})`);
  });
});
