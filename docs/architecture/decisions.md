# Key Architectural Decisions

Durable decisions that shape the codebase. Never delete a decision; if a decision
no longer holds, add a newer decision that explicitly supersedes it and mark the
old one as superseded with a pointer to the new entry.

Entries are append-only and ordered oldest first.

---

## KAD-0001 — Use `civ-engine` as the authoritative simulation core
Date: 2026-04-10
Status: Active

The game uses `civ-engine` for deterministic world state, component/query systems,
fixed-step ticking, visibility, and render projection. Gameplay rules live behind
this boundary. This is also how the project validates that `civ-engine` can
support an AoE2-style RTS.

Consequences:
- No gameplay state lives in Phaser scenes.
- New engine gaps must be documented in `docs/engine-feedback/current.md` rather than
  worked around inside `civ-engine` itself.

---

## KAD-0002 — Phaser is view and input only
Date: 2026-04-10
Status: Active

Phaser renders projected render frames and dispatches user input as commands.
It holds no authoritative gameplay state. Render-only concerns like unit
interpolation and camera control are allowed on the scene side.

Consequences:
- Any new gameplay behavior must land in the simulation bridge or `civ-engine`.
- Browser tests assert against a scene-exposed render state seam, not internal
  sim state.

---

## KAD-0003 — Single source of truth for content is `design/stats/*.csv`
Date: 2026-04-10
Status: Active

Unit stats, technologies, civilizations, and similar content are defined in
structured CSVs under `design/stats/`. A prebuild step normalizes them into
`generated/content/content.json`, which the simulation loads. Prose specs do not
duplicate CSV-owned numeric data.

Consequences:
- Balance or roster changes are data edits, not code edits.
- `generated/content/content.json` is not committed.

---

## KAD-0004 — Scope is single-player vs AI standard Random Map
Date: 2026-04-10
Status: Active

The product scope is one human player versus AI opponents on the standard Random
Map mode. Multiplayer, campaign story mode, and non-standard game modes are out
of scope.

Consequences:
- No networking code, lobby flows, or replay systems.
- Simulation does not need lockstep or peer-to-peer guarantees.
