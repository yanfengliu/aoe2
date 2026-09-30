// Real Git indexes pin the boundary: registered checkpoint bytes only. Disk
// bytes, directory membership and a -text attribute cannot confer permission.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { isPreservedIndexImport, readPreservationBindings, storedLineEndingOffenders, type PreservationBinding } from './helpers/checkoutLineEndingPreservation';

const owned: string[] = [];
const unit = ['docs', 'work', '0_example'].join('/');
const target = `${unit}/reviews/0_legacy.md`;
const checkpoint = Buffer.from('Authored review.\r\nRetained checkpoint.\r\n');
const digest = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');
function git(root: string, args: string[]) {
  return execFileSync('git', ['-c', `safe.directory=${root.replaceAll('\\', '/')}`,
    '-c', 'user.name=Line-ending test', '-c', 'user.email=line-ending-test@example.invalid',
    '-C', root, ...args], { stdio: ['ignore', 'pipe', 'pipe'] });
}
function write(root: string, path: string, bytes: Buffer | string) {
  mkdirSync(dirname(join(root, path)), { recursive: true });
  writeFileSync(join(root, path), bytes);
}
function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'aoe2-eol-'));
  owned.push(root);
  git(root, ['init', '-q']);
  write(root, '.gitattributes', '* text=auto eol=lf\n');
  write(root, 'old-review.md', 'Authored review.\nRetained checkpoint.\n');
  git(root, ['add', '--', '.gitattributes', 'old-review.md']);
  git(root, ['commit', '-qm', 'Independent historical source']);
  const revision = git(root, ['rev-parse', 'HEAD']).toString().trim();
  write(root, 'docs/work/.gitattributes', '* -text\n');
  write(root, target, checkpoint);
  git(root, ['add', '--', 'docs/work']);
  const declared: PreservationBinding = {
    target, sha256: digest(checkpoint), source: `aoe2@${revision}:old-review.md`,
  };
  write(root, 'docs/work/registry.json', JSON.stringify({ version: 1, allocations: [{
    id: 0, theme: 'example', legacyFiles: [{
      path: 'reviews/0_legacy.md', sha256: declared.sha256, source: declared.source,
    }],
  }] }));
  git(root, ['add', '--', 'docs/work/registry.json']);
  const binding = readPreservationBindings(git(root, ['show', ':docs/work/registry.json'])).get(target)!;
  return { root, binding };
}
function measured(root: string, path = target) {
  const line = git(root, ['ls-files', '--eol', '-z', '--', path]).toString().replace(/\0$/, '');
  const match = /^i\/(\S+)\s+w\/(\S+)\s+attr\/(.*?)\s*\t(.*)$/.exec(line);
  if (!match) throw new Error(`Missing index measurement for ${path}`);
  return { index: match[1], attrs: match[3], path: match[4] };
}
function accepts(root: string, binding: PreservationBinding | undefined, path = target) {
  const row = measured(root, path);
  const bytes = git(root, ['show', `:${path}`]);
  const bindings = new Map(binding ? [[binding.target, binding]] : []);
  return storedLineEndingOffenders([row], bindings, new Map([[path, bytes]])).length === 0;
}
afterEach(() => {
  for (const root of owned.splice(0)) {
    if (!resolve(root).startsWith(resolve(tmpdir()) + '/aoe2-eol-')
      && !resolve(root).startsWith(resolve(tmpdir()) + '\\aoe2-eol-')) {
      throw new Error('Refusing cleanup outside an owned line-ending fixture');
    }
    rmSync(root, { recursive: true, force: true });
  }
});

describe('only a preserved tracked import can retain indexed CRLF', () => {
  it('accepts a registered CRLF checkpoint under effective -text', () => {
    const { root, binding } = fixture();
    expect(measured(root).index).toBe('crlf');
    expect(isPreservedIndexImport(measured(root), binding, git(root, ['show', `:${target}`]))).toBe(true);
    expect(accepts(root, binding)).toBe(true);
  });

  for (const path of ['scripts/new-tool.mjs', `${unit}/reviews/1_implementation.md`]) {
    it(`refuses unregistered CRLF at ${path}, even with -text`, () => {
      const { root } = fixture();
      if (path.startsWith('scripts/')) write(root, 'scripts/.gitattributes', '* -text\n');
      write(root, path, checkpoint);
      git(root, ['add', '--', path.startsWith('scripts/') ? 'scripts' : path]);
      expect(measured(root, path).index).toBe('crlf');
      expect(accepts(root, undefined, path)).toBe(false);
    });
  }

  it('checks actual index bytes when the disk still matches the registered digest', () => {
    const { root, binding } = fixture();
    write(root, target, 'Changed index.\r\n');
    git(root, ['add', '--', target]);
    write(root, target, checkpoint);
    expect(digest(readFileSync(join(root, target)))).toBe(binding.sha256);
    expect(accepts(root, binding)).toBe(false);
  });

  it('refuses an import whose effective -text protection was removed', () => {
    const { root, binding } = fixture();
    write(root, 'docs/work/.gitattributes', '* text=auto eol=lf\n');
    expect(measured(root).index).toBe('crlf');
    expect(accepts(root, binding)).toBe(false);
  });

  it('refuses bindings outside historical/review import paths or without source identity', () => {
    const { root, binding } = fixture();
    expect(accepts(root, { ...binding, source: 'an unverified local capture' })).toBe(false);
    const path = `${unit}/plan.md`;
    write(root, path, checkpoint);
    git(root, ['add', '--', path]);
    expect(accepts(root, { ...binding, target: path }, path)).toBe(false);
  });
});
