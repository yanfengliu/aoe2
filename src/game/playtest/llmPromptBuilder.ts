// Prompt + tool-use schema construction for the LLM agent. Pure
// functions: input is the bounded snapshot + screenshot bytes + recent
// history; output is `LlmCallOptions` ready for the provider.
//
// Tool schemas are codegen'd from `GameCommands` discriminators. Names
// use underscores (Anthropic's tool name regex is /^[a-zA-Z0-9_-]+$/).

import type {
  AgentStateSnapshot,
  LlmContentBlock,
  LlmMessage,
  LlmToolSchema,
} from './types';
import { buildTacticalVisualPlaytestHeader } from './visualPlaytestAdapter';

export const SYSTEM_PROMPT_TACTICAL = `You are an AoE2 agent playing a deterministic playtest.
Your job: act each decision tick by emitting one or more game commands via the provided tools.
Constraints:
- You see the game state JSON and a screenshot of the canvas.
- The state JSON lists YOUR units, buildings, and visible resources/enemies with their entityIds. Enemy and resource visibility is fog-filtered (unless this run enables cheat-mode); your own forces are always fully listed.
- Tool calls must reference entityIds taken from the state JSON. Never invent entity ids — commands targeting ids not in the state JSON are rejected by the dispatcher.
- Commands are dispatched via tools. Do not emit free text actions.
- Optimize for short-term tactical effect under your current strategy.
Each tool call corresponds to one game command. Multiple tool calls per response are allowed; they execute in order.`;

export const SYSTEM_PROMPT_STRATEGY = `You are an AoE2 strategist setting your high-level plan.
Your job: read the current game state + screenshot, then describe your overall strategy in plain text and pick a target age + a target unit mix.
You will not emit any commands here — only the plan. The tactical sub-agent will execute it.`;

export interface TacticalHistoryEntry {
  tick: number;
  thought: string;
  commandsSummary: string;
  // playtest-fixes B: engine dispatch verdicts for this decision's
  // commands, reported by the runner after the post-decision drain.
  // Optional — entries predate the drain (the just-made decision) or
  // come from hosts that don't report outcomes.
  dispatchSummary?: string;
  rejectedCount?: number;
}

export interface BuildTacticalPromptInput {
  snapshot: AgentStateSnapshot;
  screenshotPng?: Uint8Array;
  currentStrategy: string | null;
  recentHistory: TacticalHistoryEntry[];
  ownerId: number;
  // Episodic memory: open findings from a previous run's self-improvement
  // ledger, so the agent verifies known issues instead of rediscovering them.
  knownIssues?: readonly string[];
}

