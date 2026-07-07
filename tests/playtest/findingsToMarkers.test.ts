// Unit tests for the AI-findings → agent-marker bridge (v0.1.36).
// Three pure functions: findingsToMarkers (the mapping contract),
// injectAgentMarkers (idempotent in-place overlay), deriveAnchorTick
// (the coarse anchor + its edge cases). No I/O — the .mjs script is
// thin glue around these.

import { describe, it, expect } from 'vitest';
import type { Marker, SessionBundle } from 'civ-engine';

import { isAoeMarkerData } from '../../src/game/annotations/markerSchema';
import type { ConformanceFinding, ConformanceTraceRow } from '../../src/game/playtest/conformanceProbe';
import {
  findingsToMarkers,
  injectAgentMarkers,
  deriveAnchorTick,
} from '../../src/game/playtest/findingsToMarkers';

const FIXED_CREATED_AT = '2026-06-15T00:00:00.000Z';

function finding(overrides: Partial<ConformanceFinding> = {}): ConformanceFinding {
  return {
    category: 'missing-feature',
    area: 'castle-age',
    observed: 'no command to advance past Feudal',
    expected: 'researching Castle Age at the Town Center',
    severity: 'high',
    suggestion: 'implement the age-up command',
    ...overrides,
  };
}

const CTX = { anchorTick: 250, agentId: 'campaign-4 / claude-opus-4-8', createdAt: FIXED_CREATED_AT };

