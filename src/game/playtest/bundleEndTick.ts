import type { SessionBundle } from 'civ-engine';

// Legacy bundles recorded before civ-engine 1.1.4 shipped with
// metadata.endTick 0 (finalized only at disconnect). Oracles that scan to the
// recorded end (for example noPinnedOrOscillating) see an empty range on such
// bundles and detect nothing, so every oracle pass must repair first.
export function repairBundleEndTick(bundle: SessionBundle): void {
  const metadata = bundle.metadata as { endTick?: number; startTick?: number; durationTicks?: number; persistedEndTick?: number };
  if (!metadata || (metadata.endTick ?? 0) > 0) return;
  const recordedMax = Math.max(
    metadata.persistedEndTick ?? 0,
    ...bundle.ticks.map((tickEntry) => tickEntry.tick ?? 0),
  );
  metadata.endTick = recordedMax;
  metadata.durationTicks = recordedMax - (metadata.startTick ?? 0);
}
