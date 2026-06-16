// M7 graphics — dynamic combat/selection feedback (v0.1.45). The game's first
// time-based visual feedback. Before this slice every cue was static: the
// selection ring was a flat constant-alpha stroke, and combat was instant HP
// subtraction with no impact tell.
//
// This module holds the PURE effect-decision logic so it is unit-testable
// without a Phaser stage (mirrors unitRenderer's pure unitRole/unitFacingRadians
// + the spy-tested draw helpers). It powers two effects, both derived ONLY from
// existing projected render state + a render-side per-frame delta — NO sim,
// bridge, save-format, or contract change:
//
//   1. Selection glow/pulse — animates the EXISTING selection ring's alpha,
//      stroke width, and a small outward radius offset over time (sine phase
//      from the scene clock). Derived from the `selected` set only; the ring's
//      base geometry (center, base radius, footprint rect) is unchanged.
//   2. Hit flash — a brief bright overlay on a unit whose `currentHp` dropped
//      since the last tick sample, tracked render-side via HitFlashTracker (the
//      analogue of GameScene.previousUnitProjectedPositions). The impact tell
//      for combat without rendering projectiles (deferred to the M2 projectile
//      sim).
//
// Time-based animation is fine here because it is PURELY visual — it never feeds
// back into the deterministic sim/replay. No Math.random / Date.now: the pulse
// derives from the passed scene-clock time; per-entity variation (none needed
// today) would derive deterministically from entityId. Skipped this slice:
// gather sparks (gather task is NOT on ProjectedEntityView — adding it would be
// a contract change) and death puffs / projectiles (deferred).

// ---- selection pulse -------------------------------------------------------

// Full breathing period of the selection pulse, in ms. One sine cycle.
export const SELECTION_PULSE_PERIOD_MS = 1100;

export interface SelectionPulse {
  // Stroke alpha for the ring this frame. Stays in a lit band so the ring is
  // never invisible and never over-saturated.
  alpha: number;
  // Extra radius added to the ring STROKE (px). The ring's base radius / the
  // entity hitbox is unchanged; this only makes the stroke breathe outward.
  radiusOffsetPx: number;
  // Stroke line width this frame.
  lineWidth: number;
}

// Pulse state for a given scene-clock time (ms). A single sine phase drives all
// three modulations so they breathe in lock-step. Pure + deterministic.
export function selectionPulse(timeMs: number): SelectionPulse {
  // phase in [0, 2π) over the period; cosine gives a smooth 1→-1→1 breathe.
  const phase = (timeMs % SELECTION_PULSE_PERIOD_MS) / SELECTION_PULSE_PERIOD_MS;
  // 0 at phase 0, 1 at phase 0.5, back to 0 — a smooth swell.
  const swell = (1 - Math.cos(phase * 2 * Math.PI)) / 2; // [0,1]
  return {
    // Base 0.7 → up to 1.0 at the swell peak. Always clearly visible.
    alpha: 0.7 + swell * 0.3,
    // 0 → 2px outward at the peak.
    radiusOffsetPx: swell * 2,
    // 2 → 3px stroke at the peak.
    lineWidth: 2 + swell * 1,
  };
}

// ---- hit flash -------------------------------------------------------------

// How long a single hit flash lives, in ms. Short and snappy so it reads as an
// impact, not a glow.
export const HIT_FLASH_DURATION_MS = 260;

// Extra time (ms) hasActiveFlash stays true PAST the visual end of a flash, so
// the scene runs at least one more CLEAR-render after the flash fades. Without
// it, the render cache can freeze the faint final flash frame on screen when no
// other invalidation follows (e.g. paused / no tick advance at the expiry
// moment — Phaser keeps drawing frames, but renderState early-returns without
// clearing). Nothing is drawn during the grace: intensityAt is already 0 past
// HIT_FLASH_DURATION_MS; the grace only keeps the render loop awake. Generous
// enough to span a frame at any playable frame rate.
export const FLASH_CLEAR_GRACE_MS = 80;

// True iff hp strictly dropped between two samples (both finite). A heal,
// no-change, or a null/undefined sample does NOT flash. Pure.
export function shouldFlashHit(
  prevHp: number | null | undefined,
  currHp: number | null | undefined,
): boolean {
  if (prevHp === null || prevHp === undefined || currHp === null || currHp === undefined) {
    return false;
  }
  // Reject non-finite samples (Infinity / NaN) so a degenerate hp can't arm a
  // spurious flash — matches the "both finite" contract above.
  if (!Number.isFinite(prevHp) || !Number.isFinite(currHp)) {
    return false;
  }
  return currHp < prevHp;
}

