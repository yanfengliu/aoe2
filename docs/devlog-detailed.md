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

## [2026-04-10 20:59, America/Los_Angeles] - Retarget spec to DE and align with local stats
**Action:** Reworked `design/spec-codex.md` from an AoC-focused roster dump into a DE-targeted systems spec that treats `design/stats` as the canonical content source, and rewrote `design/sources.md` to reflect the new source hierarchy and official DE references.
**Result:** The spec now explicitly targets AoE2 DE, removes stale AoC-only assumptions, reduces redundant prose duplication of civ and tech data already present in CSVs, and documents the current gap between the local stats bundle and full live-DE content. The sources file now prioritizes local stats first, official DE sources second, and keeps older AoC references only as historical context.
**Files changed:** `design/spec-codex.md`, `design/sources.md`, `docs/devlog-detailed.md`, `docs/devlog-summary.md`
**Reasoning:** The user clarified that the intended target is DE and that `design/stats` is now the source of truth. Given that, the previous hand-maintained AoC-centric prose was both redundant and partially incorrect. The revised spec defines the systems and data-interpretation rules while letting the structured data own the concrete roster.
**Notes:** The local data currently covers 30 unique civ rows with duplicates and a mostly classic unit and tech bundle, so the spec calls out dataset incompleteness instead of guessing missing DE content. This was a documentation-only change; no tests were run.

## [2026-04-10 21:08, America/Los_Angeles] - Split source log into indexed folder
**Action:** Split the single-file research log into a `design/sources/` folder with a top-level index and topic-specific source files, converted `design/sources.md` into a compatibility pointer, and updated the spec to reference the new source-file locations.
**Result:** The source documentation is now organized by policy, local data, official DE references, community and historical references, and findings. The old `design/sources.md` path still resolves for historical references in prior devlog entries, while current documentation can navigate through `design/sources/README.md`.
**Files changed:** `design/sources.md`, `design/sources/README.md`, `design/sources/01-policy.md`, `design/sources/02-local-data.md`, `design/sources/03-official-de.md`, `design/sources/04-community-and-history.md`, `design/sources/05-findings-and-guidance.md`, `design/spec-codex.md`, `docs/devlog-detailed.md`, `docs/devlog-summary.md`
**Reasoning:** The sources file had grown into several distinct concerns. Splitting it reduces merge pressure, makes the official and local source hierarchy easier to scan, and preserves backward compatibility for existing path references instead of leaving historical links dead.
**Notes:** The spec still contains one pre-existing garbled quoted heading string in the DE section; the folder split itself is complete and the source references now resolve through the new index structure. No tests were run because this was a documentation-only change.

## [2026-04-10 21:11, America/Los_Angeles] - Narrow scope to single-player AI skirmish
**Action:** Removed multiplayer and campaign-story assumptions from `design/spec-codex.md` and updated the official DE source notes so they only justify the current single-player skirmish scope.
**Result:** The spec now targets a single-player Random Map experience with one human player fighting AI opponents, allows optional AI allies, and explicitly marks multiplayer, ranked flows, replay requirements, and campaign story mode as out of scope. The simulation section no longer specifies networking or replay behavior.
**Files changed:** `design/spec-codex.md`, `design/sources/03-official-de.md`, `docs/devlog-detailed.md`, `docs/devlog-summary.md`
**Reasoning:** The user clarified that the current product scope should be limited to fighting AI in single-player. Keeping multiplayer and campaign requirements in the spec would create false implementation pressure and muddy prioritization.
**Notes:** This was a documentation-only change; no tests were run.

## [2026-04-10, UTC] — Write independent AoE2 DE game spec (spec-claude.md)
**Action:** Created `design/spec-claude.md` — a comprehensive, implementation-ready game specification for Age of Empires II: Definitive Edition. Combined local CSV data (`design/stats/`) with extensive online research into combat mechanics, economy systems, map generation, building mechanics, tech trees, and UI/networking architecture.
**Result:** Complete 17-section spec covering: game overview, match structure (7 game modes, 4 victory conditions), world/map generation (8 map types, terrain system, resource placement), economy (gather rates, trade formulas, market mechanics, tribute, relics), age progression, buildings (economy/military/defensive with all stats), units (all categories with upgrade chains), combat system (damage formula, armor classes, accuracy, elevation, blast damage, garrison arrows, conversion, healing), technology system (all blacksmith/university/monastery/dock/TC/castle techs), civilizations (30 civs across 5 expansions with bonuses), fog of war, pathfinding, AI behavior, UI layout, deterministic simulation model, multiplayer networking, and audio/visual design. Includes key formulas appendix.
**Files changed:** `design/spec-claude.md`, `docs/devlog-detailed.md`, `docs/devlog-summary.md`
**Reasoning:** The user requested an independent spec (separate from `spec-codex.md`) based on original research. The spec was built by reading all local CSV data files first, then conducting three parallel research threads (combat mechanics, economy/maps, buildings/tech tree) using web sources to fill in implementation-level detail not captured in the CSVs.
**Notes:** This spec targets the full DE product including multiplayer, unlike `spec-codex.md` which was narrowed to single-player AI skirmish. The spec defers to `design/stats/*.csv` for concrete numeric values and defines the rules/formulas that operate on that data.

