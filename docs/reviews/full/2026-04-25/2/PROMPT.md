You are a senior code reviewer running iteration **2** of a thorough, full-repository audit of an Age of Empires II browser prototype. The repository root is the current working directory.

# What to read first

- `AGENTS.md` (project rules and conventions)
- `docs/architecture/ARCHITECTURE.md` (intended boundaries)
- `docs/devlog/summary.md` (latest milestones)
- `docs/engine-feedback/current.md` (live engine asks)
- **`docs/reviews/full/2026-04-25/1/REVIEW.md` — iteration 1 synthesized findings.** Skim before reviewing so you do not re-flag already-known issues. The summary section "Iteration 1 fix status" below lists which findings were fixed, deferred, or rejected.
- High-traffic modules: `src/main.ts`, `src/app/bootstrap/**`, `src/game/simulation/createSimulationBridge.ts`, `src/game/simulation/bridge/**`, `src/game/simulation/mapGeneration/**`, `src/game/simulation/fixtures/**`, `src/phaser/scenes/**`, `src/ui/**`
- Test seams: `tests/simulation/**`, `tests/browser/**`, `tests/phaser/**`
- Sample widely; do not stop at the first file. The repo is ~47 kLOC of TypeScript across ~155 files.

# Iteration 1 fix status (do not re-flag the FIXED items as new)

**FIXED (verify the fix lands correctly; flag only if the fix has a new defect):**

- **C-1 Monk conversion flip-flop** — `bridge/monkTaskOps.ts` reset-on-different-owner now runs after the per-tick guard so the first-processed Monk wins. Commit `3f413e2`.
- **H-1 Save/load projector seed mismatch** — `createProjector` is now called with `effectiveSeed` (= `savedGame.seed` when loading). Commit `7bba71e`.
- **H-3 Garrison cross-reference integrity** — `createSimulationBridge.ts` post-load mirror check between `garrisonedByBuilding` and `garrisonedUnitToBuilding` throws on mismatch. Commit `bfce2c7`.
- **M-16 ARCHITECTURE.md `bridge/` topology** — refreshed to all 11 `bridge/` ops modules + 3 top-level siblings. Commit `6b37c62`.

**REJECTED as not-a-bug after verification:**

- **H-5 AI villager rebalance with zero villagers no-ops** — silent no-op is correct (rebalance has nothing to redistribute).

**DEFERRED to later iterations (do not re-flag as new findings — but if you find a stronger angle on any of them, note it):**

- **C-2 Save loader has no enum validation** (`createSimulationBridge.ts:1789, 1795, 1902, 1909, 1930, 1932, 1955`).
- **H-2 Save/load round-trip lacks side-map coverage** (`tests/simulation/saveLoad.test.ts`).
- **H-4 `getRenderState` per-call full scan** (`createSimulationBridge.ts:7187+`).
- **H-6 `placementMode` cleared inconsistently across player-action surfaces.**
- **H-7 HUD listeners / RAF have no symmetric cleanup.**
- **N-1 `createSimulationBridge.ts` is still ~7,360 lines.** Combat / production / gather-dropoff / sheep-ownership are the largest in-file surfaces.
- Plus M-1 through M-18 and L-1 through L-8 from iteration 1.

# What we want from iteration 2

1. **Verification pass:** Inspect the four fixes above (`monkTaskOps.ts` reset ordering, `effectiveSeed` plumbing, garrison cross-reference loop, ARCHITECTURE.md). Are they correct, complete, and side-effect-free? Flag any new defect introduced by the fix as `[V-x]`.
2. **New findings:** Anything iteration 1 missed. Particularly: places we have not yet swept hard — `mapGeneration/`, `fixtures/`, `phaser/scenes/gameScene/*`, `tests/browser/`, `scripts/`, `app/bootstrap/dev-server`. Also any cross-module integration risk.
3. **Game-design / player-experience correctness** that is not pure code health: pathing edge cases, win-condition timing, UI feedback gaps, AI loops. iteration 1 was code-leaning; iteration 2 can lean a bit more on player experience.
4. **Verified-not-bugs** section like Claude did in iteration 1 — surface tempting "bugs" you ruled out so we do not re-investigate.

# Aspects to review (matches AGENTS.md "Code review")

1. Design — scalability, generalization, debuggability, leanness. Boundary violations vs ARCHITECTURE.md.
2. Test coverage — critical paths (combat, gathering, fog, save/load, AI, occupancy, win conditions, age progression, monk + relic, trebuchet pack/unpack, sheep claims, auto-aggression).
3. Correctness — bugs, race conditions, off-by-ones, broken invariants, save/load schema drift, determinism violations.
4. Cleanliness / typing / efficiency / memory — duplicated logic, dead code, unsafe `any`, expensive per-tick scans, unbounded side maps, missing listener / RAF / timer cleanup, hidden allocations in hot loops.
5. Documentation — outdated comments, mismatches between `summary.md`, ARCHITECTURE.md, and code.

# Output format

Plain text or markdown. Do NOT propose patches and do NOT modify files.

For each finding:

- **Severity:** critical | high | medium | low | nit
- **Theme:** design | tests | correctness | cleanliness | docs
- **Where:** `path/to/file.ts:LN` (or a tight range)
- **Finding:** one to three sentences explaining the issue and the concrete risk.

End with two sections:

- **Verified-not-bugs** — items you examined and ruled out.
- **Top issues to fix first** (max 5, ordered by impact). Cite specific files and lines.
