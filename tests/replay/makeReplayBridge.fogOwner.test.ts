// replay-fog-owner: the replay bridge renders the fog perspective of
// `options.fogOwner` (default: player 1). Motivation: LLM playtest
// campaigns are played by player 2 — under the hardcoded player-1
// projector the agent's base sits in fog and replays are unwatchable.

import { describe, expect, it } from 'vitest';

import { SessionReplayer } from 'civ-engine';
import { recordCommandReplayFixture } from './replayCommandHelpers';
import { createReplayWorldOnly } from '../../src/game/simulation/replay/createReplayWorldOnly';
import { makeReplayBridge } from '../../src/game/simulation/replay/makeReplayBridge';
import { getReplayWorldContext } from '../../src/game/simulation/replay/replayWorldContext';
import {
  type GameCommands,
  type GameEvents,
} from '../../src/game/simulation/bridge/pureHelpers';
import type { SessionBundle } from 'civ-engine';

function openReplayWorld(bundle: SessionBundle<GameEvents, GameCommands>) {
  const replayer = SessionReplayer.fromBundle(bundle, {
    worldFactory: (snapshot) => createReplayWorldOnly(snapshot),
    skipRegistrationCheck: true,
  });
  return replayer.openAt(bundle.metadata.endTick);
}

describe('makeReplayBridge fogOwner', () => {
  it('hides enemy units under player-1 fog by default and reveals them for fogOwner 2', () => {
    const { bundle } = recordCommandReplayFixture();

    // Default perspective (player 1): an owner-2 unit standing on a cell
    // player 1 cannot see must be absent from the projected entities.
    const worldP1 = openReplayWorld(bundle);
    const visibilityP1 = getReplayWorldContext(worldP1)!.visibility;
    const bridgeP1 = makeReplayBridge(worldP1);
    const hiddenFromP1 = bridgeP1.getEconomyState().units.find(
      (unit) =>
        unit.owner === 2
        && !visibilityP1.isVisible(1, Math.floor(unit.x), Math.floor(unit.y)),
    );
    // Fixture sanity: the AI base starts outside player 1's line of sight.
    expect(hiddenFromP1).toBeDefined();
    const renderedP1 = bridgeP1.getRenderState().entities;
    expect(renderedP1.some((entity) => entity.id === hiddenFromP1!.id)).toBe(false);
    expect(bridgeP1.getHudState().visibleEntities).toBe(renderedP1.length);

    // fogOwner 2: the same unit is the agent's own — it must render.
    const worldP2 = openReplayWorld(bundle);
    const bridgeP2 = makeReplayBridge(worldP2, { fogOwner: 2 });
    const renderedP2 = bridgeP2.getRenderState().entities;
    expect(renderedP2.some((entity) => entity.id === hiddenFromP1!.id)).toBe(true);
    expect(bridgeP2.getHudState().visibleEntities).toBe(renderedP2.length);

    // Symmetry: an owner-1 unit standing where player 2 cannot see must
    // now be hidden.
    const visibilityP2 = getReplayWorldContext(worldP2)!.visibility;
    const hiddenFromP2 = bridgeP2.getEconomyState().units.find(
      (unit) =>
        unit.owner === 1
        && !visibilityP2.isVisible(2, Math.floor(unit.x), Math.floor(unit.y)),
    );
    expect(hiddenFromP2).toBeDefined();
    expect(renderedP2.some((entity) => entity.id === hiddenFromP2!.id)).toBe(false);
  });

  it('disposeReplayRenderAdapter disconnects the diff listener (iter-1 leak fix)', () => {
    const { bundle } = recordCommandReplayFixture();
    const world = openReplayWorld(bundle);
    const disposed = makeReplayBridge(world);
    const live = makeReplayBridge(world, { fogOwner: 2 });
    const tickBefore = disposed.getRenderState().tick;

    disposed.disposeReplayRenderAdapter();
    world.step();

    // The disposed bridge's render store froze; the connected one moved.
    expect(disposed.getRenderState().tick).toBe(tickBefore);
    expect(live.getRenderState().tick).toBe(world.tick);
  });

  it('keeps the HUD bound to player 1 regardless of fogOwner (fog toggle, not POV switch)', () => {
    const { bundle } = recordCommandReplayFixture();
    const worldP1 = openReplayWorld(bundle);
    const worldP2 = openReplayWorld(bundle);
    const hudP1 = makeReplayBridge(worldP1).getHudState();
    const hudP2 = makeReplayBridge(worldP2, { fogOwner: 2 }).getHudState();
    expect(hudP2.playerResources).toEqual(hudP1.playerResources);
    expect(hudP2.currentAge).toEqual(hudP1.currentAge);
  });
});
