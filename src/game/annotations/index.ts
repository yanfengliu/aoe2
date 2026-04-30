// Spec 2 (annotation-ui v0.1.5) AO-6: barrel export for annotation
// primitives. Consumers should import from this barrel rather than
// individual files so future internal restructure stays opaque.

export {
  type AoeJsonValue,
  type AoeAuthor,
  type AoeSeverity,
  type AoeCategory,
  type AoeMarkerData,
  DEFAULT_SEVERITY,
  DEFAULT_CATEGORY,
  isAoeMarkerData,
} from './markerSchema';
export { type SelectionAwareRefs, selectionToRefs } from './selectionToRefs';
export { type CaptureScreenshotOptions, captureScreenshot } from './captureScreenshot';
