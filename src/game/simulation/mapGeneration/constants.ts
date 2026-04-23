// Shared map dimensions. Kept in a dedicated module so `mapGeneration/*`
// helpers never need to import from `../prototypeScenario`, which would
// otherwise cycle back through the fixture/dispatcher graph.
// `prototypeScenario.ts` re-exports these as its public surface.
export const MAP_WIDTH = 60;
export const MAP_HEIGHT = 36;
