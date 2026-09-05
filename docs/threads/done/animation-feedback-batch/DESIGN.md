# Animation feedback batch — DESIGN

Closed 2026-09-05: all four slices shipped on 2026-07-15 (A as v0.2.7, B and D as v0.2.8, C as v0.2.9, the sticky boar facing as v0.2.12; `design/spec-final.md` §14.5 carries each as shipped). Only slice A's review synthesis was filed here; the later slices' reviews went to the devlog. The folder sat in `current/` for seven weeks after the last slice shipped, which is what the thread rule in `docs/policies/local-rules.md` (2026-09-05) now prevents.

Status: mechanisms resolved 2026-07-14 from the attack/wildlife/task presentation exploration (evidence anchors inline). Four independent slices sharing one subsystem map; each ships as its own TDD'd, reviewed, versioned commit. Spec rules already persisted in §14.5 (2026-07-14 user directives).

## Shared facts (explorer-verified)

- Pose math: `src/rendering/voxel/aoeVoxelUnitAttackAnimation.ts` (`attackArc` :22-33, per-role poses :186-325, pivots :77-100, controlled-part mask :349-372). Sampling: `aoeVoxelUnitAttackSampling.ts` — phase starts AT `ATTACK_IMPACT_PHASE = 0.55` and only recovers (:59-61 "combat resolves before projection"), so the authored windup segment of `attackArc` is unreachable in production; perceived softness follows directly.
- Pinning tests are invariant-based (different/same-matrix, rigid attachments, frozen-at-equal-time, root-fixed); hard numbers are only the 0.55 impact phase (browser spec :132, unit test :161) and arc endpoints being no-ops (unit test :338-339). Amplitude retunes survive.
- Attack-event feed is unit-only on four counts: `wildlifeCombatSystem.ts:124` never records; recorder requires a `unit` component (:351,:365-373); projection attaches `attackAnimation` only to units (`visibility.ts:106-108`); no resource-side sampler/pose exists.
- Wildlife corpses already exist in sim (`killWildlifeEntity`, `entityDestroyOps.ts:354-376`; `boar.corpsePersists=true`, `statTables.ts:461`); the ONLY corpse signal reaching the renderer today is `currentHp === null` (`selectionStateOps.ts:124-131` → `visibility.ts:156`); no dead-look branch exists in `createResourceParts`.
- No task/activity field exists on `ProjectedEntityView` (`types.ts:212-238`); `building` state lives in `unitCommands` read by `computeUnitActivity` (`selectionActivity.ts:137`) for HUD selection only. Movement animation is displayed-distance-derived; attack is the one event side-channel precedent.
- Animated-instance budget: units-only today, low thousands used of 8192 (`aoeVoxelResources.ts:157-173`); resources/wildlife are entirely static-lane.

## Slice A — violent unit attack poses (spec: attack-pose violence directive)

- Keep the honest no-pre-hit constraint, the 0.55 constant, and endpoint no-ops. Reshape the VISIBLE window (0.55→1.0): at sample start the weapon is at maximum coil (loaded arm, torso wound), snaps to strike peak within ~50-80 ms of the 650 ms window, then a damped follow-through (small deterministic overshoot oscillation decaying by ~300 ms) into recovery. Perceived result: the hit lands with a whip-crack instead of easing in from nothing.
- Raise per-role amplitudes (weapon rotation villager −1.05 → ≈ −1.6 rad class; infantry, cavalry lance, siege arm proportionally; archer string/bow pitch stronger) and add a bounded torso/head lean into the strike via the attack-controlled mask — parts only, presented roots never move (spec no-root-lunge).
- New quality-bar unit tests (the durable encoding of "violent"): peak weapon angular displacement ≥ role threshold; time-from-sample-start-to-peak ≤ 120 ms; overshoot decays monotonically after peak; endpoints still no-ops; rigidity/root/shadow invariants unchanged. Existing invariant suites must stay green untouched.
- Files: `aoeVoxelUnitAttackAnimation.ts` (+ its test), possibly `aoeVoxelUnitAttackSampling.ts` recovery easing only. No sim/feed change. Version bump c.

