# Review 2: implementation

## Target

Base `3bc906af51af5f29a48d11400d21aab79d714449` plus product patch SHA256 `d8714c97c4610d43afbaa83a29761ef9b051ff300d644181a4cf4eb1f564b480`, verified unchanged at review completion. This distinct lens covered high-risk product behavior. The planned Claude lane was blocked by automatic approval review because it would send unreleased source to an external service; it is an abstention, not an approval. An independent Codex lens supplied available coverage.

## Reviewers and coverage

Independent GPT-6 Astra at xhigh, read-only, no tests, gates, browser, servers, writes or external model calls.

## Reports

FPR-1 — P2: profile-selfplay.mjs:176 interpolates CLI SEED, default aoe2-prototype, while loading uses savedGame.seed (unchanged createSimulationBridge.ts:78). A save from another seed therefore produces a successful CPU profile naming the wrong match. Parse the save once and derive reported identity from effective saved state; test a saved seed differing from the default and explicit CLI seed.

No other actionable finding within this scope. Sight validation and derived-work clamping precede radius squaring, and saved component radii remain intact. Live-load repair and replay slot/component preservation follow engine structural checks, independently inspected at civ-engine/src/session-replayer-guards.ts:96. Target indexing remains local to passes queuing intentions or launching projectiles; engine ordering was grounded in world-queries.ts:219 and spatial-grid.ts:164. Current minimum-range and blast behavior remains present. On-read projection disconnects through finally even after a failed connection, grounded in render-adapter.ts:123. Measurement accounting requires successful StepReport ticks and matching world advancement; loaded bounds and empty-tick rejection are corrected. This review does not certify performance or visual behavior.

## Findings and disposition

Accept FPR-1 as F4. Assign effective loaded-seed identity and a real saved-load contract, then request focused independent re-review. Full gate and final acceptance remain pending.

## Verification

The reviewer inspected files and contracts read-only. The first integration unit run passed 4214 checks and failed the CRLF import collision; the wrapper did not retain a valid exit code, so its exit is not a green gate claim. Final full verification remains pending.

## Round outcome

The accepted finding requires a focused repair review before integrated acceptance. Original target patches remain recoverable in the ignored recovery evidence.
