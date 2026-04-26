- **Severity:** high  
  **Theme:** correctness  
  **Where:** `src/game/simulation/createSimulationBridge.ts:7096-7141,7270-7284`, `src/game/simulation/bridge/visibility.ts:34-37,120-123`  
  **Finding:** Load rehydrates the world with `effectiveSeed = savedGame.seed`, but the projector frame and HUD still expose the outer `seed` argument. A loaded match can therefore simulate one seed while rendering/debugging/reporting another, which breaks the repo’s save/load determinism contract and makes replay/debug state misleading.

- **Severity:** high  
  **Theme:** design  
  **Where:** `src/game/simulation/createSimulationBridge.ts:46-153,378-716,7086-7291`  
  **Finding:** `createSimulationBridge.ts` is still the central owner of scenario bootstrap, occupancy, selection, AI, monk logic wiring, save/load hydration, render projection, and match-end flow. The helper extractions reduced size, but not responsibility concentration, so the main bridge remains a god-class choke point that is hard to reason about and easy to regress.

- **Severity:** medium  
  **Theme:** correctness  
  **Where:** `src/game/simulation/createSimulationBridge.ts:1887-1895`, `src/game/simulation/bridge/trebuchetState.ts:42-82`  
  **Finding:** The load path claims missing `trebuchetPackStates` is safe for older saves, but the runtime helpers treat missing state as “not packed” and “not silent.” Older same-schema saves can therefore hydrate trebuchets into the wrong live behavior instead of the intended packed default.

- **Severity:** medium  
  **Theme:** design  
  **Where:** `src/game/simulation/bridge/pureHelpers.ts:8-12,65-84`, `src/game/simulation/bridge/monkTaskOps.ts:31-36`, `src/game/simulation/bridge/saveGameOps.ts:24-28`  
  **Finding:** Several extracted bridge modules still depend back on `prototypeScenario.ts` or `createSimulationBridge.ts` types/constants, so the lower layer is not actually self-contained. That keeps the layering only partially extracted and makes future splits or isolated testing harder than the architecture doc suggests.

- **Severity:** medium  
  **Theme:** docs  
  **Where:** `docs/architecture/ARCHITECTURE.md:15-29`  
  **Finding:** `ARCHITECTURE.md` still describes `bridge/` as only the first extraction wave (`pureHelpers`, `visibility`, `trebuchetState`, `fogMemoryOps`), while the codebase now also relies on `aiDecisionOps`, `matchEndOps`, `monkTaskOps`, `placementOps`, `saveGameOps`, `targetFindingOps`, `technologyOps`, plus top-level modules like `worldOccupancy`, `selectionActivity`, and `renderStore`. The documented topology is stale, which weakens the repo’s own boundary rules.

- **Severity:** medium  
  **Theme:** tests  
  **Where:** `tests/simulation/selectionActivity.test.ts:505-511`  
  **Finding:** The only test for the selection-activity overflow branch is skipped. That leaves the “cap at 5 tokens, report overflow” path unguarded, even though it is explicitly rendered in the HUD and easy to regress with future activity-label work.

- **Severity:** medium  
  **Theme:** tests  
  **Where:** `src/ui/hud/selectionPanel.ts:102-197`, `tests/browser/game-selection.spec.ts:423-569`  
  **Finding:** The compact multi-selection HUD path is not covered end to end for mixed selections that include sheep, nor for the `x<count>`/overflow rendering branch. The lower-level simulation/icon tests help, but a DOM/layout regression in the actual HUD would currently miss browser coverage.

- **Severity:** low  
  **Theme:** docs  
  **Where:** `docs/devlog/detailed/2026-04-19_2026-04-20.md:29,32,138,142`  
  **Finding:** The devlog still points readers at `tests/browser/game.spec.ts`, which no longer exists as the active suite shape. That stale reference makes the coverage history harder to audit and contradicts the current split-browser-spec layout.

**Top issues to fix first**
1. Seed mismatch on load between authoritative world state and projected/HUD state.
2. The remaining god-class pressure in `createSimulationBridge.ts`, because it amplifies risk across every subsystem change.
3. Trebuchet hydration for older same-schema saves, because the current “safe if absent” comment is not true at runtime.
4. The skipped selection-activity overflow regression, because it leaves a live HUD branch untested.
5. Refresh `ARCHITECTURE.md` to match the real simulation-module topology before more bridge work lands.
