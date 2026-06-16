# PLAN — M7 building-visuals slice 1 (v0.1.42)

1. **TDD**: write `tests/phaser/buildingRenderer.test.ts` (Graphics spy like unitRenderer's): `buildingRole` map + exhaustiveness over `BuildingType`; per-role completed silhouettes draw ≥1 fill + use `entity.tint` + all points within the footprint rect; distinct primitive sets across roles; variant contract (completed→body/roof/completion flags; construction→foundation/scaffold/construction flags; memory→null). Red.
2. **Implement `buildingRole.ts`** — pure `BuildingRole` union + `buildingRole(buildingType)` exhaustive `satisfies Record<BuildingType, BuildingRole>`.
3. **Implement `buildingSilhouettes.ts`** — per-role completed-silhouette draw fns, each within the footprint rect, body = `entity.tint`, details = darkened tint.
4. **Slim `buildingRenderer.ts`** — keep base rect + construction + memory paths byte-identical; for completed buildings resolve role → call silhouette; keep the visual-state record + its flag semantics (completed sets body/roof/completion true). Confirm <500 LOC. Green.
5. **GameScene** — untouched (call-site already delegates). Confirm LOC ≤ 1018 (it is 1017).
6. **Add `building-showcase-fixture`** (test-only): `src/game/simulation/fixtures/buildingShowcase.ts` placing one completed building per role near a P1 TC; export via `fixtures/index.ts`; register in `prototypeScenario/dispatch.ts`.
7. **Visual capture** — reuse the units pattern: `tmp/buildings/capture.mjs` + `diff.mjs`; preview on a FRESH port (PORT env; avoid orphaned :4173-4176). BEFORE (pre-wire build via git stash) → apply → AFTER → diff. Save `tmp/buildings/{before,after,diff}.png`; confirm diff confined to buildings.
8. **Gates**: `npm test` (full), `npm run typecheck`, `npm run lint`, `npm run build`. Baseline 1377 passed / 2 skipped (+ new renderer tests).
9. **Docs**: `package.json` 0.1.41→0.1.42; `docs/changelog.md` v0.1.42; devlog detailed entry (reviewer comments pending) + summary line; `design/spec-final.md` §14.5 (building-render visual); `design/roadmap.md` M7 "Building visuals" — slice done (per-role silhouettes), note deferred (per-type, construction animation/fill, rubble, per-civ).
10. Report back (facts) for the team lead's multi-CLI review + commit. Do NOT commit.
