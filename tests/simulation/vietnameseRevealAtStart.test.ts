// The Vietnamese reveal happens once, at the start of the match, and is
// measured from the middle of each enemy Town Center (work 117, register
// 2026-10-11). Definitive Edition's own civilization text says "Enemy Town
// Centers are revealed at the start of the game" (SiegeEngineers/aoe2techtree
// at 3bb43b14, DE update 185872: data.json gives the Vietnamese help string
// 120180, and strings.json holds that line).
//
// Until work 117 the reveal stood one radius-5 source on each Town Center's
// top-left cell, so it reached 5 cells past the west and north edges and 2 past
// the east and south. And it ran every time a bridge was built — a fresh match,
// every load and every replay world — so loading a save marked explored the
// ground around Town Centers the enemy had built mid-game, which the start of
// the match never saw.
//
// BOUND: one map (`ai-castle-age-military-fixture`), the human playing the
// Vietnamese against one enemy whose AI is off; one mid-game Town Center, built
// by a villager through the AI's own placement command. The replay half is in
// tests/replay/vietnameseRevealReplay.test.ts.

import { describe, expect, it } from 'vitest';

import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import type { SaveBlobV2 } from '../../src/game/simulation/saveSchema';
import { TIER_3_SLOTS } from '../../src/game/simulation/bridge/bridgeStateSerialize';
import {
  ENEMY_TOWN_CENTER,
  HUMAN,
  MID_GAME_TOWN_CENTER,
  REVEAL_RADIUS,
  REVEAL_SEED,
  TOWN_CENTER_SIZE,
  buildEnemyTownCenterMidGame,
  cellKey,
  cellsWithinOfAnchor,
  cellsWithinOfFootprintCentre,
  createVietnameseMatch,
  exploredCellsInState,
  humanExploredCells,
  humanMemoryIds,
  reachPastEdges,
  saveState,
  sortedCells,
  within,
} from './vietnameseRevealHelpers';

/** Every cell within `margin` of a footprint: the region a test reads. */
function around(anchor: { x: number; y: number }, size: number, margin: number): Set<string> {
  const cells = new Set<string>();
  for (let y = anchor.y - margin; y < anchor.y + size + margin; y += 1) {
    for (let x = anchor.x - margin; x < anchor.x + size + margin; x += 1) cells.add(cellKey(x, y));
  }
  return cells;
}

const ENEMY_BASE = around(ENEMY_TOWN_CENTER, TOWN_CENTER_SIZE, REVEAL_RADIUS + 3);
const MID_GAME_SITE = around(MID_GAME_TOWN_CENTER, TOWN_CENTER_SIZE, REVEAL_RADIUS + 3);

describe('the Vietnamese reveal at the start of a match', () => {
  it('reveals the ground within 5 cells of the middle of the enemy Town Center, as far past every edge', () => {
    const bridge = createVietnameseMatch();
    const known = within(humanExploredCells(bridge), ENEMY_BASE);
    const want = sortedCells(cellsWithinOfFootprintCentre(ENEMY_TOWN_CENTER, TOWN_CENTER_SIZE, REVEAL_RADIUS));
    const reach = reachPastEdges(new Set(known), ENEMY_TOWN_CENTER, TOWN_CENTER_SIZE);
    expect(reach, 'the reveal reaches as far past the east and south edges as past the west and north').toEqual({
      west: 3, east: 3, north: 3, south: 3,
    });
    expect(known).toEqual(want);
  });

  it('shows the enemy Town Center as a fog-memory ghost from the first tick', () => {
    const bridge = createVietnameseMatch();
    bridge.step(100);
    const enemyTownCenter = bridge.getEconomyState().buildings.find(
      (building) => building.owner === 2 && building.buildingType === 'town-center',
    )!;
    expect(humanMemoryIds(bridge.saveGame())).toContain(enemyTownCenter.id);
  });
});

