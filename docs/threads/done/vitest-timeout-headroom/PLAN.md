# Vitest timeout headroom plan

1. Record the full-suite timeout failures and isolated rerun evidence.
2. Raise the watch-tower utility test cap from 15s to 30s and the first blacksmith Forging progression cap from 45s to 60s.
3. Update the existing Vitest debugging note and devlog.
4. Run mandatory review on the scoped diff.
5. Re-run `npm.cmd test`, `npm.cmd run typecheck`, `npm.cmd run lint`, and `npm.cmd run build`.
6. Move this thread to `docs/threads/done/vitest-timeout-headroom/` after review closure.
