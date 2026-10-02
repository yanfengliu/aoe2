# Review 13: plan

## Target

Corrected source-only continuation7433b355c3031f50e8701bd794fda561e2963f4e1f0278d9505c95ccacca68f2, corrected5875-row censusbffd6e4083456f742dfc65735d22573fd08ff6bc06125a002d312503e222af97 and8 reviewed proposal files. Exact small proposal/source inputs recover through [the continuation contract](../snapshots/continuation-reviewed-inputs.json.txt); oversized census/raw results remain retained ignored inputs. Original report C:\Users\38909\Documents\github\aoe2\tmp\replay-route6-1001\continuation-proposal\review\ADDENDUM.md,8122bytes/SHA256c0640f84d60dbc8d2dd957841c0b3916c8be89fcdb4148af781dcdfa81603037.

## Reviewers and coverage

/root/runtime_execution_contract_review, independent artifact/source-only review. Read actual A20 receipts as attributed in the full report; launched no command, probe, gate or measurement. This coverage is design only.

## Reports

<!-- BEGIN EXACT ORIGINAL AUTHORED REPORT -->
# Source-only addendum — corrected shell and lookup proposal

**CP1 and CP2 are resolved in the corrected proposal source and recorded census. The mechanism is sufficiently concrete for the owner to ask whether one further bounded attempt is authorized.** No additional material design blocker was found in this focused addendum. This is not approval of a final executor and grants no runtime, retry, gate or budget authorization. Final invoker/environment/guard/predicate implementation must be frozen and independently reviewed before any runtime if the human approves.

This addendum binds CONTINUATION.md SHA256 `7433b355c3031f50e8701bd794fda561e2963f4e1f0278d9505c95ccacca68f2`, input-census.json SHA256 `bffd6e4083456f742dfc65735d22573fd08ff6bc06125a002d312503e222af97` and the other exact inputs below. The first report remains unchanged at SHA256 `db505c550087cd69e61dd8f4767d43b45ebde93d42604b81c7f2ad286023443a`; its historical findings are not erased. The owner's before-shell-lookup-fix preimages match the three original proposal/census/preparer hashes from that report. Eight corrected proposal files are copied under `corrected-proposal/`; `addendum-input-receipt.json` SHA256 `72dbc76861d42e4ee2f1936f1c737c72512ce966a49c222ea9b30ba9cd9edf02` binds the copies, lookup summary and preserved preimages.

## CP1 closed in source

CONTINUATION.md:11 now specifies the actual environment value `C:\Windows\System32\cmd.exe`. `prepare-census.mjs:13` uses a raw string with native backslashes, and both recorded lookup arms contain that exact native value. This matches the pinned promise-spawn cmd detection and `/d /s /c` branch identified in the first review. The same cmd.exe bytes remain pinned. The forward-slash executable-path spelling defect is no longer present in the proposed environment.

## CP2 closed in source and static census

`prepare-census.mjs:19-27` retains the literal original PATH, validates and retains PATHEXT, records the worker cwd, enumerates all seven project-to-drive-root ancestor .bin directories plus pinned npm's node-gyp-bin, and inspects cwd as the first directory. It enumerates all existing names matching npm or npm.any-extension rather than a fixed five-name list, records noneligible names too, classifies against the actual PATHEXT, rejects earlier eligible candidates and requires the only eligible owned-shim name to be npm.cmd.

Each arm's recorded census has nine earlier directories: cwd, seven ancestor .bin directories and node-gyp-bin. They currently contain zero npm-named candidates, so there are zero earlier eligible candidates. Each owned shim directory contains exactly one npm.cmd, recorded as a regular file with its previously reviewed digest; the two shims themselves are unchanged. PATHEXT is recorded literally as `.COM;.EXE;.BAT;.CMD;.VBS;.VBE;.JS;.JSE;.WSF;.WSH;.MSC;.PY;.PYW;.CPL`. The census retains the original63-segment PATH and the proposed shim-first base/lifecycle paths for each selected Node. It no longer assumes that only .exe/.cmd/.bat candidates matter.

CONTINUATION.md:13 explicitly rejects unexpected cwd/PATH/PATHEXT, extra npm binPaths and other prefixes. It also distinguishes static inventory from actual shell selection and requires the two real pretest controls to establish actual resolution. This closes the prior design omission. It does not claim that this source-only census is an enforcing runtime guard: the later exact guard must preserve every relevant presence/absence, candidate hash/type, canonical target and environment rule before and after execution. Expected npm PATH rewriting must follow the pinned set-path implementation, including repeated lifecycle prefixes and any case-variant environment-key handling; it must not be guessed from a simplified string-prefix check.

## New observer and remaining final-freeze requirements

