// JsonValue is not re-exported from civ-engine's index; redefine locally.
// Same shape as the engine's internal JsonValue (anything JSON.stringify can roundtrip).
export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

export type StopReason =
  | 'maxTicks'
  | 'stopWhen'
  | 'sinkError'
  | 'recorderError'
  | 'engineHalt';

export interface OracleEnvelope {
  stopReason: StopReason;
  ticksRun: number;
  seed: string;
  scenario: string;
  runStartedAt: string;
  runCompletedAt: string;
  errorCode?: string;
  errorMessage?: string;
  details?: Record<string, JsonValue>;
}

export interface RunPlaytestConfig {
  seed: string;
  scenario?: string;
  maxTicks: number;
}

export interface RunPlaytestResult {
  bundle: import('civ-engine').SessionBundle;
  envelope: OracleEnvelope;
}

export interface OracleViolation {
  oracle: string;
  severity: 'low' | 'medium' | 'high';
  tick: number | null;
  message: string;
  details?: Record<string, unknown>;
}

export interface OracleThresholds {
  matchCompleteRequired?: boolean;
  perfP99WarmupTicks?: number;
  perfP99BudgetMs?: number | 'auto';
  economyByTick?: number;
  economyMinVillagers?: number;
  economyMinAge?: 'feudal' | 'castle' | 'imperial';
  pinnedNetProgressCells?: number;
  pinnedWindowTicks?: number;
}

export const ORACLE_DEFAULTS: Required<OracleThresholds> = {
  matchCompleteRequired: true,
  perfP99WarmupTicks: 200,
  perfP99BudgetMs: 'auto',
  economyByTick: 5000,
  economyMinVillagers: 8,
  economyMinAge: 'feudal',
  pinnedNetProgressCells: 3,
  pinnedWindowTicks: 50,
};

// LLM-agent-playtest types. Shape pinned by docs/threads/current/llm-agent-playtest/DESIGN.md.

export interface AgentPlayerState {
  ownerId: number;
  age: 'dark-age' | 'feudal-age' | 'castle-age' | 'imperial-age';
  resources: { wood: number; food: number; gold: number; stone: number };
  villagerCountByTask: Record<string, number>;
  buildingCountByType: Record<string, number>;
  militaryCountByType: Record<string, number>;
  populationCurrent: number;
  populationCap: number;
}

export interface AgentEntitySummary {
  entityId: number;
  ownerId: number;
  kind: string;
  position: { x: number; y: number };
}

export interface AgentScreenMapping {
  worldBbox: { minX: number; minY: number; maxX: number; maxY: number };
  pixelBbox: { x: number; y: number; width: number; height: number };
  worldToScreen: Array<{ cellX: number; cellY: number; pixelX: number; pixelY: number }>;
}

export interface AgentStateSnapshot {
  tick: number;
  elapsedMmSs: string;
  perPlayer: AgentPlayerState[];
  selection: AgentEntitySummary[];
  // NOTE: enemies are NOT visibility-filtered — see agentSnapshot.ts
  // (impl-1 H3). Per-owner fog filtering is a Phase-6 follow-up.
  enemies: AgentEntitySummary[];
  queuedProduction: Array<{ buildingId: number; ownerId: number; queue: string[] }>;
  screenMapping: AgentScreenMapping;
}

// Discriminated dispatch result. Generic on K so callers narrow `normalized`
// by switching on `commandKind` without re-discriminating.
export type CommandDispatchResult<K extends string = string> =
  | { accepted: true; commandKind: K; normalized: Record<string, unknown> }
  | { accepted: false; reason: 'unknown-kind' | 'malformed-payload' | 'wrong-owner-range'; details?: string };

// LLM agent core (Phase 2). LlmProvider abstracts over the actual LLM
// backend (Anthropic SDK, mock, or future providers). The agent's
// decide() call goes through this seam so tests can drive without the
// real API.

export interface LlmTextBlock {
  type: 'text';
  text: string;
}
export interface LlmImageBlock {
  type: 'image';
  // Base64-encoded image (PNG). The provider impl may transform this
  // into the SDK's preferred shape (Anthropic SDK uses
  // { type: 'image', source: { type: 'base64', media_type, data } }).
  base64: string;
  mediaType: 'image/png' | 'image/jpeg';
}
export interface LlmToolUseBlock {
  type: 'tool_use';
  toolName: string;
  toolInput: Record<string, unknown>;
}
export type LlmContentBlock = LlmTextBlock | LlmImageBlock | LlmToolUseBlock;

export interface LlmMessage {
  role: 'user' | 'assistant';
  content: LlmContentBlock[];
}

export interface LlmToolSchema {
  // Tool name (Anthropic restricts to ^[a-zA-Z0-9_-]+$).
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

export interface LlmCallOptions {
  model: string;
  systemPrompt: string;
  messages: LlmMessage[];
  tools: LlmToolSchema[];
  maxOutputTokens: number;
}

export interface LlmCallResult {
  content: LlmContentBlock[];
  tokensIn: number;
  tokensOut: number;
  costUsd: number;
}

export interface LlmProvider {
  call(options: LlmCallOptions): Promise<LlmCallResult>;
}

export interface LlmCostTable {
  // Per-model { inputUsdPerMTok, outputUsdPerMTok }. The agent looks
  // up rates here to compute per-call costUsd. Defaults match published
  // Anthropic pricing as of 2026-05; bump when prices change.
  [model: string]: { inputUsdPerMTok: number; outputUsdPerMTok: number };
}

export const DEFAULT_LLM_COST_TABLE: LlmCostTable = {
  'claude-sonnet-4-6': { inputUsdPerMTok: 3, outputUsdPerMTok: 15 },
  'claude-opus-4-7': { inputUsdPerMTok: 15, outputUsdPerMTok: 75 },
};

// Agent decision returned per decide() call. The runner drains this
// into `<out>.llm-trace.json` and dispatches each command via
// __AOE2_TEST__.agent.dispatchAgentCommand.

export interface AgentStrategyRefresh {
  strategy: string;
  targetAge: 'feudal-age' | 'castle-age' | 'imperial-age';
  targetUnitMix: string;
}

export interface AgentDecisionCommand {
  type: string; // keyof GameCommands
  data: Record<string, unknown>;
}

export type AgentStopReason = 'normal' | 'cost-budget-exceeded';

export interface AgentDecision {
  thought: string;
  commands: AgentDecisionCommand[];
  strategyRefresh?: AgentStrategyRefresh;
  tokensIn: number;
  tokensOut: number;
  costUsd: number;
  stopReason: AgentStopReason;
}
