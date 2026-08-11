// Referenced here rather than in tsconfig, so `src` stays unable to reach Node APIs by accident.
/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * The changelog is hand-written and feeds the GitHub Release notes, so a malformed entry ships.
 * Editing an entry by replacing the heading above it once deleted that heading, folding a whole
 * release into its successor — silently, because the file still rendered.
 */

const changelog = readFileSync(new URL('../CHANGELOG.md', import.meta.url), 'utf8');
const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

const headings = [...changelog.matchAll(/^# \[(?<version>[^\]]+)\]\(.*compare\/v(?<previous>[^.]+\.[^.]+\.[^.]+)\.\.\.v(?<self>[^)]+)\)/gm)].map(
  (m) => ({ version: m.groups!.version, previous: m.groups!.previous, self: m.groups!.self }),
);

const sections = changelog
  .split(/^# /m)
  .slice(1)
  .map((body) => ({ version: body.match(/^\[([^\]]+)\]/)?.[1], body }));

describe('CHANGELOG.md', () => {
  it('has entries at all', () => {
    expect(headings.length).toBeGreaterThan(1);
  });

  it('gives the version in package.json its own entry', () => {
    expect(headings.map((h) => h.version)).toContain(pkg.version);
  });

  it('leads with the version in package.json', () => {
    expect(headings[0]?.version).toBe(pkg.version);
  });

  it('links each heading to its own version', () => {
    for (const { version, self } of headings) expect(self).toBe(version);
  });

  // The check that catches a swallowed heading: if 2.0.1 compares against 2.0.0, then 2.0.0 must
  // have an entry of its own. Deleting it leaves its content orphaned under its successor.
  it('has an entry for every version compared against', () => {
    const present = new Set(headings.map((h) => h.version));
    const oldest = headings[headings.length - 1]?.version;

    for (const { version, previous } of headings) {
      if (version === oldest) continue;
      expect(present, `${version} compares against ${previous}, which has no entry of its own`).toContain(previous);
    }
  });

  it('does not repeat a section title within one entry', () => {
    for (const { version, body } of sections) {
      const titles = [...body.matchAll(/^### (.+)$/gm)].map((m) => m[1]);
      expect(new Set(titles).size, `${version} repeats a section title, so entries have merged`).toBe(titles.length);
    }
  });

  it('has no duplicate version entries', () => {
    const versions = headings.map((h) => h.version);
    expect(new Set(versions).size).toBe(versions.length);
  });
});
