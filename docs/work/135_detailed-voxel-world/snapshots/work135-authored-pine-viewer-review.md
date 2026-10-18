# Authored pine public viewer — independent source review, 2026-10-18

**ACCEPT the frozen viewer/snapshot/camera source for one bounded standalone opaque diffuse projection. Native dispatch still needs the promised reviewed outer lifecycle binding; this report is not that grant.** No concrete public-runtime API, material, basis, camera-orbit or served-module defect was found. No renderer, browser, server, product import, test, build or Git command ran in this review. Only source/JSON/binary reads, hashes and standard-library byte inspection ran; only this review was written.

## Exact inspected boundary

HANDOFF SHA256 `abbd21522a29a213ca9f60d07ea9a46ecad288a0a0af5b9e0adea7bedbe60ce6`; freeze `238f3c2346709881352940e6c038255ac5cd7f22beace6beae6a837f35339a09`. Fresh readback matched **160/160** frozen files and **149/149** source-to-served pairs (both sides, lengths and SHA256), zero mismatches. The prior geometry/source review remains `21d667bda68c3119512a8c1d263b3faa045de5d9a81db5d2f4b30a451b94e625`; its named overlap convention, unresolved original optics and non-game scope remain unchanged.

| File | SHA256 |
|---|---|
| snapshot.mjs | `06f0278ab3f0461dc31235c0083a73c1dd92a638fe06729a0fe4ac133802c183` |
| viewer.mjs | `5d19ced281e8381a5d62c9e9f1161fe7a9b158faa45e8b6a5a26e804b7032706` |
| camera-oracle.mjs | `c2b2a56ddd6ec0f3518e78cb15864c85023128ed4be7ff820f5e1a1d3e4ab7ee` |
| capture.mjs | `194f6f49f753a28f158c71d2663e7ae40d62d3cbebddf55d181978d1dbfebf34` |
| prepare.mjs | `c07a991f7e368874e48e635bb5a7856a67b5f1eeca9170f9d634963b66ba86f8` |
| render-candidate.json | `7e5c72bb5092be65b6780e1b35a43138cbf602d2840079843cea53fb80c96bf4` |
| snapshot-manifest.json | `3a7c4b75d8573f465c8e85e0468fb3cab1613bba73f9761afa2274aa3a2fe22b` |
| served-input-pins.json | `1b718b3dcec9218ec9445b6f188d9fa0bda9c6920c59936d475d4c6cc243b7b9` |
| public ThreeRenderRuntime.js | `7b103529d0f1517197fd96f78636a758d4ad2b2b16148c42fa4000ad8074ce58` |
| public revisionCaptureCoordinator.js | `a9ec7e911830d81e992c06d5f5917c8ae371747bf29c9d960908b37440fbbb67` |
| public cameraStrategy.js | `8d5a6986933bc9d13db0a97320af0c8b77d6b5a3c1e1ff21b8bb9fc24b7ed2a3` |
| public materialPresenter.js | `5fcae3e50e24e33efb71273294ee8fdbff4d198751bd6cf6540ff01d268bbcd9` |
| public geometryPresenter.js | `3a5e381832f61e6292fce51ba3609b6ecc80b088454a96bbe168c2308df29e71` |
| served Three module/core | `bbf5ed13fe4373f5bd38b14ea8e62e9f157327da5638edc6d3863e08b167c9c7` / `3718df126d69c125362a03340913204470d8c50238605150e57f808840fb7759` |

The five payload lanes are hash-identical to the prior accepted candidate. No candidate regeneration or hash relearning occurred. Source-to-dist equivalence remains unproved; the actual served distribution, not that equivalence, is the renderer boundary.

## Runtime, geometry and material

The metadata candidate is correctly reconstructed as a public RenderSnapshotV1, rather than passed directly: Float32 positions/normals, Uint32 indices, Uint8 straight-alpha sRGB8 colors, Float32 identity instance matrices, matching geometry/material group references, four resources and two batches. Geometry remains 133,620 vertices / 200,430 indices / 66,810 triangles. The separately declared 140,000/210,000 geometry ceilings and 12MB input budget are technical-viewer limits, not a game-cap increase or measured runtime memory result. The retained pure core receipt reports validation plus three rejection controls; I read its source and receipt, did not rerun it, and do not elevate it to native proof.

