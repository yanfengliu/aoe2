# Versioning and Slice Cadence

## Per-AGENTS.md policy

- One coherent user-visible change → one version bump → one commit on `main`.
- Pure refactors / type-safety hardening / doc sweeps with no observable effect: no bump, no changelog entry.
- `c` bump (third digit) for non-breaking additive features, bug fixes, gameplay-rule tweaks.
- `b` bump (second digit) reset `c` for breaking changes (save format, removed APIs).

## This thread

| Slice | Version | Why this bump |
|---|---|---|
| 1 — Replay-mode annotation affordances | 0.1.7 → **0.1.8** | New user-visible behavior: Alt+M is suppressed, MarkerListPanel changes content + interactions in replay mode. `c` bump. |
| 2 — Load current live session | 0.1.8 → **0.1.9** | New HUD button, new entry point into replay mode. `c` bump. |
| 3 — Prior Sessions Replay button | 0.1.9 → **0.1.10** | New button per row, new public `RecordingService.loadPriorSessionBundle`. `c` bump. |
| 4 — File import | 0.1.10 → **0.1.11** | New HUD button, new file-picker flow. `c` bump. |
| 5 — ReplayLoadDialog modal | 0.1.11 → **0.1.12** | New modal UX consolidating slices 2-4. `c` bump. |
| 6 — Phase 3E e2e + integration | 0.1.12 → **0.1.13** OR no bump | Test-only — typically no bump, but if the slice also exposes new test-API surfaces on `window.__AOE2_TEST__` that user-facing scripts could call, that counts as additive public API and warrants a `c` bump. Decision deferred to slice-6 implementation review. |

## Changelog discipline

Each user-visible slice gets its own `## 0.1.X — <date>` block in `docs/changelog.md`. Per AGENTS.md: external audience, focuses on what users need to know, validation footer, behavior callouts. Internal commentary stays in the devlog.

## What if a slice surfaces a fix during multi-CLI review?

- Iter-2/3/N fixes for the SAME slice fold into the same version. The original slice keeps its target version number.
- A genuinely new defect discovered while implementing slice N is its own commit + bump (not folded into slice N's commit).
