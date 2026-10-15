# Codex's lanes finish on main: close what shipped, keep what is unique, retire the ten checkouts

Status: planned
Owner: Claude coordinator (Game orchestrator todos); worker to be named
Created: 2026-10-15
Updated: 2026-10-15

## Problem and outcome

The Codex orchestrator stopped working on aoe2 on 2026-10-10, and since 2026-10-11 the Claude coordinator owns its open items (local rules, "Permanent work records and the retained-owner transition"). The owner's direction of 2026-09-29 is that useful progress finishes on main and the temporary branches and checkouts are then retired. A read-only triage on 2026-10-14 found:

- Ten checkouts under `../aoe2-worktrees` from Codex's lanes. All ten HEADs are in main, none of their branches is on origin, and nine hold uncommitted files.
- Unique work in some of them: the reviewed and gated but unlanded candidates for work 107 (a persisted move-path cache, 11 files) and work 108 (engine coverage adoption, 13 paths), both staged in `parity-integration-0930`, which also holds the only copies of the authored reviews of 107 (rounds 0-2) and 108 (round 0) with their snapshots; the only copy of an unfinished browser spec, `tests/browser/movement-save-replay-controls.spec.ts`, in `replay-real-controls-1001`; three small garrison-observation files in `parity-gameplay-0930` that an OPEN register entry names as living there; `prepared-manifest.json` in `replay-parity-1001`, cited by plan 107.
- Plans 109, 110 and 111 have shipped but still say active; plan 98's remainder can become cards; plan 112, cancelled, still says the route6 checkout must not be removed; OPEN register entries from 109 and 110 (and one from 112) can close.
- `replay-parity-1001`'s `node_modules` junction points into `parity-gameplay-0930`'s own `tmp/`, and `parity-gameplay-0930`'s dependency-mirror junctions target inside their own tree, which work 113 says makes `controlWorktree.mjs remove` exit 1 after it deletes.
- The primary checkout's `tmp/` holds 112 Codex-era entries, about 785 MB.

Outcome: every Codex plan says truthfully whether it is complete, cancelled or active with an owner and a next step; every unique artifact is on main or deliberately dropped with its reason written down; all ten checkouts and their branches are gone, through `scripts/controlWorktree.mjs` only.

## Scope

- M1 (docs and the safe retirements): close plans 109, 110 and 111 with the coordinator as owner; close or drop their OPEN register entries on the evidence; turn plan 98's remainder into cards in work 106's queue and close it; turn 109's two leftovers into cards; correct plan 112's removal line; copy the authored review rounds of 107 and 108 into their permanent `reviews/` folders; make the garrison register entry stand without a `tmp/` path; copy plan 107's cited manifest if it is small; retire `corpus-evidence-1001`, `engine-coverage-adoption-1001`, `replay-parity-250`, `siege-content-1001` and `replay-parity-1001`.
- M2 (after work 107 and 108 are decided): land or cancel 108; re-baseline 97 and close it or make it a card; fix or cancel 113; retire `parity-integration-0930`, `coverage-consumer-1001`, `replay-real-controls-1001`, `parity-gameplay-0930` and `replay-timeout-route6-1001`; clean the primary `tmp/` of Codex-era entries nothing open cites.
- Excluded: landing work 107's product fix (its own plan, with an independent review because it is persistence); the CI Node version (a card in work 106's queue).

## Approach

Every claim that a file is superseded is checked before anything is discarded: byte-identical to main, or its content already applied to main, with the command recorded. `controlWorktree.mjs` runs with `--dry-run` first, and `--discard-changes` only names files proven superseded. A checkout holding anything not yet preserved stays. Docs follow the repo's rules: the register's rollover gate, thread closure, and the docs checks `checkoutLineEndings.test.ts`, `workDocsIntegration.test.ts` and `threadHygiene.test.ts` against the staged files before each commit.

## Acceptance criteria

- Plans 109, 110 and 111 say complete, with the commits that shipped them; plan 98 is closed with its remainder in work 106's queue; plan 112 no longer says a checkout must stay.
- The 107 and 108 review rounds are in `docs/work/107_replay-movement-parity/reviews/` and `docs/work/108_engine-coverage-adoption/reviews/`, within the repo's blob-size rules.
- No register entry or plan points at a path inside a checkout this work retires.
- M1's five checkouts and their branches are gone, removed by the controller, with every discarded file listed in this plan with its evidence.
- M2's checkouts are gone once 107 and 108 are decided, and the primary `tmp/` holds no Codex-era entry that nothing cites.

## Implementation steps

- [ ] M1: docs closures, preserved reviews and evidence, five checkouts retired.
- [ ] M2: 108, 97 and 113 decided; the other five checkouts retired; the primary `tmp/` cleaned.

## Outcome

Pending. Record the verified revision, checks and limitations at closure.