describe('findingsToMarkers', () => {
  it('empty findings → empty markers', () => {
    expect(findingsToMarkers([], CTX)).toEqual([]);
  });

  it('produces one well-formed agent marker per finding', () => {
    const markers = findingsToMarkers([finding(), finding({ area: 'market' })], CTX);
    expect(markers).toHaveLength(2);
    for (const m of markers) {
      expect(m.kind).toBe('annotation');
      expect(m.provenance).toBe('game');
      expect(m.tick).toBe(250);
      expect(Number.isInteger(m.tick)).toBe(true);
      // Slice 1 omits position entirely (no spatial anchor for findings).
      expect(m.refs).toBeUndefined();
      expect(m.createdAt).toBe(FIXED_CREATED_AT);
      const data = m.data as Record<string, unknown>;
      expect(data.author).toBe('agent');
      expect(data.agentId).toBe('campaign-4 / claude-opus-4-8');
    }
  });

  it('assigns unique, deterministic ids', () => {
    const markers = findingsToMarkers([finding(), finding(), finding()], CTX);
    const ids = markers.map((m) => m.id);
    expect(new Set(ids).size).toBe(3);
    const improvementIds = markers.map((m) => {
      const payload = (m.data as Record<string, unknown>).improvementLoop as { finding?: { id?: unknown } };
      return payload.finding?.id;
    });
    expect(improvementIds).toEqual([
      'aoe2-conformance-missing-feature-castle-age-250-0',
      'aoe2-conformance-missing-feature-castle-age-250-1',
      'aoe2-conformance-missing-feature-castle-age-250-2',
    ]);
    expect(new Set(improvementIds).size).toBe(3);
    // Deterministic: same inputs → identical ids (no Math.random/Date.now).
    const again = findingsToMarkers([finding(), finding(), finding()], CTX);
    expect(again.map((m) => m.id)).toEqual(ids);
    expect(
      again.map((m) => {
        const payload = (m.data as Record<string, unknown>).improvementLoop as { finding?: { id?: unknown } };
        return payload.finding?.id;
      }),
    ).toEqual(improvementIds);
  });

  it('is fully deterministic (re-run yields structurally identical markers)', () => {
    const a = findingsToMarkers([finding(), finding({ severity: 'low' })], CTX);
    const b = findingsToMarkers([finding(), finding({ severity: 'low' })], CTX);
    expect(b).toEqual(a);
  });

  it('maps every finding to category "ai" but preserves the gap type in data', () => {
    const categories: ConformanceFinding['category'][] = [
      'missing-feature',
      'spec-divergence',
      'functional-bug',
      'balance-divergence',
      'ux-gap',
    ];
    for (const category of categories) {
      const [m] = findingsToMarkers([finding({ category })], CTX);
      const data = m.data as Record<string, unknown>;
      expect(data.category).toBe('ai');
      expect(data.findingCategory).toBe(category);
    }
  });

  it('maps severity high→bug, medium→warning, low→info', () => {
    const cases: Array<[ConformanceFinding['severity'], string]> = [
      ['high', 'bug'],
      ['medium', 'warning'],
      ['low', 'info'],
    ];
    for (const [severity, expected] of cases) {
      const [m] = findingsToMarkers([finding({ severity })], CTX);
      expect((m.data as Record<string, unknown>).severity).toBe(expected);
    }
  });

  it('produced data satisfies the AoeMarkerData schema invariants', () => {
    const markers = findingsToMarkers(
      [finding({ severity: 'high' }), finding({ severity: 'medium' }), finding({ severity: 'low' })],
      CTX,
    );
    for (const m of markers) {
      expect(isAoeMarkerData(m.data)).toBe(true);
    }
  });

  it('embeds the shared visual-playtest finding payload without breaking AoeMarkerData', () => {
    const [m] = findingsToMarkers([finding({ category: 'ux-gap', area: 'command-card', severity: 'medium' })], CTX);
    expect(m.id).toBe('agent-finding-0');
    expect(m.tick).toBe(250);
    expect(m.text).toBe('[ux-gap] command-card: no command to advance past Feudal');
    expect(isAoeMarkerData(m.data)).toBe(true);
    const data = m.data as Record<string, unknown>;
    expect(data.author).toBe('agent');
    expect(data.category).toBe('ai');
    expect(data.severity).toBe('warning');
    expect(data.visualPlaytest).toMatchObject({
      schemaVersion: 1,
      type: 'finding',
      finding: {
        title: 'ux-gap - command-card',
        severity: 'medium',
        category: 'usability',
        area: 'command-card',
        observed: 'no command to advance past Feudal',
        expected: 'researching Castle Age at the Town Center',
        suggestion: 'implement the age-up command',
        evidence: { tick: 250 },
        data: { aoe2FindingCategory: 'ux-gap' },
      },
    });
    expect(data.improvementLoop).toMatchObject({
      schemaVersion: 1,
      type: 'finding',
      finding: {
        schemaVersion: 1,
        id: 'aoe2-conformance-ux-gap-command-card-250-0',
        title: 'ux-gap - command-card',
        severity: 'medium',
        category: 'usability',
        area: 'command-card',
        observed: 'no command to advance past Feudal',
        expected: 'researching Castle Age at the Town Center',
        suggestion: 'implement the age-up command',
        evidence: [{ kind: 'tick', tick: 250 }],
        verificationStatus: 'unverified',
        nextAction: 'proposalOnly',
        data: { aoe2FindingCategory: 'ux-gap' },
      },
    });
  });

  it('builds text "[<findingCategory>] <area>: <observed>" and carries detail in data', () => {
    const [m] = findingsToMarkers(
      [finding({ category: 'spec-divergence', area: 'monk', observed: 'heals instantly' })],
      CTX,
    );
    expect(m.text).toBe('[spec-divergence] monk: heals instantly');
    const data = m.data as Record<string, unknown>;
    expect(data.area).toBe('monk');
    expect(data.observed).toBe('heals instantly');
    expect(data.expected).toBe(finding().expected);
    expect(data.suggestion).toBe(finding().suggestion);
  });
});

// Minimal SessionBundle stub — only the fields these helpers touch.
function bundle(markers: Marker[], endTick = 1000): SessionBundle {
  return {
    schemaVersion: 1,
    metadata: { sessionId: 's', startTick: 0, endTick },
    initialSnapshot: {},
    ticks: [],
    commands: [],
    executions: [],
    failures: [],
    snapshots: [],
    markers,
    attachments: [],
  } as unknown as SessionBundle;
}

function humanMarker(id: string, tick = 42): Marker {
  return {
    id,
    tick,
    kind: 'annotation',
    provenance: 'game',
    text: 'human note',
    data: { author: 'human', severity: 'info', category: 'general' },
  };
}

