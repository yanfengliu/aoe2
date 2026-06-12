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
  ownUnits: [
    { entityId: 12, kind: 'villager', position: { x: 3, y: 4 }, task: 'idle' },
    { entityId: 13, kind: 'scout', position: { x: 5, y: 5 }, task: 'moving' },
  ],
  ownBuildings: [
    { entityId: 7, kind: 'town-center', position: { x: 2, y: 2 }, isComplete: true },
  ],
  nearbyResources: [
    { entityId: 41, kind: 'berry-bush', position: { x: 6, y: 2 }, amount: 125 },
  ],
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
      ownerId: 2,
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
      ownerId: 2,
    });
    expect(out.messages[0]!.content.map((c) => c.type)).toEqual(['text']);
  });

  it('embeds the current strategy verbatim in the prompt text', () => {
    const out = buildTacticalPrompt({
      snapshot: SNAPSHOT,
      currentStrategy: 'rush castle age, then knights',
      recentHistory: [],
      ownerId: 2,
    });
    const textBlock = out.messages[0]!.content.find((c) => c.type === 'text')!;
    if (textBlock.type !== 'text') throw new Error('expected text');
    expect(textBlock.text).toContain('rush castle age, then knights');
  });

  // playtest-fixes A: the prompt must surface the agent's OWN entity
  // ids — the tool schemas demand integer ids and the 2026-06-09 run
  // proved the model fabricates them when none are provided.
  it('renders own units, own buildings, and nearby resources with their entityIds', () => {
    const out = buildTacticalPrompt({
      snapshot: SNAPSHOT,
      currentStrategy: null,
      recentHistory: [],
      ownerId: 2,
    });
    const textBlock = out.messages[0]!.content.find((c) => c.type === 'text')!;
    if (textBlock.type !== 'text') throw new Error('expected text');
    expect(textBlock.text).toContain('Your units');
    expect(textBlock.text).toContain('"entityId": 12');
    expect(textBlock.text).toContain('Your buildings');
    expect(textBlock.text).toContain('"entityId": 7');
    expect(textBlock.text).toContain('Nearby resources');
    expect(textBlock.text).toContain('"entityId": 41');
  });

  it('instructs the model to use only entityIds from the state JSON', () => {
    const out = buildTacticalPrompt({
      snapshot: SNAPSHOT,
      currentStrategy: null,
      recentHistory: [],
      ownerId: 2,
    });
    const textBlock = out.messages[0]!.content.find((c) => c.type === 'text')!;
    if (textBlock.type !== 'text') throw new Error('expected text');
    expect(textBlock.text).toContain('Never invent entity ids');
  });

  // playtest-fixes B: dispatch outcomes from the previous decision must
  // reach the next prompt — the verification run showed the agent
  // blindly re-issuing rejected commands for 4 straight decisions.
  it('renders per-entry dispatch outcomes and a rejection warning when the last decision had rejections', () => {
    const out = buildTacticalPrompt({
      snapshot: SNAPSHOT,
      currentStrategy: null,
      recentHistory: [
        {
          tick: 100,
          thought: 'queue feudal',
          commandsSummary: 'queue.research',
          dispatchSummary: '0 accepted, 1 rejected — queue.research → not_a_building (Entity is not a building.)',
          rejectedCount: 1,
        },
      ],
      ownerId: 2,
    });
    const textBlock = out.messages[0]!.content.find((c) => c.type === 'text')!;
    if (textBlock.type !== 'text') throw new Error('expected text');
    expect(textBlock.text).toContain('not_a_building');
    expect(textBlock.text).toContain('REJECTED');
  });

  it('omits the rejection warning when the last decision had no rejections', () => {
    const out = buildTacticalPrompt({
      snapshot: SNAPSHOT,
      currentStrategy: null,
      recentHistory: [
        {
          tick: 100,
          thought: 'train villager',
          commandsSummary: 'queue.train',
          dispatchSummary: '1 accepted, 0 rejected',
          rejectedCount: 0,
        },
      ],
      ownerId: 2,
    });
    const textBlock = out.messages[0]!.content.find((c) => c.type === 'text')!;
    if (textBlock.type !== 'text') throw new Error('expected text');
    expect(textBlock.text).not.toContain('REJECTED');
    expect(textBlock.text).toContain('1 accepted, 0 rejected');
  });

  it('truncates each history entry thought + commandsSummary to 200 chars', () => {
    const longThought = 'x'.repeat(500);
    const out = buildTacticalPrompt({
      snapshot: SNAPSHOT,
      currentStrategy: null,
      recentHistory: [
        { tick: 100, thought: longThought, commandsSummary: 'unit.move' },
      ],
      ownerId: 2,
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

// agent-affordances B/C (campaign-1 backlog #2/#3): building options +
// placement hints must render when present and stay silent when absent
// (older fixtures/hosts).
describe('buildTacticalPrompt — agent affordances', () => {
  function promptText(snapshot: AgentStateSnapshot): string {
    const out = buildTacticalPrompt({
      snapshot,
      currentStrategy: null,
      recentHistory: [],
      ownerId: 2,
    });
    const textBlock = out.messages[0]!.content.find((c) => c.type === 'text')!;
    if (textBlock.type !== 'text') throw new Error('expected text');
    return textBlock.text;
  }

  it('omits the affordance blocks when the snapshot lacks them', () => {
    const text = promptText(SNAPSHOT);
    expect(text).not.toContain('What your buildings can do now');
    expect(text).not.toContain('Known-open building anchors');
  });

  it('renders building options with locked reasons and the villager build menu', () => {
    const text = promptText({
      ...SNAPSHOT,
      buildingOptions: {
        byBuildingType: [
          {
            buildingType: 'town-center',
            research: [],
            researchLocked: [
              {
                tech: 'feudal-age',
                reason: 'Advancing to feudal-age requires 2 completed Dark Age buildings (mill, lumber-camp, mining-camp, or barracks) — you have 1.',
              },
            ],
            train: ['villager'],
          },
        ],
        villagerCanBuild: [
          { buildingType: 'house', footprint: '2x2', cost: { wood: 25 } },
        ],
      },
    });
    expect(text).toContain('What your buildings can do now');
    expect(text).toContain('requires 2 completed Dark Age buildings');
    expect(text).toContain('house (2x2, cost {"wood":25})');
  });

  it('renders placement hints with the anchor semantics spelled out', () => {
    const text = promptText({
      ...SNAPSHOT,
      placementHints: {
        center: { x: 20, y: 20 },
        open2x2: [{ x: 17, y: 18 }, { x: 24, y: 20 }],
        open3x3: [{ x: 25, y: 24 }],
      },
    });
    expect(text).toContain('Known-open building anchors near your town center at (20,20)');
    expect(text).toContain('anchor = top-left cell');
    expect(text).toContain('{"x":17,"y":18}');
    expect(text).toContain('{"x":25,"y":24}');
  });

  it('points the placeConfirm tool description at placementHints', () => {
    const tool = buildCommandToolSchemas().find((t) => t.name === 'building_placeConfirm')!;
    expect(tool.description).toContain('placementHints');
    expect(tool.description).toContain('top-left anchor cell');
  });
});
