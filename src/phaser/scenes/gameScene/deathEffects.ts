// M7 graphics — unit death feedback (v0.1.129). Before this slice a dying
// unit simply vanished between two frames; combat read as silhouettes
// blinking out. This module plays a short, readable death tell at the cell
// where the unit stood: the body tips over and collapses into the ground
// while fading, with a couple of expanding dust rings at ground level.
//
// Deaths arrive on the projected frame (ProjectedFrameView.recentUnitDeaths),
// emitted by the sim at the destroyUnitEntity chokepoint and fog-filtered per
// viewing player — present→absent diffing on the entity view cannot
// distinguish death from fog exit or garrisoning, so the render layer never
// guesses (see docs/devlog + spec §14). Same discipline as feedbackEffects
// (v0.1.45): all animation state lives render-side, driven by the scene
// clock; NO Math.random / Date.now — per-death variation derives
// deterministically from the entity id, so replays render identically.

import type { ProjectedUnitDeathView } from '../../../game/simulation/types';
import { worldToIso } from './isoProjection';

// Total life of one death effect, in ms. Long enough to read as a fall,
// short enough that battle corpses do not pile into visual noise.
export const DEATH_EFFECT_DURATION_MS = 700;

// Extra time isAnimating stays true PAST the visual end so the scene runs at
// least one more clearing render after the last frame fades (the same
// render-cache-freeze guard as feedbackEffects.FLASH_CLEAR_GRACE_MS).
export const DEATH_CLEAR_GRACE_MS = 80;

// Hard cap on simultaneously animating deaths — a mass-death tick (castle
// blast, conquest cleanup) plays the newest N instead of unbounded overdraw.
export const MAX_ACTIVE_DEATH_EFFECTS = 40;

// Ground dust tint: a warm neutral that reads on grass, sand, and shallows.
const DUST_TINT = 0xcbb489;

export interface DeathBodyGeometry {
  // Multipliers over the unit's base draw size.
  widthScale: number;
  heightScale: number;
  alpha: number;
  // -1 | +1: which way the body tips. Derived from id parity so a battle
  // line's corpses do not all fall the same way — deterministic, replay-safe.
  tipOffsetSign: number;
}

// Body collapse over progress p in [0,1]: height wilts to nothing, width
// spreads slightly (the silhouette folds onto the ground), alpha fades out.
// Pure — same inputs, same outputs.
export function deathBodyGeometry(progress: number, size: number, id: number): DeathBodyGeometry {
  const p = Math.min(1, Math.max(0, progress));
  return {
    widthScale: size * (1 + 0.35 * p),
    heightScale: size * (1 - p) * 0.9 + 0.02,
    alpha: (1 - p) * 0.85,
    tipOffsetSign: id % 2 === 0 ? 1 : -1,
  };
}

export interface DeathDustRing {
  radiusScale: number;
  alpha: number;
}

// Two staggered dust rings expanding from the impact and fading; both gone by
// the end of the effect. Pure.
export function deathDustRings(progress: number): DeathDustRing[] {
  const p = Math.min(1, Math.max(0, progress));
  if (p >= 1) {
    return [];
  }
  const rings: DeathDustRing[] = [{ radiusScale: 0.35 + 0.75 * p, alpha: 0.4 * (1 - p) }];
  // The second ring starts at 30% progress, trailing the first.
  if (p >= 0.3) {
    const trailing = (p - 0.3) / 0.7;
    rings.push({ radiusScale: 0.25 + 0.6 * trailing, alpha: 0.3 * (1 - trailing) });
  }
  return rings;
}

// Minimal Graphics surface the effect draws with — structural, so tests use a
// lightweight spy and this module stays free of Phaser imports.
export interface DeathEffectGraphics {
  fillStyle(color: number, alpha?: number): void;
  lineStyle(width: number, color: number, alpha?: number): void;
  fillEllipse(x: number, y: number, width: number, height: number): void;
  strokeEllipse(x: number, y: number, width: number, height: number): void;
}

interface DeathFrameSource {
  tick: number;
  recentUnitDeaths: ProjectedUnitDeathView[];
}

