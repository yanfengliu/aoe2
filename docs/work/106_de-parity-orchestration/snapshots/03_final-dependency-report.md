# Work 106 independent dependency follow-up

Author: `/root/final_integration_review`. Read-only dependency review of the integrated working tree at `C:/Users/38909/Documents/github/aoe2-worktrees/parity-integration-0930`, 2026-09-30 local date / 2026-10-01 UTC. The only authored output is this explicitly authorized ignored report. No source, lock, package metadata, index or canonical document was edited.

**Verdict: accept the four-package lock repair within its stated high-audit scope.** I found no blocking lock, integrity, range, package-contract or private-installation defect. One low-severity evidence-description correction remains. This is not full runtime, main, remote or milestone acceptance.

## Exact reviewed input

- Preserved integration preimage: `tmp/parity-106/dependency-lock-preimage.json`, SHA-256 `edb642389d6a9b4ab6c289e35bff6a3091ea0f9486181386139818878d01b74a`.
- Final `package-lock.json`: SHA-256 `d0ab92d91f3210f904da14fdf3f0aa7be62a990947e1b9d3b3d55ef6f1d42581`, 146,755 bytes.
- Unchanged integration `package.json`: SHA-256 `54a99d265626f4b61dad8bdb84958631c44b581a3a2bf14b9e064b8f5cf8b701`.
- Both the private app's package and lock match these integration bytes. Game version remains 0.3.242 and linked engine metadata remains 2.4.2.
- Evidence owner: `/root/gameplay`, under `C:/Users/38909/Documents/github/aoe2-worktrees/parity-gameplay-0930/tmp/parity-106/dependencies/`. Root's copied manifests and fresh audit artifacts were also read from integration `tmp/parity-106/dependencies/`.

I independently parsed and recursively compared the full preimage and final lock. There are 297 package identities in each, no added or removed package keys, and exactly 12 changed scalar fields: version, resolved URL and integrity for each of four existing rows. All other parsed fields, including root metadata and dependency ranges, are equal.

| Final lock location | Change | Existing consuming range |
|---|---|---|
| [package-lock.json:1946](C:/Users/38909/Documents/github/aoe2-worktrees/parity-integration-0930/package-lock.json:1946) | brace-expansion 1.1.18 → 1.1.21 | minimatch: `^1.1.7` |
| [package-lock.json:1657](C:/Users/38909/Documents/github/aoe2-worktrees/parity-integration-0930/package-lock.json:1657) | nested brace-expansion 5.0.9 → 5.0.12 | typescript-estree's minimatch: `^5.0.5` |
| [package-lock.json:2645](C:/Users/38909/Documents/github/aoe2-worktrees/parity-integration-0930/package-lock.json:2645) | js-yaml 4.3.1 → 4.3.2 | game devDependency: `^4.3.1`; @eslint/eslintrc: `^4.1.1` |
| [package-lock.json:4019](C:/Users/38909/Documents/github/aoe2-worktrees/parity-integration-0930/package-lock.json:4019) | undici 7.29.0 → 7.29.1 | jsdom: `^7.25.0` |

These targets satisfy the existing ranges. The initial audit's affected ranges end at these patched versions for the remaining high advisories. No Vitest major migration, override, new edge or package.json range change is introduced.

## Finding

**DEP-R1 — P3, documentation: the scope description incorrectly calls all four rows transitive.**

Location: [product-manifest.json:6](C:/Users/38909/Documents/github/aoe2-worktrees/parity-integration-0930/tmp/parity-106/dependencies/product-manifest.json:6). The same description appears in root's dependency adoption record and the manifest generator.

Trigger: compare that description with [package.json:59](C:/Users/38909/Documents/github/aoe2-worktrees/parity-integration-0930/package.json:59). js-yaml is an explicit game development dependency, as the initial audit also records with `isDirect: true`. It is additionally consumed transitively by ESLint.

Impact: the wording understates direct tooling-dependency scope. The lock repair itself is authorized, compatible and unchanged by this distinction.

Correction: describe the final canonical outcome as four existing development-package resolution patches: three transitive rows plus the direct js-yaml development dependency's locked patch. Preserve original evidence identities; qualify the old wording rather than silently changing hash-bound artifacts. No additional runtime check is needed for this wording correction.

## Registry, tarball and installed-byte coverage

I read all four retained exact-version registry manifests and independently recomputed their SHA-256 values: brace-expansion 1.1.21 `b1b4762a8423d2637ea84e8e77f356cce6fd41642ff2e0a2091df01dc8bc66e7`; brace-expansion 5.0.12 `5421e68ea58a0286041e3f11998da4fa44055026b11c527cc14ec74895b58929`; js-yaml 4.3.2 `970a78cb315f1ce5f66885117f37a28e90e43ad7150fe172e826e87a11aca06e`; undici 7.29.1 `685384f6b29949d971a2b3fe0a5460f7c87ee30bdc01471ec81d58d237dfab7f`.

