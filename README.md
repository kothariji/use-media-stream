<div align="center">

# use-media-stream

**A React hook for `getUserMedia` that cleans up after itself.**

Cameras, microphones, device switching and track muting — without the lifecycle bugs.

[![npm](https://img.shields.io/npm/v/use-media-stream?color=cb3837&logo=npm)](https://www.npmjs.com/package/use-media-stream)
[![CI](https://github.com/kothariji/use-media-stream/actions/workflows/ci.yml/badge.svg)](https://github.com/kothariji/use-media-stream/actions/workflows/ci.yml)
[![dependencies](https://img.shields.io/badge/dependencies-0-brightgreen)](https://www.npmjs.com/package/use-media-stream?activeTab=dependencies)
[![size](https://img.shields.io/npm/unpacked-size/use-media-stream?color=blue)](https://www.npmjs.com/package/use-media-stream)
[![license](https://img.shields.io/npm/l/use-media-stream?color=blue)](./LICENSE)

[**Live demo**](https://stackblitz.com/edit/use-media-stream?file=src/App.tsx) · [Changelog](./CHANGELOG.md) · [Report an issue](https://github.com/kothariji/use-media-stream/issues)

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

<details>
<summary>yarn / pnpm / bun</summary>

```bash
yarn add use-media-stream
pnpm add use-media-stream
bun add use-media-stream
```

</details>

Requires `react >= 16` as a peer dependency. Nothing else.

> ⚠️ **Upgrading from v1?** `stop()` and unmounting now release the stream in cases where they
> previously did not, and nested constraint arrays are replaced rather than concatenated.
> See the [changelog](./CHANGELOG.md) for the full list.

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

Available as a default or named export:

```ts
import useMediaStream from 'use-media-stream';
import { useMediaStream } from 'use-media-stream';
```

## Recipes

<details>
<summary><b>Let the user pick a camera</b></summary>

Device labels are blank until permission is granted, which is why `getMediaDevices()` opens a
stream first. Release it with `stop()` like any other.

```tsx
const { videoInputDevices, selectedVideoTrackDeviceId, getMediaDevices, updateMediaDeviceConstraints } =
  useMediaStream();

useEffect(() => {
  getMediaDevices();
}, [getMediaDevices]);

<select
  value={selectedVideoTrackDeviceId ?? ''}
  onChange={(e) =>
    updateMediaDeviceConstraints({
      constraints: { video: { deviceId: e.target.value } },
      resetStream: true,
    })
  }
>
  {videoInputDevices.map((d) => (
    <option key={d.deviceId} value={d.deviceId}>
      {d.label || d.deviceId}
    </option>
  ))}
</select>;
```

</details>

<details>
<summary><b>A mute button</b></summary>

Muting toggles `track.enabled`. The device stays open, so unmuting is instant and the browser
doesn't re-prompt.

```tsx
const { isAudioMuted, muteAudio, unmuteAudio } = useMediaStream();

<button onClick={isAudioMuted ? unmuteAudio : muteAudio}>
  {isAudioMuted ? 'Unmute' : 'Mute'}
</button>;
```

To actually release the microphone, call `stop()` instead.

</details>

<details>
<summary><b>React to a track dropping out</b></summary>

`isStreaming` flips to `false` on its own if a track ends — someone unplugs the webcam, or the OS
takes the device. The mute flags follow the track in both directions.

```tsx
const { isStreaming, isVideoMuted, addVideoEndedEventListener } = useMediaStream();

useEffect(() => {
  const onEnded = () => console.log('camera went away');
  addVideoEndedEventListener(onEnded);
}, [addVideoEndedEventListener]);
```

Listeners attach to the tracks held *right now*, so re-attach after anything that replaces the
stream.

</details>

<details>
<summary><b>Custom constraints</b></summary>

Merged recursively over the defaults, so overriding `width` keeps `facingMode`.

```tsx
useMediaStream({
  mediaDeviceConstraints: { video: { width: 640, height: 480 } },
});
```

Defaults:

```ts
{
  audio: true,
  video: { facingMode: 'user', width: 1280, height: 720, frameRate: { ideal: 60, min: 10 } },
}
```

</details>

<details>
<summary><b>Next.js / server rendering</b></summary>

Import and render it on the server freely. `isSupported` is `false` there, and nothing touches
`navigator` until you call something.

```tsx
'use client';

const { isSupported, start } = useMediaStream();
if (!isSupported) return <p>Camera not available</p>;
```

Browsers require a user gesture before `getUserMedia` resolves, so `start()` belongs in an event
handler, not an effect.

</details>

## API

### `useMediaStream(props?)`

| Prop                     | Type                             | Description                                                      |
| ------------------------ | -------------------------------- | ---------------------------------------------------------------- |
| `mediaDeviceConstraints` | `MediaStreamConstraints \| null` | Optional. Merged recursively over the defaults shown above.       |

Everything is optional: `useMediaStream()`, `useMediaStream({})` and
`useMediaStream({ mediaDeviceConstraints: … })` are all valid.

### State

| Property                 | Type                  | Description                                             |
| ------------------------ | --------------------- | ------------------------------------------------------- |
| `stream`                 | `MediaStream \| null` | The current stream.                                     |
| `isSupported`            | `boolean`             | Whether `getUserMedia` exists. `false` during SSR.      |
| `isStreaming`            | `boolean`             | Whether a stream started by `start()` is active.        |
| `isAudioMuted`           | `boolean`             | Whether audio tracks are muted.                         |
| `isVideoMuted`           | `boolean`             | Whether video tracks are muted.                         |
| `error`                  | `Error \| null`       | Last error from acquiring a stream or devices.          |
| `getStreamRequest`       | `RequestState`        | `'IDLE' \| 'PENDING' \| 'FULFILLED' \| 'REJECTED'`      |
| `getMediaDevicesRequest` | `RequestState`        | Same, for the device listing.                           |

### Devices

| Property                              | Type                  | Description                                    |
| ------------------------------------- | --------------------- | ---------------------------------------------- |
| `devices`                             | `MediaDeviceInfo[]`   | All devices, once `getMediaDevices()` has run. |
| `audioInputDevices`                   | `MediaDeviceInfo[]`   | Kind `audioinput`.                             |
| `audioOutputDevices`                  | `MediaDeviceInfo[]`   | Kind `audiooutput`.                            |
| `videoInputDevices`                   | `MediaDeviceInfo[]`   | Kind `videoinput`.                             |
| `selectedAudioTrackDeviceId`          | `string \| undefined` | From the live audio track's settings.          |
| `selectedVideoTrackDeviceId`          | `string \| undefined` | From the live video track's settings.          |
| `selectedVideoTrackDeviceWidth`       | `number \| undefined` | Actual width — may differ from what you asked. |
| `selectedVideoTrackDeviceHeight`      | `number \| undefined` | Actual height.                                 |
| `selectedVideoTrackDeviceAspectRatio` | `number \| undefined` | Actual aspect ratio.                           |

### Handlers

| Handler                        | Type                                 | Description                                                                                              |
| ------------------------------ | ------------------------------------ | -------------------------------------------------------------------------------------------------------- |
| `start`                        | `() => Promise<MediaStream \| null>` | Acquires a stream. Resolves to `null` on failure and populates `error`; never throws.                    |
| `stop`                         | `() => void`                         | Stops every track and clears the stream.                                                                 |
| `getMediaDevices`              | `() => Promise<MediaDeviceInfo[]>`   | Lists devices, acquiring a stream first so labels are populated.                                         |
| `updateMediaDeviceConstraints` | `(options) => Promise<void>`         | `{ constraints, resetStream? }`. Merges constraints, and re-acquires the stream if `resetStream` is set. |
| `muteAudio` / `unmuteAudio`    | `() => void`                         | Toggles `enabled` on audio tracks. The device stays open.                                                |
| `muteVideo` / `unmuteVideo`    | `() => void`                         | Toggles `enabled` on video tracks.                                                                       |

### Track events

Every combination of `Video`/`Audio` × `Ended`/`Mute`/`Unmute`, with an `add` and `remove` for
each — twelve functions, all `(fn: EventListenerOrEventListenerObject) => void`:

```
add | remove  +  Video | Audio  +  Ended | Mute | Unmute  +  EventListener
```

e.g. `addVideoEndedEventListener`, `removeAudioUnmuteEventListener`.

### Types

```ts
import type {
  RequestState,
  TrackEvent,
  TrackKind,
  UpdateMediaDeviceConstraintsOptions,
  UseMediaStreamProps,
  UseMediaStreamReturn,
} from 'use-media-stream';

import { REQUEST_STATES, defaultMediaDeviceConstraints } from 'use-media-stream';
```

## Good to know

**The stream is released on unmount.** You only need `stop()` to end one while the component is
still mounted.

**`getMediaDevices()` opens a stream.** Device labels are blank without permission, so it acquires
one to get them. `stop()` releases it like any other.

**Muting isn't stopping.** `muteAudio()` flips `track.enabled` and keeps the device open;
`stop()` releases it and the browser may prompt again next time.

**Referential stability.** Device arrays and handlers keep a stable identity across renders, so
they're safe as `useEffect` dependencies and in `React.memo` children. `start`,
`getMediaDevices` and `updateMediaDeviceConstraints` change only when the constraints or
streaming state they close over change.

**`start()` needs a user gesture.** Browsers require one before granting camera or microphone
access, so call it from an event handler rather than an effect.

## Development

```sh
npm install
npm run typecheck
npm test
npm run test:coverage
npm run build
```

There's a playground for testing against a real camera. It aliases the package straight at `src/`,
so hook edits hot-reload with no build step:

```sh
cd playground && npm install && npm run dev
```

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
