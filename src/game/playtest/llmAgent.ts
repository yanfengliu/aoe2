// LlmAgent: two-tier (strategy + tactical) agent driving the game.
// Pure orchestration over an LlmProvider; no HTTP, no Playwright.
//
// `decide(state, screenshot)` returns AgentDecision { commands, ... }.
// The runner dispatches each command via __AOE2_TEST__.agent.dispatchAgentCommand,
// advances ticks, drains the dispatch log, and loops.

import type {
  AgentDecision,
  AgentDecisionCommand,
  AgentStateSnapshot,
  AgentStrategyRefresh,
  LlmCallOptions,
  LlmContentBlock,
  LlmProvider,
  LlmToolSchema,
} from './types';
import {
  buildCommandToolSchemas,
  buildStrategyPrompt,
  buildStrategyToolSchema,
  buildTacticalPrompt,
  fromToolName,
  type TacticalHistoryEntry,
} from './llmPromptBuilder';

// playtest-fixes B: structural twin of the runner's AgentDispatchEvent
// (declared here, not imported, to keep the agent free of runner deps).
export interface DispatchOutcomeEvent {
  commandType: string;
  accepted: boolean;
  rejectionReason?: string;
  rejectionMessage?: string;
}

export interface LlmAgentConfig {
  provider: LlmProvider;
  ownerId: number;
  strategyModel: string;
  tacticalModel: string;
  // Decision intervals
  strategyEveryNDecisions: number;
  // Token + retry caps per call
  maxOutputTokensTactical: number;
  maxOutputTokensStrategy: number;
  // Cost budget (USD). On 80% the agent logs a warn; on 100% the next
  // decide() call returns commands=[] + stopReason='cost-budget-exceeded'.
  costBudgetUsd: number;
  // Image budget. The runner already downscales to a target width; the
  // agent observes the byte size and (if exceeded) halves and retries
  // up to halfingBudget times before omitting the screenshot.
  maxImageBytes: number;
  // History trail — tail of past decisions to include in the tactical
  // prompt for context. Caller-provided so the runner controls memory.
  historyWindow: number;
  // Episodic memory: open findings from a previous run's ledger, rendered
  // into both prompts so the agent verifies instead of rediscovering.
  knownIssues?: readonly string[];
}

export const DEFAULT_AGENT_CONFIG = {
  strategyEveryNDecisions: 10,
  maxOutputTokensTactical: 1024,
  maxOutputTokensStrategy: 2048,
  costBudgetUsd: 5.0,
  maxImageBytes: 1_048_576, // 1 MiB
  historyWindow: 5,
};

type DecisionHistoryEntry = TacticalHistoryEntry;

export class LlmAgent {
  private readonly config: LlmAgentConfig;
  private decisionsSinceStrategyRefresh = Infinity;
  private currentStrategy: string | null = null;
  private currentStrategyRefresh: AgentStrategyRefresh | null = null;
  private rollingCostUsd = 0;
  private warnedOn80 = false;
  private commandToolSchemas: LlmToolSchema[];
  private strategyToolSchema: LlmToolSchema;
  private history: DecisionHistoryEntry[] = [];

  constructor(config: LlmAgentConfig) {
    this.config = config;
    this.commandToolSchemas = buildCommandToolSchemas();
    this.strategyToolSchema = buildStrategyToolSchema();
  }

  get cumulativeCostUsd(): number {
    return this.rollingCostUsd;
  }
  get strategy(): string | null {
    return this.currentStrategy;
  }

  // playtest-fixes B: the runner reports the engine's dispatch verdicts
  // for the most recent decision (drained after the post-decision
  // advance). The summary lands on that decision's history entry so the
  // NEXT tactical prompt shows the model what actually happened —
  // without this the 2026-06-09 run re-issued identical rejected
  // commands for four straight decisions.
  reportDispatchOutcome(events: DispatchOutcomeEvent[]): void {
    const last = this.history[this.history.length - 1];
    if (!last) return;
    const accepted = events.filter((e) => e.accepted).length;
    const rejected = events.length - accepted;
    const rejectedDetails = events
      .filter((e) => !e.accepted)
      .map((e) => {
        const reason = e.rejectionReason ?? 'rejected';
        const msg = e.rejectionMessage ? ` (${e.rejectionMessage})` : '';
        return `${e.commandType} → ${reason}${msg}`;
      })
      .join('; ');
    last.dispatchSummary = rejected > 0
      ? `${accepted} accepted, ${rejected} rejected — ${rejectedDetails}`
      : `${accepted} accepted, ${rejected} rejected`;
    last.rejectedCount = rejected;
  }

