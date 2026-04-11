## [2026-04-10 20:29, America/Los_Angeles] - Initialize AoE2 gameplay spec
**Action:** Wrote a clean-room, implementation-oriented gameplay specification for an Age of Empires II-compatible RTS and initialized the repo devlog files required by local project guidance.
**Result:** Added a complete spec covering match structure, world rules, economy, combat, civilizations, maps, UI, AI, determinism, and data schemas. Also created summary and detailed devlog files so future work has a documented trail.
**Files changed:** `design/aoe2-game-spec.md`, `docs/devlog-detailed.md`, `docs/devlog-summary.md`
**Reasoning:** The repository is effectively empty, so the most useful first artifact is a single source-of-truth design doc that defines the target game before engine or content work starts. Initializing the devlog now avoids future agents violating the repo workflow in `CLAUDE.md`.
**Notes:** The spec deliberately targets the classic `Age of Kings + The Conquerors` baseline instead of later Definitive Edition content to keep scope stable. No architecture document was added because this change is documentation-only and does not introduce code structure yet.

## [2026-04-10 20:50, America/Los_Angeles] - Expand AoC spec and document research sources
**Action:** Rewrote `design/spec-codex.md` into a more concrete `The Conquerors 1.0c` design spec, added building-by-building production and technology coverage, expanded the civilization section into a classic 18-civilization catalogue, and converted `design/sources.md` into a real research log.
**Result:** The spec now pins to a specific classic baseline, corrects major version drift from the prior draft, references the local structured CSVs under `design/stats`, and gives future implementers a clearer roster definition for buildings, units, upgrades, and civilization identity. The source file now records both external research and local supporting artifacts.
**Files changed:** `design/spec-codex.md`, `design/sources.md`, `docs/devlog-detailed.md`, `docs/devlog-summary.md`
**Reasoning:** The earlier draft was too high-level for concrete implementation and mixed some non-classic assumptions. The repo now contains structured local data tables, so the right move was to align the prose spec to a strict AoC baseline while using the CSVs as the exact stat and availability companion.
**Notes:** The local CSVs mix classic and later-expansion data, so the prose spec intentionally filters back to the classic roster and mechanics. This was a documentation-only change; no code or tests were run.
