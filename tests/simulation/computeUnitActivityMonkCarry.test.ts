// Unit test for the monk carry-fallthrough precedence in
// computeUnitActivity (Phase 1B monk.contextAtEntity impl-8 review fix —
// Codex F1). Verifies the carrying state surfaces only when no explicit
// task or unit command is active.

import { describe, it, expect } from 'vitest';

import { World } from 'civ-engine';
import { computeUnitActivity, type SelectionActivitySources } from '../../src/game/simulation/selectionActivity';
import type {
  GameCommands,
  GameComponents,
  GameEvents,
} from '../../src/game/simulation/bridge/pureHelpers';
import type { UnitComponent } from '../../src/game/simulation/types';

function freshWorld() {
  return new World<GameEvents, GameCommands, GameComponents>({
    gridWidth: 16,
    gridHeight: 16,
    seed: 'test',
    tps: 60,
  });
}

function makeMonk(): UnitComponent {
  return {
    unitType: 'monk',
    owner: 1,
  };
}

function makeSources(overrides: Partial<SelectionActivitySources> = {}): SelectionActivitySources {
  const world = freshWorld();
  return {
    world,
    humanPlayerId: 1,
    unitCommands: new Map(),
    monkTasks: new Map(),
    monkCarriedRelic: new Map(),
    trebuchetPackStates: new Map(),
    productionQueues: new Map(),
    constructionStates: new Map(),
    getCurrentEntityId: () => null,
    ...overrides,
  };
}

describe('computeUnitActivity — monk carry fallthrough precedence', () => {
  it('reports carrying when monk has carried relic + no task + no command', () => {
    const sources = makeSources({
      monkCarriedRelic: new Map([[42, 99]]),
    });
    expect(computeUnitActivity(sources, 42, makeMonk())).toEqual({
      verb: 'carrying',
      target: null,
    });
  });

  it('reports moving when monk has carried relic + active move command (move wins)', () => {
    const sources = makeSources({
      monkCarriedRelic: new Map([[42, 99]]),
      unitCommands: new Map([[42, { type: 'move', target: { x: 0, y: 0 } }]]),
    });
    expect(computeUnitActivity(sources, 42, makeMonk())).toEqual({
      verb: 'moving',
      target: null,
    });
  });

  it('reports converting when monk has carried relic + active convert task (task wins)', () => {
    const sources = makeSources({
      monkCarriedRelic: new Map([[42, 99]]),
      monkTasks: new Map([[42, { kind: 'convert', targetEntityRef: { id: 7, generation: 0 } }]]),
    });
    expect(computeUnitActivity(sources, 42, makeMonk()).verb).toEqual('converting');
  });

  it('reports idle when monk has no carried relic, no task, no command', () => {
    const sources = makeSources();
    expect(computeUnitActivity(sources, 42, makeMonk())).toEqual({
      verb: 'idle',
      target: null,
    });
  });
});
