// Whether the module at `moduleUrl` is the script node was asked to run, so that a script can also be imported (by
// its tests, say) without running.
//
// WHY (work 124 M2). Every script here that had such a guard wrote it as
// `import.meta.url === pathToFileURL(process.argv[1]).href`. That compares the real path Node loaded the module from
// with the path as typed, and through a junction or a symlink the two differ, so the script exited 0 having done
// nothing: `npm run ci:status`, the CI headroom judges and verify-receipt's first version all read as passes that
// way. Here both sides are resolved to their real paths first. tests/scripts/runDirectly.test.ts refuses the old
// comparison in every script under scripts/, and runs each script that uses this helper through a junction.
//
// BOUND. A path is resolved by the operating system's realpath, or by Node's own (which builds `import.meta.url`)
// where the first fails, as it can on some volumes; one that neither resolves (it does not exist) is compared as
// written. On Windows the comparison ignores case, as the file system does.

import { realpathSync } from 'node:fs';
import { resolve } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const real = (path) => {
  try {
    return realpathSync.native(path);
  } catch {
    try {
      return realpathSync(path);
    } catch {
      return resolve(path);
    }
  }
};

/**
 * @param {string} moduleUrl the caller's `import.meta.url`
 * @param {string | undefined} [scriptPath] the script node was asked to run; defaults to `process.argv[1]`
 * @returns {boolean}
 */
export function runDirectly(moduleUrl, scriptPath = process.argv[1]) {
  if (!scriptPath) return false;
  const asked = real(scriptPath);
  const self = real(fileURLToPath(moduleUrl));
  return process.platform === 'win32' ? asked.toLowerCase() === self.toLowerCase() : asked === self;
}
