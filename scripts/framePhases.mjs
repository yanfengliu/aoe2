// The phases a frame's main-thread time is split into (scripts/saveFrameRate.mjs --profile, cpuProfileFold.mjs).
//
// A phase names the function that roots it by where that function is written: `file` is a pattern on the source
// path as the build's source map gives it (`src/...` for this repo, `civ-engine/dist/...`, `voxel/dist/...`,
// `three/build/...`), and `text` a pattern on the line the function starts on. A sample belongs to the innermost
// phase on its stack, so a phase's row is its root's time without the phases nested inside it: the label's indent
// says what it is nested in on the frame's usual path. tests/scripts/framePhases.test.ts requires every pattern to
// still find its line, because a renamed function would otherwise fold silently into its caller's row.
//
// FRAME_ROOT is the game's own animation-frame callback and TICK_ROOT a simulation tick: the fold calls a frame a
// tick frame when a sample of it is under TICK_ROOT. OTHER_TASKS are the phases that run as tasks of their own, so
// a sample under one of them ends the world frame before it.

export const FRAME_ROOT = 'frame';
export const TICK_ROOT = 'tick';
export const OTHER_TASKS = Object.freeze(['hud', 'recording']);
/** The two functions saveFrameRate.mjs runs alternate animation frames through, so a profile shows where one
 *  frame's callbacks end and the next frame's begin. */
export const FRAME_SLOT_NAMES = Object.freeze(['saveFrameRateEvenFrame', 'saveFrameRateOddFrame']);
export const FRAME_SLOT = /^saveFrameRate(Even|Odd)Frame$/;

