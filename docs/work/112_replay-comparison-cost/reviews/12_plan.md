# Review 12: plan

## Target

Original source-only continuation proposal: exact originalCONTINUATION b3a9c0f44b330db8ea06c5544f1419f4ea8587aa363d10258462bbd7e97f749b, with15 retained proposal/npm source rows. The later corrected source belongs to round13. Exact small proposal/source inputs recover through [the continuation contract](../snapshots/continuation-reviewed-inputs.json.txt); oversized census/raw results remain retained ignored inputs. Original report C:\Users\38909\Documents\github\aoe2\tmp\replay-route6-1001\continuation-proposal\review\REPORT.md,13752bytes/SHA256db505c550087cd69e61dd8f4767d43b45ebde93d42604b81c7f2ad286023443a.

## Reviewers and coverage

/root/runtime_execution_contract_review, independent artifact/source-only review. Read actual A20 receipts as attributed in the full report; launched no command, probe, gate or measurement. This coverage is design only.

## Reports

<!-- BEGIN EXACT ORIGINAL AUTHORED REPORT -->
# Independent controlled npm continuation proposal review

**Conditional design PASS, with two source conditions below. Not runtime authorization and not final executor acceptance.** The proposed two exact npm.cmd shims can bypass the actual bundled-prefix/global-npm path while retaining the real package pretest and whole unit suite. The original proposal must correct the cmd.exe spelling and complete its executable-lookup boundary before its mechanism is represented as ready. The final invoker, input guard and result predicate do not yet exist as a frozen reviewed executor. The human budget decision and independent review of that executor remain separate prerequisites; this report authorizes no additional command or route.

Reviewed proposal: CONTINUATION.md SHA256 `b3a9c0f44b330db8ea06c5544f1419f4ea8587aa363d10258462bbd7e97f749b`. This report binds the original bytes and records conditions rather than silently approving later edits. All seven proposal files and eight cited installed npm source files are retained under `reviewed-proposal/`. `input-receipt.json` SHA256 `3a3432fe72be81ae652d9208bcf9bad08b5fc4bad9c483c00c9e39e17804700b` binds those copies. No proposed script, test, probe, gate or measurement was executed, no private npm config value was read, and no measured-tree or sibling file was changed. This was task-owned artifact review only; no new managed worktree was needed or created.

## Actual baseline remains distinct

The original A20 native command passed, and the reviewer independently read its completed native, test and Job artifacts: native0,570 actual files,4390 cases,4387 passed and3 actual skipped identities, zero failures,264.3966271s native-command wall,278.324s Job elapsed and3203.125s child-inclusive Job CPU. ActiveProcesses was0 and cleanupProof true. Its root npm process CPU was only0.234375s, which illustrates why it cannot stand in for the descendants' full-suite CPU. The three skips are the retained real-CLI integration case, two-player standard-map opening case and six-verb selection overflow case.

The original suite's whole-command runtime-only comparison remains REJECTED because actual pretest loaded Node20-bundled npm10.8.2 prefix/config and AppData npm11.7.0 beyond the frozen inputs. B24 was not run. These source-only proposals cannot repair that past measurement or turn omitted inputs into frozen inputs retroactively. The direct-Vitest focus result remains a separate valid bounded result.

Actual baseline artifact SHA256 values, under the worker's original protocol/suite20 directory, are:

- suite20-native.json: `7206e080c6f0eff1f4962f587c842ea274ddae96e983790479ce201e071e4d34`.
- suite20-tests.json: `6ff0b24c3614247e359f2d8026747243d88075f66cd6614150e28bc1a1d12bd7`.
- job-gate-result.json: `7ed0c19d29c3298767854bf5c2ebf798397dbe8b64209620492dd297cfc0f69c`.

## Shim forwarding and lifecycle behavior

Both proposed npm.cmd files are three lines: disable echo, invoke an absolute quoted arm Node executable plus the same quoted Program Files npm-cli.js with `%*`, then `exit /b %errorlevel%`. The only differing command component is the Node executable. At source level, the direct executable invocation returns before the following line expands the current errorlevel, and that line exits the batch with the same status. There is no intervening command, npm-prefix lookup, npm.cmd recursion or global-prefix fallback. The command target paths containing spaces are quoted. For the fixed literal `run voxel:build` lifecycle use, this is an appropriately small forwarding shim. General arbitrary shell metacharacter handling is not a claim needed for this finite protocol, and actual exit/argv behavior is still unexecuted.

The root commands remain direct selectedNode + sharednpmCli, so the new shim controls the nested package `pretest: npm run voxel:build` boundary that actually escaped. The real voxel freshness script remains in place and runs without --print-root. No test, snapshot serializer, world loop, timeout, pool or source population change is proposed. The two pretest controls exercise this real path without constructing Worlds or collecting the full suite. Frozen freshness and exclusive ownership of the relevant source/dist inputs are prerequisites; any actual build/wait request is a stop, not permission to rebuild a sibling.