export function buildTacticalPrompt(input: BuildTacticalPromptInput): {
  systemPrompt: string;
  messages: LlmMessage[];
} {
  const { snapshot, screenshotPng, currentStrategy, recentHistory, ownerId, knownIssues } = input;
  const content: LlmContentBlock[] = [];
  if (screenshotPng) {
    content.push({
      type: 'image',
      base64: encodeBase64(screenshotPng),
      mediaType: 'image/png',
    });
  }
  const lines = [
    buildTacticalVisualPlaytestHeader({
      snapshot,
      ownerId,
      hasScreenshot: screenshotPng !== undefined,
      tools: buildCommandToolSchemas(),
    }),
    `You are player ${ownerId}. Only emit commands targeting your own units / buildings; commands targeting other owners' entities will be rejected by the dispatcher.`,
    'Use entityIds EXACTLY as listed below. Never invent entity ids.',
    `Tick: ${snapshot.tick} (elapsed ${snapshot.elapsedMmSs})`,
    `Current strategy: ${currentStrategy ?? '(none — start by playing safely)'}`,
    ...knownIssuesLines(knownIssues),
    '',
    'Per-player state:',
    JSON.stringify(snapshot.perPlayer, null, 2),
    '',
    // playtest-fixes A: the agent's own forces with real entityIds —
    // these are the ONLY valid sources for the tool schemas' id fields.
    `Your units (${snapshot.ownUnits.length}):`,
    JSON.stringify(snapshot.ownUnits, null, 1),
    `Your buildings (${snapshot.ownBuildings.length}):`,
    JSON.stringify(snapshot.ownBuildings, null, 1),
    `Nearby resources (${snapshot.nearbyResources.length}, nearest first):`,
    JSON.stringify(snapshot.nearbyResources, null, 1),
    '',
    `Selection: ${snapshot.selection.length} entities${snapshot.selection.length > 0 ? '\n' + JSON.stringify(snapshot.selection) : ''}`,
    `Enemies (${snapshot.enemies.length}): ${JSON.stringify(snapshot.enemies)}`,
    `Queued production: ${snapshot.queuedProduction.length} buildings${snapshot.queuedProduction.length > 0 ? '\n' + JSON.stringify(snapshot.queuedProduction) : ''}`,
    '',
    `Camera world bbox: ${JSON.stringify(snapshot.screenMapping.worldBbox)}`,
    `Camera pixel bbox: ${JSON.stringify(snapshot.screenMapping.pixelBbox)}`,
  ];
  // agent-affordances B (campaign-1 backlog #2): what each building can
  // research/train right now — locked entries state the unmet rule so
  // the agent never has to reverse-engineer it from rejections.
  if (snapshot.buildingOptions) {
    const { byBuildingType, villagerCanBuild } = snapshot.buildingOptions;
    lines.push(
      '',
      'What your buildings can do now (locked research entries state WHY they are locked):',
      JSON.stringify(byBuildingType, null, 1),
      `Villager can build: ${villagerCanBuild
        .map((b) => `${b.buildingType} (${b.footprint}, cost ${JSON.stringify(b.cost)})`)
        .join('; ')}`,
    );
  }
  // agent-affordances C (campaign-1 backlog #3): known-open anchors so
  // house placements stop guessing into unseen water.
  if (snapshot.placementHints) {
    const hints = snapshot.placementHints;
    lines.push(
      '',
      `Known-open building anchors near your town center at (${hints.center.x},${hints.center.y}) `
        + '(anchor = top-left cell; each full footprint is scouted and unblocked):',
      `  2x2 (house/mill/camps): ${JSON.stringify(hints.open2x2)}`,
      `  3x3 (barracks and most military buildings): ${JSON.stringify(hints.open3x3)}`,
    );
  }
  if (recentHistory.length > 0) {
    lines.push('', 'Recent decisions (oldest first):');
    for (const h of recentHistory) {
      const outcome = h.dispatchSummary ? ` → outcome: ${h.dispatchSummary.slice(0, 300)}` : '';
      lines.push(`  - tick ${h.tick}: ${h.thought.slice(0, 200)} → ${h.commandsSummary.slice(0, 200)}${outcome}`);
    }
    // playtest-fixes B: surface rejections loudly — the 2026-06-09 run
    // showed the agent re-issuing identical rejected commands when the
    // verdicts stayed buried in the trace file.
    const last = recentHistory[recentHistory.length - 1]!;
    if ((last.rejectedCount ?? 0) > 0) {
      lines.push(
        '',
        `IMPORTANT: ${last.rejectedCount} of your previous commands were REJECTED by the engine (outcomes above). `
          + 'Re-read the state JSON and target only entityIds it lists; fix the targeting before retrying.',
      );
    }
  }
  lines.push('', 'Emit one or more tool calls. Each call is one game command.');
  content.push({ type: 'text', text: lines.join('\n') });
  return {
    systemPrompt: SYSTEM_PROMPT_TACTICAL,
    messages: [{ role: 'user', content }],
  };
}

export interface BuildStrategyPromptInput {
  snapshot: AgentStateSnapshot;
  screenshotPng?: Uint8Array;
  knownIssues?: readonly string[];
}

export function buildStrategyPrompt(input: BuildStrategyPromptInput): {
  systemPrompt: string;
  messages: LlmMessage[];
} {
  const { snapshot, screenshotPng, knownIssues } = input;
  const content: LlmContentBlock[] = [];
  if (screenshotPng) {
    content.push({ type: 'image', base64: encodeBase64(screenshotPng), mediaType: 'image/png' });
  }
  const lines = [
    `Tick: ${snapshot.tick} (elapsed ${snapshot.elapsedMmSs})`,
    'Current per-player state:',
    JSON.stringify(snapshot.perPlayer, null, 2),
    ...knownIssuesLines(knownIssues),
    '',
    'Describe your overall strategy in 2-3 sentences. Then pick:',
    '- targetAge: one of "feudal-age", "castle-age", "imperial-age".',
    '- targetUnitMix: a short comma-separated string like "scouts, archers, monks".',
    'Use the `set_strategy` tool to record your answer.',
  ];
  content.push({ type: 'text', text: lines.join('\n') });
  return {
    systemPrompt: SYSTEM_PROMPT_STRATEGY,
    messages: [{ role: 'user', content }],
  };
}

