import { buildContentBundle, collectValidationIssues } from './content-lib.mjs';

const strict = process.argv.includes('--strict');
const bundle = buildContentBundle();
const issues = collectValidationIssues(bundle);

if (issues.length === 0) {
  console.log('Content validation passed with no issues.');
  process.exit(0);
}

const errors = issues.filter((issue) => issue.severity === 'error');
const warnings = issues.filter((issue) => issue.severity === 'warn');

console.log(
  `Content validation found ${errors.length} error(s) and ${warnings.length} warning(s).`,
);
for (const issue of issues) {
  console.log(`[${issue.severity}] ${issue.code}: ${issue.message}`);
}

if (errors.length > 0 || (strict && warnings.length > 0)) {
  process.exit(1);
}
