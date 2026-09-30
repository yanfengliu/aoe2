// Bounds: synthetic document mutations, exact exemption bytes and complete Git
// attribute measurements. This does not establish authored truth or acceptance.
import { describe, expect, test } from 'vitest';
import { validateGitAttributes, validateWorkDocs } from './helpers/workDocsStructure.js';
import { directories, examplePlan, exampleReview, fixture, legacy, registry } from './helpers/workDocsFixture.js';
const check = (files: Map<string, Buffer>, dirs = directories(files)) => validateWorkDocs(files, dirs);
describe('work-document structural mutation controls', () => {
  test('accepts a current plan without an optional design or review', () => {
    const files = fixture(); expect(check(files)).toEqual([]);
    files.delete('work/0_example/reviews/0_implementation.md'); expect(check(files)).toEqual([]);
  });
  test.each(['threads', 'reviews'])('rejects the retained legacy %s root as a file or empty directory', root => {
    const files = fixture(); expect(check(files, new Set([...directories(files), root]))).not.toEqual([]);
    files.set(root, Buffer.from('retained root')); expect(check(files)).not.toEqual([]);
  });
  test('retaining owner roots does not permit changed imports or new raw captures', () => {
    const files = fixture(); files.set('threads/current/owner/PLAN.md', Buffer.from('Active record.'));
    const retained = () => validateWorkDocs(files, directories(files), undefined, { retainLegacyRoots: true });
    expect(retained()).toEqual([]);
    legacy(files, 'historical/PLAN.md', Buffer.from('Original.'));
    files.set('work/0_example/historical/PLAN.md', Buffer.from('Changed.'));
    expect(retained()).not.toEqual([]);
    files.set('work/0_example/historical/PLAN.md', Buffer.from('Original.'));
    files.set('threads/current/owner/stdout.txt', Buffer.from('Raw capture.'));
    expect(retained()).not.toEqual([]);
  });
  test.each([
    [], [{ id: 1, theme: 'example' }], [{ id: 0, theme: 'example' }, { id: 2, theme: 'missing' }],
    [{ id: 0, theme: 'example' }, { id: 0, theme: 'duplicate' }], [{ id: 0, theme: '../escape' }],
  ].map(allocations => ({ allocations })))('rejects empty, gapped, duplicate and unsafe allocations: %j', ({ allocations }) => {
    const files = fixture(); files.set('work/registry.json', registry(allocations)); expect(check(files)).not.toEqual([]);
  });
  test.each(['work/registry.json', 'work/.gitattributes', 'work/0_example/plan.md'])('rejects missing %s', file => {
    const files = fixture(); files.delete(file); expect(check(files)).not.toEqual([]);
  });
  test('rejects unregistered and absent unit folders', () => {
    const files = fixture(); files.set('work/1_extra/plan.md', Buffer.from(examplePlan)); expect(check(files)).not.toEqual([]);
    files.delete('work/1_extra/plan.md'); files.set('work/registry.json', registry([{id:0,theme:'example'},{id:1,theme:'missing'}])); expect(check(files)).not.toEqual([]);
  });
  test.each(['Status','Owner','Created','Updated'])('requires metadata %s', field => {
    const files = fixture(); files.set('work/0_example/plan.md', Buffer.from(examplePlan.replace(new RegExp(`^${field}:.*\\n`, 'm'), ''))); expect(check(files)).not.toEqual([]);
  });
  test.each(['Problem and outcome','Scope','Approach','Acceptance criteria','Implementation steps','Outcome'])('requires plan section %s', heading => {
    const files=fixture(); files.set('work/0_example/plan.md',Buffer.from(examplePlan.replace(`## ${heading}\n`,'## Removed\n'))); expect(check(files)).not.toEqual([]);
  });
  test('rejects impossible dates and permits explicit unknown historical metadata', () => {
    const files=fixture(); files.set('work/0_example/plan.md',Buffer.from(examplePlan.replaceAll('2026-09-05','2026-02-30'))); expect(check(files)).not.toEqual([]);
    files.set('work/0_example/plan.md',Buffer.from(examplePlan.replace('Status: active','Status: legacy').replaceAll(/2026-09-0[15]/g,'Unknown (historical record; date not recorded)'))); expect(check(files)).toEqual([]);
  });
  test.each(['Target','Reviewers and coverage','Reports','Findings and disposition','Verification','Round outcome'])('requires review section %s', heading => {
    const files=fixture(); files.set('work/0_example/reviews/0_implementation.md',Buffer.from(exampleReview.replace(`## ${heading}\n`,'## Removed\n'))); expect(check(files)).not.toEqual([]);
  });
  test.each(['reviews/1_plan.md','reviews/00_plan.md','reviews/0_unknown.md','reviews/nested/0_plan.md'])('rejects invalid review identity %s', name => {
    const files=fixture(); files.delete('work/0_example/reviews/0_implementation.md'); files.set(`work/0_example/${name}`,Buffer.from(exampleReview)); expect(check(files)).not.toEqual([]);
  });
  test('preserves exact legacy reports while making a later edit use the current format', () => {
    const files=fixture(); files.delete('work/0_example/reviews/0_implementation.md'); legacy(files,'reviews/0_legacy.md',Buffer.from('An old synthesis.\n')); expect(check(files)).toEqual([]);
    files.set('work/0_example/reviews/0_legacy.md',Buffer.from('An edited old synthesis.\n')); expect(check(files)).not.toEqual([]);
    files.set('work/0_example/reviews/0_legacy.md',Buffer.from(exampleReview)); expect(check(files)).toEqual([]);
  });
  test('rejects a changed historical source and unregistered history', () => {
    const files=fixture(); legacy(files,'historical/PLAN.md',Buffer.from('Original.')); files.set('work/0_example/historical/PLAN.md',Buffer.from('Changed.')); expect(check(files)).not.toEqual([]);
    files.set('work/0_example/historical/extra.md',Buffer.from('Extra.')); expect(check(files)).not.toEqual([]);
  });
  test.each(['stdout.txt','review.log','prompt.md','raw/capture.md','review-stderr.md'])('rejects new raw %s outside and inside a work unit', name => {
    for(const prefix of ['','work/0_example/snapshots/']) {const files=fixture();files.set(prefix+name,Buffer.from('Capture.'));expect(check(files)).not.toEqual([]);}
  });
  test.each([Buffer.alloc(0),Buffer.from([0xff]),Buffer.from('text\0binary'),Buffer.from([127])])('rejects empty or invalid snapshot bytes %j', bytes => {
    const files=fixture();files.set('work/0_example/snapshots/target.md',bytes);expect(check(files)).not.toEqual([]);
  });
  test('rejects binary snapshot names and nested attributes', () => {
    for(const path of ['snapshots/picture.png','.gitattributes','historical/.gitattributes']) {const files=fixture();files.set(`work/0_example/${path}`,Buffer.from('Authored text'));expect(check(files)).not.toEqual([]);}
  });
  test('requires exact scoped attributes', () => {const files=fixture();files.set('work/.gitattributes',Buffer.from('* text\n'));expect(check(files)).not.toEqual([]);});
});
describe('Git attribute population controls', () => {
  const path=['docs','work','0_example','plan.md'].join('/');
  const attrs=['text','filter','working-tree-encoding','ident'];
  const output=attrs.map(attr=>`${path}\0${attr}\0${attr==='text'?'unset':'unspecified'}\0`).join('');
  test('requires all four measurements for each expected path',()=>{
    expect(validateGitAttributes(output,[path])).toEqual([]);
    expect(validateGitAttributes('',[path])).not.toEqual([]);
    expect(validateGitAttributes(output.slice(0,output.indexOf('filter')-path.length-1),[path])).not.toEqual([]);
    expect(validateGitAttributes(output+output,[path])).not.toEqual([]);
    expect(validateGitAttributes('',[])).not.toEqual([]);
  });
  test.each(['text','filter','working-tree-encoding','ident'])('rejects effective %s transformation',attr=>{
    const bad=output.replace(`${attr}\0${attr==='text'?'unset':'unspecified'}`,`${attr}\0set`);expect(validateGitAttributes(bad,[path])).not.toEqual([]);
  });
});