function knownIssuesLines(knownIssues: readonly string[] | undefined): string[] {
  if (!knownIssues?.length) return [];
  return [
    '',
    'Known open issues from prior runs (verify whether still present; do not rediscover them):',
    ...knownIssues.map((issue) => `  - ${issue}`),
  ];
}

// Tool name uses underscore — Anthropic's tool regex is
// /^[a-zA-Z0-9_-]+$/, so dots from the GameCommands keys are
// substituted. The agent reverses on the way out.
export function toToolName(commandKind: string): string {
  return commandKind.replace(/\./g, '_');
}
export function fromToolName(toolName: string): string {
  return toolName.replace(/_/g, '.');
}

// Tool definitions per GameCommands discriminator. Manually mirrored
// from `src/game/simulation/commands.ts:29-61`. The companion test
// (`tests/playtest/llmPromptBuilder.test.ts`) only pins per-tool
// shape — it does NOT import `keyof GameCommands` to assert
// completeness, so adding a 16th discriminator to `commands.ts` will
// not flag this file as out of date. Re-grep `commands.ts` whenever
// you touch the GameCommands surface (Claude impl-2 M2).
export function buildCommandToolSchemas(): LlmToolSchema[] {
  const positionSchema = {
    type: 'object',
    properties: {
      x: { type: 'number', description: 'Cell X coord' },
      y: { type: 'number', description: 'Cell Y coord' },
    },
    required: ['x', 'y'],
  };
  return [
    {
      name: toToolName('unit.move'),
      description: 'Move a unit to a target cell.',
      inputSchema: {
        type: 'object',
        properties: {
          unitId: { type: 'integer', minimum: 1 },
          target: positionSchema,
        },
        required: ['unitId', 'target'],
      },
    },
    {
      name: toToolName('unit.attack'),
      description: 'Order a unit to attack a target entity.',
      inputSchema: {
        type: 'object',
        properties: {
          unitId: { type: 'integer', minimum: 1 },
          targetEntityId: { type: 'integer', minimum: 1 },
          targetEntityKind: { type: 'string', enum: ['unit', 'building', 'resource'] },
        },
        required: ['unitId', 'targetEntityId', 'targetEntityKind'],
      },
    },
    {
      name: toToolName('unit.gather'),
      description: 'Order a villager to gather a resource entity.',
      inputSchema: {
        type: 'object',
        properties: {
          unitId: { type: 'integer', minimum: 1 },
          resourceId: { type: 'integer', minimum: 1 },
        },
        required: ['unitId', 'resourceId'],
      },
    },
    {
      name: toToolName('unit.context'),
      description: 'Right-click context move on a target cell (move-or-gather-or-attack inferred).',
      inputSchema: {
        type: 'object',
        properties: {
          unitId: { type: 'integer', minimum: 1 },
          target: positionSchema,
        },
        required: ['unitId', 'target'],
      },
    },
    {
      name: toToolName('unit.contextAtEntity'),
      description: 'Right-click context on a target entity (gather/attack/follow inferred).',
      inputSchema: {
        type: 'object',
        properties: {
          unitId: { type: 'integer', minimum: 1 },
          targetEntityId: { type: 'integer', minimum: 1 },
        },
        required: ['unitId', 'targetEntityId'],
      },
    },
    {
      name: toToolName('sheep.move'),
      description: 'Move a sheep (used to herd to TC).',
      inputSchema: {
        type: 'object',
        properties: {
          sheepId: { type: 'integer', minimum: 1 },
          target: positionSchema,
        },
        required: ['sheepId', 'target'],
      },
    },
    {
      name: toToolName('monk.contextAtEntity'),
      description: 'Monk context: heal / convert / pickup / deposit on the target entity.',
      inputSchema: {
        type: 'object',
        properties: {
          unitId: { type: 'integer', minimum: 1 },
          targetEntityId: { type: 'integer', minimum: 1 },
          intendedTaskKind: { type: 'string', enum: ['heal', 'convert', 'pickup', 'deposit'] },
        },
        required: ['unitId', 'targetEntityId'],
      },
    },
    {
      name: toToolName('trebuchet.pack'),
      description: 'Pack an unpacked trebuchet.',
      inputSchema: {
        type: 'object',
        properties: { unitId: { type: 'integer', minimum: 1 } },
        required: ['unitId'],
      },
    },
    {
      name: toToolName('trebuchet.unpack'),
      description: 'Unpack a packed trebuchet.',
      inputSchema: {
        type: 'object',
        properties: { unitId: { type: 'integer', minimum: 1 } },
        required: ['unitId'],
      },
    },
    {
      name: toToolName('queue.train'),
      description: 'Queue training of a unit at a building.',
      inputSchema: {
        type: 'object',
        properties: {
          buildingId: { type: 'integer', minimum: 1 },
          unitType: { type: 'string', description: 'Unit type to train, e.g., "villager", "archer".' },
        },
        required: ['buildingId', 'unitType'],
      },
    },
    {
      name: toToolName('queue.research'),
      description: 'Queue research of a technology at a building.',
      inputSchema: {
        type: 'object',
        properties: {
          buildingId: { type: 'integer', minimum: 1 },
          technologyType: { type: 'string', description: 'Technology to research.' },
        },
        required: ['buildingId', 'technologyType'],
      },
    },
    {
      name: toToolName('market.action'),
      description: 'Market trade (buy/sell food/wood/stone/gold).',
      inputSchema: {
        type: 'object',
        properties: {
          playerId: { type: 'integer', minimum: 1, maximum: 8 },
          actionType: { type: 'string', description: 'Market action type, e.g., "sell-wood".' },
        },
        required: ['playerId', 'actionType'],
      },
    },
    {
      name: toToolName('building.placeConfirm'),
      description:
        'Place a building (commits placement at the target position). Position is the '
        + "building's top-left anchor cell; pick open, scouted ground — the state JSON's "
        + 'placementHints lists known-open anchors near your town center.',
      inputSchema: {
        type: 'object',
        properties: {
          builderId: { type: 'integer', minimum: 1 },
          buildingType: { type: 'string', description: 'Building type, e.g., "house", "farm".' },
          position: positionSchema,
          additionalBuilderIds: {
            type: 'array',
            items: { type: 'integer', minimum: 1 },
            description: 'Optional extra villager ids to assign to the same build site.',
          },
        },
        required: ['builderId', 'buildingType', 'position'],
      },
    },
    {
      name: toToolName('building.setRallyPoint'),
      description: 'Set a building rally point cell.',
      inputSchema: {
        type: 'object',
        properties: {
          buildingId: { type: 'integer', minimum: 1 },
          target: positionSchema,
        },
        required: ['buildingId', 'target'],
      },
    },
    {
      name: toToolName('building.action'),
      description: 'Building action (e.g., "ungarrison").',
      inputSchema: {
        type: 'object',
        properties: {
          buildingId: { type: 'integer', minimum: 1 },
          actionType: { type: 'string', description: 'Building action, e.g., "ungarrison".' },
        },
        required: ['buildingId', 'actionType'],
      },
    },
  ];
}

export function buildStrategyToolSchema(): LlmToolSchema {
  return {
    name: 'set_strategy',
    description: 'Record the agent\'s overall strategy + target age + target unit mix.',
    inputSchema: {
      type: 'object',
      properties: {
        strategy: { type: 'string', description: '2-3 sentence plan.' },
        targetAge: { type: 'string', enum: ['feudal-age', 'castle-age', 'imperial-age'] },
        targetUnitMix: { type: 'string', description: 'Comma-separated unit mix.' },
      },
      required: ['strategy', 'targetAge', 'targetUnitMix'],
    },
  };
}

function encodeBase64(bytes: Uint8Array): string {
  // Cross-runtime base64. In browser/Playwright `btoa` exists; in Node
  // we use Buffer. The runner side is Node, so prefer Buffer.
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(bytes).toString('base64');
  }
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]!);
  return btoa(s);
}
