import { rmSync } from 'node:fs';

// `tsc` writes into its outDir without clearing it, so files a build no longer produces survive
// from the previous one. A stale lib/cjs/package.json once hid a broken CJS build.
rmSync(new URL('../lib', import.meta.url), { recursive: true, force: true });
