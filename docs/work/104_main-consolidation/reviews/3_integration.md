# Review 3: integration repairs

## Target

Base `3bc906af51af5f29a48d11400d21aab79d714449`; verified full patch `97d2a6b4f445ee5a6a0ef4feea6fdaef88848f901acc6398279a811fc04e01d3`, product patch `efd658891215f4d5b8a23eaa6afff734e59076e86254790fdf84159fbf36236d` and supplied tree `17621d488624ba69a398dceb5b0d193c09fb69b0`. The four staged documentation repairs under IR-5 were reread afterwards. Reviewed target patches remain under primary ignored tmp/main-consolidation-20260929.

## Reviewers and coverage

Independent Astra/xhigh, read-only. Reviewed six repair files, regression contracts and owner records without repeating unchanged product or the 429-import census. Outside-diff grounding included saveGameOps.ts:66 and ci.yml:78. A distinct independent Astra product lens also rechecked FPR-1 against the same repair/product hashes.

## Reports

IR-4/F3 closed: the checkout exception reads the indexed registry and actual index blobs, requires the registered digest and effective -text, and restricts eligible paths to historical/review imports. Ordinary text remains checked. Real-Git negative controls distinguish indexed bytes from matching working-tree bytes and reject unregistered CRLF and missing attributes. This repair introduces no historical-commit dependency.

FPR-1/F4 closed: profile-selfplay.mjs:176 obtains the header seed from actual saved bridge state outside sampling. The real Arena-load test covers a saved seed differing from aoe2-prototype. A separate explicit CLI invocation is not part of this test. The distinct product reviewer inspected unchanged saveGameOps.ts:66, confirmed the call follows profiling and elapsed measurement, and closed the finding with no other actionable issue in its narrow re-review.

IR-5 — P2, discovered and closed during review: reviews 1/2 initially lacked required sections and two auxiliary records occupied unsupported unit-root paths. Both reviews now contain six required nonempty sections. Both auxiliary records moved byte-identically under snapshots, satisfying the inspected structural contract.

## Findings and disposition

IR-6 — P2, open: workDocsIntegration.test.ts:36 and workDocsRaw.test.ts:14 git-show pinned historical source 143ad5116f25393504328056764bcc8706917b9e. CI uses default shallow depth before npm test without fetching that commit. Fresh runners lack the source objects; local full-history checks miss the failure. Supply the seven fixed sources by an explicit CI fetch or reviewed fixtures, retaining fixed identity/hash checks. Missing history must not skip or pass validation. The earlier broad review missed this dependency; this pass checked the actual workflow consumer. Owner accepts and assigns a bounded source-fetch repair with a real shallow-clone control.

## Verification

No reviewer tests, gates, writes, browsers or servers. Patch hashes, contracts, test bodies and staged doc delta were inspected. Worker focused successes do not prove remote compatibility. The second focused product reviewer inspected the Arena test without running it and verified the repair and current product hashes.

## Round outcome

IR-1–IR-5 and FPR-1 are closed within reviewed bounds. IR-6 remains a material blocker. Review its repair and complete the full gate before acceptance; merge, remote verification and retirement remain pending owner duties.
