# Review 6: brightness-sample setup repair

## Target

Base `ffb94da0992c6f402b1927eff3811fecc561b90c` plus the previously reviewed integration and the working change to tests/browser/de-ground.spec.ts. Verified file SHA256 `aa20252362247a62e88a33a1b4b9175efffd75b7d4a3d048e5a5ab9854b05412`. The repair was unstaged at review completion; this verdict binds those file bytes rather than a new staged tree.

## Reviewers and coverage

Independent Astra/xhigh, read-only. Reviewed the exact setup delta, surrounding sample exclusions, assertions, timing and rasterizer controls, plus retained review 5. Outside-diff grounding included browserTestApi.ts:427 and browserRasteriser.ts:32. Earlier integrated coverage remains applicable.

## Reports

The existing real-simulation journey now extends beyond permanent Town Centre sight: destination (36,14), 300 requested ticks, camera (26,14). The repair does not manufacture visibility or change sampling eligibility.

Both four-cell floors and the strict 0.4 < ratio < 0.62 bounds remain unchanged. Grass, neighboring-water/unexplored, entity-overlap and canvas exclusions remain intact. The 90-second timeout, rendered-frame waits, explicit Natural preference and rasterizer controls remain unchanged. Other changes clarify historical measurements and add diagnostic annotations. This is a rendering contract using test-API selection and movement; it makes no human-input coverage claim.

## Findings and disposition

No material findings. The empty explored-sample setup failure is resolved within this scenario's bound. Prior findings remain closed. Owner accepts the report and preserves the existing timeout rather than extending it.

## Verification

Worker-generated reports show GPU blend passed with seven explored and fifteen visible samples, ratio 0.477827019703043; SwiftShader single-sample passed with the same populations, ratio 0.4793273302094507. The cleanup ledger records zero remaining owned process identities. The reviewer ran no tests, browser, server, gate or writes.

## Round outcome

No open material review findings on the exact repair bytes. Focused results establish this sample on both rendering tiers. Full integrated verification, main integration, remote CI and final retirement remain owner acceptance duties.
