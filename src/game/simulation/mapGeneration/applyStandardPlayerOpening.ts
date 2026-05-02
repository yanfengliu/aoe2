// Barrel re-export for the applyStandardPlayerOpening/* split. Pre-iter-3
// this was a 545-LOC monolith with 8 functions; split into patches +
// standardOpening + clusters per the 500-LOC hard-limit rule. Existing
// imports from `./applyStandardPlayerOpening` continue to work.

export {
  createPlayerStarts,
  applyResourcePatch,
  applyForestPatch,
  applyShoreFishPatches,
  applyShoreFishPatchesProcedural,
} from './applyStandardPlayerOpening/patches';

export {
  applyStandardPlayerOpening,
  applyStandardPlayerOpeningProcedural,
} from './applyStandardPlayerOpening/standardOpening';

export {
  placeResourceCluster,
  placeForestCluster,
} from './applyStandardPlayerOpening/clusters';
