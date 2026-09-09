// Fixture inputs are authored independently of the validator's headings and predicates.
import { createHash } from 'node:crypto';
export const examplePlan = `# Example
Status: active
Owner: Example owner
Created: 2026-09-01
Updated: 2026-09-05
## Problem and outcome
Preserve the document lifecycle.
## Scope
Documentation only.
## Approach
Permanent numbered folders.
## Acceptance criteria
Meaningful negative controls fail.
## Implementation steps
Check the imported records.
## Outcome
Pending verification.
`;
export const exampleReview = `# Review 0: implementation
## Target
A named recoverable revision.
## Reviewers and coverage
An independent read-only reviewer.
## Reports
No material issue in the inspected scope.
## Findings and disposition
No finding was raised.
## Verification
The named checks passed.
## Round outcome
Review completed; final acceptance is separate.
`;
export const digest = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');
export const registry = (allocations: unknown[] = [{ id: 0, theme: 'example' }]) => Buffer.from(JSON.stringify({ version: 1, allocations }));
export function fixture() {
  return new Map([
    ['work/.gitattributes', Buffer.from('* -text\n')],
    ['work/registry.json', registry()],
    ['work/0_example/plan.md', Buffer.from(examplePlan)],
    ['work/0_example/reviews/0_implementation.md', Buffer.from(exampleReview)],
  ]);
}
export function directories(files: ReadonlyMap<string, Buffer>) {
  return new Set([...files.keys()].flatMap(file => {
    const parts = file.split('/');
    return parts.slice(0, -1).map((_, index) => parts.slice(0, index + 1).join('/'));
  }));
}
export function legacy(files: Map<string, Buffer>, path: string, bytes: Buffer, source = `aoe2@${'a'.repeat(40)}:old/REVIEW.md`) {
  files.set(`work/0_example/${path}`, bytes);
  files.set('work/registry.json', registry([{ id: 0, theme: 'example', legacyFiles: [{ path, sha256: digest(bytes), source }] }]));
}
