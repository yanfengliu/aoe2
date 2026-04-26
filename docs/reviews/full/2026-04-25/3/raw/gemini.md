Warning: True color (24-bit) support not detected. Using a terminal with true color enabled will result in a better visual experience.
I will begin by reviewing the project rules, architectural boundaries, and recent devlog entries to establish the context for this third iteration of the repository audit.

I will now verify the iteration 2 fixes by examining the relevant code in `src/game/simulation/createSimulationBridge.ts` and `src/game/simulation/bridge/technologyOps.ts`.

I will now read the relevant code to verify the iteration 2 fixes.

I will now check the `filter` logic in `findPreferredVisibleEnemyBuilding` and the gathering logic in `src/game/simulation/createSimulationBridge.ts`.

I will now search for the gathering logic in `src/game/simulation/createSimulationBridge.ts` to verify H2-2.

I will now search for "gather" in `src/game/simulation/createSimulationBridge.ts`.

I will search for the gathering system loop in `src/game/simulation/createSimulationBridge.ts` by looking for `world.query('gatherer')`.

I will read the gathering loop in `src/game/simulation/createSimulationBridge.ts` around line 5582 to verify H2-2.

I will now read the `to-dropoff` branch of the gathering loop in `src/game/simulation/createSimulationBridge.ts`.

I will now examine `src/app/bootstrap/createApp.ts` and `src/app/bootstrap/browserTestApi.ts`.

I will now check `getRenderState` and `getHudState` in `src/game/simulation/createSimulationBridge.ts` for redundant work.

I will now read the beginning of the `getRenderState` function in `src/game/simulation/createSimulationBridge.ts`.

