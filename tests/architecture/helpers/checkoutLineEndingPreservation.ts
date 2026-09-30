// Preservation is a reviewed import checkpoint, not permission for every work
// file to retain CRLF. Source identity and target checkpoint bytes are distinct.
import { createHash } from 'node:crypto';

export interface PreservationBinding {
  target: string;
  sha256: string;
  source: string;
}

function safePath(path: string): boolean {
  return !/[\\:\0\r\n]/.test(path) && path.split('/').every(part => part && part !== '.' && part !== '..');
}

function sourceIdentity(source: string): boolean {
  const match = /^aoe2@(?:[0-9a-f]{40}|[0-9a-f]{64}):(.+)$/.exec(source);
  return Boolean(match && safePath(match[1]));
}

export function readPreservationBindings(bytes: Buffer): Map<string, PreservationBinding> {
  const registry = JSON.parse(bytes.toString('utf8'));
  if (registry.version !== 1 || !Array.isArray(registry.allocations)) {
    throw new Error('Indexed work registry needs version 1 and allocations before imported bytes can be preserved.');
  }
  const bindings = new Map<string, PreservationBinding>();
  for (const allocation of registry.allocations) {
    if (!Number.isSafeInteger(allocation.id) || allocation.id < 0
      || typeof allocation.theme !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(allocation.theme)
      || (allocation.legacyFiles !== undefined && !Array.isArray(allocation.legacyFiles))) {
      throw new Error('Indexed work registry contains an invalid import allocation.');
    }
    for (const entry of allocation.legacyFiles ?? []) {
      if (typeof entry.path !== 'string' || typeof entry.sha256 !== 'string' || typeof entry.source !== 'string') {
        throw new Error('Indexed work registry import needs a target path, checkpoint digest and source identity.');
      }
      const target = `docs/work/${allocation.id}_${allocation.theme}/${entry.path}`;
      if (bindings.has(target)) throw new Error(`Duplicate indexed preservation target ${target}.`);
      bindings.set(target, { target, sha256: entry.sha256, source: entry.source });
    }
  }
  return bindings;
}

export function isPreservedIndexImport(
  row: { path: string; attrs: string },
  binding: PreservationBinding | undefined,
  indexBytes: Buffer | undefined,
): boolean {
  return row.attrs.split(/\s+/).includes('-text') && binding?.target === row.path
    && /^docs\/work\/(?:0|[1-9]\d*)_[a-z0-9]+(?:-[a-z0-9]+)*\/(historical|reviews)\/.+/.test(row.path)
    && safePath(row.path) && /^[0-9a-f]{64}$/.test(binding.sha256) && sourceIdentity(binding.source)
    && indexBytes !== undefined && createHash('sha256').update(indexBytes).digest('hex') === binding.sha256;
}

export function storedLineEndingOffenders(
  rows: readonly { path: string; attrs: string; index: string }[],
  bindings: ReadonlyMap<string, PreservationBinding>,
  indexBlobs: ReadonlyMap<string, Buffer>,
): string[] {
  return rows.filter(row => ['crlf', 'mixed'].includes(row.index)
    && !isPreservedIndexImport(row, bindings.get(row.path), indexBlobs.get(row.path))).map(row => row.path);
}
