import { describe, expect, it } from 'vitest';

import { parseSessionBundleFile } from '../../src/game/replay/parseSessionBundleFile';

const validBundle = {
  schemaVersion: 1,
  metadata: { sessionId: 's1', startTick: 0, endTick: 5, sourceKind: 'session', sourceLabel: 'test', recordedAt: '2026-05-06T00:00:00.000Z' },
  commands: [{ submissionTick: 1, sequence: 0, type: 'unit.move' }],
  initialSnapshot: { tick: 0, state: [] },
  ticks: [],
  executions: [],
  failures: [],
  snapshots: [],
  markers: [],
  attachments: [],
};

describe('parseSessionBundleFile', () => {
  it('returns ok with the parsed bundle for a structurally valid input', () => {
    const result = parseSessionBundleFile(JSON.stringify(validBundle));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.bundle.metadata.sessionId).toBe('s1');
      expect(result.bundle.commands.length).toBe(1);
    }
  });

  it('returns "invalid JSON" for non-JSON input', () => {
    const result = parseSessionBundleFile('not valid json');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('invalid JSON');
  });

  it('returns "top-level is not an object" for array input', () => {
    const result = parseSessionBundleFile(JSON.stringify([1, 2, 3]));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('top-level is not an object');
  });

  it('returns "top-level is not an object" for null', () => {
    const result = parseSessionBundleFile('null');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('top-level is not an object');
  });

  it('returns "missing field metadata" when metadata is absent', () => {
    const { metadata: _, ...rest } = validBundle;
    void _;
    const result = parseSessionBundleFile(JSON.stringify(rest));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('missing field metadata');
  });

  it('returns "missing field commands" when commands is absent', () => {
    const { commands: _, ...rest } = validBundle;
    void _;
    const result = parseSessionBundleFile(JSON.stringify(rest));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('missing field commands');
  });

  it('returns "missing field initialSnapshot" when initialSnapshot is absent', () => {
    const { initialSnapshot: _, ...rest } = validBundle;
    void _;
    const result = parseSessionBundleFile(JSON.stringify(rest));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('missing field initialSnapshot');
  });

  it('returns "missing field markers" when markers is absent (replay UI iterates this)', () => {
    const { markers: _, ...rest } = validBundle;
    void _;
    const result = parseSessionBundleFile(JSON.stringify(rest));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('missing field markers');
  });

  it('returns "missing field failures" when failures is absent (replay TimelinePanel iterates hotspots)', () => {
    const { failures: _, ...rest } = validBundle;
    void _;
    const result = parseSessionBundleFile(JSON.stringify(rest));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('missing field failures');
  });

  it('returns "missing field snapshots" when snapshots is absent', () => {
    const { snapshots: _, ...rest } = validBundle;
    void _;
    const result = parseSessionBundleFile(JSON.stringify(rest));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('missing field snapshots');
  });

  it('returns "missing field schemaVersion" when schemaVersion is absent (replayer rejects later otherwise)', () => {
    const { schemaVersion: _, ...rest } = validBundle;
    void _;
    const result = parseSessionBundleFile(JSON.stringify(rest));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('missing field schemaVersion');
  });

  it('returns a typed reason when schemaVersion is the wrong type', () => {
    const result = parseSessionBundleFile(JSON.stringify({ ...validBundle, schemaVersion: 'one' }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('schemaVersion is not a number');
  });

  it('returns "commands is not an array" when commands is wrong type', () => {
    const result = parseSessionBundleFile(JSON.stringify({ ...validBundle, commands: 'not an array' }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('commands is not an array');
  });

  it('returns "metadata is not an object" when metadata is a string', () => {
    const result = parseSessionBundleFile(JSON.stringify({ ...validBundle, metadata: 'oops' }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('metadata is not an object');
  });

  it('returns "missing field metadata.sessionId" when nested field is absent', () => {
    const result = parseSessionBundleFile(
      JSON.stringify({ ...validBundle, metadata: { startTick: 0, endTick: 5 } }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('missing field metadata.sessionId');
  });

  it('returns a typed reason when sessionId is the wrong type', () => {
    const result = parseSessionBundleFile(
      JSON.stringify({ ...validBundle, metadata: { sessionId: 42, startTick: 0, endTick: 5 } }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('metadata.sessionId is not a string');
  });

  it('returns a typed reason when startTick is the wrong type', () => {
    const result = parseSessionBundleFile(
      JSON.stringify({ ...validBundle, metadata: { sessionId: 's1', startTick: 'zero', endTick: 5 } }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('metadata.startTick / endTick must be numbers');
  });
});