## Slice B — boar retaliation attack animation (spec: wildlife retaliation attack animation)

- Sim/feed: record a feed entry at the wildlife damage site (`wildlifeCombatSystem.ts:124`) through the SAME recorder, generalized: attacker resolution accepts a wildlife attacker (footprint/roots from the resource entity; witness rule identical — at least one attacker cell AND one target cell visible per perspective). Key stays `id:generation`.
- Projection: attach `attackAnimation` to wildlife resource views (drop the `unit ?` gate for keys that exist in the feed; memory ghosts never carry it).
- Renderer: boar gore pose — head/tusks pitch-down-then-up with body rocking about a front-leg pivot toward the captured target direction. Resources stay in the STATIC lane: the pose is baked into part transforms at snapshot time from `attackAnimation` + presented time (equal time ⇒ frozen; per-frame snapshot rebuild carries motion), so zero animated-slot cost and no engine change.
- Tests: feed unit tests (wildlife attacker recorded, witnessed, fog-suppressed, replay-persisted — mirror `unitAttackAnimationFeed` suites); pose unit tests (strike differs from rest, endpoints no-op, roots/shadow fixed, determinism); browser spec extends the boar-hunt fixture — when the boar's retaliation lands, its head/tusk part matrix departs rest while villager assertions stay green.
- Order AFTER slice A (same pose-math neighborhood, avoids interleaved diffs). Version bump c.

## Slice D — wildlife death carcass (spec: wildlife death carcass)

- Thread an EXPLICIT corpse signal instead of overloading health: `wildlifeAlive?: boolean` on `ProjectedEntityView`, set in `projectEntity` from the wildlife state the sim already persists. (Rationale: `currentHp === null` is a health-display convention shared with non-wildlife resources; an adversarial reviewer would rightly flag keying death off it.)
- Recipe: when a huntable's `wildlifeAlive === false`, `createResourceParts` emits the carcass variant — body rolled onto its side, legs outstretched, head/tusks grounded, slight ground sink — same footprint, same hit silhouette source (parts), static lane. Applies to any `corpsePersists` species (boar today); wolves don't persist and are unaffected.
- Tests: projection unit test (flag present, fog-filtered, replay-identical); recipe unit test (corpse parts differ from live, stay in footprint, deterministic); persistence already covered by `wildlifePersistence.test.ts` — extend with a projected-view assertion; browser spec: kill the fixture boar → pixel/part change at the corpse cell, and the corpse remains gatherable (existing contract).
- Version bump c.

## Slice C — builder hammer work loop (spec: construction work animation)

- Projection: `activeVerb?: 'building'` on `ProjectedEntityView`, derived per visible unit from the same `unitCommands` predicate `computeUnitActivity` uses (:137) — no recording/save change (derivable state), replay-identical by construction.
- Renderer: villager `mode: 'working'` when stationary AND `activeVerb === 'building'`: hammer/tool part loops raise-overhead → smash-down toward ground, ~900 ms period, identity-phased (builders desync like ambient breathing), amplitude readable at default zoom; ambient suppression on tool parts during the loop; injected-clock time only (pause-freeze inherited). Facing unchanged this slice (approach already faces the site; the smash is ground-directed per the user's description).
- Tests: projection unit test (verb present exactly while the build command is active); pose unit test (loop period/phase determinism, tool travels between authored raised/ground keypoints, roots/shadow fixed, equal-time freeze); browser spec: place a construction via test API, assert the builder's tool part matrix oscillates across ticks and freezes under pause.
- Order LAST of the batch (touches `ProjectedEntityView` alongside D; land D's projection change first, C rebases trivially). Version bump c.

## Batch order and review

Ship order: A → B → D → C, each: failing tests → implement → gates (unit + explicit browser suite vs the 2026-07-14 clean baseline: 106 passed/2 skipped) → in-process adversarial review Workflow (fog-leak, determinism/replay, budget, pose-quality dimensions) → REVIEW.md under this thread (`<date>/<n>/`) → spec §14.5 status flip → changelog + version bump → commit + push. The 0.55 constant and endpoint no-ops are frozen contracts across all slices.
