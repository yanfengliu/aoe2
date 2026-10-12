#!/usr/bin/env node
// A landing proves that its gate reached its last step on the tree it pushes.
//
//   node scripts/verify-receipt.mjs start            the first step of `npm run verify`
//   node scripts/verify-receipt.mjs write            the last step of `npm run verify`
//   node scripts/verify-receipt.mjs check [<rev>]    before a landing push; <rev> defaults to HEAD
//
// WHY (2026-10-11, defect register entry of that date). A run of `npm run verify` wrote 0 to its exit file
// while its log stopped at browser spec 139 of 238, with no lint and no build. A chain ended through WMI's
// `Win32_Process.Terminate` exits 0, so `npm run verify > log; echo $? > exit` records a pass for a run that
// never finished, and only a reader who read the whole log could tell.
//
// start  removes the last receipt, then records HEAD, HEAD's tree and every path `git status` reports, ignored
//        files aside, in tmp/verify-receipt.start.json. From here until `write` succeeds there is no receipt, so a
//        run whose chain is cut short, or fails, leaves none, rather than the last good run's.
// write  runs only as a step of `npm run verify` (npm_lifecycle_event "verify"), reached through `&&` only when
//        every stage before it exited 0. It records the run in tmp/verify-receipt.json and certifies it only if the
//        checkout matched HEAD when the gate started and when it finished (no changed, staged or untracked file
//        outside the ignored ones), and HEAD's tree did not move in between. Otherwise it does not certify the run:
//        it prints NOT CERTIFIED with the reason, which its record keeps and `check` repeats, and still exits 0, so
//        that the exit code of `npm run verify` keeps saying whether every stage exited 0 (AGENTS.md runs the gate
//        before a commit, on uncommitted work). Landing is `check`'s question, not the exit code's.
// check  accepts a certified receipt whose tree is <rev>'s tree, or one whose tree differs from <rev>'s only in
//        docs/ and design/spec-final.md, which only the tests in tests/architecture read; those it names, with the
//        command that checks them. The comparison is between trees, not commits, so a receipt survives a rebase
//        onto docs-only commits, the case the landing rule's exception exists for, and a rebase onto code does not.
//
// Exit codes: 0 done, recorded or accepted, 1 refused, 2 usage. The logic is in verify-receipt-lib.mjs; this file runs it
// with no "was I run directly?" guard, because such a guard made the command a silent exit-0 no-op when it was
// reached through a junction.
//
// BOUND. A receipt proves that the chain reached its last step with every stage exiting 0, not that every stage
// finished its work. A stage's own process ended through WMI also exits 0, so the chain goes on and `write`
// certifies the run: measured on 2026-10-12 by ending a stage's process in a scratch chain (gate-proofs.md), and
// queued in docs/learning/lessons.md with the gate that will close it. The receipt binds this repository's tree and
// nothing else: not ../civ-engine, ../voxel, node_modules, the Node version or the machine. It compares the
// checkout with HEAD at the two ends only, so a change made and undone while the gate ran passes. Changes git does
// not report (skip-worktree, assume-unchanged) pass. Two gate runs in one checkout at once share the start record;
// the gate lock forbids that. The receipt is a file in an ignored directory: it stops accidents, not intent, and
// anyone can write one by hand. The docs-only exception holds only while nothing outside tests/architecture reads
// docs/ or design/spec-final.md (true on 2026-10-11). `check` reads the receipt of the checkout it runs in.

import process from 'node:process';

import { main } from './verify-receipt-lib.mjs';

const result = main(process.argv.slice(2), { cwd: process.cwd(), env: process.env });
if (result.out) process.stdout.write(`${result.out}\n`);
if (result.err) process.stderr.write(`${result.err}\n`);
process.exitCode = result.code;
