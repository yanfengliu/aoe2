// Compares a snapshot of the incremental presentation (work 130) with one of the presentation it replaced, as
// the GPU would draw them. Deliberately NOT a `*.test.ts` file: the suites import it.
//
// What counts as the same picture:
//  - every resource, every chunk and the revision equal;
//  - the translucent `shadow-parts` and `memory-parts` batches equal instance for instance, in order, because the
//    order is what makes each pixel blend once;
//  - each opaque surface's instances equal as a set: the lanes of one surface and one animation state, merged and
//    sorted by key, equal the old single batch of that surface (which was sorted by key). Opaque instances draw
//    under the depth test, so their order and their batch change no pixel.
import { expect } from 'vitest';
import type { InstanceBatchV1, RenderSnapshotV1 } from 'voxel/core';

interface Instance {
  readonly key: string;
  readonly matrix: readonly number[];
  readonly color: readonly number[];
  readonly animation: readonly number[] | null;
}

function instances(batch: InstanceBatchV1): Instance[] {
  return batch.instanceKeys.map((key, index) => ({
    key,
    matrix: [...batch.matrices.slice(index * 16, index * 16 + 16)],
    color: batch.colors ? [...batch.colors.slice(index * 4, index * 4 + 4)] : [],
    animation: batch.animation ? [
      batch.animation.periodsMs[index]!,
      batch.animation.phasesRadians[index]!,
      ...batch.animation.translationAmplitudes.slice(index * 3, index * 3 + 3),
      ...batch.animation.rotationAmplitudesRadians.slice(index * 3, index * 3 + 3),
      ...batch.animation.scaleAmplitudes.slice(index * 3, index * 3 + 3),
    ] : null,
  }));
}

/** The old batch key a lane's instances belong to: `aoe2:batch:<source>-<surface>[-animated]-parts` maps to
 *  `aoe2:batch:<surface>[-animated]-parts`; the shadow and memory batches keep their keys. */
export function legacyBatchKey(laneKey: string): string {
  const match = /^aoe2:batch:(?:terrain|still|moving)-(.+)-parts$/.exec(laneKey);
  return match ? `aoe2:batch:${match[1]!}-parts` : laneKey;
}

export function mergedLegacyBatches(snapshot: RenderSnapshotV1): Map<string, Instance[]> {
  const merged = new Map<string, Instance[]>();
  for (const batch of snapshot.batches) {
    const key = legacyBatchKey(batch.key);
    const list = merged.get(key) ?? [];
    list.push(...instances(batch));
    merged.set(key, list);
  }
  for (const [key, list] of merged) {
    if (key === 'aoe2:batch:shadow-parts' || key === 'aoe2:batch:memory-parts') continue;
    list.sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
  }
  return merged;
}

export function expectSamePicture(actual: RenderSnapshotV1, legacy: RenderSnapshotV1, label: string): void {
  expect(actual.revision, `${label}: revision`).toBe(legacy.revision);
  expect(actual.resources, `${label}: resources`).toEqual(legacy.resources);
  expect(actual.chunks, `${label}: chunks`).toEqual(legacy.chunks);
  const merged = mergedLegacyBatches(actual);
  for (const batch of legacy.batches) {
    const expected = instances(batch);
    const got = merged.get(batch.key) ?? [];
    expect(got.map((instance) => instance.key), `${label}: ${batch.key} keys`).toEqual(expected.map((instance) => instance.key));
    expect(got, `${label}: ${batch.key} instances`).toEqual(expected);
    merged.delete(batch.key);
  }
  const leftover = [...merged.entries()].filter(([, list]) => list.length > 0).map(([key]) => key);
  expect(leftover, `${label}: instances in no old batch`).toEqual([]);
}
