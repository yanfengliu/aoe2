// Current DE's carrier rule, independent of the old refusal test:
// Update 169123 (2026-02-17), Spanish: Missionary with Relic base speed 0.9;
// the ordinary Missionary remains 1.1. Installed help string 26691 agrees.
// https://www.ageofempires.com/news/age-of-empires-ii-definitive-edition-update-169123/
// BOUND: one open straight walk, 100 ticks, no speed technology in live play;
// pure cases also hold modifier composition and an unchanged loaded Monk.

import { describe, expect, it } from 'vitest';
import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import { monkCarriedRelicCodec } from '../../src/game/simulation/bridge/bridgeStateSerialize';
import { MISSIONARY_CARRIED_RELIC_SEED } from '../../src/game/simulation/fixtures/monkRelics';
import { movementSpeedPercent } from '../../src/game/simulation/movementTechEffects';
import type { ResearchableTechnologyType, UnitTransformComponent } from '../../src/game/simulation/types';
import { stepBridgeUntil } from './createSimulationBridge.helpers';

type Bridge = ReturnType<typeof createSimulationBridge>;

function setUp(carrying: boolean) {
  const bridge = createSimulationBridge(MISSIONARY_CARRIED_RELIC_SEED, { renderProjection: 'on-read' });
  const missionary = bridge.getEconomyState().units.find((unit) => unit.unitType === 'missionary')!;
  expect(bridge.selectEntityById(missionary.id)).toBe(true);
  if (carrying) {
    const relic = bridge.getEconomyState().resources.find((resource) => resource.resourceType === 'relic')!;
    expect(bridge.issueContextCommandAtEntity(relic.id)).toBe(true);
    expect(stepBridgeUntil(bridge, () => monkCarriedRelicCodec.deserialize(
      bridge.world.getState(monkCarriedRelicCodec.slot) as Array<[number, number]> | undefined,
    ).get(missionary.id) === relic.id, { maxSteps: 100 }), 'the Missionary never picked up its relic').toBe(true);
  }
  return { bridge, id: missionary.id };
}

function walk(bridge: Bridge, id: number, ticks = 100): { distance: number; carry: number | undefined } {
  const start = bridge.world.getComponent<UnitTransformComponent>(id, 'unitTransform')!;
  expect(bridge.selectEntityById(id)).toBe(true);
  expect(bridge.issueMoveCommand(14, 10)).toBe(true);
  for (let tick = 0; tick < ticks; tick += 1) bridge.step(100);
  const end = bridge.world.getComponent<UnitTransformComponent>(id, 'unitTransform')!;
  return { distance: Math.abs(end.fineX - start.fineX) + Math.abs(end.fineY - start.fineY), carry: end.moveCarryHundredths };
}

describe('a Missionary carries a relic at current DE speed', () => {
  it('uses a 0.9 base only while carrying, with the existing speed technologies on top', () => {
    const none = new Set<ResearchableTechnologyType>();
    expect(movementSpeedPercent(none, 'missionary', 'Spanish', 'castle-age', false)).toBe(137);
    expect(movementSpeedPercent(none, 'missionary', 'Spanish', 'castle-age', true)).toBe(112);
    expect(movementSpeedPercent(new Set(['husbandry']), 'missionary', 'Spanish', 'castle-age', true)).toBe(123);
    expect(movementSpeedPercent(new Set(['fervor', 'husbandry']), 'missionary', 'Spanish', 'castle-age', true)).toBe(142);
    expect(movementSpeedPercent(none, 'monk', 'Spanish', 'castle-age', true)).toBe(87);
  });

  it('walks about nine tiles in ten game seconds while carrying and eleven without a relic', () => {
    const loaded = setUp(true);
    const empty = setUp(false);
    expect(walk(loaded.bridge, loaded.id).distance).toBeCloseTo(36, 0);
    expect(walk(empty.bridge, empty.id).distance).toBeCloseTo(44, 0);
  });

  it('keeps the carrier speed and fractional movement carry after a save and load', () => {
    const original = setUp(true);
    expect(walk(original.bridge, original.id, 21).carry).toBeGreaterThan(0);
    const blob = original.bridge.saveGame();
    const loaded = createSimulationBridge(MISSIONARY_CARRIED_RELIC_SEED, { savedGame: blob, renderProjection: 'on-read' });
    expect(walk(loaded, original.id)).toEqual(walk(original.bridge, original.id));
  });
});
