// AI-findings → agent-marker bridge (v0.1.36). Turns the conformance
// probe's structured ConformanceFinding list (conformanceProbe.ts) into
// `author: 'agent'` Markers and overlays them onto a finished run's
// SessionBundle, so replaying that bundle surfaces the AI's findings in
// the existing replay marker UI (MarkerListPanel list + TimelinePanel
// pins) — see docs/threads/current/ai-findings-annotation-bridge/DESIGN.md.
//
// These three functions are PURE and deterministic (no Math.random,
// no Date.now — `createdAt` is passed in via ctx). The file I/O lives
// in scripts/playtest-findings.mjs, which is thin glue around them.
//
// Persistence is direct bundle-array injection, NOT recorder.addMarker:
// findings are computed post-hoc with no live World/recorder, and
// recorder.addMarker requires one. (The tick is NOT the blocker: the
// engine's validateNewMarker permits retroactive past-tick markers and
// rejects only tick > world.tick, rule 6.1.tick_future — so a past-tick
// finding marker would be accepted if a recorder existed; none does.) The
// replay-load path is structural-only (parseSessionBundleFile does not
// re-validate markers), so well-formed markers appended to bundle.markers[]
// load and render directly.

import type { Marker, SessionBundle } from 'civ-engine';

import type { AoeSeverity } from '../annotations/markerSchema';
import type { ConformanceFinding, ConformanceTraceRow } from './conformanceProbe';

/** Context for building markers from findings. `createdAt` is injected
 *  (not read from a clock) so the mapping stays pure/deterministic. */
export interface FindingsToMarkersContext {
  /** The tick every finding-marker is anchored at (see deriveAnchorTick).
   *  Slice 1: all findings share one coarse anchor — findings carry no
   *  per-finding tick. */
  readonly anchorTick: number;
  /** Provenance label for the marker author, e.g. "<run-prefix> / <model>". */
  readonly agentId: string;
  /** ISO timestamp for Marker.createdAt. Injected for determinism. */
  readonly createdAt?: string;
}

// Gap-type (finding.severity) → subsystem-marker severity (AoeSeverity).
// `blocker` is intentionally NOT used: it is reserved for a human author's
// "this stops me cold" signal; an advisory audit finding never claims it.
const SEVERITY_MAP: Record<ConformanceFinding['severity'], AoeSeverity> = {
  high: 'bug',
  medium: 'warning',
  low: 'info',
};

/** True for a marker this bridge authored (used by injectAgentMarkers to
 *  replace prior agent overlays idempotently without touching human
 *  markers). */
export function isAgentMarker(marker: Marker): boolean {
  const data = marker.data;
  if (data === null || typeof data !== 'object' || Array.isArray(data)) return false;
  return (data as { author?: unknown }).author === 'agent';
}

/**
 * Map conformance findings to `author: 'agent'` Markers, one per finding.
 *
 * Each marker: kind 'annotation', provenance 'game', anchored at
 * `ctx.anchorTick`, NO refs (findings have no spatial anchor in slice 1).
 * `data` carries AoeMarkerData (author/agentId/severity/category='ai')
 * plus the full finding detail (findingCategory/area/observed/expected/
 * suggestion) for a future detail panel — extra keys are tolerated by
 * isAoeMarkerData. The finding's gap-type (missing-feature, …) survives
 * as `data.findingCategory`; the marker `category` is always 'ai' so the
 * findings group visually and `area` (unbounded free-form) is never
 * fuzzy-mapped onto the bounded AoeCategory set.
 */
export function findingsToMarkers(
  findings: readonly ConformanceFinding[],
  ctx: FindingsToMarkersContext,
): Marker[] {
  return findings.map((finding, index) => {
    const severity = SEVERITY_MAP[finding.severity];
    const marker: Marker = {
      id: `agent-finding-${index}`,
      tick: ctx.anchorTick,
      kind: 'annotation',
      provenance: 'game',
      text: `[${finding.category}] ${finding.area}: ${finding.observed}`,
      data: {
        author: 'agent',
        agentId: ctx.agentId,
        severity,
        category: 'ai',
        // Extra finding detail (ignored by isAoeMarkerData; available to a
        // future marker-detail view). The 60-char list snippet can't hold
        // expected/suggestion, so they live here.
        findingCategory: finding.category,
        area: finding.area,
        observed: finding.observed,
        expected: finding.expected,
        suggestion: finding.suggestion,
      },
      ...(ctx.createdAt !== undefined ? { createdAt: ctx.createdAt } : {}),
    };
    return marker;
  });
}

/**
 * Overlay agent markers onto a bundle, returning a new bundle (shallow
 * copy; the input is not mutated). IDEMPOTENT: any pre-existing
 * agent-authored markers are dropped before the new set is appended, so
 * re-running the findings pass replaces rather than duplicates. Non-agent
 * (human) markers are preserved.
 */
export function injectAgentMarkers(
  bundle: SessionBundle,
  agentMarkers: readonly Marker[],
): SessionBundle {
  const preserved = bundle.markers.filter((m) => !isAgentMarker(m));
  return {
    ...bundle,
    markers: [...preserved, ...agentMarkers],
  };
}

/**
 * Derive the coarse anchor tick for a run's findings: the LAST decision's
 * `tickAfter`, falling back to `metadata.endTick` when the trace is empty
 * or the last row has no usable tickAfter. The result is floored to an
 * integer (Marker.tick must be an integer) and clamped to [0, endTick]
 * (markers past endTick are unreachable on the timeline). Findings carry
 * no per-finding tick, so all of a run's findings share this anchor;
 * rich per-finding anchoring is a deferred follow-up.
 */
export function deriveAnchorTick(
  rows: readonly ConformanceTraceRow[],
  bundle: SessionBundle,
): number {
  const endTick = bundle.metadata.endTick;
  const lastTickAfter = rows.length > 0 ? rows[rows.length - 1]!.tickAfter : undefined;
  const raw =
    typeof lastTickAfter === 'number' && Number.isFinite(lastTickAfter) ? lastTickAfter : endTick;
  const floored = Math.floor(raw);
  return Math.max(0, Math.min(floored, endTick));
}
