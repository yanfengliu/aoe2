import type { ImprovementFinding } from 'civ-engine';

export interface SelfImprovementFindingComparison {
  baselineCount: number;
  currentCount: number;
  resolved: string[];
  persisted: string[];
  introduced: string[];
}

export function compareSelfImprovementFindings(
  baseline: readonly ImprovementFinding[],
  current: readonly ImprovementFinding[],
): SelfImprovementFindingComparison {
  const baselineFindings = uniqueFindingIdentities(baseline);
  const currentFindings = uniqueFindingIdentities(current);
  const baselineSet = new Set(baselineFindings.map((finding) => finding.key));
  const currentSet = new Set(currentFindings.map((finding) => finding.key));

  return {
    baselineCount: baselineFindings.length,
    currentCount: currentFindings.length,
    resolved: baselineFindings
      .filter((finding) => !currentSet.has(finding.key))
      .map((finding) => finding.id),
    persisted: currentFindings
      .filter((finding) => baselineSet.has(finding.key))
      .map((finding) => finding.id),
    introduced: currentFindings
      .filter((finding) => !baselineSet.has(finding.key))
      .map((finding) => finding.id),
  };
}

interface FindingIdentity {
  key: string;
  id: string;
}

function uniqueFindingIdentities(findings: readonly ImprovementFinding[]): FindingIdentity[] {
  const seen = new Set<string>();
  const out: FindingIdentity[] = [];
  for (const finding of findings) {
    const identity = findingIdentity(finding);
    if (seen.has(identity.key)) continue;
    seen.add(identity.key);
    out.push(identity);
  }
  return out;
}

function findingIdentity(finding: ImprovementFinding): FindingIdentity {
  const oracle = oracleFindingPayload(finding.data);
  if (oracle) {
    return {
      key: `oracle:${JSON.stringify([oracle.oracle, oracle.tick, oracle.message])}`,
      id: finding.id,
    };
  }
  return { key: `id:${finding.id}`, id: finding.id };
}

interface OracleFindingPayload {
  oracle: string;
  tick: number | null;
  message: string;
}

function oracleFindingPayload(data: ImprovementFinding['data']): OracleFindingPayload | null {
  if (!isRecord(data)) return null;
  const value = data.aoe2OracleViolation;
  if (!isRecord(value)) return null;
  const { oracle, tick, message } = value;
  if (typeof oracle !== 'string') return null;
  if (typeof message !== 'string') return null;
  if (tick !== null && (typeof tick !== 'number' || !Number.isFinite(tick))) return null;
  return { oracle, tick, message };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
