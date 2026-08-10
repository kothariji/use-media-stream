import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

/**
 * Packs the library and installs it into a scratch project, the way a consumer would.
 *
 * `npm link` and `file:` installs are not equivalent — they skip the `files` field and the
 * packing step, so both of the bugs this package shipped (a CJS build Node loaded as ESM, and
 * extensionless ESM specifiers) survive them. Only the tarball reproduces what npm publishes.
 */

const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const run = (cmd, args, cwd) => execFileSync(cmd, args, { cwd, encoding: 'utf8', stdio: 'pipe' });

const step = (label, fn) => {
  process.stdout.write(`  ${label} ... `);
  try {
    fn();
    console.log('ok');
  } catch (error) {
    console.log('FAILED\n');
    console.error(error.stdout || error.stderr || error.message);
    process.exitCode = 1;
    throw new Error(`${label} failed`);
  }
};

const root = process.cwd();
const scratch = mkdtempSync(join(tmpdir(), 'use-media-stream-verify-'));

try {
  const [{ filename }] = JSON.parse(run(npm, ['pack', '--json', '--pack-destination', scratch], root));
  const tarball = resolve(scratch, filename);
  console.log(`\nverifying ${filename}\n`);

  run(npm, ['init', '-y'], scratch);
  step('install into a scratch project', () => run(npm, ['install', tarball, 'react'], scratch));

  step('require() resolves the CommonJS build', () =>
    run(
      process.execPath,
      ['-e', "const m = require('use-media-stream'); if (typeof m.default !== 'function') throw new Error('no default export')"],
      scratch,
    ),
  );

  step('import resolves the ES module build', () =>
    run(
      process.execPath,
      [
        '--input-type=module',
        '-e',
        "import m, { useMediaStream } from 'use-media-stream'; if (typeof m !== 'function' || typeof useMediaStream !== 'function') throw new Error('missing exports')",
      ],
      scratch,
    ),
  );

  step('types resolve in every module mode', () =>
    run(npm, ['exec', '--yes', '--', '@arethetypeswrong/cli@latest', tarball], root),
  );

  step('package.json passes publint', () => run(npm, ['exec', '--yes', '--', 'publint@latest', tarball], root));

  console.log('\nall good\n');
} finally {
  rmSync(scratch, { recursive: true, force: true });
}
