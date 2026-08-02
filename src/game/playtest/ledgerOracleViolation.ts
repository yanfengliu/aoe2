// Adapter: render a self-improvement ledger finding in this repo's OracleViolation
// shape, so ledger findings and deterministic oracle violations read the same way.
// The canary drill uses it to check that a seeded bug's oracle actually fired.
//
// This module also used to pick which finding to auto-patch. That half left with
// the automated fix arm on 2026-08-01 — nothing here writes code any more.

import type { JsonValue, OracleViolation } from './types';
import type { SelfImprovementLedgerFinding } from './selfImprovementLoop';

export function ledgerFindingToOracleViolation(
  ledgerFinding: SelfImprovementLedgerFinding,
): OracleViolation {
  const finding = ledgerFinding.finding;
  const embedded = oracleViolationPayload(finding.data);
  if (embedded) {
    return {
      oracle: stringValue(embedded.oracle, ledgerFinding.area ?? ledgerFinding.category),
      severity: severityValue(embedded.severity, normalizedSeverity(ledgerFinding.severity)),
      tick: tickValue(embedded.tick, tickFromEvidence(ledgerFinding.evidence)),
      message: stringValue(embedded.message, finding.observed || ledgerFinding.title),
      ...(isRecord(embedded.details) ? { details: embedded.details } : {}),
    };
  }

  return {
    oracle: ledgerFinding.area ?? ledgerFinding.category,
    severity: normalizedSeverity(ledgerFinding.severity),
    tick: tickFromEvidence(ledgerFinding.evidence),
    message: finding.observed || ledgerFinding.title,
    details: {
      findingId: ledgerFinding.id,
      category: ledgerFinding.category,
      nextAction: ledgerFinding.nextAction,
    },
  };
}

function oracleViolationPayload(value: unknown): Record<string, unknown> | null {
  if (!isRecord(value)) return null;
  const payload = value.aoe2OracleViolation;
  return isRecord(payload) ? payload : null;
}

function tickFromEvidence(
  evidence: SelfImprovementLedgerFinding['evidence'],
): number | null {
  if (!Array.isArray(evidence)) return null;
  for (const item of evidence) {
    if (!isRecord(item)) continue;
    if (item.kind === 'tick' && typeof item.tick === 'number' && Number.isFinite(item.tick)) {
      return item.tick;
    }
  }
  return null;
}

function tickValue(value: unknown, fallback: number | null): number | null {
  if (value === null) return null;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  return fallback;
}

function severityValue(
  value: unknown,
  fallback: OracleViolation['severity'],
): OracleViolation['severity'] {
  return value === 'high' || value === 'medium' || value === 'low'
    ? value
    : fallback;
}

function normalizedSeverity(value: unknown): OracleViolation['severity'] {
  if (value === 'critical') return 'high';
  return value === 'high' || value === 'medium' || value === 'low'
    ? value
    : 'low';
}

function stringValue(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.length > 0 ? value : fallback;
}

function isRecord(value: unknown): value is Record<string, JsonValue> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
