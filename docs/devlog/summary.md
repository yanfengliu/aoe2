## 2026-05-02 (v0.1.6 in flight)
- **/full-review iter-1+2 — correctness batch:** R2-M1 autoAggression race, Gemini MAJOR pruneOrphanEntityKeys value-side leak, R2-C2 saveGame Tier-3 flush, Gemini MEDIUM accessor.flush atomicity, R2-M2/D4 pushIntention rename + dead-fallback fix, Gemini MINOR TC villager-train accumulator. Iter-2 closed atomicity placement, half-dead test gap, exhaustive switch. 725 passed.
- **Phase 2E:** visibility staleness fix — `(playerId, x, y, radius)` fingerprint cache + owner-flip remove+reinsert; closes Codex impl-19 MAJOR.
- **Phase 2D:** 30/35 Tier-1 slots migrated (29 prior slots + `aiStates`).
- **Phase 2A-C:** bridge-state migration scaffolding (`SlotCodec` registry + `BridgeStateAccessor` + `VisibilityCell`); output-phase tail (`tier3SyncSystem` + `bridgeSnapshotSystem` + `registerOutputTail`); `bootstrapFlush` + tail integration.
- **Phase 1C:** AI intention refactor — aiSystem pushes `pendingCommands` instead of mutating; `pickUnitMix` reorders BEFORE villager training so military wins under tight food.
- **Phase 1B:** all 15 commands commandified (`unit.move/attack/gather/context/contextAtEntity`, `sheep.move`, `monk.contextAtEntity`, `queue.train/research`, `market.action`, `building.placeConfirm/setRallyPoint/action`, `trebuchet.pack/unpack`).
- **Phase 1A:** scaffolding — `GameCommands` type, `dispatcher.drainPendingCommands`, empty `registerCommandHandlers`, `pendingCommands` queue.
- **Multi-CLI review process:** Codex extraction bug fixed (slice from `^codex$` header before awk markers); 5+ retroactive findings recovered post-hoc.

## 2026-04-29 (v0.1.5)
- **In-game annotation UI (Spec 2):** Alt+M for marker capture, Alt+L for list panel, IDB-mirrored sessions, JSON bundle export. Bridge gains `world` getter, `setPaused`, `getSelectedEntityRefs`, `select`. `loadGame` is async. Engine bumped to 0.8.11 for `AgentDriverContext.addMarker`/`attach`.

## 2026-04-26 (full-review V5)
- 15 V5-* fixes shipped: monksByOwner side-map for AI guard O(1), GameScene LOC trimming (regressed since), `findIdleProducer` batch precompute, multiple efficiency fixes.

## 2026-04-25 (full-review V4)
- 25 V4-* fixes: cast-hole closures, trebuchet sig reconciliation, fog-memory delete path, throttle persistence, conquest single-pass, file-size + naming cleanups.

## 2026-04-24 to 2026-04-26
- **createSimulationBridge.ts shrink:** 9519 → 332 LOC across 5 phases. Spawned `bridge/`, `systems/` (18 ECS factories), and ops modules. Side-map ownership lives in `bridgeState.ts`.

## 2026-04-23
- **Major refactors:** `prototypeScenario.ts` god-file split into `fixtures/` (13 categories); `mapGeneration/` for procedural gen; multiple 800+ LOC files split into themed sub-dirs with barrel re-exports.

## 2026-04-19 to 2026-04-22 (FU batches)
- **Batch FU8 (test stability):** EntityRef+ generation, throttled visibility, deterministic player commands; OccupancyGrid migration descoped.
- **Batch FU7 (Persian + bonuses):** Persians (TC +25 HP +25%, faster gather, free Town Watch) + civ-bonus framework.
- **Batch FU6 (Britons):** Britons (faster shepherds + arrow range/anti-cav). 35-tile attack-move "garrison-recall" trigger.
- **Batch FU5 (HUD UX):** queue cancel, rally pin, save/load via blob.
- **Batch FU4 (AI):** AI Castle/Imperial age-up, Monk training + relic collection, Wonder pursuit (wins on `ai-planner-fixture`).
- **Batch FU3 (defensive fire):** Castle garrisoned-archer arrows, real `stone-wall` / palisade.
- **Batch FU2 / FU1:** Militia → Champion, Paladin, Heavy Camel; armor damage + 11 Blacksmith techs.

## 2026-04-17 to 2026-04-18
- **Slices 1-12:** Castle + Longbowman, Imperial Age + 12 units + 14 techs, Wonder/Relic/Score win conditions, Save/Load (29 side maps), HUD UX polish, F2 debug overlay, Black Forest + Arena maps, engine-debt refactors.

## 2026-04-10 to 2026-04-13 (pre-roadmap)
- **Bootstrap + Dark/Feudal/Castle core:** TS + Vite + Phaser 3 + civ-engine; 18 supported civs; full economy loop; Barracks + conquest; Feudal + Castle units; deterministic combat polish.