export const FRAME_PHASES = Object.freeze([
  { key: 'frame', label: 'world frame: its own code, the camera', file: /^src\/app\/AoeVoxelGameView\.ts$/, text: /^private readonly frame = \(/ },

  { key: 'step', label: '  bridge.step outside a tick', file: /^src\/game\/simulation\/createSimulationBridge\.ts$/, text: /^step\(deltaMs: number\)/ },
  { key: 'tick', label: '  simulation tick: systems', file: /^src\/game\/simulation\/bridge\/tickHaltGuard\.ts$/, text: /^export function tryTick\(/ },
  { key: 'tick.ai', label: '    the computer\'s decisions', file: /^src\/game\/simulation\/bridge\/systems\/aiSystem\.ts$/, text: /^execute\(activeWorld\)/ },
  { key: 'tick.engine-diff', label: '    engine: the tick\'s diff and dirty flags', file: /^civ-engine\/dist\/world-tick\.js$/, text: /^(buildDiff|clearComponentDirty|clearStateDirty|getStateDirty|getComponentDirty)\(/ },
  { key: 'tick.recorder', label: '    session recorder', file: /^civ-engine\/dist\/session-recorder\.js$/, text: /^_onDiff\(diff\)/ },
  { key: 'tick.projection', label: '    engine render adapter: the projected diff', file: /^civ-engine\/dist\/render-adapter\.js$/, text: /^(this\.diffListener = \(diff\) =>|connect\(\)|disconnect\(\))/ },
  { key: 'tick.projection.entity', label: '      projectEntity', file: /^src\/game\/simulation\/bridge\/visibility\.ts$/, text: /^projectEntity\(ref, world\)/ },
  { key: 'tick.projection.cells', label: '      projectFrame: the frame\'s cell lists', file: /^src\/game\/simulation\/bridge\/visibility\.ts$/, text: /^projectFrame\(world\)/ },
  { key: 'tick.projection.metrics', label: '      the HUD\'s entity count', file: /^src\/game\/simulation\/renderMetricsCapture\.ts$/, text: /^capture\(\)/ },
  { key: 'json', label: '    engine JSON checks and clones', file: /^civ-engine\/dist\/json\.js$/ },

  { key: 'render-state', label: '  getRenderState: filter, fog memory, sort', file: /^src\/game\/simulation\/bridge\/renderStateOps\.ts$/, text: /^function getRenderState\(\)/ },
  { key: 'coordinator', label: '  presentation coordinator: keys, HUD lists', file: /^src\/rendering\/voxel\/AoeVoxelPresentationCoordinator\.ts$/, text: /^function syncFromBridge\(/ },
  { key: 'smoother', label: '    displayed-position smoother', file: /^src\/rendering\/displayedPositionSmoother\.ts$/, text: /^apply\(/ },
  { key: 'present', label: '    renderer.present: its own code', file: /^src\/rendering\/voxel\/AoeVoxelWorldRenderer\.ts$/, text: /^present\($/ },
  { key: 'ground', label: '      textured ground: pack and upload', file: /^src\/rendering\/voxel\/(AoeVoxelWorldRenderer|aoeDeGround)\.ts$/, text: /^(private packedGround\(|update\(data: DeGroundData\))/ },
  { key: 'snapshot', label: '      createSnapshot: its own code', file: /^src\/rendering\/voxel\/aoeVoxelAdapter\.ts$/, text: /^createSnapshot\($/ },
  { key: 'snapshot.prepare', label: '        posing entities', file: /^src\/rendering\/voxel\/aoeVoxelEntityPrep\.ts$/, text: /^prepare\(entities/ },
  { key: 'snapshot.cast-shadows', label: '          casting each entity\'s shadow', file: /^src\/rendering\/voxel\/aoeVoxelCastShadows\.ts$/, text: /^export function castShadowParts\(/ },
  { key: 'snapshot.terrain', label: '        terrain detail and ground draft', file: /^src\/rendering\/voxel\/aoeVoxelTerrainFrame\.ts$/, text: /^(detailParts|groundDraft)\($/ },
  { key: 'snapshot.lanes', label: '        lanes: opaque batches', file: /^src\/rendering\/voxel\/aoeVoxelLaneBatches\.ts$/, text: /^batches\(input/ },
  { key: 'snapshot.lanes.shadow', label: '          shadow lane', file: /^src\/rendering\/voxel\/aoeVoxelLaneBatches\.ts$/, text: /^emit\(SHADOW_BATCH_KEY/ },
  { key: 'snapshot.lanes.memory', label: '          memory lane', file: /^src\/rendering\/voxel\/aoeVoxelLaneBatches\.ts$/, text: /^emit\(MEMORY_BATCH_KEY/ },
  { key: 'snapshot.hit', label: '        hit state and hit feedback', file: /^src\/rendering\/voxel\/aoeVoxelAdapter\.ts$/, text: /^private (hitEntities|updateHitFeedback)\($/ },
  { key: 'snapshot.occlusion', label: '        occlusion silhouettes', file: /^src\/rendering\/voxel\/aoeVoxelOcclusionSilhouettes\.ts$/, text: /^export function computeOcclusionSilhouettes\(/ },
  { key: 'snapshot.overlays', label: '        overlays', file: /^src\/rendering\/voxel\/aoeVoxelOverlayParts\.ts$/, text: /^export function createAoeVoxelOverlayParts\(/ },
  { key: 'delta', label: '      the delta against the last snapshot', file: /^src\/rendering\/voxel\/aoeVoxelSnapshotDelta\.ts$/, text: /^export function acceptAoeVoxelSnapshot\(/ },
  { key: 'ingest', label: '        runtime ingest: validate and page', file: /^voxel\/dist\/three\/ThreeRenderRuntime\.js$/, text: /^(acceptDelta\(delta\)|acceptSnapshot\(snapshot\))/ },

  { key: 'renderer-frame', label: '  renderer.frame and the runtime\'s frame', file: /^(src\/rendering\/voxel\/AoeVoxelWorldRenderer\.ts|voxel\/dist\/three\/ThreeRenderRuntime\.js)$/, text: /^(frame\($|frame\(context\))/ },
  { key: 'writes', label: '    instance matrix and colour writes', file: /^voxel\/dist\/three\/instanceBatchPresenter\.js$/, text: /^reconcile\(batches, resolvers\)/ },
  { key: 'draw', label: '    the draw: three.js and WebGL calls', file: /^voxel\/dist\/three\/ThreeRenderRuntime\.js$/, text: /^renderCurrent\(\)/ },

  { key: 'hud', label: 'HUD update', file: /^src\/ui\/hud\/createHudController\.ts$/, text: /^function update\(\): void/ },
  { key: 'hud.minimap', label: '  minimap', file: /^src\/ui\/hud\/minimap\.ts$/, text: /^export function drawMinimap\(/ },
  { key: 'recording', label: 'recording mirror (IndexedDB)', file: /^src\/game\/recording\// },
]);
