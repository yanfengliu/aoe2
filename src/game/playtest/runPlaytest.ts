import { MemorySink, SessionRecorder, SinkWriteError } from 'civ-engine';
import { createSimulationBridge } from '../simulation/createSimulationBridge';
import type {
  OracleEnvelope,
  RunPlaytestConfig,
  RunPlaytestResult,
  StopReason,
} from './types';

const TICK_DELTA_MS = 100;

export async function runPlaytest(config: RunPlaytestConfig): Promise<RunPlaytestResult> {
  const { seed, maxTicks } = config;
  const scenario = config.scenario ?? seed;
  const runStartedAt = new Date().toISOString();

  const bridge = createSimulationBridge(seed);
  const sink = new MemorySink({ allowSidecar: true });
  const recorder = new SessionRecorder({
    world: bridge.world,
    sink,
    sourceLabel: `aoe2-playtest-${seed}`,
    sourceKind: 'synthetic',
  });
  recorder.connect();

  const startTick = bridge.world.tick;
  let stopReason: StopReason = 'maxTicks';
  let errorCode: string | undefined;
  let errorMessage: string | undefined;
  let details: OracleEnvelope['details'] | undefined;

  try {
    while (bridge.world.tick - startTick < maxTicks) {
      bridge.step(TICK_DELTA_MS);

      // Probe order: error -> engineHalt -> stopWhen -> maxTicks
      if (recorder.lastError) {
        stopReason = recorder.lastError instanceof SinkWriteError ? 'sinkError' : 'recorderError';
        const rawDetails = recorder.lastError.details;
        const errDetails =
          rawDetails !== null
          && typeof rawDetails === 'object'
          && !Array.isArray(rawDetails)
            ? (rawDetails as Record<string, unknown>)
            : undefined;
        errorCode = (errDetails?.code as string | undefined) ?? recorder.lastError.name;
        errorMessage = recorder.lastError.message;
        // Surface the error's structured details to REPORT.md so sink
        // failures (e.g., FileSink path / errno) carry diagnosis context.
        if (errDetails) {
          details = errDetails as OracleEnvelope['details'];
        }
        break;
      }

      const halt = bridge.getHudState().engineHalted;
      if (halt !== null) {
        stopReason = 'engineHalt';
        errorCode = halt.code;
        errorMessage = halt.message;
        details = {
          tick: halt.tick,
          phase: halt.phase,
          systemName: halt.systemName,
        };
        break;
      }

      const matchState = bridge.getMatchState();
      if (matchState.outcome !== 'running') {
        stopReason = 'stopWhen';
        details = { outcome: matchState.outcome };
        break;
      }
    }
  } finally {
    recorder.disconnect();
  }

  const ticksRun = bridge.world.tick - startTick;
  const envelope: OracleEnvelope = {
    stopReason,
    ticksRun,
    seed,
    scenario,
    runStartedAt,
    runCompletedAt: new Date().toISOString(),
    ...(errorCode !== undefined ? { errorCode } : {}),
    ...(errorMessage !== undefined ? { errorMessage } : {}),
    ...(details !== undefined ? { details } : {}),
  };

  return {
    bundle: recorder.toBundle(),
    envelope,
  };
}