Installed npm `node_modules/@npmcli/run-script/lib/make-spawn-args.js:32-47` builds the lifecycle environment and supplies cwd/shell. `set-path.js:19-29` puts every project-to-drive-root node_modules/.bin directory, then npm's node-gyp-bin, before the supplied PATH. Therefore merely putting an owned shim first in the supplied PATH does not make it first in npm's actual command search. The proposal correctly recognizes ancestor .bin precedence; condition CP2 completes that recognition.

## Conditions on the original proposal

**CP1, P2 — freeze native Windows shell spelling.** CONTINUATION.md currently spells the intended environment value `C:/Windows/System32/cmd.exe`. In the pinned npm code, `@npmcli/config/lib/definitions/definitions.js:1903-1914` defines script-shell as a String and passes it through; `lib/commands/run.js:142` supplies that value. `@npmcli/promise-spawn/lib/index.js:82` recognizes cmd only with an initial name or a backslash before cmd.exe. Literal forward-slash spelling therefore reaches the POSIX `-c` branch at lines117-121 instead of the Windows `/d /s /c` branch at lines115-116. Use the exact environment value `C:\Windows\System32\cmd.exe`, or normalize to that native form before use, and bind the actual supplied value in the final receipts. The pinned cmd.exe bytes can stay the same. This is a source-defined parsing behavior; no exploratory command is needed to fix the proposal.

**CP2, P2 — freeze the actual lookup namespace, not five guessed names.** `prepare-census.mjs:17` currently checks only npm, npm.cmd, npm.exe, npm.bat and npm.ps1 in the ancestor .bin directories. It omits cwd lookup, node-gyp-bin and other extensions permitted by the actual PATHEXT. Pinned `which/lib/index.js:18-43` starts Windows lookup at cwd and uses PATHEXT, and `promise-spawn/lib/index.js:101-116` uses command discovery to choose cmd/batch escaping. The final census must bind cwd, the exact PATH/PATHEXT used by both arms, every earlier command-search directory and every eligible npm filename in them. That includes package/ancestor .bin directories, cwd and node-gyp-bin, plus the owned shim directory itself. Require all competing earlier candidates absent and preserve their absence; hash/validate the owned shim and reject unknown additions/reparse changes. Pinned npm's complete package inventory covers node-gyp-bin bytes, but an inventory entry alone does not prove the owned shim wins. The five-name source-only census does not establish this complete negative boundary.

The root has acknowledged both conditions for the content owner. They are conditions on these original reviewed bytes, not a claim that corrected bytes were inspected. A short source-only addendum can bind a corrected proposal; no large new audit or runtime is implied.

## Config and input census assessment

The supplied user.npmrc and global.npmrc files contain only the stated comments and no credentials or behavioral overrides. Explicitly supplying their absolute paths identically on both arms is a sound way to exclude private user/global config from this new measurement. The unchanged pinned npm still loads its builtin npmrc and project config: `@npmcli/config/lib/index.js:245-262,649-678`. Keeping the complete Program Files npm package and the actual project's .npmrc presence/hash bound is therefore necessary. The proposal records the project's .npmrc as absent. Preserve that absence in the eventual execution guard; do not infer it remains absent after later documentation/preparation work.

Controlled rc paths do not by themselves control inherited npm_config_* environment fields. Npm reads those case-insensitively at `config/lib/index.js:342-355`, before file configs. A names-only observation in this review found no inherited npm_config_* or ERRORLEVEL override in the reviewer process, but that is not proof of the future invoker's environment. The final executor must explicitly supply the reviewed config/shell values, freeze the relevant nonsecret environment and reject or clear unapproved npm config overrides identically on both arms. Do not read or print private config values as part of that check. This is an unfinished final-executor binding requirement, not a request for another runtime experiment.

The static input-census has5874 rows. Its package counts are2107 for required Program Files npm11.6.2,1863 for AppData npm11.7.0 and1895 for Node20-bundled npm10.8.2. It also records the two Node binaries, cmd.exe, Node20 npm.cmd, proposed files, the original15,607-row manifest digest,35 currently absent named .bin candidates and the absent local .npmrc. `prepare-census.mjs:8` rejects unexpected non-file/non-directory entries encountered during each npm-package walk. This is a preparation inventory, not a live before/after two-way guard: it writes JSON and neither enforces future absences nor resolves all final runtime-target lookup/canonical roots. The final guard must do that after the target/cwd/environment/protocol are frozen. The preparer itself is bound by this review receipt; it is not one of its own census rows.

