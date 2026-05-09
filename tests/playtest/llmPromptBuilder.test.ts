import { describe, it, expect } from 'vitest';
import {
  buildCommandToolSchemas,
  buildStrategyPrompt,
  buildStrategyToolSchema,
  buildTacticalPrompt,
  fromToolName,
  toToolName,
} from '../../src/game/playtest/llmPromptBuilder';
import type { AgentStateSnapshot } from '../../src/game/playtest/types';

const SNAPSHOT: AgentStateSnapshot = {
  tick: 1500,
  elapsedMmSs: '00:30',
  perPlayer: [
    {
      ownerId: 1,
      age: 'dark-age',
      resources: { wood: 100, food: 200, gold: 0, stone: 0 },
      villagerCountByTask: { 'gathering-food': 3 },
      buildingCountByType: { 'town-center': 1 },
      militaryCountByType: {},
      populationCurrent: 3,
      populationCap: 5,
    },
    {
      ownerId: 2,
      age: 'feudal-age',
      resources: { wood: 200, food: 200, gold: 100, stone: 100 },
      villagerCountByTask: { 'gathering-wood': 2, 'gathering-food': 4 },
      buildingCountByType: { 'town-center': 1, 'house': 2, 'barracks': 1 },
      militaryCountByType: { 'militia': 2 },
      populationCurrent: 6,
      populationCap: 10,
    },
  ],
  selection: [],
  enemies: [
    { entityId: 5, ownerId: 1, kind: 'archer', position: { x: 1, y: 1 } },
  ],
  queuedProduction: [],
  screenMapping: {
    worldBbox: { minX: 0, minY: 0, maxX: 16, maxY: 16 },
    pixelBbox: { x: 0, y: 0, width: 800, height: 600 },
    worldToScreen: [],
  },
};

describe('llmPromptBuilder — tool name round-trip', () => {
  it('toToolName replaces dots with underscores', () => {
    expect(toToolName('building.placeConfirm')).toBe('building_placeConfirm');
  });
  it('fromToolName reverses', () => {
    expect(fromToolName('building_placeConfirm')).toBe('building.placeConfirm');
  });
  it('round-trips every GameCommands kind', () => {
    const kinds = [
      'unit.move', 'unit.attack', 'unit.gather', 'unit.context',
      'unit.contextAtEntity', 'sheep.move', 'monk.contextAtEntity',
      'trebuchet.pack', 'trebuchet.unpack', 'queue.train',
      'queue.research', 'market.action', 'building.placeConfirm',
      'building.setRallyPoint', 'building.action',
    ];
    for (const k of kinds) expect(fromToolName(toToolName(k))).toBe(k);
  });
});

describe('buildCommandToolSchemas', () => {
  it('returns 15 tools — one per GameCommands discriminator', () => {
    const tools = buildCommandToolSchemas();
    expect(tools).toHaveLength(15);
  });

  it('all tool names match Anthropic tool-name regex /^[a-zA-Z0-9_-]+$/', () => {
    const tools = buildCommandToolSchemas();
    for (const t of tools) {
      expect(t.name).toMatch(/^[a-zA-Z0-9_-]+$/);
    }
  });

  it('every tool has a description and a JSON-schema input', () => {
    const tools = buildCommandToolSchemas();
    for (const t of tools) {
      expect(t.description.length).toBeGreaterThan(0);
      expect(t.inputSchema.type).toBe('object');
      expect(t.inputSchema.required).toBeDefined();
    }
  });

  it('queue.train tool has buildingId and unitType required', () => {
    const tools = buildCommandToolSchemas();
    const train = tools.find((t) => t.name === 'queue_train')!;
    expect(train.inputSchema.required).toEqual(['buildingId', 'unitType']);
  });

  it('sheep.move tool has sheepId (not unitId) required', () => {
    const tools = buildCommandToolSchemas();
    const sheep = tools.find((t) => t.name === 'sheep_move')!;
    expect(sheep.inputSchema.required).toEqual(['sheepId', 'target']);
  });

  it('building.setRallyPoint tool has buildingId (not unitId) required', () => {
    const tools = buildCommandToolSchemas();
    const rally = tools.find((t) => t.name === 'building_setRallyPoint')!;
    expect(rally.inputSchema.required).toEqual(['buildingId', 'target']);
  });

  it('building.placeConfirm includes optional additionalBuilderIds', () => {
    const tools = buildCommandToolSchemas();
    const place = tools.find((t) => t.name === 'building_placeConfirm')!;
    const props = place.inputSchema.properties as Record<string, unknown>;
    expect(props.additionalBuilderIds).toBeDefined();
    expect(place.inputSchema.required).toEqual(['builderId', 'buildingType', 'position']);
  });
});

describe('buildStrategyToolSchema', () => {
  it('emits the set_strategy tool with required fields', () => {
    const t = buildStrategyToolSchema();
    expect(t.name).toBe('set_strategy');
    expect(t.inputSchema.required).toEqual(['strategy', 'targetAge', 'targetUnitMix']);
  });
});

describe('buildTacticalPrompt', () => {
  it('emits one user message with image + text content blocks when screenshot supplied', () => {
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);
    const out = buildTacticalPrompt({
      snapshot: SNAPSHOT,
      screenshotPng: png,
      currentStrategy: 'rush feudal',
      recentHistory: [],
    });
    expect(out.messages).toHaveLength(1);
    expect(out.messages[0]!.role).toBe('user');
    const types = out.messages[0]!.content.map((c) => c.type);
    expect(types).toEqual(['image', 'text']);
  });

  it('omits image block when screenshot is absent', () => {
    const out = buildTacticalPrompt({
      snapshot: SNAPSHOT,
      currentStrategy: null,
      recentHistory: [],
    });
    expect(out.messages[0]!.content.map((c) => c.type)).toEqual(['text']);
  });

  it('embeds the current strategy verbatim in the prompt text', () => {
    const out = buildTacticalPrompt({
      snapshot: SNAPSHOT,
      currentStrategy: 'rush castle age, then knights',
      recentHistory: [],
    });
    const textBlock = out.messages[0]!.content.find((c) => c.type === 'text')!;
    if (textBlock.type !== 'text') throw new Error('expected text');
    expect(textBlock.text).toContain('rush castle age, then knights');
  });

  it('truncates each history entry thought + commandsSummary to 200 chars', () => {
    const longThought = 'x'.repeat(500);
    const out = buildTacticalPrompt({
      snapshot: SNAPSHOT,
      currentStrategy: null,
      recentHistory: [
        { tick: 100, thought: longThought, commandsSummary: 'unit.move' },
      ],
    });
    const textBlock = out.messages[0]!.content.find((c) => c.type === 'text')!;
    if (textBlock.type !== 'text') throw new Error('expected text');
    expect(textBlock.text).toContain('tick 100');
    // Confirm the thought was truncated to 200 chars (not the full 500).
    const xRunMatch = textBlock.text.match(/x{20,}/);
    expect(xRunMatch).not.toBeNull();
    expect(xRunMatch![0]!.length).toBeLessThanOrEqual(200);
  });
});

describe('buildStrategyPrompt', () => {
  it('asks the model to call set_strategy with targetAge + targetUnitMix', () => {
    const out = buildStrategyPrompt({ snapshot: SNAPSHOT });
    const textBlock = out.messages[0]!.content.find((c) => c.type === 'text')!;
    if (textBlock.type !== 'text') throw new Error('expected text');
    expect(textBlock.text).toContain('targetAge');
    expect(textBlock.text).toContain('targetUnitMix');
    expect(textBlock.text).toContain('set_strategy');
  });
});
