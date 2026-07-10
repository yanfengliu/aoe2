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
  // provider-error-retry (2026-06-13): a transient LLM-call failure that
  // survived retry-with-backoff. Distinct from engineHalt — the game/page
  // is healthy (only the model call died), so the winner oracle, final
  // screenshot, and bundle export still run.
  | 'providerError'
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
  // Optional score-timer game length (spec §4.3). When set, the run forces
  // the score timer on so the match terminates on score at this tick instead
  // of stalemating to `maxTicks`. Keep it below `maxTicks` so the timer fires
  // inside the run loop (the cap stays a backstop).
  gameLength?: number;
  // Headless AI-vs-AI: force an AI onto the human slot too, so a deterministic
  // run is a competitive match instead of AI(enemy)-vs-inert(human). Off by
  // default (the human slot stays inert, as in a normal headless run).
  allAi?: boolean;
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
  // Confinement box radius: a unit is "confined" while every position stays
  // within (strictly under) this Manhattan distance of the span's anchor.
  // Leaving the box re-anchors the span.
  pinnedNetProgressCells?: number;
  // Minimum confined duration before a driven unit counts as pinned. Gather
  // cycles legitimately hold a villager near one spot for a full fill
  // (capacity x cadence) and short-haul circuits net almost no progress, so
  // this sits far above one gather cycle AND above the recorder's periodic
  // snapshot cadence (1000 ticks) so a qualifying span always contains at
  // least one interior snapshot for the 'gathering'-activity exemption.
  pinnedStuckTicks?: number;
  // Wider confinement box for the oscillation verdict: a unit that keeps
  // MOVING but stays inside this radius for >= pinnedStuckTicks is livelocked
  // (escape-heading ping-pong, re-target flapping) unless snapshots show it
  // gathering. Must be comfortably larger than pinnedNetProgressCells —
  // amplitude-3..5 shuttles re-anchor the tight box every leg and were
  // invisible to the pinned verdict alone.
  pinnedOscillationBoxCells?: number;
}

export const ORACLE_DEFAULTS: Required<OracleThresholds> = {
  matchCompleteRequired: true,
  perfP99WarmupTicks: 200,
  perfP99BudgetMs: 'auto',
  economyByTick: 5000,
  economyMinVillagers: 8,
  economyMinAge: 'feudal',
  pinnedNetProgressCells: 3,
  pinnedStuckTicks: 1200,
  pinnedOscillationBoxCells: 6,
};

// LLM-agent-playtest types. Shape pinned by docs/threads/done/llm-agent-playtest/DESIGN.md.

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

// playtest-fixes A: the agent's OWN forces, with the real entityIds the
// command tool schemas require. Never visibility-filtered — a player
// always knows their own units. Without these the model fabricates ids
// and the dispatcher rejects every command (2026-06-09 verification).
export interface AgentOwnUnitSummary {
  entityId: number;
  kind: string;
  position: { x: number; y: number };
  task: string;
}

export interface AgentOwnBuildingSummary {
  entityId: number;
  kind: string;
  position: { x: number; y: number };
  isComplete: boolean;
}

export interface AgentResourceSummary {
  entityId: number;
  kind: string;
  position: { x: number; y: number };
  amount: number;
}

// agent-affordances C (campaign-1 backlog #3): known-open building
// anchors near the agent's town center. Anchor = the building's
// top-left cell. Every listed anchor's full footprint is currently
// visible to the owner AND unblocked — fog reveals nothing.
export interface AgentPlacementHints {
  center: { x: number; y: number };
  open2x2: Array<{ x: number; y: number }>;
  open3x3: Array<{ x: number; y: number }>;
}

export interface AgentStateSnapshot {
  tick: number;
  elapsedMmSs: string;
  perPlayer: AgentPlayerState[];
  selection: AgentEntitySummary[];
  ownUnits: AgentOwnUnitSummary[];
  ownBuildings: AgentOwnBuildingSummary[];
  // Gatherable map resources near the agent's base (sorted by distance
  // to the first own building), visibility-filtered like enemies.
  nearbyResources: AgentResourceSummary[];
  // Enemies are visibility-filtered by default since Phase-6.B; pass
  // omniscient=true to buildAgentSnapshot for cheat-mode ground truth.
  enemies: AgentEntitySummary[];
  queuedProduction: Array<{ buildingId: number; ownerId: number; queue: string[] }>;
  screenMapping: AgentScreenMapping;
  // agent-affordances B (campaign-1 backlog #2): per-building-type
  // research/train options with locked-research reasons, + the villager
  // build menu (footprints + costs). Optional: absent on hosts that
  // don't provide the bridge surfaces (older fixtures).
  buildingOptions?: import('../simulation/createSimulationBridge').AgentBuildingOptions;
  // agent-affordances C: known-open anchors near the town center.
  // null when the owner has no buildings yet.
  placementHints?: AgentPlacementHints | null;
}

// Discriminated dispatch result. Generic on K so callers narrow `normalized`
// by switching on `commandKind` without re-discriminating.
export type CommandDispatchResult<K extends string = string> =
  | { accepted: true; commandKind: K; normalized: Record<string, unknown> }
  | {
    accepted: false;
    // 'not-owned' (playtest-fixes iter-1, Codex HIGH): the acting
    // entity does not belong to the agent's owner — enforced at the
    // dispatch boundary because the engine's semantic validators have
    // no actor identity.
    reason: 'unknown-kind' | 'malformed-payload' | 'wrong-owner-range' | 'not-owned';
    details?: string;
  };

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
  // Anthropic pricing as of 2026-06; bump when prices change.
  [model: string]: { inputUsdPerMTok: number; outputUsdPerMTok: number };
}

export const DEFAULT_LLM_COST_TABLE: LlmCostTable = {
  // claude-opus-4-8 is the playtest-standard model for ALL harness LLM
  // calls (tactical + strategy + conformance + auto-fix) while Fable 5 is
  // banned (2026-06-12 user directive — see design/spec-final.md §15.7).
  // Revert to claude-fable-5 when the ban lifts.
  'claude-opus-4-8': { inputUsdPerMTok: 5, outputUsdPerMTok: 25 },
  'claude-fable-5': { inputUsdPerMTok: 10, outputUsdPerMTok: 50 },
  'claude-sonnet-4-6': { inputUsdPerMTok: 3, outputUsdPerMTok: 15 },
  // Corrected 2026-06-09: Opus 4.7 is $5/$25 (the earlier $15/$75 row
  // predated the 4.7 price drop and over-estimated envelope costs).
  'claude-opus-4-7': { inputUsdPerMTok: 5, outputUsdPerMTok: 25 },
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
