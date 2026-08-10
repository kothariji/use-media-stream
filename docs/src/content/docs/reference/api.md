---
title: API reference
description: Everything useMediaStream accepts and returns.
---

## `useMediaStream(props?)`

```ts
import useMediaStream from 'use-media-stream';
// or
import { useMediaStream } from 'use-media-stream';
```

| Prop | Type | Description |
|---|---|---|
| `mediaDeviceConstraints` | `MediaStreamConstraints \| null` | Optional. Merged recursively over the [defaults](../../guides/constraints/#the-defaults). Read once, on mount. |

Everything is optional — `useMediaStream()`, `useMediaStream({})` and
`useMediaStream({ mediaDeviceConstraints: … })` are all valid.

## State

| Property | Type | Description |
|---|---|---|
| `stream` | `MediaStream \| null` | The current stream. |
| `isSupported` | `boolean` | Whether `getUserMedia` exists. `false` during SSR. |
| `isStreaming` | `boolean` | Whether a stream started by `start()` is active. |
| `isAudioMuted` | `boolean` | Whether audio tracks are muted. |
| `isVideoMuted` | `boolean` | Whether video tracks are muted. |
| `error` | `Error \| null` | Last error from acquiring a stream or devices. |
| `getStreamRequest` | `RequestState` | State of the stream request. |
| `getMediaDevicesRequest` | `RequestState` | State of the device listing. |

## Devices

| Property | Type | Description |
|---|---|---|
| `devices` | `MediaDeviceInfo[]` | All devices, once `getMediaDevices()` has run. |
| `audioInputDevices` | `MediaDeviceInfo[]` | Kind `audioinput`. |
| `audioOutputDevices` | `MediaDeviceInfo[]` | Kind `audiooutput`. |
| `videoInputDevices` | `MediaDeviceInfo[]` | Kind `videoinput`. |
| `selectedAudioTrackDeviceId` | `string \| undefined` | From the live audio track's settings. |
| `selectedVideoTrackDeviceId` | `string \| undefined` | From the live video track's settings. |
| `selectedVideoTrackDeviceWidth` | `number \| undefined` | Actual width — may differ from what you asked for. |
| `selectedVideoTrackDeviceHeight` | `number \| undefined` | Actual height. |
| `selectedVideoTrackDeviceAspectRatio` | `number \| undefined` | Actual aspect ratio. |

## Handlers

| Handler | Type | Description |
|---|---|---|
| `start` | `() => Promise<MediaStream \| null>` | Acquires a stream. Resolves to `null` on failure and populates `error`; never throws. No-op if already streaming. |
| `stop` | `() => void` | Stops every track and clears the stream. No-op if nothing is open. |
| `getMediaDevices` | `() => Promise<MediaDeviceInfo[]>` | Lists devices, acquiring a stream first so labels are populated. |
| `updateMediaDeviceConstraints` | `(options) => Promise<void>` | See below. |
| `muteAudio` / `unmuteAudio` | `() => void` | Toggles `enabled` on audio tracks. The device stays open. |
| `muteVideo` / `unmuteVideo` | `() => void` | Toggles `enabled` on video tracks. |

### `updateMediaDeviceConstraints(options)`

| Option | Type | Description |
|---|---|---|
| `constraints` | `MediaStreamConstraints` | Merged recursively over the current constraints. |
| `resetStream` | `boolean` | Optional, defaults to `false`. Release and re-acquire with the new constraints. `isStreaming` is preserved. No-op if no stream is open. |

## Track events

Twelve functions, one per combination, all
`(fn: EventListenerOrEventListenerObject) => void`:

```
add | remove  +  Video | Audio  +  Ended | Mute | Unmute  +  EventListener
```

<details>
<summary>All twelve, written out</summary>

- `addVideoEndedEventListener` · `removeVideoEndedEventListener`
- `addAudioEndedEventListener` · `removeAudioEndedEventListener`
- `addVideoMuteEventListener` · `removeVideoMuteEventListener`
- `addAudioMuteEventListener` · `removeAudioMuteEventListener`
- `addVideoUnmuteEventListener` · `removeVideoUnmuteEventListener`
- `addAudioUnmuteEventListener` · `removeAudioUnmuteEventListener`

</details>

They apply to the tracks held **right now** — re-attach after anything that replaces the stream.
See [Track events](../../guides/muting/#track-events).

## Referential stability

Safe as `useEffect` dependencies and in `React.memo` children:

| Stable across renders | Changes when |
|---|---|
| `stop`, all mute functions, all twelve listener functions | never |
| `audioInputDevices`, `audioOutputDevices`, `videoInputDevices` | `devices` changes |
| `start`, `getMediaDevices`, `updateMediaDeviceConstraints` | the constraints or streaming state they close over change |

The second group changing is deliberate — depending on them re-runs your effect exactly when the
thing it captured actually moved.

## Exports

```ts
import useMediaStream, {
  useMediaStream as named,
  REQUEST_STATES,
  defaultMediaDeviceConstraints,
} from 'use-media-stream';

import type {
  RequestState,
  TrackEvent,
  TrackKind,
  UpdateMediaDeviceConstraintsOptions,
  UseMediaStreamProps,
  UseMediaStreamReturn,
} from 'use-media-stream';
```

### `REQUEST_STATES`

```ts
{ IDLE: 'IDLE', PENDING: 'PENDING', FULFILLED: 'FULFILLED', REJECTED: 'REJECTED' }
```

`RequestState` is the union of those four, so a `switch` over it is exhaustive.

### `UseMediaStreamReturn`

Derived with `ReturnType<typeof useMediaStream>`, so it cannot drift from the implementation. Useful
for typing a wrapper:

```ts
function useCamera(): UseMediaStreamReturn {
  return useMediaStream({ mediaDeviceConstraints: { audio: false } });
}
```