  async decide(
    state: AgentStateSnapshot,
    screenshotPng: Uint8Array | undefined,
  ): Promise<AgentDecision> {
    if (this.rollingCostUsd >= this.config.costBudgetUsd) {
      return {
        thought: 'cost budget exceeded',
        commands: [],
        tokensIn: 0,
        tokensOut: 0,
        costUsd: 0,
        stopReason: 'cost-budget-exceeded',
      };
    }

    const screenshot = clampImage(screenshotPng, this.config.maxImageBytes);

    let strategyRefresh: AgentStrategyRefresh | undefined;
    if (this.decisionsSinceStrategyRefresh >= this.config.strategyEveryNDecisions) {
      const refresh = await this.refreshStrategy(state, screenshot);
      // Always reset the cadence counter (Codex impl-2 MED3 + Claude
      // impl-2 M5) — otherwise an invalid `set_strategy` tool call
      // leaves the agent stuck in "always refresh" mode, retrying an
      // Opus-priced call every decision and silently burning budget.
      this.decisionsSinceStrategyRefresh = 0;
      if (refresh) {
        strategyRefresh = refresh;
        this.currentStrategyRefresh = refresh;
        this.currentStrategy = refresh.strategy;
      } else {
        console.warn(
          '[llm-agent] strategy refresh returned null (invalid set_strategy tool call); keeping previous strategy.',
        );
      }
    }
    this.decisionsSinceStrategyRefresh += 1;

    // Within-call cost guard (Codex impl-2 HIGH + Claude impl-2 M1).
    // The strategy refresh may have pushed cost over budget; bail out
    // before paying for the tactical call too.
    if (this.rollingCostUsd >= this.config.costBudgetUsd) {
      return {
        thought: 'cost budget exceeded after strategy refresh',
        commands: [],
        strategyRefresh,
        tokensIn: 0,
        tokensOut: 0,
        costUsd: 0,
        stopReason: 'cost-budget-exceeded',
      };
    }

    const tacticalPrompt = buildTacticalPrompt({
      snapshot: state,
      screenshotPng: screenshot,
      currentStrategy: this.currentStrategy,
      recentHistory: this.history.slice(-this.config.historyWindow),
      ownerId: this.config.ownerId,
      ...(this.config.knownIssues !== undefined ? { knownIssues: this.config.knownIssues } : {}),
    });

    const callOptions: LlmCallOptions = {
      model: this.config.tacticalModel,
      systemPrompt: tacticalPrompt.systemPrompt,
      messages: tacticalPrompt.messages,
      tools: this.commandToolSchemas,
      maxOutputTokens: this.config.maxOutputTokensTactical,
    };
    const result = await this.config.provider.call(callOptions);
    this.recordCost(result.costUsd);

    const { thought, commands } = parseTacticalResponse(result.content);
    this.history.push({
      tick: state.tick,
      thought,
      commandsSummary: commands.map((c) => c.type).join(', '),
    });
    if (this.history.length > this.config.historyWindow * 4) {
      // bound history accumulation; runner-side trace JSON keeps full history.
      this.history = this.history.slice(-this.config.historyWindow * 2);
    }

    return {
      thought,
      commands,
      strategyRefresh,
      tokensIn: result.tokensIn,
      tokensOut: result.tokensOut,
      costUsd: result.costUsd,
      stopReason: 'normal',
    };
  }

  private async refreshStrategy(
    state: AgentStateSnapshot,
    screenshotPng: Uint8Array | undefined,
  ): Promise<AgentStrategyRefresh | null> {
    const prompt = buildStrategyPrompt({
      snapshot: state,
      screenshotPng,
      ...(this.config.knownIssues !== undefined ? { knownIssues: this.config.knownIssues } : {}),
    });
    const callOptions: LlmCallOptions = {
      model: this.config.strategyModel,
      systemPrompt: prompt.systemPrompt,
      messages: prompt.messages,
      tools: [this.strategyToolSchema],
      maxOutputTokens: this.config.maxOutputTokensStrategy,
    };
    const result = await this.config.provider.call(callOptions);
    this.recordCost(result.costUsd);
    return parseStrategyResponse(result.content);
  }

  private recordCost(addUsd: number): void {
    this.rollingCostUsd += addUsd;
    if (
      !this.warnedOn80
      && this.rollingCostUsd >= this.config.costBudgetUsd * 0.8
    ) {
      this.warnedOn80 = true;
      console.warn(
        `[llm-agent] cost at 80% of budget: $${this.rollingCostUsd.toFixed(4)} / $${this.config.costBudgetUsd.toFixed(2)}`,
      );
    }
  }
}

// Drop the screenshot if it exceeds the byte budget. The runner is
// responsible for downscaling at the source; the agent just enforces
// the cap as a safety. Per design, after 2 halvings the runner omits
// the screenshot — we don't re-encode here, just drop.
function clampImage(
  bytes: Uint8Array | undefined,
  maxBytes: number,
): Uint8Array | undefined {
  if (!bytes) return undefined;
  if (bytes.byteLength <= maxBytes) return bytes;
  return undefined;
}

function parseTacticalResponse(content: LlmContentBlock[]): {
  thought: string;
  commands: AgentDecisionCommand[];
} {
  let thought = '';
  const commands: AgentDecisionCommand[] = [];
  for (const block of content) {
    if (block.type === 'text') {
      thought = thought ? `${thought}\n${block.text}` : block.text;
    } else if (block.type === 'tool_use') {
      commands.push({
        type: fromToolName(block.toolName),
        data: block.toolInput,
      });
    }
  }
  return { thought, commands };
}

function parseStrategyResponse(content: LlmContentBlock[]): AgentStrategyRefresh | null {
  for (const block of content) {
    if (block.type !== 'tool_use') continue;
    if (block.toolName !== 'set_strategy') continue;
    const input = block.toolInput as Record<string, unknown>;
    const strategy = typeof input.strategy === 'string' ? input.strategy : '';
    const targetAge = String(input.targetAge);
    const targetUnitMix = typeof input.targetUnitMix === 'string' ? input.targetUnitMix : '';
    if (
      targetAge === 'feudal-age'
      || targetAge === 'castle-age'
      || targetAge === 'imperial-age'
    ) {
      return { strategy, targetAge, targetUnitMix };
    }
  }
  return null;
}
