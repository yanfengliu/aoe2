// Work 142 M2b-2: the scenario registry lists work 142's fixtures by calling
// `selectionControlsScenarios()` while it is itself being evaluated. A module
// that imports `selectionControls.ts` before anything else (the browser
// selection-controls spec does) evaluates the registry in the middle of an
// import cycle (selectionControls -> prototypeScenario -> scenarioRegistry ->
// fixtures), before `buildingCardKeys.ts` has run, so the function may read only
// literals and function declarations. A const it read there threw "Cannot
// access before initialization" and stopped the whole browser suite from
// loading (the first full gate of M2b-2a). This file imports in that order.

import { selectionControlsScenarios } from '../../src/game/simulation/fixtures/selectionControls';
import { describe, expect, it } from 'vitest';

import { SCENARIO_FACTORIES } from '../../src/game/simulation/prototypeScenario/scenarioRegistry';

describe('work 142 fixtures register whatever loads first', () => {
  it('lists the selection-controls, building-card-keys, building-go-to-keys and selection-cap fixtures', () => {
    expect(selectionControlsScenarios().map(([seed]) => seed))
      .toEqual(['selection-controls-fixture', 'building-card-keys-fixture', 'building-go-to-keys-fixture', 'selection-cap-fixture']);
    expect(SCENARIO_FACTORIES.has('selection-controls-fixture')).toBe(true);
    expect(SCENARIO_FACTORIES.has('building-card-keys-fixture')).toBe(true);
    expect(SCENARIO_FACTORIES.has('building-go-to-keys-fixture')).toBe(true);
    expect(SCENARIO_FACTORIES.has('selection-cap-fixture')).toBe(true);
  });
});
