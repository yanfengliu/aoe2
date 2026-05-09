// Schema validator for playtest-corpus-llm.json. Mirrors the
// deterministic corpus schema in `corpusSchema.ts` but with LLM-
// specific fields (decisionInterval, owners, optional cost-budget
// override per row).

export interface PlaytestLlmCorpusRun {
  name: string;
  seed: string;
  maxTicks: number;
  decisionInterval?: number; // default 250
  owners?: number[]; // default [2]
  costBudgetUsd?: number; // default uses agent's --cost-budget
}

export interface PlaytestLlmCorpus {
  runs: PlaytestLlmCorpusRun[];
}

export class CorpusLlmParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CorpusLlmParseError';
  }
}

function isPositiveInteger(v: unknown): v is number {
  return typeof v === 'number' && Number.isInteger(v) && v > 0;
}

export function parseCorpusLlmFile(text: string): PlaytestLlmCorpus {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (err) {
    throw new CorpusLlmParseError(
      `invalid JSON: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new CorpusLlmParseError('top-level must be an object');
  }
  const root = parsed as Record<string, unknown>;
  if (!Array.isArray(root.runs)) {
    throw new CorpusLlmParseError('field "runs" must be an array');
  }
  const runs: PlaytestLlmCorpusRun[] = [];
  for (let i = 0; i < root.runs.length; i++) {
    const r = root.runs[i];
    if (typeof r !== 'object' || r === null || Array.isArray(r)) {
      throw new CorpusLlmParseError(`runs[${i}] must be an object`);
    }
    const row = r as Record<string, unknown>;
    if (typeof row.name !== 'string' || row.name.trim() === '') {
      throw new CorpusLlmParseError(`runs[${i}].name must be a non-empty string`);
    }
    if (typeof row.seed !== 'string' || row.seed.trim() === '') {
      throw new CorpusLlmParseError(`runs[${i}].seed must be a non-empty string`);
    }
    if (!isPositiveInteger(row.maxTicks)) {
      throw new CorpusLlmParseError(`runs[${i}].maxTicks must be a positive integer`);
    }
    let decisionInterval: number | undefined;
    if (row.decisionInterval !== undefined) {
      if (!isPositiveInteger(row.decisionInterval)) {
        throw new CorpusLlmParseError(
          `runs[${i}].decisionInterval must be a positive integer if provided`,
        );
      }
      decisionInterval = row.decisionInterval;
    }
    let owners: number[] | undefined;
    if (row.owners !== undefined) {
      if (!Array.isArray(row.owners) || row.owners.length === 0) {
        throw new CorpusLlmParseError(
          `runs[${i}].owners must be a non-empty array if provided`,
        );
      }
      for (const o of row.owners) {
        if (!isPositiveInteger(o)) {
          throw new CorpusLlmParseError(
            `runs[${i}].owners must contain only positive integers`,
          );
        }
      }
      owners = row.owners as number[];
    }
    let costBudgetUsd: number | undefined;
    if (row.costBudgetUsd !== undefined) {
      if (typeof row.costBudgetUsd !== 'number' || row.costBudgetUsd <= 0) {
        throw new CorpusLlmParseError(
          `runs[${i}].costBudgetUsd must be a positive number if provided`,
        );
      }
      costBudgetUsd = row.costBudgetUsd;
    }
    runs.push({
      name: row.name,
      seed: row.seed,
      maxTicks: row.maxTicks,
      ...(decisionInterval !== undefined && { decisionInterval }),
      ...(owners !== undefined && { owners }),
      ...(costBudgetUsd !== undefined && { costBudgetUsd }),
    });
  }
  return { runs };
}