**Required versus optional roots:** the only allowed real npm implementation is the complete Program Files npm11.6.2 package, including its builtin config and bundled dependencies. The selected Node binaries, owned shim, native shell and controlled config/lookup inputs are also required. The AppData npm11.7.0 package and Node20-bundled npm10.8.2/prefix/shims are optional guarded observations of previously forbidden paths. Retaining their hashes can make accidental changes detectable, but their presence in a new manifest must never authorize loading them. Once the shims work, neither package is needed to perform the defined commands. Treating all three as equally permitted npm implementations would preserve the original P1 rather than resolve it. Extra optional census/guard cost belongs in the new packet's measured accounting.

## Required actual predicate and bounded next decision

The stated two actual controls followed by one conditional A20/B24 full pair are coherent as a proposed finite budget. They can close the omitted-toolchain boundary only when the eventual predicate verifies what executed. Require nonempty complete observations of each expected root npm invocation, nested shared npm `run voxel:build` and real voxel script without --print-root; selected execPath/version on each observed Node process; the shared CLI's canonical actual argv path; zero forbidden prefix/npx/global/bundled CLI invocations; real freshness-skip stdout; native0; unchanged input population and successful Job/accounting/cleanup receipts. An empty record set, inherited npm_execpath, an expected version string alone or the root command's argv is insufficient.

The retained negative inputs must exercise that same predicate. In particular original record50568 actually invokes bundled npm-prefix.js, while record55872 actually invokes the AppData npm CLI but initially carries the inherited allowed Program Files npm_execpath. Each must independently be rejected from actual argv, even if the environment field looks approved. Record64720 provides the later real freshness-script/global-npm environment corroboration; it must not be the only negative row that makes the check red. These are existing artifact inputs, not new external commands. The two actual approved pretest controls supply the positive evidence; never manufacture a passing synthetic binding instead.

Before any full suite, the final frozen invoker and predicate must be independently inspected and both actual control outputs accepted. Keep new output paths/manifest separate from the rejected original packet. The full pair must retain the exact570 files/4390 identities, original skip policy, full default reporter and JSON error checks,700 phases, cache controls and actual equivalent runtime/core denominator. The unchanged hard1200s Job caps, no-repeat rule and below-A20 full wall/child-inclusive JobCPU predicate stay in force. Capturing forbidden bytes after an arm starts is not a recovery path.

Human approval of this bounded continuation, if obtained, would be approval for new work after the spent extension; it is not inferred from this review. Source preparation, real controls, full-suite acceptance, ordinary verify, final integrated review and hosted acceptance remain distinct. The original A20 comparison remains rejected permanently; a successful new packet would be new evidence. Windows20 hosted coverage remains deliberately absent, and unrelated parity/engine work remains open.

## Exact proposal digests

| Artifact | SHA256 |
| --- | --- |
| CONTINUATION.md | `b3a9c0f44b330db8ea06c5544f1419f4ea8587aa363d10258462bbd7e97f749b` |
| npm20/npm.cmd | `a6ab114beda71dced18716ce9e615173620e1a6e007def6950ebf74bae0de272` |
| npm24/npm.cmd | `966b8ae3667338a2f7db6d84b4fb6aa5fa4660b19c66d2587ced042d7e7b4b82` |
| user.npmrc | `26324cac45a03a9fcf8a187e0e8bc823a4905a4fd0e2c4307b08f4b1cb673a9a` |
| global.npmrc | `184da28e48e56cfd484b4751331b9af5dd0603efb047ffb67e0ee59c4ee6e0e6` |
| prepare-census.mjs | `3cd2696accac2f5a6a2eb88bfad04ce4a22a59c71d6dff2e455c87e98d6ca3aa` |
| input-census.json | `6c1a37a4253ec8a89287665ff8a10fabecfd328868f9caef5e21c1d8e7af7f3d` |

This review ends at the proposal boundary. It does not claim the forthcoming caller/invoker, guard or predicate was implemented, run, accepted or authorized.
<!-- END EXACT ORIGINAL AUTHORED REPORT -->

## Findings and disposition

CP1/P2 backslash shell spelling and CP2/P2 complete cwd/PATH/PATHEXT/node-gyp/ancestor-bin lookup were accepted source conditions. This original conditional design judgment did not accept an executor or authorize runtime. The complete conditions and deferred environment/predicate work remain in the authored report.

## Verification

Static exact-input inspection only; no proposed script/preload/shim/pretest or fullpair executed. Original focusPASS and A20native0/P1controlled-comparison rejection remain unchanged. Complete report is retained once without content/citation normalization; extraction matches actual original bytes.

## Round outcome

Source-only proposal judgment, with no executor acceptance or runtime/budget authorization. Work112 remains blocked pending the new decision; mainWindows/M7/fullparity and21consumer scopes remain OPEN.
