# Vitest timeout headroom design

## Context

The repo now uses Vitest's `threads` pool to avoid Windows fork-pool `onTaskUpdate` RPC failures in the CPU-heavy simulation suite. Explicit per-test timeout arguments still override the global runner timeout, so long deterministic simulations need caps that reflect full-suite contention rather than isolated file timings.

## Decision

Raise only explicit caps that have failed under the required `npm.cmd test` gate while passing in isolation. Do not broad-brush all simulation tests or hide assertion failures behind unlimited timeouts.

## Boundaries

- Test behavior and assertions stay unchanged.
- Timeout changes are allowed only when the failing command output and isolated rerun show deterministic logic still passes.
- Debugging evidence lives in `docs/debugging/2026-05-04-vitest-worker-ontaskupdate.md`; devlog summarizes the gate impact.
