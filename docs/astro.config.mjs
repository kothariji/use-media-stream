// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import react from '@astrojs/react';
import starlightThemeFlexoki from 'starlight-theme-flexoki';

const repo = 'https://github.com/kothariji/use-media-stream';

export default defineConfig({
  site: 'https://kothariji.github.io',
  base: '/use-media-stream',
  /**
   * Internal links are relative, which is what keeps them independent of `base`. That only holds
   * at URLs ending in a slash: from `/use-media-stream` rather than `/use-media-stream/`, a link
   * to `./installation/` resolves to `/installation/` and 404s.
   *
   * GitHub Pages already 301s every path to add the slash, so production was never affected — but
   * the dev server serves both happily, so the breakage only showed up locally. This makes dev
   * agree with production instead of being more permissive than it.
   */
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
      /**
       * The demo runs the real source rather than the published package, so edits to the hook
       * hot-reload here — the same trick the standalone playground used before it moved in.
       */
      alias: {
        'use-media-stream': new URL('../src/index.ts', import.meta.url).pathname,
      },
    },
  },
});
