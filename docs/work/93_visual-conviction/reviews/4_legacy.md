# Concrete unit identity review — pass 5

## Scope

This pass adversarially reviewed the v0.3.6 all-34-type visual profiles, humanoid/mounted/siege/monk family recipes, concrete attack-pose styles, exhaustive rig mapping, showcase fixture, prepared silhouette-picking parity, memory behavior, bounds, and malformed-projection fallback. Simulation, damage, commands, persistence, replay authority, and the sibling Voxel package were explicitly out of change scope.

## Findings and repairs

- The first review proved that a malformed unit projection with an active attack pose still entered the rig path and dereferenced a missing style. A RED regression reproduced the throw; malformed profiles now return the authored contact shadow directly and remain animation-free.
- Added armor and rider detail initially did not share the tunic's attack translation or ambient suppression, so plate, mail, helmets, and signatures could shear from the leaning body. Shared body-group predicates now drive both pose ownership and suppression; RED attachment tests pin equal translation/orientation deltas for armored infantry and riders.
- The trebuchet's visible sling stone was not controlled with the sling. A three-part pairwise-distance regression failed before the fix; arm, sling, counterweight, and payload now share the release transform.
- Polearm reach correction initially excluded the spearman's shield after its direct thrust pose. A forced-distance RED measured the shield moving 0.1728 world units while the arm moved 0.4032; the polearm rig now owns shield and boss through the same bounded lean.
- Root self-review removed a detached fake champion sword filler that existed only to satisfy an old representative test. The characterization and reach contracts now name the actual greatsword, short sword, axe, and lance behavior instead of preserving visually dishonest geometry.

## Evidence

- Exhaustive compile-time maps cover all 34 `UnitType` values, and the showcase proves each appears exactly once while a hidden inert opponent keeps the capture nonterminal.
- Every concrete recipe is deterministic, uniquely keyed, at most 32 parts, bounded and grounded, memory-safe, and stable across idle/moving/attack variants. Representative adapter tests prove presented matrices and prepared silhouette-hit matrices remain identical.
- The root focused pass completed 81 tests across seven recipe, attack, reach, animation, characterization, and showcase files. The independent reviewer separately completed 95 focused tests, scoped ESLint, file-size inspection, and `git diff --check`.
- The fixed 1,200×720 paused all-unit comparison changes 12,962 of 864,000 pixels (1.5002%), with bounds x=228–968 and y=184–536 confined to unit geometry. The after frame contains 1,017 instances and 20,600 triangles at the unchanged seven materials, nine batches, and 16 draws.

## Verdict

Approved after four substantive visual-cohesion repairs, with no remaining actionable finding. Concrete appearance, pose ownership, memory recipes, and presented picking agree; complete repository gates, audits, and headless browser verification remain the delivery gate rather than review evidence.
