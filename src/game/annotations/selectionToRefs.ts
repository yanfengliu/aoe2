// Spec 2 (annotation-ui v0.1.5) AO-6: resolve a selection (EntityRef[])
// into a MarkerRefs shape suitable for `recorder.addMarker`. Per DESIGN
// v3+, aoe2 has no cell-selection state, so this resolver is entities-only:
// either `{ entities: EntityRef[] }` (when selection is non-empty) or
// `{ tickRange: { from: tick, to: tick } }` (empty-selection fallback).

import type { EntityRef } from 'civ-engine';

// Loose interface — matches civ-engine's `MarkerRefs` shape without
// pulling in the deep import. Kept loose so future cell-selection
// integration (v0.1.6+) can extend without churning the consumer.
export interface SelectionAwareRefs {
  readonly entities?: readonly EntityRef[];
  readonly tickRange?: { readonly from: number; readonly to: number };
}

export function selectionToRefs(
  selectedRefs: readonly EntityRef[],
  fallbackTick: number,
): SelectionAwareRefs {
  if (selectedRefs.length > 0) {
    // Defensive copy so the recorder doesn't observe later mutations.
    return { entities: selectedRefs.slice() };
  }
  return { tickRange: { from: fallbackTick, to: fallbackTick } };
}
