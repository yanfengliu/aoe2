// Bound: fixed approved Git identities and hashes; registry text cannot grant
// permission. Reconstruction changes LF to CRLF only, never normalizes input.
import { createHash } from 'node:crypto';
import { APPROVED_RAW_IMPORTS, type RawBinding } from './workDocsRawImports.js';
const digest = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');
export function assertBoundBytes(binding: RawBinding, target: Buffer, source: Buffer): void {
  if (digest(target) !== binding.targetSha256) throw new Error(`${binding.target} changed from its fixed imported digest; restore the reviewed bytes.`);
  if (digest(source) !== binding.sourceGitSha256) throw new Error(`${binding.source} does not match its fixed Git digest; restore the reviewed source identity.`);
  if (target.equals(source)) return;
  if (source.includes(13)) throw new Error(`${binding.source} contains CR bytes; only exact bytes or pure LF source reconstruction is approved.`);
  let text: string;
  try { text = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(source); }
  catch { throw new Error(`${binding.source} is invalid UTF-8; LF reconstruction requires valid UTF-8 source bytes.`); }
  const reconstructed = Buffer.from(text.replaceAll('\n', '\r\n'), 'utf8');
  if (!reconstructed.equals(target)) throw new Error(`${binding.target} is neither exact Git bytes nor the fixed LF-to-CRLF reconstruction; do not normalize the source or target.`);
}
export function assertApprovedRaw(target: string, entry: { source: string; sha256: string }, bytes: Buffer, readSource: (source: string) => Buffer): void {
  const binding = APPROVED_RAW_IMPORTS.find(item => item.target === target && item.source === entry.source);
  if (!binding || binding.targetSha256 !== entry.sha256) throw new Error(`${target} is outside the seven reviewed raw-import bindings; new captures stay ignored until a separately reviewed migration changes that boundary.`);
  assertBoundBytes(binding, bytes, readSource(entry.source));
}
