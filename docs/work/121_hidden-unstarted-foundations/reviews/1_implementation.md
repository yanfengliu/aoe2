# Review 1: implementation

## Target

Repository aoe2, branch `hidden-unstarted-foundations`, the repair of round 0: `99d449b4..4688b86a`, which is commits `aa2a1ea6` ("Take review round 1 of work 121: allies' fog, older saves, the AI's own origin") and `4688b86a` ("Record work 121's review round 1: register, changelog, devlog, architecture"), on main `d68f0289`: 36 files, +596 −160.

## Reviewers and coverage

- **One focused, read-only re-review** run by the coordinator, who reported the findings below to the implementer. It checked that round 0's findings F2 to F13 were repaired and that each gate they named discriminates.
- This record is the implementer's short form of what the coordinator relayed. The reviewer's own report is not kept here.

## Reports

Not kept: the re-review reached the implementer only as the coordinator's summary of its findings, which the table below restates in short form.

## Findings and disposition

The verdict: nothing blocking. Every finding from F2 to F13 is fixed, and each gate it tested discriminates. Accepted, to land after the fixes below; no further round was needed.

| # | Severity | Finding and scenario | Disposition |
|---|---|---|---|
| R1 | should-fix | Test gap: `aiSystem.ts`'s `if (knownTownCentersByOwner.has(building.owner)) continue;` had no test. Reverting it to `townCentersByOwner.has` kept the AI gate 8/8 green. | Fixed: `hidden-foundation-last-resort-town-center-fixture` is the last-resort scene with the human's Barracks foundation replaced by an unstarted Town Center foundation. The AI must attack the House within 20 ticks. With the line reverted it is red: "counts an owner whose only Town Center is an unstarted foundation as having none, and falls back on its House: expected false to be true". |
| R2 | should-fix | Spec consistency: the shared-sight paragraph (drawing, and an ally's base through fog memory) and §12.1's ally sentence lacked the foundation exception. | Fixed. The drawing exception is an enemy's unstarted foundation; the fog-memory exception is any other player's. |
| R3 | nit | The draw message, the same class as the defeat message. | Fixed: "Mutual annihilation: no player has units or started buildings left." when an unstarted foundation still stands. Gated: both sides delete their last unit and started building on one tick. |
| R4 | nit | §12.1's "can flip at once the same way" is not true while the building is an unstarted foundation. | Fixed: "unless it is a foundation nobody has started building, which no enemy can convert". |
| R5 | nit | §12.2 said the walk-order message names the foundation's cell; it names only the type. | Fixed. |
| R6 | nit | `winnerOracle.ts`'s header still said "no engine coupling". | Fixed: it names the started rule it reads. |
| R7 | nit | The API method and the module function shared a name. `lowestIdStartedTownCenter` kept a variable called `oldest`. | Fixed: the module function is `isHiddenUnstartedFoundation`, and the variable is `lowest`. |
| R8 | nit, left | The agent snapshot's opt-in all-seeing mode lists everything. | Left as it is, as asked. |
| R9 | nit, left | One shot in flight in an older save can still land on a hidden foundation. | Left as it is, as asked. |
| R10 | nit, left | The oracle does not count garrisoned or transported units, which predates this work. | Left; the coordinator queued it as a card. |

The two new cases join the mutation set, and all 25 mutations were rerun on the repaired tree.

## Verification

On the repaired tree: every gate file passed, the affected test files and `tests/architecture` passed, typecheck and lint passed, and 25 mutations, each restored after, were all red, the two new ones included (the last resort's Town Center check and the draw message). `npm run verify` runs once, under the gate lock, at landing.

## Round outcome

Accepted: land after the fixes above, with no further review round.
