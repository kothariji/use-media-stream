// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import react from '@astrojs/react';
import starlightThemeFlexoki from 'starlight-theme-flexoki';

const repo = 'https://github.com/kothariji/use-media-stream';

export default defineConfig({
  site: 'https://kothariji.github.io',
  base: '/use-media-stream',
  // Internal links are relative, which keeps them independent of `base` — but only resolves
  // correctly at URLs ending in a slash. GitHub Pages 301s to add it; this makes dev do the same.
  trailingSlash: 'always',
  integrations: [
    react(),
    starlight({
      title: 'use-media-stream',
      description: 'A React hook for getUserMedia that cleans up after itself.',
      plugins: [starlightThemeFlexoki()],
      social: [
        { icon: 'github', label: 'GitHub', href: repo },
        { icon: 'npm', label: 'npm', href: 'https://www.npmjs.com/package/use-media-stream' },
      ],
      editLink: { baseUrl: `${repo}/edit/master/docs/` },
      lastUpdated: true,
      customCss: ['./src/styles/wide-page.css'],
      sidebar: [
        {
          label: 'Start here',
          items: [
            { slug: 'installation' },
            { slug: 'quick-start' },
          ],
        },
        {
          label: 'Guides',
          items: [
            { slug: 'guides/streams' },
            { slug: 'guides/devices' },
            { slug: 'guides/muting' },
            { slug: 'guides/constraints' },
            { slug: 'guides/server-rendering' },
          ],
        },
        {
          label: 'Reference',
          items: [
            { slug: 'reference/api' },
            { slug: 'reference/migrating-from-v1' },
          ],
        },
        { label: 'Live demo', slug: 'demo' },
      ],
    }),
  ],
  vite: {
    resolve: {
      // The demo runs the package source, so edits to the hook hot-reload here.
      alias: {
        'use-media-stream': new URL('../src/index.ts', import.meta.url).pathname,
      },
      // Belt and braces: the workspace already hoists react, but installing inside docs/ instead
      // of at the root recreates a local copy, and two Reacts give `_jsxDEV is not a function`.
      dedupe: ['react', 'react-dom'],
    },
  },
});
