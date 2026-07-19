# Unit recipe and attack-rig extraction review — pass 4

## Scope

This pass reviewed the behavior-preserving split of scaled unit-part authorship, rigid attack geometry, and exhaustive per-`UnitType` rig descriptors against every live recipe, locomotion/work/attack state, ambient suppression, bounded reach, fog memory, adapter batching, presented silhouette picking, occlusion, and the 500-line cap.

## Characterization evidence

- A SHA-256 oracle serializes every part for all 34 unit types across idle, locomotion, builder work, attack coil, authoritative impact, snap peak, recovery, and fog-memory states. Its eight expected digests were captured against committed `d5e652a` before the extraction.
- Independent review ran the oracle against both `d5e652a` and the refactor; every digest matched. The extraction therefore preserves part keys, order, dimensions, surfaces, tints, transforms, and animation payloads across the sampled production state space.
- Exhaustive `satisfies Record<UnitType, UnitAttackRig>` coverage retains every prior role pivot, controlled-part pattern, and melee-reach cap while making the concrete type the descriptor authority.

## Verification

- The focused recipe/animation/reach suite passed 96 tests. A separate adapter, fog-memory, occlusion, and presented-hit-proxy suite passed 43 tests.
- Full gates passed 2,181 tests with 2 skipped across 290 passed and 1 skipped files, typecheck, zero-warning lint, and the 569-module production build. Every reviewed file remains under 500 lines.

## Verdict

Approved with no actionable finding. Render and picking still consume the same unchanged prepared parts, and the new seams are ready for an independently testable visible weapon/profile commit.
