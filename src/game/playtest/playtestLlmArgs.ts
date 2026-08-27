// CLI argument parsing + validation for scripts/playtest-llm.mjs, extracted to
// a typed, unit-testable module (full-review iter-2 H8). The script previously
// parsed numeric flags with a bare `Number(...)`, so `Number('nope') === NaN`
// made every budget/tick comparison in llmAgent/llmRunner false — silently
// removing the spend and run bounds. Validation lives here and THROWS
// `PlaytestLlmArgError`; the script catches it and exits 2 (keeps the exit-code
// contract while making the logic testable off-process).

export class PlaytestLlmArgError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PlaytestLlmArgError';
  }
}

export interface PlaytestLlmArgs {
  seed: string;
  /** v0.3.142: the human slot's civilization (?civ= URL param), '' = default. */
  civ: string;
  maxTicks: number;
  out: string;
  decisionInterval: number;
  strategyEvery: number;
  owners: number[];
  costBudget: number;
  provider: 'claude-code' | 'api' | null;
  useDevServer: boolean;
  noScreenshot: boolean;
  screenshotEvery: number;
  omniscient: boolean;
  knownFindings: string | null;
}

function requireFinite(
  raw: string | undefined,
  flag: string,
  opts: { integer?: boolean; min?: number } = {},
): number {
  const { integer = false, min } = opts;
  const n = Number(raw);
  const ok =
    raw !== undefined &&
    raw.trim() !== '' &&
    Number.isFinite(n) &&
    (!integer || Number.isInteger(n)) &&
    (min === undefined || n >= min);
  if (!ok) {
    const kind = integer ? 'an integer' : 'a finite number';
    const bound = min === undefined ? '' : ` >= ${min}`;
    throw new PlaytestLlmArgError(
      `playtest-llm: ${flag} must be ${kind}${bound}, got '${raw ?? '(missing)'}'`,
    );
  }
  return n;
}

function requireValue(raw: string | undefined, flag: string): string {
  if (raw === undefined) {
    throw new PlaytestLlmArgError(`playtest-llm: ${flag} requires a value`);
  }
  return raw;
}

export function parsePlaytestLlmArgs(argv: readonly string[]): PlaytestLlmArgs {
  const args: PlaytestLlmArgs = {
    seed: 'aoe2-prototype',
    civ: '',
    maxTicks: 5000,
    out: 'output/playtests-llm/run',
    decisionInterval: 250,
    strategyEvery: 10,
    // LLM plays player 1 (the human slot) so player 2's in-game AI is a real
    // opponent (campaign-1..5 used owners [2], leaving player 1 inert).
    owners: [1],
    costBudget: 5.0,
    provider: null, // null = auto-detect
    useDevServer: false,
    noScreenshot: false,
    screenshotEvery: 1000, // dashboard checkpoint cadence; 0 disables
    omniscient: false,
    knownFindings: null,
  };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i]!;
    if (a === '--seed') args.seed = requireValue(argv[++i], '--seed');
    else if (a === '--civ') args.civ = requireValue(argv[++i], '--civ');
    else if (a === '--max-ticks') args.maxTicks = requireFinite(argv[++i], '--max-ticks', { integer: true, min: 1 });
    else if (a === '--out') args.out = requireValue(argv[++i], '--out');
    else if (a === '--decision-interval') args.decisionInterval = requireFinite(argv[++i], '--decision-interval', { integer: true, min: 1 });
    else if (a === '--strategy-every') args.strategyEvery = requireFinite(argv[++i], '--strategy-every', { integer: true, min: 1 });
    else if (a === '--owners') args.owners = requireValue(argv[++i], '--owners').split(',').map((o) => requireFinite(o, '--owners', { integer: true, min: 1 }));
    else if (a === '--cost-budget') args.costBudget = requireFinite(argv[++i], '--cost-budget', { min: 0 });
    else if (a === '--provider') {
      const v = requireValue(argv[++i], '--provider');
      if (v !== 'claude-code' && v !== 'api') {
        throw new PlaytestLlmArgError(`playtest-llm: --provider must be 'claude-code' or 'api', got '${v}'`);
      }
      args.provider = v;
    } else if (a === '--use-dev-server') args.useDevServer = true;
    else if (a === '--no-screenshot') args.noScreenshot = true;
    else if (a === '--screenshot-every') args.screenshotEvery = requireFinite(argv[++i], '--screenshot-every', { integer: true, min: 0 });
    else if (a === '--omniscient') args.omniscient = true;
    else if (a === '--known-findings') args.knownFindings = requireValue(argv[++i], '--known-findings');
    else if (a.startsWith('--')) {
      throw new PlaytestLlmArgError(`playtest-llm: unknown argument '${a}'`);
    }
  }
  return args;
}
