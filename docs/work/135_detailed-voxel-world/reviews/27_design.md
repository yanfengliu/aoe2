# Review 27: design

## Target

Date: 2026-10-18. Scope: the M15 comparison-region bookkeeping contract, not M15 art, source implementation or rendered fidelity. This report belongs to the next M15 milestone; it does not modify the earlier frozen documentation target.

The original contract is `C:/Users/38909/Documents/github/aoe2/tmp/work135-m15-comparison/predeclared-contract.json`. The source extent record is `C:/Users/38909/Documents/Codex/2026-10-18/voxel-art-reference-proof/outputs/checks/m15-pre-capture-extent-discrepancy.json`. The subsequent analysis correction is `C:/Users/38909/Documents/github/aoe2/tmp/work135-m15-comparison/analysis-region-correction.json`. The capture record is `C:/Users/38909/Documents/Codex/2026-10-18/voxel-art-reference-proof/outputs/renders/m15-capture.json`.

| Record | Verified SHA256 |
|---|---|
| Original contract | `0a667db3fff866babda2f44ec93cc89fe0e598cfc245307920cc9310f6be7cc5` |
| Source extent discrepancy | `b7e97612f83cf77dd88006bf9544db70d3fb3f9ae301a418d3b08f783d6f6161` |
| Post-capture analysis correction | `d328ce6775a5d6d864507b5140b1070a6377a128b9e57f439b0ed01c7369f848` |
| M15 capture record | `26ac42bbdb58bcf1c607f63a271824fc8e187d3f5b81c0bbc4c1f34468815bc0` |

### Recoverable original authored contract

The following is the original contract text, frozen at 20:19:40.582900 UTC. It remains unchanged. The before-image pin records M14's subject-only status and does not approve final reference quality.

```json
{
  "frozenAt": "2026-10-18T20:19:40.582900+00:00",
  "before": "M14 rough emerging-head subject PASS only; finalreferencequalityunaccepted",
  "beforeSha256": "c8b04ca84cc2d2a78e9b1dea33fc11c2d0dafc45b855f8c193d6913f6192b2a5",
  "expectedRegionsInclusive": [
    [
      100,
      15,
      405,
      320
    ],
    [
      380,
      65,
      675,
      315
    ],
    [
      5,
      220,
      410,
      390
    ]
  ],
  "intendedDelta": "Reference-specific head/jaw/throat planes and ground flare, directional flame/hot patch organization, unequal pad groups; corrected no-humanoid subject preserved across allangles",
  "controls": "Frozen reference, matchedcamera, palette/pitch, lighting/raster/M12-equalbuild, graygrid and ancillary forked feature",
  "successorCaptureAvailableAtFreeze": false,
  "comparator": "scripts/diffMapScreenshots.mjs",
  "acceptance": "Full native multiview reference-fidelity judgment; pixelconfinement alone is not artapproval"
}
```

### Recoverable post-capture authored analysis correction

This is the actual correction record. Its explicit timing label is part of the target. The first capture batch was not governed by a pre-capture ROI addendum.

```json
{
  "recordedAt": "2026-10-18T20:32:17.685119+00:00",
  "timing": "POST-CAPTURE ANALYSIS CORRECTION; firstM15capture already existed before root addendum attempt. Never label as predeclared forfirstbatch.",
  "originalContractSha256": "0a667db3fff866babda2f44ec93cc89fe0e598cfc245307920cc9310f6be7cc5",
  "originalPreservedUnchanged": true,
  "extentRecordSha256": "b7e97612f83cf77dd88006bf9544db70d3fb3f9ae301a418d3b08f783d6f6161",
  "extentWasRecordedBeforeCapture": "2026-10-18T20:27:01.496053Z",
  "captureRecordSha256": "26ac42bbdb58bcf1c607f63a271824fc8e187d3f5b81c0bbc4c1f34468815bc0",
  "expectedRegionsInclusive": [
    [
      100,
      15,
      405,
      320
    ],
    [
      380,
      65,
      684,
      315
    ],
    [
      5,
      218,
      410,
      390
    ]
  ],
  "change": "BookkeepingROIonly; flame right675to684 andpadtop220to218 cover rawsourceprojection withroundingguard. Actorunchanged.",
  "independentReview": "m13_fresh_native_review read originalcontract and rawextentrecord, no materialfinding; noM15image/artscore supplied.",
  "acceptanceUnchanged": true,
  "requiredAudit": "Report outsidecounts for originalANDcorrected unions, includingremovedM14pixels; inspect all11nativeviews forclipping/framing/fidelity. No retrospective predeclaredPASS claim."
}
```

