import { writeFileSync } from 'node:fs';

/**
 * The root package.json says `"type": "module"`, and that applies to every .js in the package —
 * including the CommonJS build. Without this marker Node loads lib/cjs through the ESM loader
 * and its internal requires resolve against the wrong base.
 *
 * ponytail: a file rather than `cp`, only because `cp` is not portable to Windows.
 */
writeFileSync(new URL('../lib/cjs/package.json', import.meta.url), `${JSON.stringify({ type: 'commonjs' }, null, 2)}\n`);
