# Review 0: implementation (M1)

## Target

aoe2 commit 73e5ed78 on branch `de-game-speeds-1106` (work 149 M1), reviewed as `git diff 4bd1978b 73e5ed78`, with 4bd1978b main at the time: DE's four game speeds in `src/game/simulation/matchOptions.ts`, the lobby's row, `?speed=`, the numpad's keys, the Time chip's readout, their tests, spec §4.5 and the lines citing it, the changelog's "Unreleased — work 149" entry.

## Reviewers and coverage

- Codex `gpt-6-astra`, `model_reasoning_effort=xhigh`, read-only sandbox (codex-cli 0.163.0), the runbook's command (`../fleet/docs/skills/multi-cli-review.md`) from a run folder in the worktree's ignored `tmp/review-runs/`, with the worktree as `--cd`. The worktree was clean before and after.
- One lane, Codex preferred by the brief. The prompt named the six acceptance criteria: the lobby, `parseSpeedParam`, the keys and one ladder, the readout, the tests, and the spec and changelog.

## Reports

### Codex (`gpt-6-astra`)

No blocker or major issue. Two minor findings, redacted only of absolute paths:

1. Minor: `matchOptionParams.ts:50`, an explicitly empty `?speed=` (or one of spaces) runs at 1.0x without a warning, where §4.5 said any other value warns. Reproduced directly. Suggested fix: return silently only for an absent parameter.
2. Minor: `game-speed.spec.ts:30`, every readout assertion is `toHaveText`, which a hidden element also passes, and neither case enters a replay, so a readout left hidden or a dropped replay-mode subscription would pass. Suggested fix: assert visibility at boot and after the keys, and enter and leave a replay through the real controls.

## Findings and disposition

1. FINDING-1 (minor), kept as is and the spec made exact. The four sibling parsers (`?resources=`, `?victory=`, `?popcap=` and this one) all treat an empty value as absent, so `?speed=` keeps that rule; §4.5 now says a URL without `?speed=`, or with it empty, runs at 1.0x silently, and only an unknown value warns. Docs only.
2. FINDING-2 (minor), noted, not repaired in this round: the brief has minor findings noted rather than a new round, and the repair is a test change, which needs a full gate of its own. Plan 149's "Not checked" already names it: the replay-mode hide is wired, not driven. Left for the landing or a later lane.

## Verification

None needed for FINDING-1 beyond the content checks (a spec sentence); FINDING-2 changes nothing.

## Round outcome

No blocker or major finding; two minor ones, one settled in the spec and one noted. No further round.
