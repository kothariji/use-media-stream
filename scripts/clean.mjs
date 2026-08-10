import { rmSync } from 'node:fs';

/**
 * `tsc` writes into its outDir without clearing it, so files a build no longer produces survive
 * from the previous one. That hid a broken CJS build behind a stale `lib/cjs/package.json`.
 */
rmSync(new URL('../lib', import.meta.url), { recursive: true, force: true });
