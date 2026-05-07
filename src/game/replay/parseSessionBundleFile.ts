import type { SessionBundle } from 'civ-engine';

export type ParseSessionBundleResult =
  | { readonly ok: true; readonly bundle: SessionBundle }
  | { readonly ok: false; readonly reason: string };

// All top-level fields a fully-formed `SessionBundle` carries. The
// replay UI (TimelinePanel mode listener) and the replayer itself
// iterate every array surface during/after `enterReplay`, so a partial
// bundle can throw AFTER the bridge has swapped into replay mode. That
// would violate the "invalid bundles never partially apply" contract.
// `schemaVersion` is also required because `enterReplay` exits any
// existing replay before constructing `SessionReplayer.fromBundle` —
// so a missing schemaVersion would partially apply (leave replay mode)
// before failing inside `_verifyVersionCompat()`. Match civ-engine
// `SessionBundle` exactly (session-bundle.ts:109-123).
const REQUIRED_TOP_LEVEL: ReadonlyArray<keyof SessionBundle> = [
  'schemaVersion',
  'metadata',
  'initialSnapshot',
  'ticks',
  'commands',
  'executions',
  'failures',
  'snapshots',
  'markers',
  'attachments',
];

const REQUIRED_METADATA_FIELDS: ReadonlyArray<keyof SessionBundle['metadata']> = [
  'sessionId',
  'startTick',
  'endTick',
];

const ARRAY_FIELDS: ReadonlyArray<keyof SessionBundle> = [
  'ticks',
  'commands',
  'executions',
  'failures',
  'snapshots',
  'markers',
  'attachments',
];

/**
 * Slice 4 (replay-load-and-e2e v0.1.11): parses raw JSON text from a
 * user-uploaded file into a structurally validated SessionBundle. This
 * is a structural check only — it does NOT validate command payloads,
 * marker schemas, or snapshot integrity. The civ-engine
 * `SessionReplayer.openAt` rejection path provides the deeper validation
 * at replay time.
 *
 * Returns `{ ok: true, bundle }` for structurally valid input or
 * `{ ok: false, reason }` with a user-friendly message describing the
 * first violation encountered.
 */
export function parseSessionBundleFile(text: string): ParseSessionBundleResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, reason: 'invalid JSON' };
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { ok: false, reason: 'top-level is not an object' };
  }
  const obj = parsed as Record<string, unknown>;
  for (const field of REQUIRED_TOP_LEVEL) {
    if (!(field in obj)) {
      return { ok: false, reason: `missing field ${field}` };
    }
  }
  // Required arrays — must be present (per REQUIRED_TOP_LEVEL above) and
  // typed as arrays. The earlier missing-field loop already flagged
  // absence, so here we only need to type-check.
  for (const field of ARRAY_FIELDS) {
    if (!Array.isArray(obj[field])) {
      return { ok: false, reason: `${field} is not an array` };
    }
  }
  const metadata = obj.metadata;
  if (metadata === null || typeof metadata !== 'object' || Array.isArray(metadata)) {
    return { ok: false, reason: 'metadata is not an object' };
  }
  const metaObj = metadata as Record<string, unknown>;
  for (const field of REQUIRED_METADATA_FIELDS) {
    if (!(field in metaObj)) {
      return { ok: false, reason: `missing field metadata.${String(field)}` };
    }
  }
  if (typeof metaObj.sessionId !== 'string') {
    return { ok: false, reason: 'metadata.sessionId is not a string' };
  }
  if (typeof metaObj.startTick !== 'number' || typeof metaObj.endTick !== 'number') {
    return { ok: false, reason: 'metadata.startTick / endTick must be numbers' };
  }
  if (typeof obj.schemaVersion !== 'number') {
    return { ok: false, reason: 'schemaVersion is not a number' };
  }
  return { ok: true, bundle: parsed as unknown as SessionBundle };
}
