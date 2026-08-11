<div align="center">

# use-media-stream

**A React hook for `getUserMedia` that cleans up after itself.**

Cameras, microphones, device switching and track muting — without the lifecycle bugs.

[![npm](https://img.shields.io/npm/v/use-media-stream?color=cb3837&logo=npm)](https://www.npmjs.com/package/use-media-stream)
[![CI](https://github.com/kothariji/use-media-stream/actions/workflows/ci.yml/badge.svg)](https://github.com/kothariji/use-media-stream/actions/workflows/ci.yml)
[![dependencies](https://img.shields.io/badge/dependencies-0-brightgreen)](https://www.npmjs.com/package/use-media-stream?activeTab=dependencies)
[![size](https://img.shields.io/npm/unpacked-size/use-media-stream?color=blue)](https://www.npmjs.com/package/use-media-stream)
[![license](https://img.shields.io/npm/l/use-media-stream?color=blue)](./LICENSE)

### [📖 Documentation](https://kothariji.github.io/use-media-stream/) · [🎥 Live demo](https://kothariji.github.io/use-media-stream/demo/) · [Changelog](./CHANGELOG.md)

</div>

---

Getting a camera stream is one line. Getting it to *stop* is where the bugs are — a component
unmounts and the recording light stays on, a device list leaves an orphaned stream open, a track
goes silent and your UI never notices.

This hook owns that lifecycle so you don't have to.

- 🎥 **Start, stop and swap devices** with a small, predictable API
- 🧹 **Releases tracks on unmount** — no lingering camera light
- 🎚️ **Mute without dropping the device**, so unmuting is instant
- 🔌 **Device enumeration** split by kind, with live track settings
- 🖥️ **Server-safe** — renders in Next.js and Remix without a `typeof window` dance
- 📦 **Zero runtime dependencies**, ESM + CJS, typed, published with provenance

## Install

```bash
npm install use-media-stream
```

Requires `react >= 16` as a peer dependency. Nothing else.

> ⚠️ **Upgrading from v1?** `stop()` and unmounting now release the stream in cases where they
> previously did not. See [Migrating from v1](https://kothariji.github.io/use-media-stream/reference/migrating-from-v1/).

## Quick start

```tsx
import { useEffect, useRef } from 'react';
import useMediaStream from 'use-media-stream';

function Camera() {
  const { stream, isStreaming, error, start, stop } = useMediaStream();
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current) videoRef.current.srcObject = stream;
  }, [stream]);

  if (error) return <p>{error.message}</p>;

  return (
    <>
      <video ref={videoRef} autoPlay playsInline muted />
      <button onClick={isStreaming ? stop : start}>{isStreaming ? 'Stop' : 'Start'}</button>
    </>
  );
}
```

That's the whole thing. Navigate away mid-stream and the camera turns off on its own.

## Documentation

Full guides and API reference at **[kothariji.github.io/use-media-stream](https://kothariji.github.io/use-media-stream/)**:

| | |
| --- | --- |
| [Quick start](https://kothariji.github.io/use-media-stream/quick-start/) | A working camera in about fifteen lines |
| [Streams and lifecycle](https://kothariji.github.io/use-media-stream/guides/streams/) | When the stream is released, and by what |
| [Devices](https://kothariji.github.io/use-media-stream/guides/devices/) | Listing and switching cameras and microphones |
| [Muting and track events](https://kothariji.github.io/use-media-stream/guides/muting/) | Why muting isn't stopping |
| [Constraints](https://kothariji.github.io/use-media-stream/guides/constraints/) | Resolution, frame rate, and how merging works |
| [Server rendering](https://kothariji.github.io/use-media-stream/guides/server-rendering/) | Next.js, Remix, static export |
| [API reference](https://kothariji.github.io/use-media-stream/reference/api/) | Everything the hook returns |
| [Live demo](https://kothariji.github.io/use-media-stream/demo/) | Every function, wired to your camera |

## Development

```sh
npm install          # one install at the root; docs/ is an npm workspace
npm run typecheck
npm test
npm run test:coverage
npm run build
```

The docs site doubles as the development playground — it imports the hook from `src/`, so edits
hot-reload against a real camera:

```sh
npm run docs         # dev server, http://localhost:4321/use-media-stream/
npm run docs:stop    # it runs detached, so it needs stopping explicitly
npm run docs:build
```

> Install from the **root**, not from inside `docs/`. The demo imports the hook from `src/`, which
> resolves its dependencies from the root — a separate install in `docs/` gives you two copies of
> React in one page.

### Verifying the published output

```sh
npm run verify:package
```

Packs the library and installs it into a scratch project the way a consumer would, then checks
`require()` resolves the CJS build, `import` resolves the ESM one, types resolve in every module
mode (`attw`), and `package.json` is sane (`publint`).

Worth running before any release. `npm link` and `file:` installs are **not** equivalent — they
skip packing and the `files` field, and both of the packaging bugs this library once shipped
survive them. CI runs this same script.

### Releasing

```sh
npm version <patch|minor|major>
git push --follow-tags
```

A `v*` tag runs the full suite and publishes with provenance. Prereleases go to the `next`
dist-tag, so `npm install use-media-stream` is unaffected.

## Contributing

Issues and pull requests welcome — [open an issue](https://github.com/kothariji/use-media-stream/issues)
to start.

## License

[MIT](./LICENSE) © [Dhruv Kothari](https://github.com/kothariji)
