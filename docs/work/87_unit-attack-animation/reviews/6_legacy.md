# Review iteration 7

## Scope

OpenAI Codex externally re-reviewed the frozen iteration-6 code and documentation with the same read-only live-code directive and explicit anti-regression checklist. The reviewer was asked to trace the tick-plus-mutation visibility cache through every player-command mutation path, replay/save construction, tower ordering, and max-pop workload rather than relying on the prior synthesis. Anthropic Claude remained unavailable under the already-recorded tenant export boundary and was not retried or routed around.

## Finding and disposition

- **MEDIUM — fine-grid movement conservatively invalidated the visibility revision even when the LOS fingerprint did not change. Confirmed and fixed.** `moveUnitOneSubgridStep` often advances only `unitTransform` while coarse `position` remains in the same cell. Alternating fine movers and attackers could therefore restore O(moves × vision sources) scans despite the iteration-6 unchanged-burst gate. `playerCommandVisibilityRevision.ts` now compares the actual visibility-source fingerprint `(playerId, coarse x, coarse y, radius)` across an entity mutation and increments only when that fingerprint changes. Unit/wildlife destruction use the same tracker; recursive building destruction retains an explicit conservative mark because it may remove garrisoned sources outside the building's own fingerprint. Construction completion also marks unconditionally because `finalizeBuildingConstruction` adds the vision source before invoking its completion callback.

## Result

The max-pop regression now alternates 200 fine-transform mutations with 200 impacts and proves one underlying synchronization; a coarse-cell change forces the second synchronization and the next tick forces the third. The focused feed/replay/file-size set passed three files and 15 tests, and TypeScript passed. No prior fog, replay, simultaneous-attacker, movement-facing, pause, picking, or save boundary changed. Because iteration 7 found a real issue, iteration 8 must independently verify this narrowed invalidation contract before the thread closes.
