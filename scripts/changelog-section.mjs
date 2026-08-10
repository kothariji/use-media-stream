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

const sectionFor = (wanted) => {
  const start = lines.findIndex((line) => line.startsWith('# ') && line.includes(`[${wanted}]`));
  if (start === -1) return null;

  const rest = lines.slice(start + 1);
  const end = rest.findIndex((line) => line.startsWith('# '));
  return (end === -1 ? rest : rest.slice(0, end)).join('\n').trim();
};

const exact = sectionFor(version);

if (exact) {
  console.log(exact);
} else {
  /**
   * Prereleases have no section of their own — they lead to one. Show the notes for the version
   * they are rehearsing, so the release page says what is actually landing rather than just
   * pointing elsewhere, with a banner making clear this is not the final thing.
   */
  const [base] = version.split('-');
  const banner =
    `> **Pre-release for ${base}.** Published to the \`next\` dist-tag, so \`npm install use-media-stream\`\n` +
    `> is unaffected. The notes below are for ${base} and may still change.\n` +
    `>\n` +
    `> \`\`\`sh\n` +
    `> npm install use-media-stream@${version}\n` +
    `> \`\`\``;

  console.log([banner, sectionFor(base)].filter(Boolean).join('\n\n---\n\n'));
}
