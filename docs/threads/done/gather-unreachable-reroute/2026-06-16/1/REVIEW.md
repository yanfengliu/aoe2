# REVIEW — gather-unreachable-reroute, iteration 1 (2026-06-16)

Diff: the v0.1.47 gather-unreachable reroute (929-line `git diff --cached`). Three CLIs, all codebase-grounded.

- **Codex** gpt-5.5 xhigh, `--sandbox read-only` (no `--ignore-user-config`). Read files via the Windows-native fallback.
- **Claude** opus[1m] `--effort max`, `--allowedTools Read,Glob,Grep,Bash(git diff/log/show)`. Ran typecheck + the two new test files itself.
- **Gemini** gemini-3.1-pro-preview `--approval-mode plan`. Hit 2× 429 (capacity) and recovered internally; emitted a grounded review.
- **Contamination audit: CLEAN.** `git status` after the batch showed all changes still staged, no unstaged writes (no Gemini plan-mode `replace` contamination).

## Convergence

All three independently flagged **one** substantive finding — the fully-boxed per-tick BFS storm (Codex MEDIUM, Claude MEDIUM, Gemini HIGH). **No HIGH bug in the core fix.** Codex and Claude each explicitly verified (and I re-verified): the default-path byte-identity, count bookkeeping, determinism, no-save-change, and file sizes are all correct. The remaining findings are LOW/doc-accuracy. Every empirical reviewer claim was checked against the live code + a runtime probe before acting (AGENTS.md) — which mattered here (see F5).

## Findings + disposition

1. **[MEDIUM/HIGH — storm] Fully-boxed villager → unbounded per-tick BFS.** (Codex MED, Claude MED, Gemini HIGH.) When NO resource of the desired kind is reachable, the reroute scanned every candidate (one `findResourceApproachPlan` BFS each) → idle → the unchanged bottom idle→assign re-picked the same unreachable resource → repeated every tick (1+N BFS/tick vs 1 pre-fix, N = map resources of that kind). VERIFIED against code. **FIXED:** capped the reachability scan at `MAX_REACHABILITY_PROBES`=16 in `villagerGatherAssignment.ts`. The success case short-circuits at the first reachable candidate (well within the cap, so the realistic reroute is unaffected); the pathological fully-boxed case is bounded to ≤16 BFS/tick instead of scaling with the map. Added a mechanism test asserting the probe count is bounded. Also: the branch now deposits a carry first (see F4).

2. **[LOW — doc accuracy] "idles" / "no worse than before" / "self-resolving" overstated.** (Claude L1, Gemini LOW, Codex doc note.) The villager does not durably idle (it oscillates), and the fully-boxed cost was NOT parity with pre-fix. **FIXED:** reworded `spec-final.md` §6.4, `changelog.md` 0.1.47, `DESIGN.md`, `PLAN.md`, the devlog, summary, and roadmap to accurately describe the bounded behaviour + the carry-deposit.

3. **[LOW — dead code] `else if (excludeId !== null)` unreachable.** (Gemini.) VERIFIED: the sole caller passing `excludeResourceId` also passes `requireReachable: true`, so that branch could never execute. **FIXED:** removed it; documented that `excludeResourceId` is honoured only under `requireReachable`.

4. **[LOW — carry parity] Unreachable branch could strand a carry.** (Claude L2; Claude called it "theoretical", but it is REAL.) VERIFIED via `clearGathererOrder` (bridgeHelpers.ts:264): it sets `task='idle'` without resetting `carriedAmount`, and `setUnitGatherCommandDirect` then sets `to-resource` — so a carrying villager CAN be in `to-resource` (an explicit gather order issued mid-carry). The old unreachable branch could idle it with the carry stranded. **FIXED:** the unreachable branch now sets `to-dropoff` when `carriedAmount > 0` (mirrors the depleted/gone sibling branch), then reroutes from empty.

5. **[LOW — fixture/doc] Codex LOW-1: "the boxed farm is tier-1 `owner=null`, not tier-0" — CORRECT; Claude's contrary "owner=2/tier-0" verification was WRONG.** Settled by probing the spawned entity (`tmp/`): the farm's food resource is `owner=null, baseOwner=2` (tier-1), as are the berries. The fixture reproduces the gridlock via the BELOW-FAN-OUT-CAP food-villager count (the spawn default gives 2 food + 1 wood villager; 2 food < cap 4 → the over-subscription fan-out never redistributes them off the nearest unreachable food), NOT the owner tier. **FIXED:** corrected the fixture comments + every doc claiming a "tier-0 owned farm". (The campaign-11 ROOT CAUSE was genuinely a tier-0 owned sheep — accurate, unchanged.) Reviewer-divergence lesson: a confident reviewer verification can be wrong; the runtime probe was decisive.

6. **[LOW — test] Integration secondary assertion non-discriminating.** (Claude L3 + lead.) `working.length>=1` (any gathering villager) passed pre-fix too — the spawn-default wood villager chops a ring tree. **FIXED:** replaced with a reachable-berries-gathered check (berries untouched pre-fix → clean discriminator). Re-verified red (pre-fix) → green (post-fix).

## Outcome

One substantive finding (the storm) bounded + five LOW/doc items, all addressed and test-guarded. The findings were about a pathological edge case + doc accuracy, not the fix's correctness (default-path byte-identity, determinism, save-safety all verified clean). This is nitpick-convergence; no iter-2 reviewer round needed — the storm cap + doc corrections are mechanical and covered by the new bounded-probe test. Gates re-run green after the fixes.
