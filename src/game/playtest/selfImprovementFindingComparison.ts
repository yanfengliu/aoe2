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

// Stable identity key for cross-run finding comparison — oracle findings key
// on the violation tuple so positional id-suffix churn does not defeat the
// resolved/persisted/introduced deltas or the recursive pass's prove-fixed check.
export function findingIdentityKey(finding: ImprovementFinding): string {
  return findingIdentity(finding).key;
}

// Within a SINGLE run's union (markers ∪ envelope ∪ oracle), dedup with a FINER
// key than the cross-run findingIdentityKey. Conformance findings key on their
// per-finding id: the SAME defect surfaced by both markers and the envelope
// carries the SAME id (tick + index) and still collapses, but two DISTINCT
// defects in one [category, area] have distinct id suffixes and are BOTH kept —
// whereas the coarse cross-run conformance key (deliberately [category, area] for
// resolved/introduced stability) collapsed them, hiding the second (iter-4
// review: a later HIGH could vanish behind an earlier LOW). Oracle findings keep
// the violation tuple, since their positional id churn would wrongly split true
// duplicates that appear in more than one source.
export function withinRunUnionKey(finding: ImprovementFinding): string {
  const oracle = oracleFindingPayload(finding.data);
  if (oracle) {
    return `oracle:${JSON.stringify([oracle.oracle, oracle.tick, oracle.message])}`;
  }
  return `id:${finding.id}`;
}

function findingIdentity(finding: ImprovementFinding): FindingIdentity {
  const oracle = oracleFindingPayload(finding.data);
  if (oracle) {
    return {
      key: `oracle:${JSON.stringify([oracle.oracle, oracle.tick, oracle.message])}`,
      id: finding.id,
    };
  }
  // M13-#3: conformance finding ids embed the anchor tick + index (see
  // visualPlaytestAdapter), so the SAME defect at tick 500 vs 750 gets a
  // different id → the `id:` fallback would report it resolved+introduced every
  // run. Key on the stable semantic signature (category + area) instead. This is
  // the safe direction (over-merge under-counts `introduced` rather than
  // thrashing); a normalized-`observed` discriminator is a possible refinement.
  if (isRecord(finding.data) && 'aoe2FindingCategory' in finding.data) {
    return {
      key: `conformance:${JSON.stringify([finding.category, finding.area ?? ''])}`,
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
