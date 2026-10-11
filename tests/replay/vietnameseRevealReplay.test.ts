// A replay world never re-applies the Vietnamese reveal (work 117, register
// 2026-10-11). The reveal belongs to the start of the match: the cells it
// explored and the fog-memory entries it wrote are in the recording's state
// (`aoe2.visibility`, `aoe2.lastSeenStatic`), so a world built from any
// snapshot gets them back exactly as recorded. Until work 117 every replay
// world ran the reveal again over the Town Centers standing at its snapshot,
// so a world opened after the enemy had built one mid-game explored ground the
// match never saw, and the replay diverged from its own recording.
//
// BOUND: one map and one mid-game Town Center (tests/simulation/
// vietnameseRevealHelpers.ts), checked through the engine's own replayer —
// `selfCheck` over every recorded segment and `openAt` at snapshot ticks. The
// "recording made before work 117" is a doctored recording: its first snapshot
// holds the old corner-measured reveal in place of the centred one. No
// recording made by an older build is committed.

import { SessionRecorder, SessionReplayer, type SessionBundle } from 'civ-engine';
import { describe, expect, it } from 'vitest';

import type { GameCommands, GameEvents, GameWorld } from '../../src/game/simulation/bridge/pureHelpers';
import { TIER_3_SLOTS } from '../../src/game/simulation/bridge/bridgeStateSerialize';
import { createReplayWorldOnly } from '../../src/game/simulation/replay/createReplayWorldOnly';
import { getReplayWorldContext } from '../../src/game/simulation/replay/replayWorldContext';
import type { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import {
  ENEMY_TOWN_CENTER,
  HUMAN,
  MID_GAME_TOWN_CENTER,
  REVEAL_RADIUS,
  TOWN_CENTER_SIZE,
  buildEnemyTownCenterMidGame,
  cellKey,
  cellsWithinOfAnchor,
  cellsWithinOfFootprintCentre,
  createVietnameseMatch,
  exploredCellsInState,
  sortedCells,
  within,
} from '../simulation/vietnameseRevealHelpers';

type Bridge = ReturnType<typeof createSimulationBridge>;
type Bundle = SessionBundle<GameEvents, GameCommands>;
type SnapshotState = { state: Record<string, unknown> };

function record(bridge: Bridge, snapshotInterval: number | null, play: () => void): Bundle {
  const recorder = new SessionRecorder({
    world: bridge.world,
    snapshotInterval,
    terminalSnapshot: true,
    sourceKind: 'session',
    sourceLabel: 'vietnamese-reveal-replay-test',
  });
  recorder.connect();
  try {
    play();
  } finally {
    recorder.disconnect();
  }
  return recorder.toBundle() as unknown as Bundle;
}

function replayerFor(bundle: Bundle) {
  return SessionReplayer.fromBundle(bundle, {
    worldFactory: (snapshot) => createReplayWorldOnly(snapshot),
    skipRegistrationCheck: true,
  });
}

/** The human's explored cells in a replay world, read from its live map. */
function exploredInReplayWorld(world: GameWorld): Set<string> {
  const context = getReplayWorldContext(world);
  if (!context) throw new Error('The replay world carries no replay context, so its visibility map cannot be read.');
  return new Set(context.visibility.getExploredCells(HUMAN).map(({ x, y }) => cellKey(x, y)));
}

describe('a replay world keeps the Vietnamese reveal its recording holds', () => {
  it('re-simulates a match in which the enemy built a Town Center mid-game without diverging', () => {
    const bridge = createVietnameseMatch();
    const bundle = record(bridge, 400, () => {
      buildEnemyTownCenterMidGame(bridge);
      for (let tick = 0; tick < 20; tick += 1) bridge.step(100);
    });
    const replayer = replayerFor(bundle);

    // Opened at the last snapshot, after the new Town Center stood: the world
    // knows exactly the ground the recording says the human knew there.
    const lastTick = bundle.snapshots.at(-1)!.tick;
    const lastSnapshot = bundle.snapshots.at(-1)!.snapshot as unknown as SnapshotState;
    const recorded = exploredCellsInState(lastSnapshot.state, HUMAN);
    const wouldReveal = cellsWithinOfFootprintCentre(MID_GAME_TOWN_CENTER, TOWN_CENTER_SIZE, REVEAL_RADIUS);
    expect(within(recorded, wouldReveal), 'the premise: the match never saw the new Town Center').toEqual([]);
    const replayed = exploredInReplayWorld(replayer.openAt(lastTick));
    expect(within(replayed, wouldReveal), 'the replay world revealed the mid-game Town Center').toEqual([]);
    expect(sortedCells(replayed)).toEqual(sortedCells(recorded));

    // And every recorded segment re-simulates to the next snapshot exactly,
    // visibility and fog memory included.
    const checked = replayer.selfCheck();
    expect(checked.ok, JSON.stringify(checked.stateDivergences.map((divergence) => ({
      from: divergence.fromTick, to: divergence.toTick, path: divergence.firstDifferingPath,
    })))).toBe(true);
    expect(checked.checkedSegments).toBeGreaterThan(2);
  }, 60_000);

  it('opens a recording made before work 117 with the corner-measured reveal it holds, and nothing added', () => {
    const bridge = createVietnameseMatch();
    const bundle = record(bridge, null, () => {
      for (let tick = 0; tick < 5; tick += 1) bridge.step(100);
    });
    // Such a recording's first snapshot holds the circle the old reveal stood
    // on the Town Center's top-left cell.
    const snapshot = bundle.initialSnapshot as unknown as SnapshotState;
    const width = (snapshot.state[TIER_3_SLOTS.bridgeMeta] as { mapWidth: number }).mapWidth;
    const toIndex = (cell: string): number => {
      const [x, y] = cell.split(',').map(Number) as [number, number];
      return y * width + x;
    };
    const centred = cellsWithinOfFootprintCentre(ENEMY_TOWN_CENTER, TOWN_CENTER_SIZE, REVEAL_RADIUS);
    const corner = cellsWithinOfAnchor(ENEMY_TOWN_CENTER, REVEAL_RADIUS);
    const centredOnly = new Set([...centred].filter((cell) => !corner.has(cell)).map(toIndex));
    const units = snapshot.state[TIER_3_SLOTS.visibility] as { players: Array<[number | string, { explored: number[] }]> };
    const human = units.players.find(([owner]) => owner === HUMAN)![1];
    human.explored = [...new Set([
      ...human.explored.filter((index) => !centredOnly.has(index)),
      ...[...corner].map(toIndex),
    ])].sort((a, b) => a - b);
    const recorded = exploredCellsInState(snapshot.state, HUMAN);

    const replayed = exploredInReplayWorld(replayerFor(bundle).openAt(bundle.metadata.startTick));
    expect(within(replayed, centred)).toEqual(within(recorded, centred));
    expect(sortedCells(replayed)).toEqual(sortedCells(recorded));
  });
});
