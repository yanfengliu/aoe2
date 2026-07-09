export interface RecursivePassArgs {
  seed: string;
  maxTicks: number;
  costBudget: number;
  baseline: string | null;
  knownFindings: string | null;
  /** 'auto' = full loop unless the worktree can't take it; true = strict --apply; false = --propose-only. */
  apply: 'auto' | true | false;
  outRoot: string;
  reviewer: string;
}

export function parseArgs(argv: string[]): RecursivePassArgs;
export function defaultKnownFindings(outRoot: string): string | null;
export function planRerunBudget(costBudgetUsd: number, runSpendUsd: number): number | null;