For every package, the retained tarball's computed SHA-512 equals both registry `dist.integrity` and final lock integrity. Its registry tarball URL equals the final resolved URL. Tarball sizes are respectively 7,924, 12,620, 227,545 and 400,243 bytes. I decompressed and read their tar entries in memory without extracting files. All 263 regular packaged files (4 + 13 + 36 + 210) match current installed bytes; no mismatches or missing packaged files were found. The four packaged package.json contracts also agree with retained registry and installed metadata.

Dependencies, optional dependencies, peer dependencies, peer metadata, engines, bin, license and funding are unchanged against the preimage rows. None of the four published packages declares preinstall/install/postinstall hooks. This does not establish the safety or execution of every lifecycle hook elsewhere in the game's dependency tree.

All four rows are development dependencies. brace-expansion 5.0.12 keeps `engines.node: 20 || >=22`; undici 7.29.1 keeps `>=20.18.1`. The other two declare no Node floor in the inspected metadata. These patches introduce no new engine constraint: local Node 24.12.0 satisfies them, as do Node 22 and sufficiently recent Node 20 (at least 20.18.1 for undici). The actual workflows request Node 20 for CI and Node 22 for the corpus; I read those declarations rather than assuming .nvmrc governs them. No Node 20/22 runtime execution was performed by this reviewer, and this is not a claim that every historical Node 20 point release works.

## Installation, wrappers and audit evidence

Private install manifest SHA-256 `2cba53fd8ab7a24d495d23785e626e322cdfbbb5da46e4eaea866098dbb63e75` matches the product handoff. I independently hashed all 694 listed wrapper files and checked sizes and recorded mtimes: zero mismatches. The civ-engine wrapper contains package metadata plus 372 dist files; voxel contains package metadata plus 320 dist files. Their only top-level entries are package.json and dist. Versions are 2.4.2 and 1.2.0. No sibling source or build configuration is present in those wrappers.

The integration node_modules junction, both local package links and the private peer-resolution junction resolve to the stated owned mirror targets. The mirror package and lock exactly match the reviewed integration inputs. The maintained voxel freshness script reads the actual linked package and compares package/source mtimes with dist; the retained execution proof reports its up-to-date skip. I read that script and confirmed the recorded wrapper mtimes fit the skip condition. I did not execute the script or build either sibling.

The retained npm ci log reports 219 packages installed. I read the installed smoke script and result: both brace-expansion generations, js-yaml parsing, undici's fetch export and the engine/voxel exports are covered. Current package metadata and all packaged bytes independently confirm the four installed versions. The direct installed tree and patched-family tree artifacts contain no error or problems entries.

The baseline and final full locktree JSON both contain ELSPROBLEMS and exactly the same 20 sorted missing linked-sibling development requirements. I independently compared those lists. Both whole-locktree checks remain failed, not green; they are inherited relative to this four-row repair. The narrower successful installed trees do not establish installed sibling development environments.

I read the initial audit, final private-input audits and root's fresh integrated audits. Initial audit: three high families plus three moderate entries. Both final full audit artifacts: zero high/critical, three moderate development entries (@humanfs/node, @vitest/mocker, vitest). Both final production artifacts: zero vulnerabilities. The retained initial advisory ranges exclude all four final package versions. The three moderate entries remain visible and unresolved; the reported Vitest remedy is a major migration. Root and worker report actual high-audit command exits of zero; I independently checked the returned audit contents but did not run an audit.

Evidence bound: `freeze-proof.mjs` verifies artifact contents but writes several historical command-exit labels as literals, including privateCiExit and installedSmokeExit. Therefore this review does not treat those labels as an independently captured process transcript. The handoff attributes the original command outcomes to the worker; the current installed bytes, tree artifacts and audits provide the independently inspected evidence. Freshness is different: its status is read from the subprocess result in that script. No process success is inferred merely from a green prose summary.

## Acceptance boundary

The four registry resolutions are exact and integrity-bound, and the private Node 24 installation is consistent with the reviewed lock. Full reproducibility still requires the recorded local file-dependency artifacts; the existing remote rolling engine-dist URL is outside this lock patch and is not made immutable by it. The private npm ci used --ignore-scripts, so it is not evidence that all default npm ci lifecycle behavior or the game runtime gate has executed successfully.

This reviewer ran only filesystem/Git reads, JSON comparisons, in-memory archive reads and hashes. No install, package update, network fetch, test, audit command, game gate, browser, server, external reviewer or sibling build ran. No subagent was created. Only this ignored authored report was written.

Dependency acceptance does not close FINAL-R1's visual supplement, FINAL-R2's active-status correction, final full verification, representative play, committed-source binding, main/push/remote acceptance or cleanup. Existing CL-4/M7 and broader DE parity work remain open. Root owns those remaining boundaries.
