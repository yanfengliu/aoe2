# Villagers spread on idle→assign (Loop 1 follow-up)

Objective: stop villagers re-piling onto the single nearest tree. Loop 1 (gather-stall, v0.1.24) added a give-up path for villagers stuck on an over-subscribed resource, but a replay of the next playtest (campaign-5) showed they STILL re-piled — 15 of 16 woodcutters on one tree — because the normal idle→assign path picked the globally-nearest matching resource, so a villager that finished a trip went straight back to the crowded tree.

## Change
`assignNearestResource` gains a `spreadCap` param (used when `preferUnsaturated`). The saturation tiebreak now pushes resources with `>= spreadCap` gatherers to the back of the same owner tier.
- idle→assign: `preferUnsaturated=true, spreadCap=IDLE_ASSIGN_SPREAD_CAP (4)` — fans out, but generously, so only extreme piles spread.
- stuck-villager redistribute: `preferUnsaturated=true, spreadCap=MAX_GATHERERS_PER_RESOURCE (2)` — tight, to maximally spread a genuine over-subscription. The over-subscribed redistribute TRIGGER still uses count > 2.

## Why the generous cap (load-bearing)
An earlier attempt made idle→assign saturation-aware at cap 2. That BROKE the AI's age-up: cap 2 is below the AI's natural 2-3-per-resource clustering, so it force-spread the AI's villagers → over-gathered food → over-trained villagers → the TC never freed for age research (the AI hoarded 4625 food, stuck in Feudal). A cap of 4 is above the AI's clustering, so the AI is unaffected (age-up passes) while the player's 15-villager pile still fans out.

## Verification
- `tests/simulation/villagerGatherSpread.test.ts` — villagers ordered onto one tree fan out (passes).
- `tests/simulation/aiPlayer.test.ts` "ages up through the ages" — PASSES at cap 4 (the guard; it FAILS at cap 2). This is what proves the generous cap doesn't perturb the AI's tuned economy.
- A confirming playtest was deferred — the claude subscription degraded over the long session (campaign-6 stalled), so the fix is verified by deterministic tests; a fresh campaign when the CLI recovers will confirm end-to-end + surface the next bug.

## Determinism / fog
Deterministic (stable sort, no randomness). No save-format change.
