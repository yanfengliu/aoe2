// Barrel re-export for the economyBasics/* split. Pre-iter-3 this was
// an 830-LOC monolith with 12 fixture factories; split into gathering +
// fogAndMovement + visionAndAggro per the 500-LOC hard-limit rule.
// Existing imports from `./economyBasics` continue to work.

export {
  createMiningCampFixture,
  createVillagerNoWoodDropoffFixture,
  createFishFixture,
} from './economyBasics/gathering';

export {
  createFogMemoryCastleEdgeFixture,
  createFogMemoryCastleDestroyEdgeFixture,
  createResourceDepletionFixture,
  createNarrowCorridorFixture,
  createMoveTargetUnblocksFixture,
} from './economyBasics/fogAndMovement';

export {
  createFogMemoryFixture,
  createBuildingFootprintVisionFixture,
  createBoarAggroFixture,
  createWolfAggroFixture,
} from './economyBasics/visionAndAggro';

export {
  createGatherUnreachableRerouteFixture,
} from './economyBasics/gatherReroute';

export {
  createDropOffUnreachableRerouteFixture,
} from './economyBasics/dropOffReroute';