## [2026-04-10, UTC] — Narrow spec-claude.md to single-player vs AI
**Action:** Removed multiplayer networking section (§16), lobby system, spectator mode, peer-to-peer lockstep, disconnect handling, and replay system from `design/spec-claude.md`. Reframed all remaining references from multiplayer to single-player with AI opponents/allies. Simplified simulation model section to tick-based simulation without lockstep networking concerns. Added scope declaration to header. Renumbered Audio and Visual from §17 to §16.
**Result:** Spec now has 16 sections (down from 17). All "ally" references now specify "AI ally". Trade, tribute, and team bonus mechanics retained but scoped to AI partners. Game setup replaces lobby system.
**Files changed:** `design/spec-claude.md`, `docs/devlog-detailed.md`
**Reasoning:** User clarified the product scope is single-player only — one human player vs AI opponents. Multiplayer and campaign story modes are out of scope.
**Notes:** Documentation-only change. No tests run.

## [2026-04-10, UTC] — Remove non-standard game modes from spec-claude.md
**Action:** Removed Death Match, Regicide, Empire Wars, King of the Hill, Wonder Race, and Capture the Relic game modes from `design/spec-claude.md`. Kept only Random Map (Standard) mode. Simplified Spies/Treason tech to Spies only (Treason is Regicide-specific).
**Result:** Section 2.1 now describes only the standard Random Map mode. All mode-specific mechanics (King unit, Monument, pre-placed buildings) removed.
**Files changed:** `design/spec-claude.md`, `docs/devlog-detailed.md`
**Reasoning:** User requested only the standard Random Map mode be kept in scope.
**Notes:** Documentation-only change. No tests run.

## [2026-04-10 21:34, America/Los_Angeles] - Clean up local stats integrity issues
**Action:** Corrected obvious integrity problems in `design/stats`: removed duplicate civilization rows, fixed civ and tech spelling/canonical-name drift, fixed the `Archer` hit-point/range field swap in `units.csv`, and normalized one semicolon-delimited civ token with stray whitespace. Updated `design/spec-codex.md` and `design/sources/05-findings-and-guidance.md` so they no longer document already-fixed duplicate-row issues.
**Result:** The checked-in stats bundle is internally cleaner and less likely to break string-based joins during import. `civilizations.csv` now has unique civ names, the Barracks and Stable upgrade chain names line up with `units.csv`, and the most obvious bad unit stat row is corrected. The remaining gap is broader DE roster completeness: several later-expansion civ references still point at units and unique techs that are not yet represented in `units.csv` or `technologies.csv`.
**Files changed:** `design/stats/civilizations.csv`, `design/stats/technologies.csv`, `design/stats/units.csv`, `design/spec-codex.md`, `design/sources/05-findings-and-guidance.md`, `docs/devlog-detailed.md`, `docs/devlog-summary.md`
**Reasoning:** The user asked to fix data problems in the local stats bundle. The safest high-confidence pass was to resolve verified duplicates, malformed text, canonical-name mismatches, and clearly wrong local values without inventing missing late-expansion DE content.
**Notes:** No tests were run because this was a data and documentation cleanup pass. A follow-up sourced content pass is still required if the repo wants the later-expansion civ rows to be fully backed by local unit and technology records.

## [2026-04-10 21:37, America/Los_Angeles] - Restrict specs to standard Random Map mode
**Action:** Removed the remaining non-standard mode assumptions from `design/spec-codex.md` and tightened one leftover game-setup line in `design/spec-claude.md` so the specs no longer imply a selectable game-mode roster.
**Result:** `spec-codex.md` now defines a single standard match-setup path, removes Regicide/Wonder-capable preset requirements, and narrows victory support language to the standard Random Map ruleset. `spec-claude.md` no longer tells implementers to expose a generic game-mode selector in setup.
**Files changed:** `design/spec-codex.md`, `design/spec-claude.md`, `docs/devlog-detailed.md`, `docs/devlog-summary.md`
**Reasoning:** The user clarified that only standard mode should remain in scope. Leaving special-mode setup hooks in the spec would create false implementation requirements and conflict with the single-mode product target.
**Notes:** Documentation-only change. No tests were run.

## [2026-04-10 21:53, America/Los_Angeles] - Consolidate working specs into official final spec
**Action:** Read `design/spec-codex.md` and `design/spec-claude.md`, merged their compatible content into a new canonical document at `design/spec-final.md`, and updated `design/sources/README.md` so the source index now points at the final spec instead of the older draft.
**Result:** The repo now has a single official spec that keeps the strong source-of-truth and normalization rules from `spec-codex.md` while incorporating the fuller gameplay, economy, combat, UI, AI, and simulation guidance from `spec-claude.md`. The merged doc keeps standard Random Map single-player scope, avoids duplicating CSV-owned roster data, and adds a concise appendix of implementation-critical formulas and constants.
**Files changed:** `design/spec-final.md`, `design/sources/README.md`, `docs/devlog-detailed.md`, `docs/devlog-summary.md`
**Reasoning:** The user asked for one official spec instead of two parallel documents. Consolidation removes ambiguity about which draft is authoritative and reduces the risk of future design drift between overlapping markdown files.
**Notes:** `design/spec-codex.md` and `design/spec-claude.md` are retained as precursor drafts, but `design/spec-final.md` is now the canonical spec. No tests were run because this was a documentation-only change.
