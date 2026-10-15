#!/usr/bin/env node
// A landing proves that its gate reached its last step on the tree it pushes, and that both test suites finished.
//
//   node scripts/verify-receipt.mjs start            the first step of `npm run verify`
//   node scripts/verify-receipt.mjs write            the last step of `npm run verify`
//   node scripts/verify-receipt.mjs check [<rev>]    before a landing push; <rev> defaults to HEAD
//
// WHY (2026-10-11, defect register entry of that date). A run of `npm run verify` wrote 0 to its exit file
// while its log stopped at browser spec 139 of 238, with no lint and no build. A chain ended through WMI's
// `Win32_Process.Terminate` exits 0, so `npm run verify > log; echo $? > exit` records a pass for a run that
// never finished, and only a reader who read the whole log could tell. A stage's own process ended the same way
// exits 0 too, and the chain goes on past it (work 124 M2).
//
// start  removes the last receipt, the two test suites' last reports and the last bundle (dist/), then records HEAD,
//        HEAD's tree and every path `git status` reports, ignored files aside, in tmp/verify-receipt.start.json. From
//        here until `write` succeeds there is no receipt, so a run whose chain is cut short, or fails, leaves none,
//        rather than the last good run's; and a build ended before it writes leaves the browser suite no bundle to
//        test, so it fails, rather than testing the last one.
// write  runs only as a step of `npm run verify` (npm_lifecycle_event "verify"), reached through `&&` only when
//        every stage before it exited 0. It records the run in tmp/verify-receipt.json and certifies it only if:
//        both suites left their own report of a whole, passing run of the full suite, written during this run
//        (verify-receipt-evidence.mjs); the checkout matched HEAD when the gate started and when it finished (no
//        changed, staged or untracked file outside the ignored ones); and HEAD's tree did not move in between.
//        Otherwise it prints NOT CERTIFIED with the reason, which its record keeps and `check` repeats. A suite that
//        did not show a whole, passing run makes the run not a pass, so `write` exits 1. A checkout that was not
//        clean, or a tree that moved, leaves the stages' verdict standing, so `write` exits 0 then: AGENTS.md runs
//        the gate before a commit, on uncommitted work. Landing is `check`'s question, not the exit code's.
// check  accepts a certified receipt whose tree is <rev>'s tree, or one whose tree differs from <rev>'s only in
//        docs/ and design/spec-final.md, which only the tests in tests/architecture read; those it names, with the
//        command that checks them. The comparison is between trees, not commits, so a receipt survives a rebase
//        onto docs-only commits, the case the landing rule's exception exists for, and a rebase onto code does not.
//        It prints the counts the two suites' own reports gave, to compare with the summaries in the run's log. A
//        receipt of format 1, from before the suites' reports were required, it refuses by name.
//
// Exit codes: 0 done, recorded or accepted, 1 refused or not a pass, 2 usage. The logic is in
// verify-receipt-lib.mjs; this file runs it with no "was I run directly?" guard, because such a guard made the command
// a silent exit-0 no-op when it was reached through a junction (the other scripts use scripts/run-directly.mjs).
//
// BOUND. Only the two test suites leave evidence of their own: content:validate, typecheck, lint and build, if their
// own process is ended from outside, exit 0 and pass (the build that `npm run test:browser` runs first can no longer
// leave an old bundle behind, since `start` removed it). A suite's report is trusted for what it says, so one written
// by hand passes, and so does a report another whole run of that suite writes inside this run's window
// (verify-receipt-evidence.mjs's bound has the cases). The receipt
// binds this repository's tree and nothing else: not ../civ-engine, ../voxel, node_modules, the Node version or the
// machine. It compares the checkout with HEAD at the two ends only, so a change made and undone while the gate ran
// passes. Changes git does not report (skip-worktree, assume-unchanged) pass. Two gate runs in one checkout at once
// share the start record and the reports; the gate lock forbids that. The receipt is a file in an ignored directory:
// it stops accidents, not intent, and anyone can write one by hand. The docs-only exception holds only while nothing
// outside tests/architecture reads docs/ or design/spec-final.md (true on 2026-10-11). `check` reads the receipt of
// the checkout it runs in.

import process from 'node:process';

import { main } from './verify-receipt-lib.mjs';

const result = main(process.argv.slice(2), { cwd: process.cwd(), env: process.env });
if (result.out) process.stdout.write(`${result.out}\n`);
if (result.err) process.stderr.write(`${result.err}\n`);
process.exitCode = result.code;
