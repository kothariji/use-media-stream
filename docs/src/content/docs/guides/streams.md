---
title: Streams and lifecycle
description: When a stream is acquired, when it is released, and what turns the camera light off.
---

The whole point of this hook is that the camera turns off when it should. This page is what "when
it should" means.

## Starting

```tsx
const { start, isStreaming, stream } = useMediaStream();
```

`start()` acquires a stream if there isn't one, sets `isStreaming`, and resolves to the
`MediaStream` — or to `null` on failure, with the reason in `error`. It never throws.

Calling it twice is safe. If a stream is already running it returns the existing one without
touching the camera again.

```tsx
const s1 = await start();
const s2 = await start(); // same stream, no second permission prompt
```

## Stopping

`stop()` stops every track, clears `stream`, and resets `getStreamRequest` to `IDLE`.

It guards on **whether a stream exists**, not on `isStreaming`. That distinction matters because
[`getMediaDevices()`](../devices/) opens a stream of its own without ever setting `isStreaming` —
so `stop()` releases that one too.

:::note[This was a bug in v1]
v1 guarded `stop()` on `isStreaming`, so calling `getMediaDevices()` and then `stop()` left the
camera running with no public way to release it. If you worked around it, you can stop.
:::

## Unmounting

**You do not need to clean up.** The hook releases its tracks when your component unmounts:

```tsx
function Camera() {
  const { start } = useMediaStream();
  // no useEffect teardown needed — unmounting stops the tracks
}
```

This is the guarantee worth internalising. In v1 there was no cleanup at all, so navigating away
from a page mid-stream left the camera on until the tab was closed.

The corollary: if you hand the `MediaStream` to something that outlives the component — a recorder,
a WebRTC peer connection, a global store — it **will** be stopped when the component unmounts. Keep
the hook mounted for as long as the stream is needed.

## Tracks ending on their own

A stream can die without you asking. Someone unplugs the webcam, the OS hands the device to another
application, or a permission is revoked mid-session.

The hook listens for the `ended` event and flips `isStreaming` to `false`, so your UI follows along
without polling:

```tsx
const { isStreaming } = useMediaStream();
// goes false by itself if the camera disappears
```

To react beyond that, attach your own listener — see [Track events](../muting/#track-events).

## Request state

`getStreamRequest` tracks the acquisition as a state machine rather than a loading boolean:

```tsx
import { REQUEST_STATES } from 'use-media-stream';

const { getStreamRequest } = useMediaStream();

switch (getStreamRequest) {
  case REQUEST_STATES.IDLE:      return <button onClick={start}>Start</button>;
  case REQUEST_STATES.PENDING:   return <Spinner />;   // waiting on the permission prompt
  case REQUEST_STATES.REJECTED:  return <Error />;
  case REQUEST_STATES.FULFILLED: return <Video />;
}
```

`PENDING` is the interesting one: it covers the window where the browser is showing the permission
dialog, which can last as long as the person takes to click.

The values are a typed union, so the `switch` above is exhaustive — add a fifth state and
TypeScript tells you where to handle it.

## Failure

Nothing throws. Failures land in `error` as an `Error`, and `getStreamRequest` becomes `REJECTED`:

```tsx
const { error, start } = useMediaStream();

if (error?.name === 'NotAllowedError') return <p>Camera permission was denied.</p>;
if (error?.name === 'NotFoundError') return <p>No camera found.</p>;
```

Common `DOMException` names from `getUserMedia`:

| `name` | Means |
|---|---|
| `NotAllowedError` | Permission denied, or blocked by policy |
| `NotFoundError` | No device matches the constraints |
| `NotReadableError` | Hardware exists but another app has it |
| `OverconstrainedError` | Constraints too strict to satisfy |

On a browser without `getUserMedia`, `isSupported` is `false` and `start()` sets a plain `Error`
rather than throwing.