describe('a loaded match keeps the reveal it started with, and gains none', () => {
  it('keeps the start-of-match reveal, ground and ghost, through a save and a load', () => {
    const bridge = createVietnameseMatch();
    bridge.step(100);
    const enemyTownCenter = bridge.getEconomyState().buildings.find(
      (building) => building.owner === 2 && building.buildingType === 'town-center',
    )!;
    const loaded = createSimulationBridge(REVEAL_SEED, { savedGame: structuredClone(bridge.saveGame()) });
    expect(within(humanExploredCells(loaded), ENEMY_BASE)).toEqual(
      sortedCells(cellsWithinOfFootprintCentre(ENEMY_TOWN_CENTER, TOWN_CENTER_SIZE, REVEAL_RADIUS)),
    );
    expect(humanMemoryIds(loaded.saveGame())).toContain(enemyTownCenter.id);
  });

  it('leaves a Town Center the enemy built mid-game unexplored and unremembered when the match is loaded', () => {
    const bridge = createVietnameseMatch();
    const midGameTownCenter = buildEnemyTownCenterMidGame(bridge);
    const wouldReveal = cellsWithinOfFootprintCentre(MID_GAME_TOWN_CENTER, TOWN_CENTER_SIZE, REVEAL_RADIUS);
    const saved = structuredClone(bridge.saveGame());
    expect(
      within(humanExploredCells(bridge), MID_GAME_SITE),
      'the premise: nothing of the human\'s has seen the new Town Center',
    ).toEqual([]);
    expect(humanMemoryIds(saved), 'the premise: the human does not remember it').not.toContain(midGameTownCenter);

    const loaded = createSimulationBridge(REVEAL_SEED, { savedGame: structuredClone(saved) });
    const explored = humanExploredCells(loaded);
    expect(within(explored, wouldReveal), 'the load revealed the mid-game Town Center').toEqual([]);
    const remembered = humanMemoryIds(loaded.saveGame());
    expect(remembered, 'the load remembered the mid-game Town Center').not.toContain(midGameTownCenter);
    // And nothing else either: the human knows exactly the ground it saved,
    // and remembers exactly the buildings it saved.
    expect(sortedCells(explored)).toEqual(sortedCells(exploredCellsInState(saveState(saved), HUMAN)));
    expect(remembered).toEqual(humanMemoryIds(saved));
  });

  it('keeps a save from before work 117 as it was: the old corner-measured reveal, nothing added', () => {
    // Such a save holds the circle the old reveal stood on the Town Center's
    // top-left cell, and loading no longer re-applies any reveal, so that is
    // the ground the player goes on knowing. (The spec states this bound.)
    const bridge = createVietnameseMatch();
    bridge.step(100);
    const saved = structuredClone(bridge.saveGame()) as SaveBlobV2;
    const state = saveState(saved);
    const width = (state[TIER_3_SLOTS.bridgeMeta] as { mapWidth: number }).mapWidth;
    const centred = cellsWithinOfFootprintCentre(ENEMY_TOWN_CENTER, TOWN_CENTER_SIZE, REVEAL_RADIUS);
    const corner = cellsWithinOfAnchor(ENEMY_TOWN_CENTER, REVEAL_RADIUS);
    const units = state[TIER_3_SLOTS.visibility] as { players: Array<[number | string, { explored: number[] }]> };
    const human = units.players.find(([owner]) => owner === HUMAN)![1];
    const toIndex = (cell: string): number => {
      const [x, y] = cell.split(',').map(Number) as [number, number];
      return y * width + x;
    };
    const centredOnly = new Set([...centred].filter((cell) => !corner.has(cell)).map(toIndex));
    human.explored = [...new Set([
      ...human.explored.filter((index) => !centredOnly.has(index)),
      ...[...corner].map(toIndex),
    ])].sort((a, b) => a - b);

    const loaded = createSimulationBridge(REVEAL_SEED, { savedGame: saved });
    expect(within(humanExploredCells(loaded), ENEMY_BASE)).toEqual(sortedCells(corner));
  });
});
