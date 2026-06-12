# Agent affordances (campaign-1 backlog #1–#3)

Objective: convert the three HIGH items mined from campaign-1 (devlog 2026-06-10) into shipped affordances so campaign-2 can reach Feudal without burning decisions on reverse-engineering hidden rules. One coherent change, one version bump.

## Evidence (campaign-1, 5000 ticks, $18.19)

- 8× `cannot_research` rejections returned "Cannot research that here." while the real rule (Feudal needs 2 completed Dark Age buildings + 500F) stayed hidden — ~7 decisions (~$4) burned reverse-engineering it.
- 19/27 placement rejections were blind house placements into unseen water; the message was a bare "Placement blocked."
- The snapshot never tells the agent what each building can research/train right now, nor where open ground is.

## A. Actionable rejection messages (backlog #1)

The dispatch feedback loop (playtest-fixes B) already delivers `result.message` to the agent via `AgentDispatchEventLog.rejectionMessage` → `dispatchSummary` (llmAgent.ts:108). Only the validator message text needs to improve; no harness change.

- **A1 `cannot_research`** (`queueResearchValidator.ts`): split the conflated `!canResearchAt || !options.includes` check.
  - Wrong building type → name where the tech IS researched: new `buildingsThatResearch(tech)` export from `prototypeBuildingRules.ts` (reverse lookup over `RESEARCHES_BY_BUILDING`).
  - Right building, unavailable → reason from a new `researchUnavailableReason(owner, buildingType, tech)` collaborator (`bridge/researchAvailability.ts`):
    - Age-up techs: "requires 2 completed Dark Age buildings (mill, lumber-camp, mining-camp, or barracks) — you have 1" (counts via new `playerQueries.countCompletedAgePrerequisites`), or "already feudal-age or beyond" when the age gate fails.
    - Already-researched techs: "fletching is already researched."
    - Fallback: generic + the currently-researchable list at this building ("Currently researchable here: man-at-arms-upgrade" / "Nothing is currently researchable at this building right now."), which is always actionable and computable from `getResearchOptions`.
  - Considered and rejected for this iteration: refactoring `optionsRules.ts`'s hand-rolled if-chains into a declarative rule table that both the options and the reasons derive from. Right long-term shape, but it rewrites the game-rule source of truth in the same diff as message plumbing; deferred to keep this diff behavior-preserving and reviewable.
- **A2 `insufficient_resources`** (research + train + placeConfirm validators): state need vs have, e.g. "Not enough food: need 500, have 320." Shared helper `describeMissingResources(stockpile, cost)` in `prototypeEconomyRules.ts` next to `resourcesMissing`.
- **A3 `placement_blocked`** (`buildingPlaceConfirmValidator.ts`): new `describePlacementBlockers(x, y, w, h)` on `cellPassability` (it already owns occupancy + tiles + world): first blocking cell + cause (water / forest / a building (town-center) / a resource (gold) / a unit / out of bounds) + blocked-cell count + footprint size, plus the nearest open visible anchor when one exists within the scan radius: "Placement blocked for house (2x2): water at (43,18); 3 of 4 cells blocked. Nearest open ground you can see: (40,17)."
- **HUD pass-through**: `humanInputOps.queueResearch` and `placementOps.confirmBuildingPlacement` currently translate these codes to fixed toast strings; switch the `cannot_research` / `placement_blocked` fallbacks to `result.message ?? <fixed string>` so the human player gets the same why. All other toast strings unchanged.

## B. Research/train options per building in the snapshot (backlog #2)

- New `bridge/buildingOptionsOps.ts`: `getAgentBuildingOptions(ownerId)` returns, per distinct COMPLETED owned building type: `research` (available now, with cost), `researchLocked` (visible-but-unavailable: the TC age-up tech with its prereq reason, and in-flight techs with "already being researched"), `train` (available now). Plus `villagerCanBuild`: the build menu with footprint sizes + costs ("house (2x2)"). In-flight lookups use a NON-creating probe (iter-1 Claude L2) so the read surface never perturbs the Tier-2 cache.
- Reasons come from the same `researchAvailability` engine as A1 — one source of truth for "why not".
- Exposed on `SimulationBridge` (+ `BrowserTestBridge`), composed into the snapshot by `browserTestAgentApi.snapshotForAgent` as a new optional `buildingOptions` input to `buildAgentSnapshot` (builder stays pure), rendered by `llmPromptBuilder` as a "What your buildings can do now" block.

## C. Placement-validity hints (backlog #3)

- `findOpenPlacementAnchors` (also on `cellPassability`): deterministic outward ring scan from a center, returns up to N anchors whose footprint is unblocked AND every footprint cell currently visible to the owner (no fog leak; mirrors the snapshot's fairness rules). Scan order fixed (ascending ring radius, then row-major within the ring) so runs are deterministic.
- Used twice: the A3 rejection suggestion (nearest 1 from the attempted anchor) and a new snapshot `placementHints` block (anchors near the agent's town center: up to 6 for 2x2, up to 4 for 3x3) via new bridge method `findOpenPlacementAnchorsNear(ownerId, x, y, w, h, max)`.
- `building_placeConfirm` tool description updated to point at the hints.
- Out of scope: a `getPlacementPreviewAt` agent *tool* (mid-decision probe round-trip adds latency/cost per call; snapshot hints + rejection suggestions cover the observed failure mode — revisit only if campaign-2 still shows blind placements).

## Fairness / determinism constraints

- Hints and suggestions only name cells fully visible to the acting owner (`VisibilityMap.isVisible`), so the agent learns nothing the fog hides. Blocker descriptions in A3 are exempt: the engine already rejected the command, and naming the cause for a cell the agent targeted is the honest minimum (real AoE2 shows you the red footprint reason too); it names the cause, never enumerates unseen terrain beyond the attempted footprint.
- Ring scans are pure functions of (occupancy, visibility, center) — no RNG, no entity-id iteration-order dependence.

## Non-goals

- No engine changes (everything composes existing bridge surfaces; no engine gap found).
- No optionsRules rule-table refactor (deferred; see A1).
- No new agent tools; no prompt-budget blowout (new blocks ≈ 150–250 tokens, bounded by caps).

## Version / docs impact

0.1.20 → 0.1.21 (non-breaking user-visible: actionable rejection messages incl. two HUD toast fallbacks, new snapshot affordances, new public bridge methods). ARCHITECTURE helper-ops list += researchAvailability/buildingOptionsOps + drift-log row. Spec: §15.7 snapshot/feedback contract + a command-rejection message contract note. Changelog entry. README public-surface check.