White material RGBA and white per-instance RGBA avoid unintended tint/black multiplication. Independent byte enumeration of the copied 133,620 vertex colors found exactly `(9,97,72,255):39024`, `(32,96,79,255):37464`, `(15,76,58,255):37704`, `(67,52,27,255):19428`; no translucent color was introduced. The served public geometry presenter performs its sRGB-to-linear conversion; the viewer does not pre-linearize. The already normalized right-handed y-up geometry uses one identity instance matrix, avoiding the prior diagnostic model translation being applied twice. Ground winding faces +Y, matching its normals.

Actual installed public implementations/types confirm: `acceptSnapshot` returns the checked accepted/rejected status; `frame({nowMs,deltaMs,frameIndex})` returns a presented manifest or undefined; `captureWithManifest({detail:'resources'})` is synchronous and returns `{status:'captured',manifest,readback}`. The runner reads `captured.readback.dataUrl` correctly. Runtime-rendered ownership permits this public capture; no host-readback lease is required. The viewer uses public exports and rendererFactory, no private mesh fallback. The copied Three module's relative core import and the import-map `three` binding resolve to the frozen served closure.

Lambert, opacity1, white vertex-color multiplier, single-sided opaque material is a coherent **declared projection**. Roughness0.1 is retained but does not affect Lambert; `_ior/_ri/_d/implicit _type` remain unmapped, not proven inactive. The neutral plane, white hemisphere/key, gray ground bounce, no shadows/fog/stylized resolve, sRGB/NoToneMapping are stated standalone choices, not Natural, game ground/contact, author optics or original game artwork. SwiftShader is suitable for this bounded representation/style look if it actually renders correctly; it cannot establish hardware parity or game performance. Record actual GL backend and inspect every original image.

## Camera and evidence bounds

The helper's fixed initial 45-degree view is explicitly replaced before every frame. Actual camera position/lookAt, left/right/top/bottom and matrices change; the borrowed-camera host projection policy does not reset them. The independent oracle imports neither Three nor its helper. Its right/up/back basis agrees analytically with a y-up orbit at elevation30 degrees; its +X/+Z literal expectations at 45/135/225/315 are distinct and correctly signed. Runtime checks compare every pine vertex through actual view/projection matrices to that independent projection and require full pine framing. This is not ten repeated 45-degree labels. The retained four literal/two invalid-input pure controls establish their stated bound only; actual camera/render checks have not run.

Fixed four angles plus one root-drawn held-out angle at zoom1.5 and3.4 give ten views. Choose a genuinely separated held-out angle: labels round to six decimals, so a value infinitesimally near a fixed angle could collide and stop the run via CreateNew; that is avoidable in the root grant without changing geometry or broadening the matrix. No rendered silhouette, base contact, legibility, exact optics or game readiness is accepted before actual originals are inspected.

## Minimum dispatch integration — use the existing proven helper

The inner runner has strict4898 binding, frozen served allowlist/hash checks, grant/freeze/lease/deadline checks, first-error stop, unique output directory, headless owned browserServer and finally closure of context/connection/browserServer/HTTP listener. It records only the browser root PID, honestly not a typed identity. Its timer is best effort, and finally awaits are not independently bounded. Its last full160-file guard runs on normal completion, **not in the exceptional finally path**. Runtime disposal errors are swallowed in the page-dispose attempt before context closure; therefore a cleanup string alone must not become an all-clean claim. Success is correctly labelled pending manual review and post-host audit.

Mechanically bind this runner to the already reviewed absolute pinned pwsh7.6.5 foreground/controller + typed-CIM audit pattern, with port4898 and this exact freeze. Do not invent another supervisor. The outer binding must (1) pin actual Node/Playwright/helper inputs and canonical non-reparse grant/output paths, retain immutable supplied grant bytes and actual host/browser/child PID+UTC-creation identities, (2) enforce the finite hard deadline while retaining controller/conhost through finally, (3) attempt and record all160 final readbacks and grant/lease checks on both success and failure, and (4) require actual native/host exits, complete ten PNG/JSON rows with hashes, no native errors, successful closure and a fresh typed census/control1/0/0 plus port4898-free receipt. A killed/partial run or cleanup/readback failure is not a completed capture. Keep the root lock until that audit, removing only the verified owned marker.

These are the specific promised lifecycle integration conditions, not an API/material redesign request or a reason to reopen sculpting. No viewer-source repair is required by this review. After that small binding is reviewed and root grants it, the next useful evidence is the actual ten native images. This review created no persistent process/resource and made no product/source/Git/gallery changes.