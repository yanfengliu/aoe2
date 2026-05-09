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
