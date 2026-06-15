# AoE2 coverage roadmap — from vertical slice to the full game

The goal is the complete, publicly-known Age of Empires II (Definitive Edition / HD) experience, not the current early-game slice. `design/spec-final.md` is the TARGET (the rules); this file is the prioritized GAP between the current implementation and that target, and it is the backlog the LLM-playtest loop works through (run → `playtest:findings` → implement → re-run). It is derived from a full simulation-coverage audit (2026-06-13) that grounded every "implemented" claim in running code.

## Current state (audit headline)

A complete but **shallow** land-only 1v1 vertical slice: Dark → Feudal → Castle → Imperial all work, with a working economy, blacksmith + unit-upgrade tech, abstracted combat, monks, three win conditions, and a competent AI. Breadth coverage vs. the full game: **units 35/104, technologies 37/140, buildings 17/27, civ differentiation ~0/30, naval 0, victory 3/4.** The slice is real and playable — it is depth and breadth that are missing.

## Playtest findings log

- **campaign-7 (2026-06-14, on v0.1.27):** ground-truth replay showed the LLM agent **rushed and wiped out by the AI in the Dark Age** (its villagers fell 5→0, it never reached Feudal, 0 commands rejected) — so the iter-1/2 economy techs (gather-rate, carry) and planned farms are MID-game features the agent never reaches in this matchup. **Reprioritization: early-game survivability before mid-game depth.** First fix shipped: Palisade Walls enabled in the Dark Age (v0.1.28; they were wrongly gated to Feudal+barracks, leaving no Dark-Age defense). Open follow-ups surfaced by this run, to confirm on re-playtest: (a) does the agent actually wall/defend — the affordance places one building per command, with no "build a wall line" helper; (b) is the AI over-efficient in the Dark Age (it kept 6 villagers + 7 buildings while massing 9 military); (c) is Town Center defensive fire strong enough to protect nearby villagers (the agent retreated "under TC arrow cover" and still lost them). Re-playtest after the wall fix to find the next gap.
- **campaign-8 (2026-06-14, on v0.1.28, re-playtest after the wall fix):** the agent still loses villagers to a Dark-Age militia raid and **does not build the now-available palisade walls** (0 wall commands — it retreats villagers "under Town Center fire" instead). Ground-truth code reading found the real game bug behind the deaths: an **empty Town Center fired 0 arrows** (`buildingArrowCount` returned 0 unless garrisoned), violating spec §10.8 ("base attack") and inconsistent with the Castle — so a TC gives zero passive defense during the economy phase. **TC base-fire fix found, reverted, BLAST RADIUS NOW SCOPED (re-do is BOUNDED):** the one-line fix (empty TC fires 1 base arrow, like the Castle) is correct + spec-aligned (all 3 CLIs agreed on correctness). The full suite showed 27 failures and I initially reverted assuming all 27 were the fix's — but the late Claude review isolated them: **only ~4-7 are caused by the TC fire** (the auto-aggression + monk-convert fixtures that stage enemies within range 6 of the human spawn TC, so the now-firing TC damages them — e.g. monk-convert enemy 45→10), and the **other ~21 are PRE-EXISTING sim-throughput load-flakiness** (the `x2`-annotated tests; they pass in isolation, fail only under full-suite load — unrelated to this change). So the re-do is bounded: **re-apply the one-liner + reconcile the ~4-7 combat-on-the-TC fixtures** (move the enemy outside the TC's closest-edge range 6, OR drop the human TC spawn from those unit-behavior fixtures, OR assert on the unit's order/position rather than enemy HP — per Claude's remediation). Note: the flaky suite means a single full run is NOT a reliable green signal — verify the reconciled tests in isolation. Other remaining items: the agent doesn't wall/garrison well (LLM-strategy/affordance — a "build a wall line" helper would help; the agent may currently be too weak to surface mid-game gaps); AI Dark-Age efficiency still unconfirmed.

## Three structural enablers (build these and the most content lights up)

1. **A stat-multiplier subsystem.** Its absence is why ~12 economy techs, all civ bonuses, and many upgrades are data-only. One layer (apply rate/cost/stat deltas from data to owned + future entities) unblocks the widest swath of content. — `[sim]`
2. **Sustained economy: pop cap → 200 (+ TC/Castle pop) and farms.** A 5-base pop cap and the total absence of farms cap army size and starve a long game after sheep/boar/berries deplete — together they block any real mid/late-game. — `[sim]`/`[sim+data]`
3. **Data-driven combat: melee/pierce armor classes + class-based bonus damage.** Real counter play (skirms↔archers, halbs↔cav, pierce-immune buildings) needs spec §10's class system wired from the CSV columns instead of one armor value + hard-coded type checks. — `[sim]`

