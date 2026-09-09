# Voxel visual-quality increment — adversarial review

Date: 2026-07-12

Scope: sibling `voxel` daylight runtime plus AoE2 v0.1.148 procedural voxel art and browser evidence

Verdict: approved locally; publication remains conditional on engine-first push authorization

## Reviewers and evidence

- Engine reviewer inspected the live runtime, tests, exports, docs, and built output. It found one MEDIUM initialization-rollback defect: constructor failure during renderer sizing removed neither the runtime/daylight scene roots nor the owned renderer. Parameterized owned/borrowed failure tests drove transactional cleanup. Independent built-output reproduction verified both roots absent, owned renderer disposed exactly once, borrowed renderer not disposed, and the original error preserved. Final engine verification passed 74/74 tests, typecheck, lint, and build.
- AoE reviewer inspected the live source, pin, visual evidence, metrics, docs, file sizes, and worktree. Its initial findings were: HIGH stale engine pin; MEDIUM whole-snapshot CPU churn without an explicit acceptance boundary; MEDIUM incomplete implementation ledgers; MEDIUM time-drifted before/after evidence; LOW ignored Playwright artifacts. Final re-review found no substantive issue.

## Dispositions

- `.github/voxel-commit` now pins `dd9b811d0dd3a5912cbc4626cc1b7ade94895e74`. The engine commit is local-only, so AoE may not be pushed first.
- The accepted before/after/diff set uses the same seed, tick 0, camera, viewport, game size, and DPR. Independent pixelmatch reproduced 71,616/480,000 changed pixels (14.92%).
- The controlled frame reports 1,000 instances, four batches, eight draw calls, 16,632 triangles, five materials, one geometry resource, five renderer geometries, and one texture.
- Whole-snapshot rebuilding is accepted only for the opt-in slice. `DESIGN.md` records the local 2,261-entity synthetic reference and a 4 ms representative-browser trigger; `PLAN.md` keeps static/dynamic batch separation in backlog.
- Plans, spec, architecture, decisions, drift log, changelog, README, devlogs, and review evidence agree on implemented versus deferred scope.
- `.playwright-cli` is removed. All reviewed new source/test files are under 500 lines, and `git diff --check` is clean.

## Final gates

- Shared engine: `npm run verify` passed 74/74 tests, typecheck, zero-warning lint, and build; package dry-run produced `voxel-0.1.1.tgz` metadata successfully.
- AoE unit gate: 250 files passed and one skipped; 2,062 tests passed and two skipped.
- AoE browser gate: after hardening a 30-second multi-thousand-tick scenario budget and replacing a host-RAF-dependent interpolation probe with a deterministic half-tick sequence, the fresh production run passed 100 tests with two intentional visual-baseline skips.
- AoE typecheck, zero-warning lint, and production build passed; Vite transformed 455 modules.

No unresolved code or visual-quality finding remains. Remote delivery is blocked only on explicit authorization to push the engine commit first and the pinned AoE commit second.
