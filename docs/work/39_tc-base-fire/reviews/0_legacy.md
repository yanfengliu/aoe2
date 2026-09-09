# TC base-fire (empty Town Center fires its base arrow) — Review iteration 1

Objective: implement spec §10.8 base attack so a completed but empty Town Center fires 1 base arrow (was 0; only fired when garrisoned), and restage the ~25 combat-isolation fixtures whose duels were staged inside a Town Center's range so the now-firing TC doesn't contaminate their assertions. Shipped as v0.1.29.

## Gates (driver-run, authoritative)

- `npm test`: **1255 passed / 2 skipped** (same count as baseline; all green).
- `npm run typecheck`, `npm run lint`, `npm run build`: all clean.
- Two-phase verification: Phase A — all 9 affected files green in isolation WITHOUT the one-liner (relocations are behavior-preserving). Phase B — with the one-liner, all 9 green in isolation, then full suite green.

## Reviewers

- **Codex (`gpt-5.5`, xhigh, read-only sandbox) — SHIP, no findings.** Codebase-grounded (cited file:line evidence): verified the one-liner is correct and Castle-consistent (`prototypeBuildingRules.ts:335-343`), the firing path uses it at the only callsite and skips incomplete buildings (`towerCombatSystem.ts:63-95`), the range model is footprint-Manhattan on the 4×4 TC (`pureHelpers.ts:390-407`, `buildingFootprints.ts:12`), no moved unit is off the 60×36 map or on a TC footprint, every asserted distance is preserved by the group translations (cavalry-archer range 4; mangonel/onager min-range-2; bombard min-range-3; tower siege-first 3-vs-4), the AI fixtures are sound (`townCenterRefs` is written only from spawned TCs per `scenarioSeedOps.ts:281-288`/`entityCreateOps.ts:252-255`, so ai-planner truly has no human TC → `humanTownCenterId` null; the AI target chain `aiSystem.ts:750-770` matches the fixture comments; `disableAi` honored at `scenarioSeedOps.ts:168-169`), and docs/version match.
  - Codex's FIRST run wrote a diff-parsing script that ran on the raw diff (mixing `-`/`+` lines and all fixtures), producing only diff-artifact noise; it was re-run standalone with a "reason directly, cite file:line, no scripts" prompt, which produced the grounded review above.
- **Driver self-review (main agent):** independently confirmed each combat group was translated as a unit (relative geometry intact), each behavioral fixture's INTENT is preserved (ai-planner still measures AI age-up/military, now un-perturbed; ai-rush still kills a villager; production still tests human economy; autoAggression's "enemy unscathed" assertions are meaningful again), and coverage is clean (only `buildingArrowCount('town-center')` assertions are the new empty=1/garrison=4; firing path shared with the Castle, already tested by `fu3DefensiveFire`). The metric correction from the scoping subagent (footprint-Manhattan, not anchor-Chebyshev) was verified against `pureHelpers.ts` + `buildingFootprints.ts` before use.

## Unavailable this iteration (session-load throttle)

- **Gemini (`gemini-3.1-pro-preview`):** transient SSL failure (`ERR_SSL_SSLV3_ALERT_BAD_RECORD_MAC`) on every retry — no review produced. Working tree audited after: no contamination (Gemini never connected; all 20 changed files are the intended fix + docs).
- **Claude (`opus[1m]`):** hung at 0 bytes for ~17 min under the heavy concurrent session load and was stopped.

The throttle is concurrency/long-session induced (per `docs/learning/lessons.md` + memory). Per AGENTS.md, one grounded reviewer (Codex) plus the driver self-review and green gates is acceptable for a single iteration when the others are unreachable; **Claude + Gemini re-review is queued for the next iteration** (re-run standalone on this commit).

## Findings & disposition

No real findings. Codex (grounded) and the driver self-review converge on no issues; all gates green. **Disposition: SHIP (v0.1.29).**
