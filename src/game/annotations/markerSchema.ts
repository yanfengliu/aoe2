// Spec 2 (annotation-ui v0.1.5) AO-6: AOE-side marker `data` schema.
// civ-engine's `Marker` is unchanged; aoe2 extends via the JSON-typed
// `marker.data` field. Screenshot attachment ids live in the generic
// `Marker.attachments: string[]` (NOT in `data.screenshotAttachmentId`)
// so generic consumers (BundleViewer, runMetrics) discover them
// without knowing AOE-specific shape.

// civ-engine doesn't re-export JsonValue from index.ts; define a local
// equivalent with the same shape to avoid a phantom import.
export type AoeJsonValue =
  | string
  | number
  | boolean
  | null
  | AoeJsonValue[]
  | { [key: string]: AoeJsonValue };

export type AoeAuthor = 'human' | 'agent';

export type AoeSeverity = 'info' | 'warning' | 'bug' | 'blocker';

export type AoeCategory =
  | 'pathfinding'
  | 'combat'
  | 'economy'
  | 'ai'
  | 'ui'
  | 'perf'
  | 'general';

export interface AoeMarkerData {
  readonly author: AoeAuthor;
  /** Present iff author === 'agent'. */
  readonly agentId?: string;
  /** Default 'info'. */
  readonly severity?: AoeSeverity;
  /** Default 'general'. */
  readonly category?: AoeCategory;
}

export const DEFAULT_SEVERITY: AoeSeverity = 'info';
export const DEFAULT_CATEGORY: AoeCategory = 'general';

const VALID_AUTHORS: ReadonlySet<string> = new Set(['human', 'agent']);
const VALID_SEVERITIES: ReadonlySet<string> = new Set([
  'info',
  'warning',
  'bug',
  'blocker',
]);
const VALID_CATEGORIES: ReadonlySet<string> = new Set([
  'pathfinding',
  'combat',
  'economy',
  'ai',
  'ui',
  'perf',
  'general',
]);

export function isAoeMarkerData(value: unknown): value is AoeMarkerData {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }
  const obj = value as Record<string, unknown>;
  if (!VALID_AUTHORS.has(obj.author as string)) return false;
  if (obj.agentId !== undefined && typeof obj.agentId !== 'string') return false;
  if (obj.severity !== undefined && !VALID_SEVERITIES.has(obj.severity as string)) {
    return false;
  }
  if (obj.category !== undefined && !VALID_CATEGORIES.has(obj.category as string)) {
    return false;
  }
  // author === 'human' must NOT carry agentId (per the schema invariant).
  if (obj.author === 'human' && obj.agentId !== undefined) return false;
  return true;
}
