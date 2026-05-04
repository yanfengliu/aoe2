# Review iteration 4 - monkTasks accessor migration

## Reviewers

- Codex (`gpt-5.5`, xhigh, read-only): returned one MEDIUM documentation finding and found no code-level correctness, security, or performance issues.
- Claude (`claude-opus-4-7[1m]`, max): still unreachable due quota limit: "You've hit your limit - resets May 5, 7pm (America/Los_Angeles)."

## Findings

### MEDIUM C6 - active changelog still described monkTasks as unmigrated

Codex verified that the active `0.1.6-rc1` changelog entry still said `monkTasks` was blocked and that snapshot equivalence covered only 34 migrated codecs, contradicting the live accessor-backed `monkTasks` migration.

Disposition: fixed. Updated `docs/changelog.md` to include `monkTasks` among migrated slots, describe `sideMaps.monkTasks` as the schema-1 source of truth on load, and state that `unitCommands` remains the last bridge-owned Tier-1 codec before schema-2 can drop redundant side-map projections. `package.json` was not otherwise changed by this iteration.

## Verification

- `Select-String -Path 'docs\changelog.md' -Pattern '34 of 35|34 migrated|monkTasks.*NOT|KAD-0007|only slot'` returned no hits.