## Reviewers and coverage

Reviewer: Codex `/root/m13_fresh_native_review`, independent of the M15 author. The original bounded review read the actual original-contract and raw source-extent JSON records. It did not inspect M15 images, recompute the occupancy projection, verify the M15 source implementation or assign an art score. This report additionally reads and hashes the actual post-capture correction and capture metadata to preserve the corrected timing.

## Reports

### Original bounded instrument assessment

No material finding in the proposed ROI correction. The actual records support flame `[380,65,684,315]` and pad `[5,218,410,390]`, with actor `[100,15,405,320]` unchanged. These cover the reported conservative occupied-cube extents with rounding guards. The reported maximum x682.677 remains inside the 685-pixel canvas.

The source record reports enclosing flame pixels x395–683/y92–285 and pad pixels x42–373/y219–348. Thus the flame's right bound changes from 675 to 684, and the pad's top bound from 220 to 218. This assessment concerns the declared analysis rectangles, not a requirement to squeeze geometry into them.

The correction must not excuse clipping, framing mismatch or changed pixels outside the declared regions, including removed M14 pixels. Those remain actual-capture checks. All eleven M15 native views still require full reference-fidelity review. Source occupancy count, connectivity and absent humanoid marker strings establish no art approval.

### Timing correction recorded 2026-10-18

The review request treated the correction as pre-capture. That premise was wrong. The integration owner subsequently reported that the first M15 capture ran at 20:29:47–55 UTC while the request/response was in flight. The capture metadata inspected for this report contains eleven captures and its file's observed last-write time is 20:29:55.6356306 UTC. The source-extent record was authored at 20:27:01.496053 UTC, before that capture; the actual analysis correction was authored at 20:32:17.685119 UTC, after it.

My original response instructed: "Preserve the original JSON and date the addendum before capture." That instruction rested on the mistaken pre-capture premise; it was not fulfilled before the first batch and must not be reported as an event that occurred.

The owner reports that its guard refused the attempted pre-capture addendum and that a mistaken message claiming the addendum existed was promptly corrected. The inspected actual correction explicitly labels itself post-capture. This report makes no claim that the correction was predeclared for the first batch or that the reviewer approved images before capture. The original no-material-finding assessment survives only as an assessment of the bookkeeping rectangles and their stated limits.

## Findings and disposition

No material finding was reported against the proposed bookkeeping rectangle correction. The original predeclared contract and the post-capture analysis correction must remain distinct records. Integration-owner acceptance/disposition belongs in the plan; this reviewer supplies no retrospective predeclared PASS or art PASS.

The integration owner will report outside-region counts for both original and corrected unions, including removed M14 pixels, and inspect all eleven actual native views for clipping, framing and reference fidelity. The corrected union is explanatory analysis of the first batch, not a replacement history for the original union.

## Verification

The four target hashes in the table above were read from the actual files. Both authored contract texts are retained above so their substantive target remains recoverable. No raw run output, screenshot or source code was promoted into this report. No product/source/runtime change, capture, browser, server or heavy gate was run by this reviewer. The original bounded review and this documentation task viewed no M15 pixels.

## Round outcome

No material finding on the bookkeeping ROI change, with the timing explicitly corrected to **post-capture analysis correction for the first M15 batch**. M14's existing subject-only PASS is unchanged. M15 final fidelity remains unreviewed by this agent and requires the actual eleven-view image review. This report creates no approval hold and grants no art acceptance.