Error during GrepLogic execution: Error: Process exited with code 2: regex parse error:
    getRenderState() {
                     ^
error: unclosed counted repetition

I will search for `getRenderState\(\) \{` in `src/game/simulation/createSimulationBridge.ts`.

I will now read the `getHudState` function in `src/game/simulation/createSimulationBridge.ts`.

I will now read the `syncFromBridge` function in `src/phaser/scenes/GameScene.ts`.

I will search for `syncFromBridge` in `src/phaser/scenes/GameScene.ts`.

I will now re-examine the `getRenderState` function in `src/game/simulation/createSimulationBridge.ts`.

I will now examine `src/ui/hud/createHudController.ts` and its helper modules, starting with `src/ui/hud/createHudController.ts`.

I will now check `tooltips.ts`, `selectionPanel.ts`, and `saveLoadPanel.ts`.

I will now check `src/phaser/scenes/GameScene.ts` to see how it handles listener cleanup and if it has a `destroy` method.

I will search for the `create` and `destroy` methods in `src/phaser/scenes/GameScene.ts`.

I will search for `create\(\)` in `src/phaser/scenes/GameScene.ts`.

I will search for `create()` in `src/phaser/scenes/GameScene.ts`.

Error during GrepLogic execution: Error: Process exited with code 2: regex parse error:
    create() {
             ^
error: unclosed counted repetition

I will search for `create\(\)\s*\{` in `src/phaser/scenes/GameScene.ts`.

Attempt 1 failed. Retrying with backoff... _GaxiosError: request to https://cloudcode-pa.googleapis.com/v1internal:streamGenerateContent?alt=sse failed, reason: 04630000:error:0A0003FC:SSL routines:ssl3_read_bytes:sslv3 alert bad record mac:c:\ws\deps\openssl\openssl\ssl\record\rec_layer_s3.c:1605:SSL alert number 20

    at Gaxios._request (file:///C:/Users/38909/AppData/Roaming/npm/node_modules/@google/gemini-cli/bundle/chunk-UIBQS45C.js:8804:66)
    at process.processTicksAndRejections (node:internal/process/task_queues:105:5)
    at async _OAuth2Client.requestAsync (file:///C:/Users/38909/AppData/Roaming/npm/node_modules/@google/gemini-cli/bundle/chunk-UIBQS45C.js:10763:16)
    at async CodeAssistServer.requestStreamingPost (file:///C:/Users/38909/AppData/Roaming/npm/node_modules/@google/gemini-cli/bundle/chunk-UIBQS45C.js:277779:17)
    at async CodeAssistServer.generateContentStream (file:///C:/Users/38909/AppData/Roaming/npm/node_modules/@google/gemini-cli/bundle/chunk-UIBQS45C.js:277579:23)
    at async file:///C:/Users/38909/AppData/Roaming/npm/node_modules/@google/gemini-cli/bundle/chunk-UIBQS45C.js:278424:19
    at async file:///C:/Users/38909/AppData/Roaming/npm/node_modules/@google/gemini-cli/bundle/chunk-UIBQS45C.js:255329:23
    at async retryWithBackoff (file:///C:/Users/38909/AppData/Roaming/npm/node_modules/@google/gemini-cli/bundle/chunk-UIBQS45C.js:275301:23)
    at async GeminiChat.makeApiCallAndProcessStream (file:///C:/Users/38909/AppData/Roaming/npm/node_modules/@google/gemini-cli/bundle/chunk-UIBQS45C.js:312614:28)
    at async GeminiChat.streamWithRetries (file:///C:/Users/38909/AppData/Roaming/npm/node_modules/@google/gemini-cli/bundle/chunk-UIBQS45C.js:312452:29) {
  config: {
    url: 'https://cloudcode-pa.googleapis.com/v1internal:streamGenerateContent?alt=sse',
    method: 'POST',
    params: { alt: 'sse' },
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'GeminiCLI/0.39.1/gemini-3-flash-preview (win32; x64; terminal) google-api-nodejs-client/9.15.1',
      Authorization: '<<REDACTED> - See `errorRedactor` option in `gaxios` for configuration>.',
      'x-goog-api-client': 'gl-node/22.14.0'
    },
    responseType: 'stream',
    body: '<<REDACTED> - See `errorRedactor` option in `gaxios` for configuration>.',
    signal: AbortSignal { aborted: false },
    retry: false,
    paramsSerializer: [Function: paramsSerializer],
    validateStatus: [Function: validateStatus],
    errorRedactor: [Function: defaultErrorRedactor]
  },
  response: undefined,
  error: FetchError2: request to https://cloudcode-pa.googleapis.com/v1internal:streamGenerateContent?alt=sse failed, reason: 04630000:error:0A0003FC:SSL routines:ssl3_read_bytes:sslv3 alert bad record mac:c:\ws\deps\openssl\openssl\ssl\record\rec_layer_s3.c:1605:SSL alert number 20
  
      at ClientRequest.<anonymous> (file:///C:/Users/38909/AppData/Roaming/npm/node_modules/@google/gemini-cli/bundle/chunk-UIBQS45C.js:7726:18)
      at ClientRequest.emit (node:events:518:28)
      at emitErrorEvent (node:_http_client:104:11)
      at TLSSocket.socketErrorListener (node:_http_client:518:5)
      at TLSSocket.emit (node:events:518:28)
      at TLSSocket._emitTLSError (node:_tls_wrap:1034:10)
      at TLSWrap.onerror (node:_tls_wrap:475:11)
      at TLSWrap.callbackTrampoline (node:internal/async_hooks:130:17) {
    type: 'system',
    errno: 'ERR_SSL_SSLV3_ALERT_BAD_RECORD_MAC',
    code: 'ERR_SSL_SSLV3_ALERT_BAD_RECORD_MAC'
  },
  code: 'ERR_SSL_SSLV3_ALERT_BAD_RECORD_MAC',
  [Symbol(gaxios-gaxios-error)]: '6.7.1'
}
I will now read `src/phaser/scenes/GameScene.ts` starting from line 151.

I will search for `applyShoreFishPatches` in the `src/game/simulation/mapGeneration/` directory.

I will read the `applyShoreFishPatches` and `applyShoreFishPatchesProcedural` functions in `src/game/simulation/mapGeneration/applyStandardPlayerOpening.ts`.

I will search for the `seedToNumber` function in the `src/` directory.

I will now check lines 5897-5919 and 2548 in `src/game/simulation/createSimulationBridge.ts` to investigate the `isVisibleToHuman` issue.

I will search for `createProjector` in `src/game/simulation/bridge/`.

I will search for `forward-enemy-house` in `src/game/simulation/mapGeneration/defaultMap.ts`.

I will read `src/game/simulation/mapGeneration/defaultMap.ts`.

I will read `applyStandardPlayerOpeningProcedural` in `src/game/simulation/mapGeneration/applyStandardPlayerOpening.ts`.

I will read the `applyStandardPlayerOpeningProcedural` function in `src/game/simulation/mapGeneration/applyStandardPlayerOpening.ts`.

I will search for `cellBlockedByScenarioEntity` in `src/game/simulation/mapGeneration/applyStandardPlayerOpening.ts`.

I will read `src/game/simulation/bridge/matchEndOps.ts`.

I will search for `playerHasConquestPresence` in `src/game/simulation/createSimulationBridge.ts`.

I will read `src/phaser/scenes/gameScene/worldLayers.ts`.

I will examine the `scripts/` directory for any potential issues.

I will read `scripts/validate-content.mjs`.

I will read the beginning of `scripts/content-lib.mjs`.

Iteration 3 of the Age of Empires II browser prototype audit is complete. All Iteration 2 fixes have been verified as correct. This round focused on "less-swept" directories (bootstrap, UI controller, Phaser scene helpers), resulting in findings regarding memory leaks, redundant processing in the test API, and map-generation collisions.

### Verification of Iteration 2 fixes

- **V2-1 (`getHudState` seed):** OK. `effectiveSeed` is now correctly returned in the snapshot.
- **H2-1 (Tech idempotency/dedupe):** OK. `applyTechnology` guard prevents double bonuses; `enqueueResearch` prevents double charging across concurrent producers.
- **H2-2 (Gather preservation):** OK. Carry load is preserved when the drop-off path is blocked.
- **H2-3 (Black Forest radius):** OK. Radius 7 accommodates the starting resource offsets.
- **M2-1 (Target-finding visibility):** OK. `findPreferredVisibleEnemyBuilding` now correctly uses `isFootprintVisible`.

### New Findings (Iteration 3)

#### [V3-1] Redundant `syncFromBridge` and projection in `browserTestApi.ts`
- **Severity:** medium
- **Theme:** cleanliness, performance
- **Where:** `src/app/bootstrap/browserTestApi.ts:103-113, 211-221`
- **Finding:** `getSnapshot` calls `scene.syncFromBridge(true)`, and `advanceTicks` also calls it before calling `getSnapshot`, leading to redundant work. Furthermore, `getSnapshot` calls `bridge.getRenderState()` twice (once via `syncFromBridge` and once directly), which triggers expensive full-map entity filtering and sorting every call.
- **Risk:** Slows down browser tests significantly as the entity count grows.

#### [M3-1] `createHudController` leaks `requestAnimationFrame` and global listeners
- **Severity:** medium
- **Theme:** cleanliness
- **Where:** `src/ui/hud/createHudController.ts:330-331, 353, 356`
- **Finding:** The controller adds `mousemove` and `mouseup` listeners to the `window` and starts a `requestAnimationFrame` loop, but it does not expose a `destroy()` method to clean them up.
- **Risk:** Memory and CPU leak when the game is restarted or destroyed (e.g., in a single-page app context or during test teardown).

#### [M3-2] `renderFog` performs full-map scans and allocations per frame
- **Severity:** medium
- **Theme:** performance
- **Where:** `src/phaser/scenes/gameScene/worldLayers.ts:133-154`
- **Finding:** Every frame, `renderFog` creates two new `Set` objects from the frame's cell arrays and performs $O(Width \times Height)$ calls to `Phaser.Graphics.fillRect`.
- **Risk:** Garbage collection pressure and unnecessary draw calls. For a standard map, this is ~2,160 `fillRect` calls every 16ms, even when the fog hasn't changed.

#### [M3-3] `isVisibleToHuman` and `prototypeFogMemory` still use anchor-cell visibility
- **Severity:** medium
- **Theme:** correctness
- **Where:** `src/game/simulation/createSimulationBridge.ts:2548, 5913`
- **Finding:** While M2-1 fixed target finding, the `isVisibleToHuman` helper and the fog-memory refresh loop still check only the anchor cell for buildings. The comment at line 5913 explicitly (and now incorrectly) states that this matches the projector.
- **Risk:** Inconsistency between what is rendered (footprint-visible) and what is remembered/detectable by scripts (anchor-visible). Large buildings may vanish from fog memory while still partially in vision.

### Deferred Findings (Re-prioritized)

#### [H2-1 Sibling] Simultaneous mutual annihilation grants 'defeat'
- **Severity:** medium
- **Theme:** game design
- **Where:** `src/game/simulation/createSimulationBridge.ts:6265-6273`
- **Finding:** The conquest resolver checks the human player first. If both players' last units/buildings die on the same tick (e.g., a mutual Mangonel shot), the human's check fires, sees no presence, and triggers a 'defeat' immediately without checking the enemy.
- **Risk:** Unfair match outcome; diverges from standard "Draw" or "Mutual Annihilation" expectations.

#### [M2-10] Default-map forest clusters collide with forward enemy house
- **Severity:** medium
- **Theme:** correctness
- **Where:** `src/game/simulation/mapGeneration/defaultMap.ts:25-42`; `applyStandardPlayerOpening.ts:538-580`
- **Finding:** `createDefaultMap` places the forward house at `(39, 18)` *after* forest clusters are seeded. `placeForestCluster` does not consult building spawns when checking if a cell is blocked.
- **Risk:** Some seeds will place a tree at `(39, 18)`, causing the building spawn to overlap a resource and triggering a bridge bootstrap crash.

#### [M2-8] Identical duplicated code for shore fish patches
- **Severity:** low
- **Theme:** cleanliness
- **Where:** `src/game/simulation/mapGeneration/applyStandardPlayerOpening.ts:88-144` vs `:147-202`
- **Finding:** `applyShoreFishPatches` and `applyShoreFishPatchesProcedural` are byte-for-byte identical.
- **Risk:** Increased maintenance burden; fixes in one might not propagate to the other.

#### [M2-12] `seedToNumber` UTF-16 surrogate pair hash collision
- **Severity:** low
- **Theme:** correctness
- **Where:** `src/game/simulation/mapGeneration/sharedTerrainHelpers.ts:20-26`
- **Finding:** Using `charCodeAt(0)` on a code-point iterator (`for...of`) ignores the second half of surrogate pairs.
- **Risk:** Seeds like `"😀"` and `"😁"` will hash to the same value, producing identical maps.

### Verified-not-bugs (ruled out)

- **`createApp.ts` closure-bridge:** Re-assigning the `bridge` variable in the `createApp` scope is safe because the HUD facade arrows (`() => bridge.getHudState()`) re-evaluate the reference on every call. It works by design, though an explicit `setBridge` would be cleaner.
- **`GameScene` input listeners:** Phaser automatically cleans up `this.input.on` listeners added to a scene's input manager when the scene is destroyed. No leak here.

### Top issues to fix first

1. **[M3-1] HUD Controller cleanup:** Expose `destroy()` to cancel RAF and window listeners. (`src/ui/hud/createHudController.ts`)
2. **[M3-3] Fog-memory visibility parity:** Update `isVisibleToHuman` and fog-memory refresh to use `isFootprintVisible`. (`src/game/simulation/createSimulationBridge.ts:2548, 5913`)
3. **[M2-10] Map-gen collision:** Protect the `FORWARD_ENEMY_HOUSE_POSITION` in `cellBlockedByScenarioEntity`. (`src/game/simulation/mapGeneration/applyStandardPlayerOpening.ts`)
4. **[H2-1 Sibling] Conquest Draw:** Check enemy presence before granting 'defeat' to the human in the mutual-annihilation case. (`src/game/simulation/createSimulationBridge.ts:6265`)
5. **[V3-1] Test API Redundancy:** Remove redundant `syncFromBridge` and `getRenderState` calls in the test snapshot path. (`src/app/bootstrap/browserTestApi.ts`)