function agentMarker(id: string, tick = 250): Marker {
  return {
    id,
    tick,
    kind: 'annotation',
    provenance: 'game',
    text: 'old agent finding',
    data: { author: 'agent', agentId: 'prior', severity: 'bug', category: 'ai' },
  };
}

describe('injectAgentMarkers', () => {
  it('appends agent markers onto an empty bundle', () => {
    const result = injectAgentMarkers(bundle([]), findingsToMarkers([finding()], CTX));
    expect(result.markers).toHaveLength(1);
    expect((result.markers[0].data as Record<string, unknown>).author).toBe('agent');
  });

  it('preserves non-agent (human) markers', () => {
    const human = humanMarker('h1');
    const result = injectAgentMarkers(bundle([human]), findingsToMarkers([finding()], CTX));
    expect(result.markers).toContainEqual(human);
    expect(result.markers.filter((m) => (m.data as { author?: string })?.author === 'agent')).toHaveLength(1);
  });

  it('is idempotent: re-injecting replaces prior agent markers instead of duplicating', () => {
    const newAgentMarkers = findingsToMarkers([finding(), finding({ area: 'market' })], CTX);
    // Bundle already carries a prior agent-marker set (from a previous run).
    const seeded = bundle([humanMarker('h1'), agentMarker('a-old-0'), agentMarker('a-old-1')]);
    const result = injectAgentMarkers(seeded, newAgentMarkers);
    const agents = result.markers.filter((m) => (m.data as { author?: string })?.author === 'agent');
    expect(agents).toHaveLength(2);
    // None of the OLD agent ids survive.
    expect(result.markers.map((m) => m.id)).not.toContain('a-old-0');
    expect(result.markers.map((m) => m.id)).not.toContain('a-old-1');
    // Human marker still present.
    expect(result.markers.some((m) => m.id === 'h1')).toBe(true);
  });

  it('running twice with the same findings does not grow the agent-marker count', () => {
    const markers = findingsToMarkers([finding()], CTX);
    const once = injectAgentMarkers(bundle([]), markers);
    const twice = injectAgentMarkers(once, markers);
    const agents = twice.markers.filter((m) => (m.data as { author?: string })?.author === 'agent');
    expect(agents).toHaveLength(1);
  });
});

function row(tickAfter: number, decisionIndex = 0): ConformanceTraceRow {
  return {
    decisionIndex,
    tickBefore: Math.max(0, tickAfter - 250),
    tickAfter,
    thought: 't',
    commands: [],
    costUsd: 0,
    stopReason: 'normal',
    dispatchEvents: [],
  };
}

describe('deriveAnchorTick', () => {
  it("uses the last decision's tickAfter", () => {
    expect(deriveAnchorTick([row(250, 0), row(500, 1), row(750, 2)], bundle([], 1000))).toBe(750);
  });

  it('falls back to metadata.endTick when the trace is empty', () => {
    expect(deriveAnchorTick([], bundle([], 1234))).toBe(1234);
  });

  it('uses persistedEndTick when a historical bundle has endTick stuck at zero', () => {
    const repaired = bundle([], 0) as SessionBundle & { metadata: { persistedEndTick: number } };
    repaired.metadata.persistedEndTick = 9000;
    expect(deriveAnchorTick([row(9000, 35)], repaired)).toBe(9000);
  });

  it('falls back to metadata.endTick when the last row has no usable tickAfter', () => {
    const bad = { ...row(0), tickAfter: undefined as unknown as number };
    expect(deriveAnchorTick([bad], bundle([], 999))).toBe(999);
  });

  it('clamps a tickAfter beyond endTick down to endTick', () => {
    expect(deriveAnchorTick([row(5000, 0)], bundle([], 1000))).toBe(1000);
  });

  it('floors a non-integer tickAfter to an integer', () => {
    expect(deriveAnchorTick([row(250.7, 0)], bundle([], 1000))).toBe(250);
  });

  it('never returns a negative tick (clamps to 0)', () => {
    expect(deriveAnchorTick([row(-50, 0)], bundle([], 1000))).toBe(0);
  });
});
