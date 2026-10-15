# Unbuilt foundations behave as in Definitive Edition

Status: active
Owner: Coordinator worker w126-unbuilt-foundations (coordinator: AOE2 repo coordinator setup)
Created: 2026-10-14
Updated: 2026-10-15

## Problem and outcome

In this build a foundation nobody has started building claims its cells as a wall from the moment it is placed. Four things follow, and each differs from Definitive Edition.
- **A hidden unit is frozen.** Since work 122 (v0.3.254) the player may place a foundation partly over unexplored ground. A unit hidden there cannot leave until a builder arrives, and the cancel then refunds the whole cost, so the trap is free. This is the OPEN register entry "2026-10-12 — A unit hidden in the fog is frozen under a foundation the player places over it".
- **Nobody walks over it, and nobody else can build on it.** DE update 185872 fixed "a bug preventing Villagers from walking over unbuilt Foundations" and "a bug causing unbuilt building Foundations to prevent players from building upon them". Since work 121 (v0.3.252) an enemy cannot see such a foundation, yet it still blocks the enemy's walking and building. This is the OPEN register entry "2026-10-12" of work 121.
- **The start check cancels for units.** Work 122's start check (`foundationStart.ts`) cancels a foundation for anything under it, units included. Hotfix 45185 names "a structure or foundation" outside the player's sight, and update 46295 names "an obstacle". Neither names a unit. 44725 speaks of ground occupied "by a building or unit", and 87863 fixed own and allied units obstructing construction. How units are handled here is this game's design decision, which this work makes and records.
- **Delete refunds nothing.** Deleting an unstarted foundation refunds nothing here. DE refunds it in full. Work 122 measured this: placing a house took wood from 1,000 to 975, and deleting it left 975.

Outcome:
- Until construction starts, an unbuilt foundation is no obstacle. Units walk over it, and other players may place on it. Whoever starts construction first wins: a later start finds the other's foundation as a structure and is cancelled, as 45185 and 46295 say.
- When the first builder starts construction, units standing on the footprint are moved off.
- The start check cancels only for structures, foundations, terrain and resources.
- Deleting an unstarted foundation refunds its full cost.

## Scope

- Reserved for this work:
  - the occupancy claim of an unstarted foundation (`worldOccupancy*.ts`, `passableStructures.ts`, `structureClaimKind`);
  - construction start and the moving of units off the footprint;
  - `foundationStart.ts`'s cancel rule;
  - the delete-refund path;
  - their tests and the spec's §8 and §12 lines.
- Off limits while they run:
  - work 120 M4 (civBonusTable, civBonusEffects, civilizations.csv, civProfiles.ts and the gather systems);
  - work 125 (the HUD cost text);
  - work 123 (browser specs near their limits, the playwright reporters, .github/).
- The AI's site search and its pending-footprint mask must keep their guarantees. Prove the map stays connected with the AI placement gates.

## Approach

Two milestones, each reproduced first, gated, independently reviewed and landed on its own.

- **M1: walkable unbuilt foundations, a start that moves units off, and the start check limited to structures and terrain.**
  - Source the exact DE rule first: which units may cross an unbuilt foundation (185872 names villagers), and what happens to units on it when construction starts. Use official notes or DE's data. If the sources leave a choice, stop and bring the options to the coordinator.
  - It closes the register entry of the frozen unit and the movement and building half of work 121's entry.
- **M2: Delete refunds an unstarted foundation in full,** with the price paid if the build records it, otherwise the owner's current price as work 122's cancel does. Say which.

## Acceptance criteria

- Each behaviour is reproduced first, then gated:
  - a unit crossing an unbuilt foundation;
  - another player placing on one;
  - the first start winning and the later start cancelled;
  - units moved off at start;
  - no cancel for units;
  - the delete refund.
  Each gate is proven red by mutation.
- The AI placement gates (`aiPlacementKeepsMapConnected` and the reachability gates) still pass.
- The two OPEN register entries close with how they are now checked. Records the session needs:
  - a register entry for the delete refund;
  - changelog lines and a version bump per milestone;
  - devlog lines;
  - spec lines;
  - a replay and save statement.
- Independent read-only review before landing. Each milestone lands with `npm run verify` exit 0, its log read through the build, and `node scripts/verify-receipt.mjs check` printing OK.

## Implementation steps

- [ ] M1 — implemented on branch `unbuilt-foundations`; the sources and the coordinator's rule choices are in [design.md](design.md).
  - [x] Independent read-only review of `b4ca7f01`, round 0 (record `reviews/0_implementation.md`): one blocking finding (two seats' builders waiting on each other forever), four should-fix with five gate gaps, four nits and a second-seed census. All repaired or answered on the coordinator's rules, with 13 new mutations; the second seed showed the AI on another path and nothing stalled, so the census re-recorded in phase 1 stands.
  - [x] Focused re-review of `491931c6`, round 1 (record `reviews/1_implementation.md`): nothing blocking, every round-0 repair confirmed. One should-fix, the builders' exception too wide (a villager passing through a pass was put on its far side), narrowed to a builder beside its own site, and three nits, all repaired.
  - [ ] Landing.
- [ ] M2

## Outcome

Pending.