## Milestones (ranked; each item validated by tests + a playtest re-run)

Tags: `[sim]` simulation logic here · `[data]` CSV/content wiring · `[engine]` may need civ-engine primitives.

### M1 — Make a sustained match possible
- **Population supply → AoE2-correct.** ✅ done (v0.1.23): Town Center +5, House +5, Castle +20 (were 0); cap fully building-derived (base 0, the starting Town Center supplies the opening 5). `[sim]`
- **Population limit of 200 + correct over-housing/destruction.** The 200 ceiling needs RAW building-supply tracking so over-housing past 200 and then losing housing doesn't wrongly drop the cap — clamping the stored cap is lossy (Codex population-model iter-1 HIGH). Currently unbounded by housing (pre-existing behavior; not reachable at current game scale). `[sim]`
- **Farms + reseed.** A depleting renewable food entity buildable on a Mill anchor, with auto/again reseed and the farm-upgrade techs (Horse Collar / Heavy Plow / Crop Rotation once the multiplier layer exists). Without it a long game starves. `[sim+data]`
- **Stat-multiplier subsystem + economy upgrades.** Gather-rate / carry / villager-speed multipliers applied from data; lights up Wheelbarrow, Hand Cart, Double-Bit Axe, Bow Saw, Two-Man Saw, mining techs (~12 techs). `[sim]`

### M2 — Real combat & counters
- **Melee/pierce armor split + data-driven bonus damage.** Parse the CSV `armor`/`attack_bonus`/`armor_bonus` pairs; damage = spec §10.1 class summation; remove the hard-coded type-vs-type table. `[sim]`
- **Projectiles.** Travel time, accuracy rolls, missed shots, and Ballistics/Thumb-Ring; archers/siege/towers fire real projectiles instead of instant HP subtraction. `[sim]`
- **Elevation + blast/splash damage.** 1.25×/0.75× by elevation; mangonel/onager/scorpion area damage via the unused `blast_radius`. `[sim]`

### M3 — Civilization identity
- **Civ-effect application layer.** Read `civilization_bonus` / `team_bonus` and apply cost/rate/stat deltas; per-civ Castle UU gating beyond the Britons special-case; unique techs. 29/30 civs are currently identical. `[sim+data]`

### M4 — Content breadth
- **Unique units beyond Longbowman** (~17 UU + elites; Castle-gated by civ, several with special mechanics). `[data+sim]`
- **University + its techs** (Ballistics, Masonry, Murder Holes, Treadmill Crane, Architecture, Bombard Tower) — needs a building-mutation system (HP/armor/LoS/range). `[sim+data]`
- **Monastery techs** (Redemption, Sanctity, Faith, Block Printing, Herbal Medicine, Theocracy, …) + faith/probability conversion instead of the fixed ramp. `[data+sim]`
- **Tower line / gates / wall upgrades** (Guard Tower, Keep, Bombard Tower; gates; Fortified Wall) so defensive play can develop. `[data+sim]`

### M5 — Naval layer (large)
- **Dock + ships + fishing ships + transport + naval trade** (~18 ships + Dock + dock techs are entirely data-only; water tiles exist but nothing floats). Blocks water maps and transport play. `[sim+data]`

### M6 — Match completeness & control
- **Score-timer victory.** A timeout where highest score wins, so stalemates end (score is currently display-only). `[sim]`
- **Stances / formations / attack-move / patrol.** UnitCommand is move/build/attack only; auto-aggression is hard-coded. `[sim]`
- **Repair.** Villagers repairing buildings & siege (no handler today). `[sim]`
- **AI depth.** Siege production (so it can break walls/Castles), team play (trade/tribute/joint defense), and difficulty-differentiated tactics (currently only cadence/gather-rate differ). `[sim]`

## How the loop drives this

Each milestone item is a self-contained change: spec update (the rule), TDD, multi-CLI review, commit, then a playtest re-run whose `playtest:findings` either confirms the gap closed (the `unknown-kind` rejection for that command disappears; the agent uses the new capability) or surfaces the next gap. Cross-cutting note from the audit: nearly every gap is simulation-logic work in this repo, not a civ-engine limitation.
