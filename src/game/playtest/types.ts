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