export interface HitFlashTracker {
  // Record this tick's hp for an entity. If it dropped vs the prior recorded
  // sample, arm a flash starting at `nowMs`. The FIRST sample for an id never
  // flashes (no prior to compare). Feed this the PROJECTED hp (not interpolated)
  // once per tick, mirroring GameScene.previousUnitProjectedPositions.
  recordSample(id: number, hp: number | null, nowMs: number): void;
  // 0..1 decaying flash intensity for an entity at clock time `nowMs`. 0 for an
  // unknown id, a never-hit id, or an expired flash.
  intensityAt(id: number, nowMs: number): number;
  // Drop every tracked id not in `visibleIds` so the map stays O(visible).
  pruneTo(visibleIds: Set<number>): void;
  // Whether ANY tracked entity has a live flash at `nowMs` — used to keep the
  // render loop awake while a flash plays (cache-busting).
  hasActiveFlash(nowMs: number): boolean;
  // Number of tracked entities (test/inspection aid).
  size(): number;
}

interface FlashEntry {
  lastHp: number;
  // Clock time the current flash started, or null if no flash is armed.
  flashStartMs: number | null;
}

// Linear decay from 1 at start to 0 at +HIT_FLASH_DURATION_MS. Pure.
function decayIntensity(flashStartMs: number | null, nowMs: number): number {
  if (flashStartMs === null) {
    return 0;
  }
  const elapsed = nowMs - flashStartMs;
  if (elapsed < 0 || elapsed >= HIT_FLASH_DURATION_MS) {
    return 0;
  }
  return 1 - elapsed / HIT_FLASH_DURATION_MS;
}

export function createHitFlashTracker(): HitFlashTracker {
  const entries = new Map<number, FlashEntry>();

  return {
    recordSample(id, hp, nowMs) {
      if (hp === null) {
        // No health to track (e.g. a fog-memory or hp-less entity). Drop any
        // stale entry so a later real sample starts fresh.
        entries.delete(id);
        return;
      }
      const existing = entries.get(id);
      if (existing === undefined) {
        entries.set(id, { lastHp: hp, flashStartMs: null });
        return;
      }
      if (shouldFlashHit(existing.lastHp, hp)) {
        existing.flashStartMs = nowMs;
      }
      existing.lastHp = hp;
    },
    intensityAt(id, nowMs) {
      const entry = entries.get(id);
      if (entry === undefined) {
        return 0;
      }
      return decayIntensity(entry.flashStartMs, nowMs);
    },
    pruneTo(visibleIds) {
      for (const id of entries.keys()) {
        if (!visibleIds.has(id)) {
          entries.delete(id);
        }
      }
    },
    hasActiveFlash(nowMs) {
      for (const entry of entries.values()) {
        if (entry.flashStartMs === null) {
          continue;
        }
        const elapsed = nowMs - entry.flashStartMs;
        // Active through the visual life PLUS a short clear-grace (see
        // FLASH_CLEAR_GRACE_MS) so the scene runs one more clear-render after the
        // flash fades and the final faint frame can't linger.
        if (elapsed >= 0 && elapsed < HIT_FLASH_DURATION_MS + FLASH_CLEAR_GRACE_MS) {
          return true;
        }
      }
      return false;
    },
    size() {
      return entries.size;
    },
  };
}

// ---- hit-flash draw --------------------------------------------------------

// Minimal Graphics surface the flash draw needs. Declared structurally so the
// drawer is testable with a lightweight spy (no Phaser import here — this file
// stays pure/headless).
export interface FlashGraphics {
  fillStyle(color: number, alpha?: number): void;
  lineStyle(width: number, color: number, alpha?: number): void;
  fillCircle(x: number, y: number, radius: number): void;
  strokeCircle(x: number, y: number, radius: number): void;
}

// Minimal projected-entity shape the tracker feed needs (id + hp + kind). Kept
// structural (kind as a bare string) so this module imports no app types.
interface HpSample {
  id: number;
  currentHp: number | null;
  kind: string;
}

