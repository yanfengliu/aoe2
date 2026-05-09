import { describe, it, expect } from 'vitest';
import { validateAgentCommandShape } from '../../src/app/bootstrap/agentCommandValidator';

const OWNERS = { ownerRangeInclusive: { min: 1, max: 8 } };

describe('validateAgentCommandShape', () => {
  it('accepts a canonical building.placeConfirm', () => {
    const r = validateAgentCommandShape(
      {
        type: 'building.placeConfirm',
        data: {
          builderId: 42,
          buildingType: 'farm',
          position: { x: 12, y: 14 },
          additionalBuilderIds: [43],
        },
      },
      OWNERS,
    );
    expect(r.accepted).toBe(true);
    if (r.accepted) {
      expect(r.commandKind).toBe('building.placeConfirm');
      expect(r.normalized).toMatchObject({ builderId: 42, buildingType: 'farm' });
    }
  });

  it('accepts a canonical queue.train', () => {
    const r = validateAgentCommandShape(
      { type: 'queue.train', data: { buildingId: 5, unitType: 'villager' } },
      OWNERS,
    );
    expect(r.accepted).toBe(true);
  });

  it('rejects unknown kind', () => {
    const r = validateAgentCommandShape({ type: 'fly.swarm', data: {} }, OWNERS);
    expect(r).toEqual({
      accepted: false,
      reason: 'unknown-kind',
      details: 'unknown command kind: fly.swarm',
    });
  });

  it('rejects non-object envelope', () => {
    const r = validateAgentCommandShape('not-an-object', OWNERS);
    expect(r.accepted).toBe(false);
    if (!r.accepted) expect(r.reason).toBe('malformed-payload');
  });

  it('rejects null envelope', () => {
    const r = validateAgentCommandShape(null, OWNERS);
    expect(r.accepted).toBe(false);
  });

  it('rejects missing data field', () => {
    const r = validateAgentCommandShape({ type: 'unit.move' }, OWNERS);
    expect(r.accepted).toBe(false);
    if (!r.accepted) expect(r.reason).toBe('malformed-payload');
  });

  it('rejects missing required field with the field name', () => {
    const r = validateAgentCommandShape(
      { type: 'queue.train', data: { buildingId: 5 } }, // missing unitType
      OWNERS,
    );
    expect(r.accepted).toBe(false);
    if (!r.accepted) {
      expect(r.reason).toBe('malformed-payload');
      expect(r.details).toContain('unitType');
    }
  });

  it('rejects bad position shape (string instead of {x,y})', () => {
    const r = validateAgentCommandShape(
      { type: 'unit.move', data: { unitId: 1, target: '12,14' } },
      OWNERS,
    );
    expect(r.accepted).toBe(false);
    if (!r.accepted) expect(r.reason).toBe('malformed-payload');
  });

  it('rejects negative entity ids', () => {
    const r = validateAgentCommandShape(
      { type: 'unit.move', data: { unitId: -3, target: { x: 1, y: 1 } } },
      OWNERS,
    );
    expect(r.accepted).toBe(false);
  });

  it('rejects market.action with out-of-range playerId', () => {
    const r = validateAgentCommandShape(
      { type: 'market.action', data: { playerId: 99, actionType: 'sell-wood' } },
      OWNERS,
    );
    expect(r).toMatchObject({ accepted: false, reason: 'wrong-owner-range' });
  });

  it('accepts market.action with in-range playerId', () => {
    const r = validateAgentCommandShape(
      { type: 'market.action', data: { playerId: 2, actionType: 'sell-wood' } },
      OWNERS,
    );
    expect(r.accepted).toBe(true);
  });

  it('accepts unit.attack with targetEntityKind discriminator', () => {
    const r = validateAgentCommandShape(
      {
        type: 'unit.attack',
        data: { unitId: 1, targetEntityId: 2, targetEntityKind: 'unit' },
      },
      OWNERS,
    );
    expect(r.accepted).toBe(true);
  });

  it('rejects unit.attack with bogus targetEntityKind', () => {
    const r = validateAgentCommandShape(
      {
        type: 'unit.attack',
        data: { unitId: 1, targetEntityId: 2, targetEntityKind: 'wonder' },
      },
      OWNERS,
    );
    expect(r.accepted).toBe(false);
  });

  it('accepts trebuchet.pack with just unitId', () => {
    const r = validateAgentCommandShape({ type: 'trebuchet.pack', data: { unitId: 7 } }, OWNERS);
    expect(r.accepted).toBe(true);
  });
});
