# Use Media Stream

[use-media-stream](https://www.npmjs.com/package/use-media-stream) is a React hook for working with `getUserMedia`. It handles acquiring and releasing streams, listing devices, muting tracks, and updating constraints, and it cleans up after itself when your component unmounts.

Ships ESM and CommonJS, safe to server-render, published with provenance. **Zero runtime dependencies.**

<a href="https://www.npmjs.com/package/use-media-stream">
    <img src="https://img.shields.io/npm/v/use-media-stream.svg" alt="npm package" />
</a>

![GitHub License](https://img.shields.io/github/license/kothariji/use-media-stream?q=1)

### Demo - [Link](https://stackblitz.com/edit/use-media-stream?file=src/App.tsx)

## Installation

```bash
npm install use-media-stream
# or
yarn add use-media-stream
# or
pnpm add use-media-stream
```

Requires `react >= 16` as a peer dependency. Nothing else.

> **Upgrading from v1?** `stop()` and unmounting now release the stream in cases where they
> previously did not, and nested constraint arrays are replaced rather than concatenated.
> See the [changelog](./CHANGELOG.md) for the full list of breaking changes.

## Usage

```tsx
import { useRef, useEffect } from 'react';
import useMediaStream from 'use-media-stream';

function Camera() {
  const { stream, isStreaming, error, start, stop, muteAudio } = useMediaStream();
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current) videoRef.current.srcObject = stream;
  }, [stream]);

  if (error) return <p>{error.message}</p>;

  return (
    <>
      <video ref={videoRef} autoPlay playsInline muted />
      <button onClick={isStreaming ? stop : start}>{isStreaming ? 'Stop' : 'Start'}</button>
      <button onClick={muteAudio}>Mute</button>
    </>
  );
}
```

The hook is available as both a default and a named export:

```ts
import useMediaStream from 'use-media-stream';
import { useMediaStream } from 'use-media-stream';
```

> **The stream is released automatically when your component unmounts.** You only need to call
> `stop()` to end a stream while the component is still mounted.

### Server rendering

Safe to import and render on the server. `isSupported` is `false` there, and nothing touches
`navigator` until you call something, so Next.js, Remix and friends render it without a
`typeof window` dance:

```tsx
const { isSupported, start } = useMediaStream();
// isSupported is false during SSR and on browsers without getUserMedia
if (!isSupported) return <p>Camera not available</p>;
```

You still need a user gesture to call `start()` — browsers require one for `getUserMedia`.

## Props

| Prop                     | Type                              | Description                                            |
| ------------------------ | --------------------------------- | ------------------------------------------------------ |
| `mediaDeviceConstraints` | `MediaStreamConstraints \| null`  | Optional. Merged recursively over the defaults below.  |

Both the argument and the field are optional, so `useMediaStream()`, `useMediaStream({})` and
`useMediaStream({ mediaDeviceConstraints: { video: { width: 640 } } })` are all valid. Merging is
recursive, so overriding `video.width` leaves the default `video.facingMode` in place.

<details>
<summary>Default constraints</summary>

```ts
{
  audio: true,
  video: {
    facingMode: 'user',
    width: 1280,
    height: 720,
    frameRate: { ideal: 60, min: 10 },
  },
}
```

</details>

## Returns

### State

| Property                            | Type                          | Description                                              |
| ----------------------------------- | ----------------------------- | -------------------------------------------------------- |
| `stream`                            | `MediaStream \| null`         | The current media stream.                                |
| `isSupported`                       | `boolean`                     | Whether the browser supports `getUserMedia`.             |
| `isStreaming`                       | `boolean`                     | Whether a stream started by `start()` is active.         |
| `isAudioMuted`                      | `boolean`                     | Whether audio tracks are muted.                          |
| `isVideoMuted`                      | `boolean`                     | Whether video tracks are muted.                          |
| `error`                             | `Error \| null`               | The last error from acquiring a stream or devices.       |
| `getStreamRequest`                  | `RequestState`                | `'IDLE' \| 'PENDING' \| 'FULFILLED' \| 'REJECTED'`       |
| `getMediaDevicesRequest`            | `RequestState`                | Same, for the device listing.                            |

### Devices

| Property                            | Type                | Description                            |
| ----------------------------------- | ------------------- | -------------------------------------- |
| `devices`                           | `MediaDeviceInfo[]` | All devices, once `getMediaDevices()` has run. |
| `audioInputDevices`                 | `MediaDeviceInfo[]` | Devices of kind `audioinput`.          |
| `audioOutputDevices`                | `MediaDeviceInfo[]` | Devices of kind `audiooutput`.         |
| `videoInputDevices`                 | `MediaDeviceInfo[]` | Devices of kind `videoinput`.          |
| `selectedAudioTrackDeviceId`        | `string \| undefined` | From the live audio track's settings. |
| `selectedVideoTrackDeviceId`        | `string \| undefined` | From the live video track's settings. |
| `selectedVideoTrackDeviceWidth`     | `number \| undefined` | Actual width, which may differ from the requested one. |
| `selectedVideoTrackDeviceHeight`    | `number \| undefined` | Actual height.                         |
| `selectedVideoTrackDeviceAspectRatio` | `number \| undefined` | Actual aspect ratio.                 |

### Handlers

| Handler                        | Type                                                | Description                                          |
| ------------------------------ | --------------------------------------------------- | ---------------------------------------------------- |
| `start`                        | `() => Promise<MediaStream \| null>`                | Acquires a stream. Resolves to `null` on failure and populates `error`; it never throws. |
| `stop`                         | `() => void`                                        | Stops every track and clears the stream.             |
| `getMediaDevices`              | `() => Promise<MediaDeviceInfo[]>`                  | Lists devices. Acquires a stream first, because labels stay blank until permission is granted. Release it with `stop()`. |
| `updateMediaDeviceConstraints` | `(options) => Promise<void>`                        | `{ constraints, resetStream? }`. Merges the constraints, and re-acquires the stream if `resetStream` is true. |
| `muteAudio` / `unmuteAudio`    | `() => void`                                        | Toggles `enabled` on audio tracks. The device stays open. |
| `muteVideo` / `unmuteVideo`    | `() => void`                                        | Toggles `enabled` on video tracks.                   |

### Track events

Attach your own listeners to the tracks the hook currently holds. They apply to the live tracks
only, so re-attach after anything that replaces the stream.

Every combination of `Video`/`Audio` × `Ended`/`Mute`/`Unmute`, with an `add`/`remove` pair each —
twelve functions, all `(fn: EventListenerOrEventListenerObject) => void`:

```
add|remove + Video|Audio + Ended|Mute|Unmute + EventListener
```

e.g. `addVideoEndedEventListener`, `removeAudioUnmuteEventListener`.

### Referential stability

The device arrays and every handler keep a stable identity across renders, so they are safe as
`useEffect` dependencies and in `React.memo` children. `start`, `getMediaDevices` and
`updateMediaDeviceConstraints` change identity when the constraints or streaming state they close
over change, which is the point — depend on them and you re-run when it actually matters.

### Exported types

```ts
import type {
  RequestState,
  TrackKind,
  UpdateMediaDeviceConstraintsOptions,
  UseMediaStreamProps,
  UseMediaStreamReturn,
} from 'use-media-stream';

import { REQUEST_STATES, defaultMediaDeviceConstraints } from 'use-media-stream';
```

## Development

```sh
npm install
npm run typecheck
npm test
npm run test:coverage
npm run build
```

### Verifying the published output

`npm run verify:package` packs the library and installs it into a scratch project the way a
consumer would, then checks that `require()` resolves the CommonJS build, `import` resolves the
ESM one, the types resolve in every module mode (`attw`), and `package.json` is sane (`publint`).

This is worth running before any release. `npm link` and `file:` installs are *not* equivalent —
they skip packing and the `files` field, and both of the packaging bugs this library shipped
survive them. CI runs this same script.

A playground is included for testing against a real camera. It aliases the package straight at
`src/`, so edits hot-reload with no build step:

```sh
cd playground
npm install
npm run dev
```

## License

MIT — see [LICENSE](./LICENSE).

## Contributing

Issues and pull requests welcome — [open an issue](https://github.com/kothariji/use-media-stream/issues).
