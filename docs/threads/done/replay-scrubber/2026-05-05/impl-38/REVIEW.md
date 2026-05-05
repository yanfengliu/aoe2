# Phase 3B ReplayController Review - impl-38

## Scope

Re-reviewed the revised Phase 3B diff after impl-37 fixes for playback pacing, scrub selection preservation, interpolation, method forwarding, and replay seed propagation.

## Reviewer Availability

- Codex: not available at the start of this iteration due to the same account usage limit from impl-37.
- Claude: not available at the start of this iteration due to the same account limit from impl-37.
- Gemini fallback: completed. Gemini verified the prior findings as resolved and reported no substantive remaining issue.

## Findings

- **Gemini G6 - setTimeout fallback timestamp hardcoded to zero (minor hardening).** The fallback scheduler used `callback(0)` when `requestAnimationFrame` was absent, so repeated fallback frames would not accumulate time after the first frame. Fixed by passing `globalThis.performance?.now() ?? Date.now()` to the callback.

## Disposition

Gemini approved the revised controller/bridge design after the impl-37 fixes, with only the fallback timestamp hardening noted. That hardening was applied and focused gates were rerun.
