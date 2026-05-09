// Shape-only validation for LLM-agent dispatched commands. Runs before
// pushing onto pendingCommands; the existing semantic validators run
// later inside `world.submitWithResult` during `drainPendingCommands`,
// and any rejections surface via `bridge.consumeCommandRejection()`.
//
// Per docs/threads/current/llm-agent-playtest/DESIGN.md §1: this method
// returns a structured `CommandDispatchResult` rather than a boolean so
// the trace can distinguish concrete failure modes.

import type { GameCommands } from '../../game/simulation/commands';
import type { CommandDispatchResult } from '../../game/playtest/types';

const KNOWN_KINDS: ReadonlySet<keyof GameCommands> = new Set([
  'unit.move',
  'unit.attack',
  'unit.gather',
  'unit.context',
  'unit.contextAtEntity',
  'sheep.move',
  'monk.contextAtEntity',
  'trebuchet.pack',
  'trebuchet.unpack',
  'queue.train',
  'queue.research',
  'market.action',
  'building.placeConfirm',
  'building.setRallyPoint',
  'building.action',
] as const);

export interface AgentCommandShape {
  type: keyof GameCommands;
  data: Record<string, unknown>;
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function isPosition(v: unknown): v is { x: number; y: number } {
  return (
    isPlainObject(v)
    && typeof v.x === 'number' && Number.isFinite(v.x)
    && typeof v.y === 'number' && Number.isFinite(v.y)
  );
}

function isPositiveInteger(v: unknown): v is number {
  return typeof v === 'number' && Number.isInteger(v) && v > 0;
}

// Per-discriminator required-field check. Defensive against the LLM
// sending a kind it has the right name for but missing/mistyping a
// field. Catches the common "model invented the schema" failure mode.
function checkRequiredFields(
  type: keyof GameCommands,
  data: Record<string, unknown>,
): { ok: true } | { ok: false; missing: string } {
  const need = (key: string, predicate: (v: unknown) => boolean): string | null => {
    return predicate(data[key]) ? null : key;
  };
  let missing: string | null = null;
  switch (type) {
    case 'unit.move':
    case 'unit.context':
      missing = need('unitId', isPositiveInteger) ?? need('target', isPosition);
      break;
    case 'sheep.move':
      // sheep.move uses sheepId, not unitId (commands.ts:44).
      missing = need('sheepId', isPositiveInteger) ?? need('target', isPosition);
      break;
    case 'building.setRallyPoint':
      // building.setRallyPoint uses buildingId, not unitId (commands.ts:59).
      missing = need('buildingId', isPositiveInteger) ?? need('target', isPosition);
      break;
    case 'unit.attack':
      missing = need('unitId', isPositiveInteger)
        ?? need('targetEntityId', isPositiveInteger)
        ?? need('targetEntityKind', (v) => v === 'unit' || v === 'building' || v === 'resource');
      break;
    case 'unit.gather':
      missing = need('unitId', isPositiveInteger) ?? need('resourceId', isPositiveInteger);
      break;
    case 'unit.contextAtEntity':
    case 'monk.contextAtEntity':
      missing = need('unitId', isPositiveInteger) ?? need('targetEntityId', isPositiveInteger);
      break;
    case 'trebuchet.pack':
    case 'trebuchet.unpack':
      missing = need('unitId', isPositiveInteger);
      break;
    case 'queue.train':
      missing = need('buildingId', isPositiveInteger) ?? need('unitType', (v) => typeof v === 'string');
      break;
    case 'queue.research':
      missing = need('buildingId', isPositiveInteger)
        ?? need('technologyType', (v) => typeof v === 'string');
      break;
    case 'market.action':
      missing = need('playerId', isPositiveInteger) ?? need('actionType', (v) => typeof v === 'string');
      break;
    case 'building.placeConfirm':
      missing = need('builderId', isPositiveInteger)
        ?? need('buildingType', (v) => typeof v === 'string')
        ?? need('position', isPosition);
      break;
    case 'building.action':
      missing = need('buildingId', isPositiveInteger)
        ?? need('actionType', (v) => typeof v === 'string');
      break;
  }
  return missing === null ? { ok: true } : { ok: false, missing };
}

export interface ValidateAgentCommandOptions {
  // Acceptable owner range; rejected if a command's player is outside.
  // Today only `market.action` carries an explicit `playerId`; the rest
  // route through unit/building entities whose ownership is enforced
  // by semantic validators downstream. Range is mostly here to catch
  // the LLM emitting `playerId: 0` or absurd values.
  ownerRangeInclusive: { min: number; max: number };
}

export function validateAgentCommandShape(
  raw: unknown,
  opts: ValidateAgentCommandOptions,
): CommandDispatchResult {
  if (!isPlainObject(raw)) {
    return { accepted: false, reason: 'malformed-payload', details: 'envelope must be an object' };
  }
  const { type, data } = raw as { type?: unknown; data?: unknown };
  if (typeof type !== 'string' || !KNOWN_KINDS.has(type as keyof GameCommands)) {
    return { accepted: false, reason: 'unknown-kind', details: `unknown command kind: ${String(type)}` };
  }
  if (!isPlainObject(data)) {
    return { accepted: false, reason: 'malformed-payload', details: 'data must be an object' };
  }
  const required = checkRequiredFields(type as keyof GameCommands, data);
  if (!required.ok) {
    return {
      accepted: false,
      reason: 'malformed-payload',
      details: `missing or invalid field: ${required.missing}`,
    };
  }
  if (type === 'market.action') {
    const pid = (data as { playerId: number }).playerId;
    if (pid < opts.ownerRangeInclusive.min || pid > opts.ownerRangeInclusive.max) {
      return {
        accepted: false,
        reason: 'wrong-owner-range',
        details: `playerId ${pid} outside [${opts.ownerRangeInclusive.min}, ${opts.ownerRangeInclusive.max}]`,
      };
    }
  }
  return { accepted: true, commandKind: type as keyof GameCommands, normalized: data };
}
