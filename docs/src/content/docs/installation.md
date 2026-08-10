---
title: Installation
description: Install use-media-stream, and what to know if you are upgrading from v1.
sidebar:
  order: 1
---

```sh
npm install use-media-stream
```

```sh
# or
yarn add use-media-stream
pnpm add use-media-stream
bun add use-media-stream
```

That's it. The package has **zero runtime dependencies** — `react >= 16` as a peer dependency is
the only thing it expects, and you already have that.

## What you get

The package ships both module formats with types for each, so it works whether your project is
ESM, CommonJS, or bundled:

```js
import useMediaStream from 'use-media-stream';   // ESM
const useMediaStream = require('use-media-stream'); // CommonJS
```

It is published with [provenance](https://docs.npmjs.com/generating-provenance-statements), so you
can verify the tarball on npm was built by the repository's release workflow:

```sh
npm audit signatures
```

## Requirements

| | |
|---|---|
| React | `>= 16` (peer dependency) |
| Node | `>= 18`, only if you render server-side |
| Browser | Anything with [`getUserMedia`](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia) — every current browser |

`getUserMedia` requires a **secure context**, so the camera works on `https://` and on
`localhost`, but not on a plain `http://` origin.

## Upgrading from v1

v2 is a correctness release. The API is unchanged apart from additions, but the lifecycle fixes
change behaviour by definition — two of them turn the camera off in cases where v1 left it on.

See [Migrating from v1](../reference/migrating-from-v1/) for the full list. The short version:

- `stop()` releases **any** stream the hook holds, not just one started by `start()`
- Unmounting releases the stream
- `error` is `Error | null`, was `unknown`
- Request states are a union, were `string`

## Next

- [Quick start](../quick-start/) — a working camera in about fifteen lines
- [Live demo](../demo/) — every function wired to a real camera
