import type { ApplyResultV1, DeltaApplyResultV1, InstanceBatchV1, RenderDeltaV1, RenderOperationV1, RenderResourceV1, RenderSnapshotV1 } from 'voxel/core';
import { translucentBoundsChanged } from './aoeVoxelTranslucentBounds';

interface SnapshotRuntime {
  acceptSnapshot(snapshot: RenderSnapshotV1): ApplyResultV1;
  acceptDelta?(delta: RenderDeltaV1): DeltaApplyResultV1;
}

/** A rejected/resync delta has not changed the runtime. Retry the complete snapshot so a stale base, a delta
 *  budget or a custom runtime without deltas retains the same admission behavior as the original renderer. */
export function acceptAoeVoxelSnapshot(runtime: SnapshotRuntime, next: RenderSnapshotV1, previous: RenderSnapshotV1 | null): ApplyResultV1 {
  if (previous && runtime.acceptDelta) {
    const delta = aoeVoxelSnapshotDelta(previous, next);
    if (delta) {
      const result = runtime.acceptDelta(delta);
      if (result.status === 'accepted') return result;
    }
  }
  return runtime.acceptSnapshot(next);
}

function sameRange(a: ArrayLike<number>, b: ArrayLike<number>, start: number, count: number): boolean {
  for (let index = start; index < start + count; index += 1) if (!Object.is(a[index], b[index])) return false;
  return true;
}

function sameSlot(a: InstanceBatchV1, b: InstanceBatchV1, index: number): boolean {
  if (!sameRange(a.matrices, b.matrices, index * 16, 16)) return false;
  if (a.colors && b.colors && !sameRange(a.colors, b.colors, index * 4, 4)) return false;
  if (a.animation && b.animation) {
    for (const field of ['periodsMs', 'phasesRadians', 'translationAmplitudes', 'rotationAmplitudesRadians', 'scaleAmplitudes'] as const) {
      const stride = field === 'periodsMs' || field === 'phasesRadians' ? 1 : 3;
      if (!sameRange(a.animation[field], b.animation[field], index * stride, stride)) return false;
    }
  }
  return true;
}

function selectSlots<T extends Float32Array | Uint8Array>(source: T, stride: number, slots: readonly number[]): T {
  const out = (source instanceof Float32Array ? new Float32Array(slots.length * stride) : new Uint8Array(slots.length * stride)) as T;
  slots.forEach((slot, index) => out.set(source.subarray(slot * stride, (slot + 1) * stride), index * stride));
  return out;
}

/** Patch only when keys retain their exact order. A translucent batch's order is part of its picture: shadow
 *  pieces must remain highest-first and fog ghosts precede silhouettes. Any reordering, insertion, removal or
 *  layout change gets a complete put, so canonical paging cannot rearrange one of those passes. */
function batchOperation(previous: InstanceBatchV1, next: InstanceBatchV1, resources: readonly RenderResourceV1[]): RenderOperationV1 | null {
  const put: RenderOperationV1 = { op: 'put-batch', batch: next };
  if (previous.incarnation !== next.incarnation || previous.geometryKey !== next.geometryKey
    || previous.materialKey !== next.materialKey || Boolean(previous.colors) !== Boolean(next.colors)
    || Boolean(previous.animation) !== Boolean(next.animation)
    || previous.animation?.rotationMode !== next.animation?.rotationMode
    || JSON.stringify(previous.presentation) !== JSON.stringify(next.presentation)
    || previous.instanceKeys.length !== next.instanceKeys.length
    || previous.instanceKeys.some((key, index) => key !== next.instanceKeys[index])) return put;
  const changed: number[] = [];
  for (let index = 0; index < next.instanceKeys.length; index += 1) {
    if (!sameSlot(previous, next, index)) changed.push(index);
  }
  // A freshly posed but byte-equal batch needs no update. Its next real revision will still be newer than the
  // canonical one; there is no requirement that a batch's revision match every snapshot's revision.
  if (changed.length === 0) return null;
  if (changed.length > next.instanceKeys.length / 2) return put;
  if (translucentBoundsChanged(previous, next, resources)) return put;
  return {
    op: 'patch-batch-instances', key: next.key, incarnation: next.incarnation, revision: next.revision,
    removeInstanceKeys: [],
    upserts: {
      instanceKeys: changed.map((index) => next.instanceKeys[index]!),
      matrices: selectSlots(next.matrices, 16, changed),
      ...(next.colors ? { colors: selectSlots(next.colors, 4, changed) } : {}),
      ...(next.animation ? { animation: {
        ...next.animation,
        periodsMs: selectSlots(next.animation.periodsMs, 1, changed),
        phasesRadians: selectSlots(next.animation.phasesRadians, 1, changed),
        translationAmplitudes: selectSlots(next.animation.translationAmplitudes, 3, changed),
        rotationAmplitudesRadians: selectSlots(next.animation.rotationAmplitudesRadians, 3, changed),
        scaleAmplitudes: selectSlots(next.animation.scaleAmplitudes, 3, changed),
      } } : {}),
    },
  };
}

/** A null result requires a full snapshot (initial state or a changed descriptor/epoch). */
export function aoeVoxelSnapshotDelta(previous: RenderSnapshotV1, next: RenderSnapshotV1): RenderDeltaV1 | null {
  if (JSON.stringify(previous.descriptor) !== JSON.stringify(next.descriptor)) return null;
  const operations: RenderOperationV1[] = [];
  const resources = new Map(previous.resources.map((resource) => [resource.key, resource]));
  for (const resource of next.resources) {
    const before = resources.get(resource.key);
    if (!before || before.incarnation !== resource.incarnation || before.revision !== resource.revision) {
      operations.push({ op: 'put-resource', resource });
    }
    resources.delete(resource.key);
  }
  for (const resource of resources.values()) operations.push({ op: 'remove-resource', key: resource.key, incarnation: resource.incarnation });
  const chunks = new Map(previous.chunks.map((chunk) => [chunk.key, chunk]));
  for (const chunk of next.chunks) {
    const before = chunks.get(chunk.key);
    if (!before || before.incarnation !== chunk.incarnation || before.revision !== chunk.revision) {
      operations.push({ op: 'put-chunk', chunk });
    }
    chunks.delete(chunk.key);
  }
  for (const chunk of chunks.values()) operations.push({ op: 'remove-chunk', key: chunk.key, incarnation: chunk.incarnation });
  const batches = new Map(previous.batches.map((batch) => [batch.key, batch]));
  for (const batch of next.batches) {
    const before = batches.get(batch.key);
    if (!before || before.incarnation !== batch.incarnation || before.revision !== batch.revision) {
      const operation = before ? batchOperation(before, batch, next.resources) : { op: 'put-batch' as const, batch };
      if (operation) operations.push(operation);
    }
    batches.delete(batch.key);
  }
  for (const batch of batches.values()) operations.push({ op: 'remove-batch', key: batch.key, incarnation: batch.incarnation });
  return {
    schemaVersion: 'voxel.render-delta/1', worldId: next.descriptor.worldId, epoch: next.descriptor.epoch,
    baseRevision: previous.revision, revision: next.revision, operations,
  };
}
