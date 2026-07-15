# animation-feedback-batch — slice A (violence retune) review iteration 1 (2026-07-15)

In-process adversarial Workflow, 2 dimensions (pose-quality, contracts) + verifiers. The first run died wholesale on a session limit and was resumed from cache; 4 verifiers were later lost to a model quota, so their findings were lead-adjudicated against live code and reproduced with probes before any fix.

## Confirmed findings → both fixed

- **HIGH (contracts): the whip-crack struck AWAY from the captured target.** For villager and champion (and, unflagged by the reviewer, siege), the visible window delivered the directive mirrored: at the 0.55 damage-tick sample the weapon was already EXTENDED toward the target, and the ~52 ms snap swept it up-and-over to end BEHIND the actor's heels — the maximal-velocity motion travelled away from the target while the hit spark flashed on it. Only the knight's lance implemented the stated story. Root cause: the pre-existing v0.2.3 sign convention (`pitch = -arc * 1.6`, where positive pitch swings a weapon head forward-and-down about its pivot) was harmless while the visible window was a monotone decay, and became a real backward strike the moment the coil→snap window was authored. Two independent probes reproduced it; the lead's own probe confirmed villager tool-head +0.637 toward at 0.55 → −0.392 behind at peak. FIX: pitch sign flipped for the humanoid chop and the siege throwing arm (`arc * 1.6` / `arc * 1.1`), verified by probe — villager now −0.729 coil → +0.679 strike with a −0.393→−0.709 drop through the target.
  - **The test was structurally blind to it.** The quality bar asserted `coil.x * strike.x < 0`, which is satisfied by EITHER orientation. Rewritten to assert the ABSOLUTE sense: `coil.x < 0` (loads behind) AND `strike.x > 0` (drives through), plus a chop-drop check. This test now fails on the pre-fix code.
- **LOW (pose-quality): the bar omitted the roles the same diff retuned.** PROBES covered villager/champion/knight only, while the diff raised archer (bow pitch 0.22→0.34, draw arm 0.58→0.85) and cavalry-archer amplitudes with no threshold, and siege had neither. The verifier proved the hole by reverting archer to v0.2.3 AND halving siege below it — all 38 attack tests plus typecheck/lint/build stayed green. FIX: probes added for cavalry-archer, mangonel, battering-ram, and the archer draw arm, with the rig kind (`chop`/`thrust`/`draw`) selecting the applicable assertions — draw rigs skip snap-timing because their extreme legitimately IS the loaded draw at the impact sample.

## Refuted / not actioned

- Arc-continuity, NaN-at-edges, and determinism claims were checked and hold (endpoints are exact no-ops; `(1-q)^2` forces zero at phase 1; no Date/random in the module).

## Notable non-finding

- An external agent edit partially reverted the archer amplitudes mid-session; the gates did not catch it (no archer probe existed at the time). This is the same hole the LOW finding names, and the added probes now close it.

## State

tests/rendering 182/182, full unit suite 2,062/2 skips, typecheck, lint, build, browser attack spec green.
