# aoe2 engine-bump 0.8.11 → 0.8.12 Review

**Date:** 2026-04-30
**Reviewers:** Codex `gpt-5.5` xhigh + Claude `claude-opus-4-7[1m]` max
**Disposition:** ACCEPT (both reviewers convergent)

## Scope

aoe2 tracking commit for civ-engine v0.8.12 (Spec 5: Counterfactual Replay). Lockfile-only change in source tree (`package-lock.json` 0.8.11 → 0.8.12); no `.ts` modifications. Devlog entries documenting the bump scope and verification.

## Verification

All four aoe2 gates pass against civ-engine v0.8.12 with no source-side changes:
- `npm test` — exit 0
- `npm run typecheck` — clean
- `npm run lint` — clean
- `npm run build` — clean (Vite + Phaser bundle, 470 KB main + 1.48 MB Phaser)

Spec 5 surface (`forkAt` / `ForkBuilder` / `Divergence` / `diffBundles`) is purely additive — none of those symbols are referenced by current aoe2 code. The bump is genuinely zero-impact for the running game; it just makes the new APIs available for future consumption (v0.1.6 replay scrubber or counterfactual-replay agent demos).

## Final disposition

**ACCEPT.** No findings.