`observe-lifecycle.cjs:4-10` records actual process/worker identity, executable/version/argv, cwd, PATH, PATHEXT, shell and npm identity environment fields to the owned receipt directory. This provides the extra observed command-resolution data that was missing from the earlier preload. It writes neither stdout nor product state. Its source and exact new census row are retained; it has not been loaded or run during this review.

The new observer is additional evidence, not a drop-in replacement for all existing instrumentation. Its source omits the old preload's availableParallelism/halfCoreCap/nodeCompileCache fields and is inactive when ROUTE6_RECEIPT_DIR is unset. The final executor must explicitly wire the owned directory and retain or compose the original runtime/core/cache observations. The predicate must reject absent, empty, malformed or incomplete observations. Its shared JSONL output must be treated as unaccepted until fully parsed with the required process/command evidence; a zero-byte or partial file cannot mean that no forbidden command occurred. This remains part of the explicitly deferred executor review, not a reason to run another probe now.

The fixed worker cwd and npm lookup rules apply to the root and relevant npm lifecycle chain. Existing whole-suite tests intentionally launch non-npm children from temporary fixture directories; for example the previously reviewed voxel-root test's run helper supplies a fixture cwd and --print-root. The final predicate must identify these source-bound contexts without accepting an unexpected npm lifecycle cwd or changing test work. A blanket requirement that every descendant cwd equal the worker would reject legitimate original work. This distinction belongs in the final predicate implementation and requires no extra test command or population change.

All first-review final-freeze requirements remain: explicit identical credential-free rc paths, controlled relevant environment without printing private values, exact canonical actual CLI argv, nonempty expected root/nested/real-freshness command observations, real skip output, and rejection of the retained forbidden npm-prefix and global-CLI bindings even when npm_execpath is inherited from the allowed root. The required implementation remains only the complete Program Files npm11.6.2 package. AppData npm11.7.0 and bundled npm10.8.2 inventories remain optional guarded forbidden roots, not alternate permitted implementations. Their inclusion must never make actual execution through them acceptable.

The proposal's finite order and work remain unchanged: two real pretest identity controls if approved, then only after acceptance one conditional A20/B24 complete-suite pair, with unchanged tests, skips, timeouts, isolated threads, accounting/cleanup, no-repeat rule and ordinary final verification as separately described. No command was executed in this addendum and no source/probe/gate was run. No measured-tree, private config or sibling state was modified. No new worktree or persistent process was created.

The prior A20 remains native0 with570files/4390cases,4387pass/3skip,264.3966271s wall and3203.125 Job CPU seconds, active0. Its full comparison remains rejected because of the omitted real pretest inputs. This corrected proposal does not retroactively validate it, does not reset the exhausted budget and does not establish Windows20 hosted coverage, full verify or hosted acceptance.

## Exact corrected artifacts

| Artifact | SHA256 |
| --- | --- |
| CONTINUATION.md | `7433b355c3031f50e8701bd794fda561e2963f4e1f0278d9505c95ccacca68f2` |
| input-census.json,5875rows | `bffd6e4083456f742dfc65735d22573fd08ff6bc06125a002d312503e222af97` |
| prepare-census.mjs | `bc78f2d1b9e8763cb166db9c63cbf24ec238936d476d78afe6845fb3190f60ea` |
| observe-lifecycle.cjs | `82aa032780f7fe9415ef74121601a2aec7de0b60fcb0929821b95a3f171245be` |
| npm20/npm.cmd,unchanged | `a6ab114beda71dced18716ce9e615173620e1a6e007def6950ebf74bae0de272` |
| npm24/npm.cmd,unchanged | `966b8ae3667338a2f7db6d84b4fb6aa5fa4660b19c66d2587ced042d7e7b4b82` |
| user.npmrc,unchanged | `26324cac45a03a9fcf8a187e0e8bc823a4905a4fd0e2c4307b08f4b1cb673a9a` |
| global.npmrc,unchanged | `184da28e48e56cfd484b4751331b9af5dd0603efb047ffb67e0ee59c4ee6e0e6` |
<!-- END EXACT ORIGINAL AUTHORED REPORT -->

## Findings and disposition

CP1/CP2 closed in corrected proposal source/static census. Final observer composition, relevant npm environment, expected lifecycle/temporary-fixture contexts, nonempty actual argv and complete guard/predicate remain explicit executor prerequisites. Human budget decision remains unanswered; no test/control/fullsuite ran and no further route is released.

## Verification

Static exact-input inspection only; no proposed script/preload/shim/pretest or fullpair executed. Original focusPASS and A20native0/P1controlled-comparison rejection remain unchanged. Complete report is retained once without content/citation normalization; extraction matches actual original bytes.

## Round outcome

Source-only proposal judgment, with no executor acceptance or runtime/budget authorization. Work112 remains blocked pending the new decision; mainWindows/M7/fullparity and21consumer scopes remain OPEN.