// Feed the tracker every entity's PROJECTED hp for the current tick and prune
// any entity no longer present, so a hit flash arms on an hp drop and the map
// stays O(visible). Called once per tick change from the scene (the analogue of
// rebuilding GameScene.previousUnitProjectedPositions). Pure orchestration over
// the tracker — extracted to keep the pinned GameScene file lean.
export function feedHitFlashTracker(
  tracker: HitFlashTracker,
  entities: readonly HpSample[],
  nowMs: number,
): void {
  // Only units render a hit flash (the scene's drawUnitFlash is unit-only), so
  // track only unit hp — keeps hasActiveFlash (and the scene's render-cache
  // bust) tight to what is actually drawn; a damaged building never arms a
  // flash and so never holds the animated path.
  const visible = new Set<number>();
  for (const entity of entities) {
    if (entity.kind !== 'unit') {
      continue;
    }
    tracker.recordSample(entity.id, entity.currentHp, nowMs);
    visible.add(entity.id);
  }
  tracker.pruneTo(visible);
}

// A hot impact tint (white-hot core fading to a warm orange ring).
const FLASH_CORE_TINT = 0xfff4d8;
const FLASH_RING_TINT = 0xffb347;

// Draw a brief impact flash for a unit centred at (cx, cy) with bounding radius
// r, at the given 0..1 intensity. Nothing is drawn at intensity 0. Every drawn
// point stays inside radius r so the flash never spills past the unit's existing
// footprint. Pure (no clock, no random) — the caller supplies the intensity.
export function drawHitFlash(
  graphics: FlashGraphics,
  cx: number,
  cy: number,
  r: number,
  intensity: number,
): void {
  if (intensity <= 0) {
    return;
  }
  const clamped = Math.min(1, intensity);
  // Filled core disc: grows slightly with intensity but capped inside r.
  const coreRadius = Math.min(r, r * (0.45 + 0.25 * clamped));
  graphics.fillStyle(FLASH_CORE_TINT, 0.55 * clamped);
  graphics.fillCircle(cx, cy, coreRadius);
  // Bright rim ring just inside the unit edge. Phaser centres strokes on the
  // path, so a 2px stroke at r would bleed ~1px past r; drawing at r minus half
  // the stroke keeps every rim pixel within the unit's bounding radius.
  const rimWidth = 2;
  graphics.lineStyle(rimWidth, FLASH_RING_TINT, 0.9 * clamped);
  graphics.strokeCircle(cx, cy, Math.max(0, r - rimWidth / 2));
}

// ---- scene-facing orchestrator ---------------------------------------------

// A thin stateful facade the scene holds (mirrors unitRenderer / buildingRenderer
// / worldLayers / selectionLayers): owns the hp-delta tracker and bundles the
// per-frame feedback decisions so the pinned GameScene file stays a lean set of
// one-line call-sites. All animation state lives here, render-side only.
export interface FeedbackEffectsRenderer {
  // Re-sample every entity's projected hp for the current tick (arms hit flashes
  // on hp drops); call once per tick change.
  recordTick(entities: readonly HpSample[], nowMs: number): void;
  // Whether a time-based effect is live this frame (selection pulse or any hit
  // flash) — the scene uses this to keep re-rendering instead of caching.
  isAnimating(selectedCount: number, nowMs: number): boolean;
  // The selection-ring pulse for this frame.
  pulse(nowMs: number): SelectionPulse;
  // Draw the hit flash (if any) for one unit, given its bounding circle.
  drawUnitFlash(graphics: FlashGraphics, cx: number, cy: number, r: number, id: number, nowMs: number): void;
  // Drop all animation state (used when the scene swaps bridges).
  reset(): void;
}

export function createFeedbackEffectsRenderer(): FeedbackEffectsRenderer {
  let tracker = createHitFlashTracker();
  return {
    recordTick(entities, nowMs) {
      feedHitFlashTracker(tracker, entities, nowMs);
    },
    isAnimating(selectedCount, nowMs) {
      return selectedCount > 0 || tracker.hasActiveFlash(nowMs);
    },
    pulse(nowMs) {
      return selectionPulse(nowMs);
    },
    drawUnitFlash(graphics, cx, cy, r, id, nowMs) {
      drawHitFlash(graphics, cx, cy, r, tracker.intensityAt(id, nowMs));
    },
    reset() {
      tracker = createHitFlashTracker();
    },
  };
}
