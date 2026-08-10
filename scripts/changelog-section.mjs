import { readFileSync } from 'node:fs';

/**
 * Prints the CHANGELOG section for one version, for use as GitHub Release notes.
 *
 * Keeps CHANGELOG.md the single source: the release page is generated from it rather than
 * written twice and left to drift.
 *
 * ponytail: a line scan, not a markdown parser. Sections start with `# ` and run to the next
 * one, which is the whole format. If the changelog ever grows nested `# ` headings, parse it.
 */
const version = process.argv[2];
if (!version) throw new Error('usage: node scripts/changelog-section.mjs <version>');

const lines = readFileSync(new URL('../CHANGELOG.md', import.meta.url), 'utf8').split('\n');
const start = lines.findIndex((line) => line.startsWith('# ') && line.includes(`[${version}]`));

if (start === -1) {
  // Prereleases deliberately have no section of their own; they point at the version they lead to.
  const [base] = version.split('-');
  console.log(
    `Pre-release for ${base}. See [CHANGELOG.md](https://github.com/kothariji/use-media-stream/blob/master/CHANGELOG.md) for what is landing.\n\n` +
      `\`\`\`sh\nnpm install use-media-stream@${version}\n\`\`\``,
  );
} else {
  const rest = lines.slice(start + 1);
  const end = rest.findIndex((line) => line.startsWith('# '));
  console.log(
    (end === -1 ? rest : rest.slice(0, end))
      .join('\n')
      .trim(),
  );
}
