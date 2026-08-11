import { writeFileSync } from 'node:fs';

// The root package.json says `"type": "module"`, which applies to lib/cjs too — without this
// marker Node loads the CommonJS build through the ESM loader and its requires resolve wrongly.
writeFileSync(new URL('../lib/cjs/package.json', import.meta.url), `${JSON.stringify({ type: 'commonjs' }, null, 2)}\n`);
