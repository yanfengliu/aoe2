import { describe, expect, it } from 'vitest';
import {
  DEFAULT_CATEGORY,
  DEFAULT_SEVERITY,
  isAoeMarkerData,
} from '../../src/game/annotations/markerSchema';

describe('markerSchema', () => {
  describe('DEFAULT_*', () => {
    it('exports the documented defaults', () => {
      expect(DEFAULT_SEVERITY).toBe('info');
      expect(DEFAULT_CATEGORY).toBe('general');
    });
  });

  describe('isAoeMarkerData', () => {
    it('accepts a minimal human marker (author only)', () => {
      expect(isAoeMarkerData({ author: 'human' })).toBe(true);
    });

    it('accepts a full agent marker', () => {
      expect(
        isAoeMarkerData({
          author: 'agent',
          agentId: 'gpt-5.5',
          severity: 'bug',
          category: 'pathfinding',
        }),
      ).toBe(true);
    });

    it('rejects null / non-object / array', () => {
      expect(isAoeMarkerData(null)).toBe(false);
      expect(isAoeMarkerData('hello')).toBe(false);
      expect(isAoeMarkerData(42)).toBe(false);
      expect(isAoeMarkerData([])).toBe(false);
    });

    it('rejects unknown author', () => {
      expect(isAoeMarkerData({ author: 'system' })).toBe(false);
    });

    it('rejects unknown severity', () => {
      expect(isAoeMarkerData({ author: 'human', severity: 'critical' })).toBe(false);
    });

    it('rejects unknown category', () => {
      expect(isAoeMarkerData({ author: 'human', category: 'lore' })).toBe(false);
    });

    it('rejects non-string agentId', () => {
      expect(isAoeMarkerData({ author: 'agent', agentId: 42 })).toBe(false);
    });

    it('rejects human marker with agentId (schema invariant)', () => {
      expect(
        isAoeMarkerData({ author: 'human', agentId: 'oops' }),
      ).toBe(false);
    });

    it('agent without agentId is allowed (agentId optional)', () => {
      expect(isAoeMarkerData({ author: 'agent' })).toBe(true);
    });
  });
});
