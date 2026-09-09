# Replay Scrubber + Bridge-Snapshot — Design Spec

**Status:** Closed v21 (2026-05-05). aoe2 v0.1.6/v0.1.7 shipped the replay-scrubber roadmap in coherent user-visible units: commandify aoe2 input + AI intention dispatcher + bridge-state migration + schema-2 saves in v0.1.6, then the user-visible Phase 3C TimelinePanel in v0.1.7. Phase 3D/3E replay-load sources and browser scrubber e2e remain future work and should open a fresh `docs/threads/current/<objective>/` thread unless this historical thread is intentionally reopened. The user chose option A (commandify) over deferral — AI-native architectural correctness over implementation cost.

**v21 deltas vs v20:** The thread is closed under `docs/threads/done/replay-scrubber/`. Future replay-load/e2e work should create a new current objective thread rather than writing new review iterations into this done thread.

**Why this is split:** the original single-file spec grew past 1800 lines (~65k tokens), which exceeds Read's 25k-token budget and forces partial reads on every reference. The content is now broken into bounded sub-files under `design/`, ordered to match the original section numbering. Older version-delta history (v20 → v1) lives entirely in `01`/`02`/`03`; the goals, bridge-state inventory, architecture, API contracts, commandify scope, ADRs, invariants, performance, versioning, open questions, and implementation phase preview live in `04` through `12`. Each sub-file's body is the exact slice of the original document — no rewording.

## Sub-files

- [01-history-v21-v15-deltas.md](design/01-history-v21-v15-deltas.md) — original H1 + status note + v21/v20/v19/v18/v17/v16/v15 delta entries.
- [02-history-v14-v10-deltas.md](design/02-history-v14-v10-deltas.md) — v14 delta + v13 scope decision + v11/v10 deltas.
- [03-history-v9-v1-deltas.md](design/03-history-v9-v1-deltas.md) — v9 through v1 deltas, plus the closing horizontal-rule front matter (Author, Coordinated repos, Current scope, Related primitives).
- [04-goals-non-goals.md](design/04-goals-non-goals.md) — §1 Goals and Version Split + §2 Non-Goals (v0.1.7 Phase 3C).
- [05-bridge-state-inventory.md](design/05-bridge-state-inventory.md) — §3 Tier-1 / Tier-2 / Tier-3 slot tables + presentation-only items.
- [06-architecture.md](design/06-architecture.md) — §4 ASCII diagrams (Live game + Replay mode), file layout, plus the §5 "API contract" section header.
- [07a-api-bridge-state-migration.md](design/07a-api-bridge-state-migration.md) — §5.1 per-slot codecs + `BridgeStateAccessor`; §5.2 output-phase tail (`tier3SyncSystem` + `bridgeSnapshotSystem`).
- [07b-api-replay-controller.md](design/07b-api-replay-controller.md) — §5.3 `worldFactory` + `makeReplayBridge`; §5.4 `ReplayController`; §5.5 `TimelinePanel`.
- [07c-api-load-flow-and-annotation.md](design/07c-api-load-flow-and-annotation.md) — §5.6 createWorld split + Schema-2 load flow (PATH A/B/C); §5.7 Annotation UI behavior in replay mode.
- [08-commandify.md](design/08-commandify.md) — §6 Commandify aoe2 input (subsections 6.1 command surface, 6.2 validators+handlers, 6.3 facade, 6.4 migration order, 6.5 AI intention/dispatcher, 6.6 system split table, 6.7 verification).
- [09-adrs.md](design/09-adrs.md) — §7 ten ADRs (bridge state in `world.state`, output-phase tail, worldFactory split, schema-2 + back-compat, saveGame flush, no civ-engine changes, three load sources, replay pause/restore, frame-coalesced drag, stateful play).
- [10-invariants-and-testing.md](design/10-invariants-and-testing.md) — §8 Determinism / Equivalence Invariants + §9 Testing Strategy (unit / integration / browser).
- [11-perf-versioning-questions.md](design/11-perf-versioning-questions.md) — §10 Performance considerations + §11 deferred optimizations + §12 Versioning + §13 Open Questions.
- [12-implementation-phases.md](design/12-implementation-phases.md) — Implementation phases preview (Phase A through Phase 3E).
