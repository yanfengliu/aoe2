import {
  MAP_HEIGHT,
  MAP_WIDTH,
  type PlayerStartSpec,
  type PrototypeScenario,
  type ScenarioSpawnSpec,
} from '../prototypeScenario';
import { createGrassFixtureTerrain, ownedSpawn } from './common';

// Work 132's fixtures (tests/simulation/victoryCountdownLength.test.ts,
// tests/replay/victoryCountdownReplay.test.ts): a Wonder, or every relic in one
// Monastery, that opens its victory clock with NO override, so the clock runs
// the length the rule gives the players seated. The short-countdown fixtures
// override that length to a handful of ticks; these are the ones that do not.
//
// Seeds: `wonder-default-clock-<n>p-fixture` and `relic-default-clock-<n>p-fixture`
// for n = 2..8 players, and the `-2p-atheism-` variants, in which player 2
// starts with Atheism already researched (the extension is the match's, so it
// lengthens the clock of player 1, who holds the Wonder or the relics).
//
// Owner 1 is the human and holds the Wonder (a completed one, so its clock
// opens at seeding) or a Monastery with the map's three relics (the clock opens
// on the first tick). Every other player is a Town Center with no AI, so
// nothing happens in the world and the match ends only by the clock; a Town
// Center keeps a player in the match for conquest.

const SEATS = [2, 3, 4, 5, 6, 7, 8] as const;

/** Town Center anchors, far enough apart that no footprint or vision overlaps. */
const TOWN_CENTERS = [
  { x: 8, y: 8 },
  { x: 28, y: 8 },
  { x: 48, y: 8 },
  { x: 8, y: 28 },
  { x: 28, y: 28 },
  { x: 48, y: 28 },
  { x: 18, y: 18 },
  { x: 38, y: 18 },
] as const;

type ClockKind = 'wonder' | 'relic';

interface ParsedSeed {
  kind: ClockKind;
  players: number;
  atheism: boolean;
}

const SEED_PATTERN = /^(wonder|relic)-default-clock-(\d)p(-atheism)?-fixture$/;

export function victoryClockSeed(kind: ClockKind, players: number, atheism = false): string {
  return `${kind}-default-clock-${String(players)}p${atheism ? '-atheism' : ''}-fixture`;
}

/** Every seed this module answers to. */
export function victoryClockSeeds(): string[] {
  const seeds: string[] = [];
  for (const kind of ['wonder', 'relic'] as const) {
    for (const players of SEATS) seeds.push(victoryClockSeed(kind, players));
    seeds.push(victoryClockSeed(kind, 2, true));
  }
  return seeds;
}

function parseSeed(seed: string): ParsedSeed {
  const match = SEED_PATTERN.exec(seed);
  if (!match) {
    throw new Error(
      `'${seed}' is not a victory-clock fixture seed; expected wonder-default-clock-<2..8>p-fixture, `
      + 'relic-default-clock-<2..8>p-fixture or the -2p-atheism- variant.',
    );
  }
  const players = Number(match[2]);
  if (!SEATS.includes(players as (typeof SEATS)[number])) {
    throw new Error(`'${seed}' seats ${String(players)} players; a victory-clock fixture seats 2 to 8.`);
  }
  return { kind: match[1] as ClockKind, players, atheism: match[3] !== undefined };
}

export function createVictoryClockFixture(seed: string): PrototypeScenario {
  const { kind, players, atheism } = parseSeed(seed);
  const age = kind === 'wonder' ? 'imperial-age' : 'castle-age';
  const starts: PlayerStartSpec[] = [];
  const spawns: ScenarioSpawnSpec[] = [];
  for (let seat = 1; seat <= players; seat += 1) {
    const townCenter = TOWN_CENTERS[seat - 1]!;
    starts.push({
      owner: seat,
      townCenter,
      startingAge: age,
      ...(seat > 1 ? { disableAi: true } : {}),
      ...(atheism && seat === 2 ? { startingResearchedTechnologies: ['atheism' as const] } : {}),
    });
    spawns.push(ownedSpawn('town-center', seat, townCenter.x, townCenter.y, { vision: 7 }));
  }
  spawns.push(
    kind === 'wonder'
      ? ownedSpawn('wonder', 1, 14, 6)
      : ownedSpawn('monastery', 1, 12, 6, { startingRelicsInMonastery: 3 }),
  );
  return {
    seed,
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    terrain: createGrassFixtureTerrain(),
    starts,
    spawns,
  };
}
