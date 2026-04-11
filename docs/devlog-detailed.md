## [2026-04-10 20:29, America/Los_Angeles] - Initialize AoE2 gameplay spec
**Action:** Wrote a clean-room, implementation-oriented gameplay specification for an Age of Empires II-compatible RTS and initialized the repo devlog files required by local project guidance.
**Result:** Added a complete spec covering match structure, world rules, economy, combat, civilizations, maps, UI, AI, determinism, and data schemas. Also created summary and detailed devlog files so future work has a documented trail.
**Files changed:** `design/aoe2-game-spec.md`, `docs/devlog-detailed.md`, `docs/devlog-summary.md`
**Reasoning:** The repository is effectively empty, so the most useful first artifact is a single source-of-truth design doc that defines the target game before engine or content work starts. Initializing the devlog now avoids future agents violating the repo workflow in `CLAUDE.md`.
**Notes:** The spec deliberately targets the classic `Age of Kings + The Conquerors` baseline instead of later Definitive Edition content to keep scope stable. No architecture document was added because this change is documentation-only and does not introduce code structure yet.