export interface DeathEffectsRenderer {
  // Ingest the current projected frame's death feed; each (id, tick) death is
  // admitted once no matter how many frames repeat it (the feed spans several
  // ticks so a snapshot rebuild cannot drop deaths).
  ingestFrame(frame: DeathFrameSource | null, nowMs: number): void;
  // Whether any effect is live (plus the clear grace) — keeps the scene's
  // render loop redrawing instead of caching a mid-fade frame.
  isAnimating(nowMs: number): boolean;
  // Draw every active effect. Call before the entity pass so corpses render
  // under living units and buildings.
  drawAll(graphics: DeathEffectGraphics, nowMs: number, cellSize: number): void;
  // Drop all state (bridge swap / scene reset).
  reset(): void;
  // Test/inspection aid.
  activeCount(): number;
}

interface ActiveDeathEffect {
  death: ProjectedUnitDeathView;
  startMs: number;
}

function deathKey(death: ProjectedUnitDeathView): string {
  return `${death.id}:${death.tick}`;
}

export function createDeathEffectsRenderer(): DeathEffectsRenderer {
  let active: ActiveDeathEffect[] = [];
  const seen = new Set<string>();

  function pruneExpired(nowMs: number): void {
    active = active.filter(
      (effect) => nowMs - effect.startMs < DEATH_EFFECT_DURATION_MS + DEATH_CLEAR_GRACE_MS,
    );
  }

  return {
    ingestFrame(frame, nowMs) {
      if (!frame) {
        return;
      }
      for (const death of frame.recentUnitDeaths) {
        const key = deathKey(death);
        if (seen.has(key)) {
          continue;
        }
        seen.add(key);
        active.push({ death, startMs: nowMs });
      }
      pruneExpired(nowMs);
      if (active.length > MAX_ACTIVE_DEATH_EFFECTS) {
        active.splice(0, active.length - MAX_ACTIVE_DEATH_EFFECTS);
      }
      // A death's frame membership is a CONTIGUOUS window: it is surfaced iff
      // (age <= DEATH_FEED_TICKS) AND (viewer in its fixed at-death witness
      // set) — neither term can flip back on, so a death never leaves the
      // frame and returns. Thus a key absent from the current frame has aged
      // out for good and can be forgotten; keys still in the frame stay in
      // `seen` so an in-window death (whose ~0.7s effect ends before its
      // ~1s feed window) is never re-admitted and re-played. Periodic prune
      // keeps the set O(recent).
      if (seen.size > MAX_ACTIVE_DEATH_EFFECTS * 4) {
        const fresh = new Set(frame.recentUnitDeaths.map(deathKey));
        for (const key of seen) {
          if (!fresh.has(key)) {
            seen.delete(key);
          }
        }
      }
    },
    isAnimating(nowMs) {
      return active.some(
        (effect) => nowMs - effect.startMs < DEATH_EFFECT_DURATION_MS + DEATH_CLEAR_GRACE_MS,
      );
    },
    drawAll(graphics, nowMs, cellSize) {
      pruneExpired(nowMs);
      for (const { death, startMs } of active) {
        const progress = (nowMs - startMs) / DEATH_EFFECT_DURATION_MS;
        if (progress >= 1) {
          continue; // inside the clear grace: keep the loop awake, draw nothing
        }
        const iso = worldToIso(death.x + 0.5, death.y + 0.5);
        const body = deathBodyGeometry(progress, death.size, death.id);
        // Ground line: the body collapses onto the diamond centre, tipping
        // sideways as it falls.
        const bodyWidth = cellSize * body.widthScale;
        const bodyHeight = cellSize * body.heightScale;
        const tipOffset = body.tipOffsetSign * cellSize * 0.15 * progress;
        graphics.fillStyle(death.tint, body.alpha);
        graphics.fillEllipse(iso.x + tipOffset, iso.y, bodyWidth, bodyHeight);

        for (const ring of deathDustRings(progress)) {
          const radius = cellSize * ring.radiusScale;
          graphics.lineStyle(1, DUST_TINT, ring.alpha);
          // Iso-squashed ground ring (2:1, matching the terrain diamonds).
          graphics.strokeEllipse(iso.x, iso.y, radius * 2, radius);
        }
      }
    },
    reset() {
      active = [];
      seen.clear();
    },
    activeCount() {
      return active.length;
    },
  };
}
