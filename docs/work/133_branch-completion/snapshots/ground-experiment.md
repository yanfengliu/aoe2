# Bounded opaque ground-order experiment — 2026-10-17

Owner: software_performance_audit, accepted by the integration owner as a rejected experiment. The original B implementation and its stronger unresolved software criterion are unchanged. No ground-order product change ships.

## Fixed target and result

The different mechanism was Natural ground mesh.renderOrder=1 after ordinary opaque voxel meshes at order0. Baseline index tree84c4bc889423a9eadadedca2acfc8e09bdf5896c was preserved before mutation; both frozen bundles and the rejected patch are ignored evidence under tmp/work133-ground. Baseline build index SHA256ff50526b1143959cac19fe97b528729d472e9b0f58edcc14ed6933dd960d1d74; candidate indexa90413131ba457bcf3195aec05172058d61bac67e0feb1ceecd9dee318843443. Rejected patch SHA25621d9b820385aad290fa4f378f7e5871be26dfeba8522b509967d186caed40ed3.

## Authored worker handoff

The bounded candidate is rejected and fully restored. Drawing Natural ground last changes pixels; no performance gain is claimed.

| Natural view | SwiftShader changed pixels | GPU changed pixels |
| --- | ---: | ---: |
| Opening | 6 | 16 |
| Late base | 5 | 17 |
| Empty corner | 0 | 0 |
| Held-out close view | 0 | 0 |

All eight Moebius pairs are unchanged. One same-baseline GPU control changes zero pixels, confirming an attributable ordering difference.

Original ground, rendering test and baseline build are restored exactly; their diff against the saved tree is empty. The focused experiment test went red before the change and passed afterward (9 tests). Both builds/typechecks passed. The full integration gate was not run by this worker.

Corrected Normal probe passed independent scrutiny after BR1–4 corrections. SHA2565dd829a7d2ea54c74817d221ff73ed0cb90780f92ba2aee04d69908802191eec. It was prepared, not executed: the candidate failed pixels before scoring. No software ≤1.25 ratio or GPU ≥55 fps result was measured by this experiment. B's prior bounded upload/GPU evidence remains; settled Normal software acceptance stays open.

Owned process audit found zero remaining task previews, runners or tagged browsers. Unrelated applications were untouched. Write lease and heavy resource slot were released.

Correction retained: an earlier progress message incorrectly generalized later zero-diff SwiftShader rows; the complete counts above supersede it.

## Integration disposition

The integration owner rejected the candidate under its predeclared unchanged-pixel criterion, accepted the byte-for-byte restoration, and released the expensive slot to the instrumented AI census. No later cheap counter or callback reading substitutes for the missing settled Normal software result. The rejected candidate does not invalidate B's eight zero-difference before/after pairs. Independent final product review and full gates remain required.
