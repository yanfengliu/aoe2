I have enough information. Here's the review.

---

## Code Review: Construction HP Ramp (0.1.4)

**Verdict:** Implementation is largely correct. One substantive behavioral concern, one notable test coverage gap, and one doc-accuracy nit. No bugs that would break the gates.

---

### Findings

#### 1. [MEDIUM] Force-set at completion silently heals damage taken late in construction — contradicts the devlog's central claim

`playerCommandsSystem.ts:397-399` unconditionally sets `currentHp = maxHp` on the completing tick:

```javascript
if (buildingHealth) {
  buildingHealth.currentHp = buildingHealth.maxHp;
}
```

The devlog says: *"Damage taken during construction is preserved (HP increments add to the current value rather than overwriting it)."* That preservation only holds **during** construction. At the **completion tick**, any damage is wiped: a foundation chipped to 5/75 at 95% built will pop to 75/75 the moment the last tick fires, healing 70 HP for free.

Two issues with this:

- **Canonical AoE2 behavior**: in AoE2 a building completing in damaged state stays damaged (the build crew doesn't repair, just finishes). The diff's stated goal is "canonical AoE2"; this is a measurable deviation.
- **Internal contradiction**: the devlog/changelog text reads as if damage is preserved end-to-end. A future reader will be misled.

Fix-direction (no patch — your call): instead of `currentHp = maxHp`, snap only the float drift, e.g. `currentHp = Math.min(maxHp, Math.round(currentHp))` or `currentHp = Math.min(maxHp, currentHp)` after rounding. Or, accept the behavior and update the devlog text to make it explicit ("damage preserved during construction; healed at completion as a simplification").

#### 2. [MEDIUM] Test coverage is thin — only the happy path is exercised

The new test verifies (a) low initial HP, (b) mid-build > start, (c) final == max. Per the verification checklist you handed me, **none** of the genuinely interesting edge cases are covered:

- **Damage-during-construction** — the central claim of the diff, untested. A regression that breaks the additive form (e.g., switching to `floor(maxHp * progress / total)`) would still pass the new test.
- **Save/load round-trip mid-construction** — claimed safe in the devlog, but no test asserts it.
- **Scenario-seeded `isComplete: true`** — no anti-regression test that those still spawn at full HP. `addBuildingEntity` now branches on `isComplete`; a future refactor could flip the branch and only the existing scenario tests would catch it (and only by accident).
- **Destroy-during-construction** — relies on existing `entityDestroyOps` cleanup behavior; not covered for the new mid-construction state.

Recommend at minimum: a damage-during-construction case (place house, deal damage at ~50% built, finish, assert final HP < maxHp under the *intended* preservation semantics — which today's implementation will fail if you pick that semantic).

#### 3. [LOW] Devlog accuracy nit

The devlog claims the existing health-bar renderer "already paints any entity with a known `currentHp` / `maxHp` pair, so the foundation's ramping HP shows up on the existing bar with no changes." I did not verify the renderer end-to-end visually (you noted this is a UI-adjacent change — the project rule is to verify visual changes in `npm run dev` with screenshots; the devlog says no before/after capture was taken). Worth a quick eyeball before merging given the diff explicitly affects rendered HP bars on every constructable building.

---

### Verifications (clean)

- **(a) Damage during construction**: Combat code (`playerCommandsSystem.ts` building-attack branch) reads/writes `buildingHealthStates.currentHp` directly without checking `constructionStates.isComplete`, so foundations are damageable. The additive build-tick increment correctly preserves damage *during* construction. ✓ (See finding #1 for the completion-tick caveat.)
- **(b) Save/load round-trip**: `saveSchema.ts:192` serializes `buildingHealthStates` as `{currentHp, maxHp}`; `hydrateFromSavedGame.ts:254-255` restores it directly via `buildingHealthStates.set(id, {...hp})` — does NOT route through `addBuildingEntity` (which would re-floor to startHp). Mid-construction HP round-trips intact. ✓
- **(c) Scenario-seeded `isComplete` buildings**: `scenarioSeedOps.ts` passes `isComplete=true`; the ternary in `entityCreateOps.ts:225` correctly returns `fullHp` for that branch. No regression. ✓
- **(d) Destroy-during-construction**: `entityDestroyOps.ts` deletes both `constructionStates` and `buildingHealthStates` regardless of completion state. ✓
- **(e) Fog memory**: Verified `fogMemorySystem` snapshots intentionally do not include HP fields (`MemoryEntry` has none); remembered foundations render without an HP bar. This is by-design pre-existing behavior; the new ramp doesn't leak into fog. ✓
- **(f) Float drift at completion**: The `Math.min(maxHp, ...)` clamp in the per-tick branch and the `currentHp = maxHp` force-set at completion together absorb both directions of drift. The math is exact: `startHp + totalBuildTicks * (maxHp - startHp)/totalBuildTicks = maxHp`, modulo IEEE 754. ✓
- **Multiple builders**: Each builder's loop iteration both increments `buildProgressTicks` and adds `hpPerTick`; total HP added at completion still equals `maxHp - startHp` because both rates scale with builder count. ✓
- **Anti-regression on existing combat/AI/save tests**: The change only touches the `!isComplete` branch of `addBuildingEntity` and the build-tick branch of `playerCommandsSystem`. Existing tests use scenario seeders (which pass `isComplete=true`) or operate on completed buildings, so they are unaffected by the initial-HP change. The devlog's mention of an early `markOutOfBandRenderChange()` causing a 10s timeout in `ai-rush-fixture` is the kind of regression that *would* have come from this diff; it was caught and removed before commit. ✓

---

### Doc reconciliation

- `docs/changelog.md` 0.1.4 entry — accurate match to implementation. ✓
- `docs/devlog/detailed/2026-04-26_2026-04-26.md` — accurate except for the "damage preserved" overstatement noted in finding #1.
- `docs/devlog/summary.md` line — accurate.
- `package.json` 0.1.3 → 0.1.4 — appropriate for non-breaking user-visible bug fix per the AGENTS.md versioning rule. ✓
- No new public API surface, no architecture change — `README.md` / `ARCHITECTURE.md` / `drift-log.md` correctly untouched. ✓

---

### Summary

Ship it after deciding on finding #1 (either change the completion behavior or correct the devlog text to match the actual heal-on-completion behavior) and ideally adding the damage-during-construction test from finding #2. The other items are not blockers.
