## Target

Round 13 reviews completed shipping attempt 2 under C:/Users/38909/Documents/github/aoe2-worktrees/software-culling-proof-1017/tmp/probes/work130-culling/shipping-pin-preparation/execution-2/, following the exact retry accepted in round 12. The source is voxel commit 08398b573ad54bcb5c764ad0c2ef3cedc3cce33f, tree df0147f51cdfff4d1ab5338f1d2d672594a4108f.

Exact SHA256 bindings: report.md 0312a40df7bbbf3f746c788074f150265fa0ac2ed16ebfe2de03dd267b75fa46; artifact-index.json 3b2e2b3eb450614d3de82f259703ab0a28bbf4304893185c7d28e218e510dd1c; ../shipping-build-pins.json 94ba751c3acc50cf1f8cf1163763bc0c314b072b3e4003aeed2e2099cdc6108e; ../shipping-origin-receipt.json a362cda50efe6cb2f714baaed6366ed8ba97e9f01a9816ebdc51a918101cde93; ../shipping-resolved-inputs.jsonl ba25da2490fd83613425207c03b78f5468dc051e064a8884c189ed46694d3c61.

## Reviewers and coverage

Independent Codex reviewer using the prescribed Astra/xhigh controls. Read-only review covered native exits and complete test output, compiler inventories, archive/extracted source identities, loaded-module provenance, copied fixtures, behavioral receipts, protected inputs, first-failure preservation and process cleanup. No rerun, build, browser, profile, source export or source edit occurred. This authored review is the only new output.

## Reports

All five native operations exited 0: archive, member inventory, extraction, compiler and Vitest. Their stderr logs are empty. Vitest 3.2.6 reports one complete file with 16 passed tests and no skipped, failed or unreached cases. The setup receipt alone was not treated as a passing-run verdict.

The scoped Git line-ending flags took effect. Independently reading the tar and extracted files confirms all 166 payloads reproduce the exact expected Git blob IDs and lengths without normalization. Archive SHA256 is cc6f2cbeeb352162749c8fc723edd7355a92776563fe40570ebf60d447360d9e. The source before/after lists agree.

The native compiler's complete output reconciles with 778 pinned input files, including all 159 source TypeScript files and 619 dependencies from the reviewed dependency tree. Its 318 emitted files match the on-disk output inventory and manifest, with no hash mismatch. The source-resident face-outlines.test.ts was compiled into JavaScript/declarations; it was not an additional executed test.

The eight healthy scenarios record 63 usable committed draws and 60 equal-depth fixture frames. All four intended sensitivity controls failed at the intended actual-state assertion and then restored healthy: first-full capacity 8 versus 64; count-change capacity 16 versus 64 at grow-33; camera revision VISIBLE_OMISSION at pan key fixed:shadow:0:0007; reconstruction-reset capacity 8 versus 64. The unchanged fixture digest is 62322c1f5a2786cd0ccb80f7697077164a988ac99f6563fcf8c6695e0333ae2f.

## Findings and disposition

No material finding blocks progression to the separately reviewed real-host/render proof.

Shipping origin is established by the combined build, setup assertions, actual module trace and completed behavioral run. All 138 unique observed shipping JavaScript paths map to the compiled manifest; every raw hash and pre-transform input hash agrees with those compiled bytes. The exercised ThreeRenderRuntime, RenderWorld and meshing exports satisfy the explicit shipping identity assertions, and the shipping runtime class differs from the installed class. The unchanged fixtures actually observed and compared presenter meshes; this is not an empty-scene pass.

The copied lifecycle receipt is byte-identical to the prior installed-runtime receipt, SHA256 62f52824a38881feb5db86d1104ced1cbf820a6e64fba75f72620d0038cb79a5. Its legacy installed-runtime and unavailable-shipping labels remain inherited metadata. They do not identify this run's runtime. The reviewed fresh-copy controller does not copy an old run receipt; the completed sixteen-case run generates it, and the separate shipping build/origin/trace evidence supplies the runtime identity. The authored result report makes this distinction explicit.

The independent lifecycle contract passes: lost admissions cause no draws/commits, restoration returns to running with device generation 1 to 2 and prior revision 3, followed by source revisions 7 and 8. Absent presented fields on undrawn receipt rows are not interpreted as null runtime watermarks. Both injected draws fail terminally with the expected error. Terminal restored capacities 64 versus 8 remain diagnostic under the pre-observation exception; genuine reconstruction then draws the full 67 slots before compacting to 15 while preserving usable capacities, bounds, order and replacement behavior.

This evidence covers synthetic public-runtime behavior and the real Three comparator over the flat fixtures. It does not resolve actual AoE host/coordinator admission, paused-camera presentation scheduling, bridge rollback, hit/source revision coordination, WebGL/GPU restoration or rendered pixels.

## Verification

Fresh hashes match all 767 indexed artifacts, all 318 emitted files and all 778 compiler inputs. All seven copied proof/pin files match the accepted originals. All 2,684 protected input bindings and six retry-own pins agree before/after and still match disk.

All 187 first-attempt artifact entries remain unchanged at their preserved paths. The relocation receipt explains the moved tar/source paths; the historical artifact index remains byte-identical at f446c7b939dfdcc7ba2660d38539fbfd1edce50f2b3b0e7589ce518a57fa548e. Attempt 1 remains a documented pre-compiler instrument failure, not a behavioral result.

The final cleanup record names ten owned PID/creation identities. Independent process inspection found none active. Git reports no tracked changes. Evidence and the worktree remain intentionally retained for integration-owner handoff; no reviewer-owned long-running resource was created.

## Round outcome

Accepted as passing bounded shipping-source-equivalent local-build evidence. It supports the next separately reviewed host/render proof, subject to the integration owner's scope and lane release. No further execution is authorized by this report alone.

CI artifact-byte equivalence, real host/bridge behavior, WebGL/pixels, browser controls and Normal-speed equal-work FPS remain unverified. No product candidate or performance acceptance is approved. The software ratio <=1.25, GPU >=55 FPS, preserved pixels and unchanged simulation work remain unchanged requirements; the stronger software criterion remains UNMET.
