# Phase 3A/A.5 Replay World Review - Iteration 34

## Reviewers

- Codex `gpt-5.5` xhigh: unreachable due usage limit after the previous substantive reviews (`try again at 8:37 PM`).
- Claude `claude-opus-4-7[1m]`: unreachable due quota limit (`You've hit your limit - resets 7pm (America/Los_Angeles)`).
- Gemini `gemini-3.1-pro-preview`: completed fallback structural review from the diff prompt; no file-reading guarantee equivalent to Codex/Claude.

## Findings

- [LOW] Gemini: `registerAllSystems.ts` duplicated identical live/replay `prototypeAi` and `prototypeAutoAggression` registration blocks after the pending-boundary fix. Disposition: fixed by registering the replay drain conditionally and then sharing the AI/auto-aggression registration path.
- [LOW] Gemini: the duplicated replay branch carried a copied comment with visible character-encoding noise. Disposition: fixed by removing the duplicate branch.
- [LOW] Gemini: `hydrateFromWorldState.ts` mutated `garrisonedByBuilding` while iterating the map directly, unlike nearby defensive spread iterations. Disposition: fixed by iterating over `[...garrisonedByBuilding]`.

## Outcome

Fallback review found cleanup-only issues after the Codex findings were addressed. Required Codex/Claude re-review was attempted and blocked by external CLI quota, so the blocker is recorded rather than treated as approval.
