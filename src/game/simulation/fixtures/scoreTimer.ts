import {
  MAP_HEIGHT,
  MAP_WIDTH,
  type PrototypeScenario,
} from '../prototypeScenario';
import { createGrassFixtureTerrain, ownedSpawn } from './common';

// Score-timer victory fixtures (spec §4.3). Every fixture sets a short
// `gameLength` and gives each player a Town Center, so no player is
// eliminated and conquest never fires — the match can only end via the
// score timer. Spawns increment the produced counters, so entity count
// drives each player's score: TC = +50, villager = +10, house = +50.
//
// Three fixtures exercise the human's three outcome branches:
//   victory-fixture  P1 sole top   (P1 180 > P2 50)
//   draw-fixture     P1 tied top   (P1 180 == P2 180)
//   defeat-fixture   P1 not top    (P1 50 < P3 100 < P2 180), 3 players

interface PlayerLoadout {
  owner: number;
  villagers: number;
  houses: number;
}

// Fixed per-player anchor blocks, well separated and inside the 60x36 map.
const ANCHORS: Record<
  number,
  { tc: { x: number; y: number }; row: number; houseRow: number; x0: number }
> = {
  1: { tc: { x: 6, y: 6 }, row: 10, houseRow: 12, x0: 10 },
  2: { tc: { x: 48, y: 6 }, row: 10, houseRow: 12, x0: 44 },
  3: { tc: { x: 28, y: 28 }, row: 32, houseRow: 34, x0: 24 },
};

function buildScenario(
  seed: string,
  gameLength: number,
  loadouts: PlayerLoadout[],
): PrototypeScenario {
  const spawns: PrototypeScenario['spawns'] = [];
  for (const { owner, villagers, houses } of loadouts) {
    const anchor = ANCHORS[owner];
    spawns.push(ownedSpawn('town-center', owner, anchor.tc.x, anchor.tc.y, { vision: 7 }));
    for (let i = 0; i < villagers; i += 1) {
      spawns.push(ownedSpawn('villager', owner, anchor.x0 + i, anchor.row, { vision: 4 }));
    }
    for (let i = 0; i < houses; i += 1) {
      spawns.push(ownedSpawn('house', owner, anchor.x0 + i * 3, anchor.houseRow, { vision: 3 }));
    }
  }
  return {
    seed,
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    terrain: createGrassFixtureTerrain(),
    gameLength,
    starts: loadouts.map(({ owner }) => ({
      owner,
      townCenter: ANCHORS[owner].tc,
      disableAi: true,
    })),
    spawns,
  };
}

// P1 sole top: TC + 3 villagers + 2 houses = 180 vs P2 TC = 50 -> victory.
export function createScoreTimerVictoryFixture(seed: string): PrototypeScenario {
  return buildScenario(seed, 30, [
    { owner: 1, villagers: 3, houses: 2 },
    { owner: 2, villagers: 0, houses: 0 },
  ]);
}

// P1 tied for top: both players 180 -> draw (human tied at the top score).
export function createScoreTimerDrawFixture(seed: string): PrototypeScenario {
  return buildScenario(seed, 30, [
    { owner: 1, villagers: 3, houses: 2 },
    { owner: 2, villagers: 3, houses: 2 },
  ]);
}

// P1 not top in a 3-player game: P1 50 < P3 100 < P2 180 -> defeat.
export function createScoreTimerDefeatFixture(seed: string): PrototypeScenario {
  return buildScenario(seed, 30, [
    { owner: 1, villagers: 0, houses: 0 },
    { owner: 2, villagers: 3, houses: 2 },
    { owner: 3, villagers: 0, houses: 1 },
  ]);
}
