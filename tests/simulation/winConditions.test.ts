import { describe, expect, it } from 'vitest';

import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import {
  selectOwnedBuildingDirect,
  selectOwnedUnitDirect,
  stepBridgeUntil,
} from './createSimulationBridge.helpers';

type Bridge = ReturnType<typeof createSimulationBridge>;

function findFirstOwnedBuilding(bridge: Bridge, owner: number, buildingType: string) {
  return bridge
    .getEconomyState()
    .buildings.find((building) => building.owner === owner && building.buildingType === buildingType);
}

function countOwnedBuildings(bridge: Bridge, owner: number, buildingType: string): number {
  return bridge
    .getEconomyState()
    .buildings.filter((building) => building.owner === owner && building.buildingType === buildingType)
    .length;
}

describe('Slice 8 Wonder, Relic, Score win conditions', () => {
  describe('Task A — Wonder placement', () => {
    it('exposes Wonder in the villager build menu at Imperial Age', () => {
      const bridge = createSimulationBridge('wonder-imperial-fixture');

      expect(selectOwnedUnitDirect(bridge, 1, 'villager')).toBe(true);
      const buildOptions = bridge.getSelectionState().buildOptions;
      expect(buildOptions).toContain('wonder');
    });

    it('does not expose Wonder in Castle Age', () => {
      const bridge = createSimulationBridge('castle-age-fixture');

      expect(selectOwnedUnitDirect(bridge, 1, 'villager')).toBe(true);
      const buildOptions = bridge.getSelectionState().buildOptions;
      expect(buildOptions).not.toContain('wonder');
    });

    it('only allows one Wonder per owner at a time', () => {
      // This fixture pre-places a completed Wonder plus a villager at
      // Imperial Age. Even though Imperial gate is satisfied, the
      // one-wonder-per-owner cap must hide Wonder from the villager's
      // build options.
      const bridge = createSimulationBridge('wonder-existing-fixture');

      expect(countOwnedBuildings(bridge, 1, 'wonder')).toBe(1);
      expect(selectOwnedUnitDirect(bridge, 1, 'villager')).toBe(true);
      expect(bridge.getSelectionState().buildOptions).not.toContain('wonder');
    });
  });

  describe('Task B — Wonder victory countdown', () => {
    it('awards a Wonder victory when the countdown expires while the Wonder stands', () => {
      const bridge = createSimulationBridge('wonder-short-countdown-fixture');

      // Fixture pre-places a completed Wonder for player 1 with a short
      // countdown override so the test resolves quickly.
      expect(findFirstOwnedBuilding(bridge, 1, 'wonder')).toBeDefined();

      expect(
        stepBridgeUntil(
          bridge,
          () => bridge.getMatchState().outcome !== 'running',
          { maxSteps: 120 },
        ),
      ).toBe(true);

      const matchState = bridge.getMatchState();
      expect(matchState.outcome).toBe('victory');
      expect(matchState.winCondition).toBe('wonder');
    });

    it('does not award Wonder victory when the Wonder is destroyed mid-countdown', () => {
      // Fixture: player 1 has a Wonder with very low HP and a short
      // countdown override. Player 2 has an enemy siege unit standing next
      // to the Wonder that will destroy it before the countdown ends.
      const bridge = createSimulationBridge('wonder-destroyed-fixture');

      expect(findFirstOwnedBuilding(bridge, 1, 'wonder')).toBeDefined();

      // Step past the countdown window. Enemy siege should destroy the
      // Wonder before it expires. The match must remain running.
      for (let index = 0; index < 60; index += 1) {
        bridge.step(100);
      }

      // Wonder should be destroyed.
      expect(findFirstOwnedBuilding(bridge, 1, 'wonder')).toBeUndefined();
      // Match must not have flipped to Wonder victory.
      const matchState = bridge.getMatchState();
      if (matchState.outcome !== 'running') {
        expect(matchState.winCondition).not.toBe('wonder');
      }
    });
  });

  describe('Task C — Relic victory countdown', () => {
    it('awards a Relic victory when one player holds every relic for the countdown', () => {
      const bridge = createSimulationBridge('relic-short-countdown-fixture');

      expect(
        stepBridgeUntil(
          bridge,
          () => bridge.getMatchState().outcome !== 'running',
          { maxSteps: 120 },
        ),
      ).toBe(true);

      const matchState = bridge.getMatchState();
      expect(matchState.outcome).toBe('victory');
      expect(matchState.winCondition).toBe('relic');
    });

    it('does not start a Relic countdown when a live neutral relic remains on the map', () => {
      // Fixture: player 1 has 2 relics in the Monastery, but a third live
      // neutral relic sits on the map. Player 1 does NOT hold every relic,
      // so no relic countdown should ever complete. Well past the short
      // countdown window, match must still be running (or have ended for
      // another reason, but not relic victory).
      const bridge = createSimulationBridge('relic-not-all-held-fixture');

      for (let index = 0; index < 60; index += 1) {
        bridge.step(100);
      }

      const matchState = bridge.getMatchState();
      if (matchState.outcome !== 'running') {
        expect(matchState.winCondition).not.toBe('relic');
      }
    });
  });

  describe('Task D — Score summary', () => {
    it('computes per-owner scores at match end after a conquest victory', () => {
      const bridge = createSimulationBridge('conquest-victory-fixture');

      // Select the human militia at (8, 8) and issue a context command on
      // the enemy house at (10, 8). Mirrors the browser conquest test.
      expect(bridge.selectEntityAtCell(8, 8)).toBe(true);
      expect(bridge.issueContextCommand(10, 8)).toBe(true);

      expect(
        stepBridgeUntil(
          bridge,
          () => bridge.getMatchState().outcome === 'victory',
          { maxSteps: 400 },
        ),
      ).toBe(true);

      const matchState = bridge.getMatchState();
      expect(matchState.outcome).toBe('victory');
      expect(matchState.scores).toBeDefined();
      expect(matchState.scores![1]).toBeGreaterThan(0);
      expect(matchState.scores![2]).toBeGreaterThanOrEqual(0);
    });
  });

  it('exposes Wonder victory condition for the human winner via the HUD match state', () => {
    const bridge = createSimulationBridge('wonder-short-countdown-fixture');

    expect(
      stepBridgeUntil(
        bridge,
        () => bridge.getMatchState().outcome !== 'running',
        { maxSteps: 120 },
      ),
    ).toBe(true);

    const hudState = bridge.getHudState();
    expect(hudState.matchState.outcome).toBe('victory');
    expect(hudState.matchState.winCondition).toBe('wonder');
    expect(hudState.matchState.summary).toMatch(/wonder/i);
  });
});
