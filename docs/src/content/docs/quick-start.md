---
title: Quick start
description: A working camera component with use-media-stream, in about fifteen lines.
sidebar:
  order: 2
---

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

That's the whole thing. Navigate away mid-stream and the camera turns off on its own — there is no
cleanup for you to write.

## What's happening

**`start()`** asks the browser for a camera and microphone, which triggers the permission prompt
the first time. It resolves to the `MediaStream`, or to `null` if something went wrong — it never
throws. The reason lands in `error`.

**`stream`** is the `MediaStream` itself, or `null`. Assigning it to a `<video>` element's
`srcObject` is what puts the picture on screen; React has no prop for that, hence the ref and the
effect.

**`stop()`** stops every track and clears the stream, which is what actually turns the camera light
off.

**`error`** is an `Error` you can render directly. Permission denials arrive here as a
`DOMException` with `name: 'NotAllowedError'`.

## The `muted` attribute

The `<video>` element is `muted` deliberately. Without it you get your own microphone played back
through your speakers, which feeds back. It mutes playback only — the audio track in the stream is
untouched, so recording or transmitting still captures sound.

`autoPlay` and `playsInline` matter too: without them the video stays a blank frame, and on iOS it
tries to open fullscreen.

## Requesting only what you need

The default asks for both camera and microphone. If you only want video, say so — the permission
prompt then only mentions the camera:

```tsx
useMediaStream({ mediaDeviceConstraints: { audio: false } });
```

See [Constraints](../guides/constraints/) for resolution, frame rate and facing mode.

## A note on permissions

Browsers require a **user gesture** before granting camera access, so `start()` belongs in an event
handler. Calling it from an effect on mount will be rejected in most browsers, and it's poor
behaviour regardless — people don't expect a page to switch their camera on by itself.

## Next

- [Streams and lifecycle](../guides/streams/) — when the stream is released, and by what
- [Devices](../guides/devices/) — letting people pick a camera
- [API reference](../reference/api/) — everything the hook returns
