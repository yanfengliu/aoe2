# Review 11: integration

## Target

Actual initial A20 npmtest bindings plus frozen15607-row manifest and real pretest/launcher source. Authored receiptfeaac3f7882d328eba0fb6f7c89bb0e575d0a25cc8446e6bb08f947644a477c2 binds16 retained source/binding inputs.

Original authored report: C:\Users\38909\Documents\github\aoe2\tmp\replay-route6-1001\execution-contract-review\actual-focus\suite20-pretest-note\REPORT.md; 6486bytes/SHA256 d0558d9a1f82070e8b3dc0ac49ca6d39bd5b2f8d8bc3677203a083b2edaa6d47. This is late permanent preservation of an actual earlier round; its original chronology and substantive bytes are unchanged. Reports are embedded once, without citation or content normalization. Cited raw evidence stays ignored while this unresolved handoff remains active.

## Reviewers and coverage

/root/runtime_execution_contract_review; independent read-only lens and actual access are stated in the complete report. Coverage does not transfer to later source or execution.

## Reports

<!-- BEGIN EXACT ORIGINAL AUTHORED REPORT -->
# Material suite20 pretest toolchain finding

**P1 / acceptance blocker: stop this fixed full-suite comparison before B24.** The actual suite20 pretest executes npm bytes outside the reviewed frozen input boundary. This is not a test-generated npm environment string. Preserve the native A20 evidence and its real outcome under the existing cap; do not amend the manifest, alter scripts, probe with B24 or rerun an arm to repair this packet. This finding does not erase the separately valid direct-Vitest focus result, but it supersedes the source review's expectation that the proposed complete-suite command would stay within the frozen complete npm package boundary.

The root requested this bounded read-only investigation after observing the anomaly. No test, measurement process, probe, gate or mutation was launched in the measured tree by this reviewer. The audit used existing binding receipts, source and filesystem paths only. Authored copies are outside the measured source tree.

## Actual chain, with retained receipt names

- `20676-0-1790913110846.json`: actual Node20.20.2 executes the intended `C:/Program Files/nodejs/node_modules/npm/bin/npm-cli.js test -- ...`. The root invocation is correct.
- `50568-0-1790913111060.json`: actual Node20.20.2 executes its extracted distribution's `node_modules/npm/bin/npm-prefix.js`.
- `55872-0-1790913111377.json`: actual Node20.20.2 executes `C:/Users/38909/AppData/Roaming/npm/node_modules/npm/bin/npm-cli.js run voxel:build`. This argv is direct evidence that the other npm CLI ran, even though this process's initial preload still sees the inherited Program Files npm_execpath.
- `64720-0-1790913112638.json`: actual Node20.20.2 then executes the real checkout's `scripts/voxel-build-if-stale.mjs`, without `--print-root`, with npm_execpath now naming that AppData installation.

The timestamps place this chain at the beginning of the suite command, before its tests. `package.json:28` defines pretest as `npm run voxel:build`; voxel:build invokes the real script. The selected Node20 distribution's `npm.cmd` sets its own Node binary, runs its bundled npm-prefix.js, and substitutes the returned prefix's npm-cli.js if present. Its prefix helper loads @npmcli/config and prints config.globalPrefix. The AppData npm's `node_modules/@npmcli/config/lib/set-envs.js:109-110` then overwrites npm_execpath and npm_node_execpath for lifecycle children. This explains the observed values without assuming an environment-only fixture.

`tests/scripts/voxelBuildIfStale.test.ts:80-81` always invokes `[script, '--print-root']` with process.execPath and has no npm environment override. The retained test invocation `36284-0-1790913232888.json` does contain `--print-root` and the original Program Files npm_execpath. It is distinct from the pretest binding. `scripts/voxel-build-if-stale.mjs:55` exits early on that option, while the pretest uses the freshness path at lines135-137. The missing option and explicit npm CLI argv rule out the test-only explanation.

## Missing frozen input coverage and canonical paths

