# Replay fog-owner toggle (user request 2026-06-12)

Objective: let the replay viewer switch which player's fog of war is rendered, so LLM playtest campaigns (agent = player 2) can actually be spectated. Today the replay projector hardcodes `HUMAN_PLAYER_ID`; the agent's base sits under fog except where player 1 scouted (the same blind spot that bit the observation oracle pre-finding-G).

## Shape

- **`makeReplayBridge(world, {fogOwner})`** — new option, default `HUMAN_PLAYER_ID`. Drives (a) `createProjector(visibility, fogOwner, ...)` (entity/cell visibility projection), (b) `createRenderStateOps({humanPlayerId: fogOwner, ...})` (that dep is really "perspective owner": it gates the building/resource footprint-visibility filter), and (c) fog-memory getters — zeroed when `fogOwner !== HUMAN_PLAYER_ID` because the engine records "last seen" ghost memory for the human player only; other perspectives render live visibility without ghosts (honest: the data does not exist).
- **`ReplayController`** gains `fogOwner` (readonly), `fogOwnerCandidates()` (owners present in the replay world's per-player economy state, ascending), `setFogOwner(owner)` (validates against candidates; no-op when unchanged), and `cycleFogOwner()`. Switching rebuilds ONLY the replay bridge over the SAME world (the pattern `openReplayAt` already uses, minus the world re-materialization): preserve still-current selection refs, `bridgeCell.replace`, update context, emit tick so panels refresh. Playback position, play/pause state, and simulation state are untouched. `fogOwner` resets to `HUMAN_PLAYER_ID` on every `enterReplay` (predictable default per session).
- **TimelinePanel**: a `Fog: P<n>` button in the controls row (testid `timeline-fog-owner`); click → `controller.cycleFogOwner()`; label re-renders from `controller.fogOwner`; disabled when fewer than 2 candidates.
- **ReplayHotkeys**: `Alt+F` cycles (replay-mode only, like the existing bindings).
- **HUD panels stay player-1-bound** (resources/age/population in the top bar): this is a FOG perspective toggle, not a full POV switch — a full perspective switch (HUD + selection scoping) is a possible follow-up, deliberately out of scope.

## Why bridge-rebuild instead of mutable projector

The RenderAdapter captures its projector at construction; `openReplayAt` already rebuilds the whole replay bridge per scrub commit, so a fog switch reusing exactly that path inherits its correctness (selection preservation, render-store reset via fresh adapter connect) with no new invalidation machinery. Cost is one adapter reconnect per toggle — user-interaction frequency, irrelevant.

## Non-goals

- No live-mode fog toggle (cheat surface; live stays human-locked).
- No omniscient/fog-off option this iteration — toggle cycles recorded players only. (PlayerObserver-based spectator streams remain a future engine-backed option.)
- No HUD/selection POV switch (above).

## Version / docs

0.1.21 → 0.1.22 (user-visible feature). Spec §15.3: replace the stale "No replay system is in scope." with a replay paragraph (the shipped v0.1.7-0.1.16 system was never specced) including the fog-perspective rule. README: rewrite the fog caveat into the toggle instructions. Changelog entry. No ARCHITECTURE change (no new module/boundary).