Frozen manifest SHA256 `96ff139b0e666da8ee63dac2a529348ac2de0128b6a95c09942cc24a97e74913` lists only `C:/Program Files/nodejs/node_modules/npm` among its npm package inventory roots. It contains zero rows for the AppData npm package, zero rows for the Node20 distribution's bundled npm package and zero rows for that distribution's npm.cmd. It does pin the Node20 node.exe binary, which is insufficient to pin these separately loaded JavaScript/shim/config files.

| Actual input | Package version / SHA256 | Frozen rows |
| --- | --- | ---: |
| Intended Program Files npm package | 11.6.2 | Complete declared inventory root |
| Program Files bin/npm-cli.js | `3ce7cba6f5128dd5f54c98b6a5036b0f850496878cc2e21044b675fe3c594e3e` | 1, exact hash matches |
| Actual AppData npm package | 11.7.0 | 0 |
| AppData bin/npm-cli.js | `8e5f6f3429f8cdbe693cdc29904e9d5a7b127a494bd15c804bd54c7403bfcbe7` | 0 |
| Node20 bundled npm package supplying prefix/config resolution | 10.8.2 | 0 |
| Node20 npm.cmd | `21b46c69ad6e2f231f02a9e120f4ba6c8e75fef5a45637103002eab99f888ab8` | 0 |
| Node20 bundled bin/npm-prefix.js | `673f620e40137c295f2cf057364468bf3a71653dfc0973be895ebf7a8c368c2e` | 0 |

The exact named Program Files CLI, AppData CLI and Node20 prefix file, plus every filesystem ancestor, were inspected for reparse points. All three ancestor lists are empty. Thus these are not hidden junction aliases for the one pinned npm root. The two CLI digests differ, independently ruling out equal file contents. Package version reads and copied hashes are observations after suite20 began; they document the missing boundary and cannot retroactively establish a pre-arm freeze. The audit did not read private npm configuration values.

## Contract consequence

The direct root npm-cli and actual Node20 runtime remain correct. This finding is narrower than a wrong-Node result and says nothing by itself about product assertions. However, complete whole-command cost includes pretest work, so the guarantee that all execution-affecting installed npm bytes are pinned and that only the selected Node runtime differs between arms is unsupported. The 15,607-row guards cannot detect changes to inputs absent from their manifest. The prefix helper also uses a different bundled npm package from the pinned Program Files package, before entering the unpinned global npm.

The fixed contract requires rejecting unexplained or changed execution inputs; it does not license adding these paths after A20 starts or changing the child launcher between arms. Running B24 to see whether it resolves the same npm would be an extra acceptance experiment after a known material gap, not proof that the already-frozen input boundary was adequate. Stop before B24 under this protocol. Retain A20's native pass/fail/timeout and all costs as evidence with this limitation. Do not call the full-suite comparison controlled, complete or accepted from this packet. Any future repair needs the owner's explicit next decision within the user's exhausted-route constraint; no further route is inferred here.

`receipt.json` SHA256 `feaac3f7882d328eba0fb6f7c89bb0e575d0a25cc8446e6bb08f947644a477c2` binds all16 retained source/binding artifacts and their original paths, frozen membership counts, package roots and ancestor reparse checks. The focus report remains unchanged at SHA256 `332d4be242e458fee2bc3bac1a7149d876e4a10794c70e6af4fbcbb98004c976`.
<!-- END EXACT ORIGINAL AUTHORED REPORT -->

## Findings and disposition

R6-P1: ACCEPTED material measurement-input blocker. Real pretest executes bundlednpm10.8.2 prefix/config and globalnpm11.7.0 absent from the freeze. Root stopped beforeB24 and did not amend or rerun. The actual native0 A20 remains valid correctness evidence but is not a controlled runtime-only comparison. Focus PASS stays intact.

## Verification

A20 actually finished native0:570files/4390cases,4387PASS/3existing skips;264.3966271s native command wall,278.324s Jobwall,3203.125s child-inclusiveJobCPU. Declared guards0mismatch,active0/query/close/cleanup true. The old automated inspector passed without detecting P1; independent judgment controls acceptance.

## Round outcome

Full controlled comparison REJECTED;B24 did not run. Five original routes and the one human extension are spent. No further runtime or source shipping is authorized; a source-only continuation awaits a new decision.
