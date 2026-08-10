---
title: Constraints
description: Setting resolution, frame rate and facing mode, and how constraints are merged.
---

Constraints are the standard
[`MediaStreamConstraints`](https://developer.mozilla.org/en-US/docs/Web/API/MediaStreamConstraints)
object — this hook just gives you two places to set them and merges them sensibly.

## Setting them up front

```tsx
useMediaStream({
  mediaDeviceConstraints: { video: { width: 640, height: 480 } },
});
```

Read once, when the hook first mounts. Changing the prop later has no effect — use
`updateMediaDeviceConstraints()` for that.

## Changing them later

```tsx
const { updateMediaDeviceConstraints } = useMediaStream();

await updateMediaDeviceConstraints({
  constraints: { video: { width: 1920, height: 1080 } },
  resetStream: true,
});
```

`resetStream` decides whether the change applies now or next time:

- **`true`** — release the current stream and re-acquire with the new constraints. `isStreaming` is
  preserved, so a running stream stays running.
- **`false`** (the default) — record the constraints; they apply at the next `start()`.

If no stream is open, `resetStream: true` does nothing rather than switching the camera on.

## The defaults

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

Exported, if you want to read or extend them:

```ts
import { defaultMediaDeviceConstraints } from 'use-media-stream';
```

## How merging works

Yours are merged **recursively** over the defaults, so setting one field doesn't wipe its
neighbours:

```ts
useMediaStream({ mediaDeviceConstraints: { video: { width: 640 } } });

// →  video: { facingMode: 'user', width: 640, height: 720, frameRate: { ideal: 60, min: 10 } }
```

Nesting is followed all the way down — overriding `frameRate.ideal` keeps `frameRate.min`:

```ts
{ video: { frameRate: { ideal: 30 } } }

// →  frameRate: { ideal: 30, min: 10 }
```

Two rules to know:

**Booleans replace objects.** `{ audio: false }` disables audio outright rather than merging into
it. This is how you ask for video only:

```ts
useMediaStream({ mediaDeviceConstraints: { audio: false } });
```

**Arrays are replaced, not concatenated.**

```ts
// base:     { deviceId: { exact: ['a'] } }
// override: { deviceId: { exact: ['b'] } }
// result:   { deviceId: { exact: ['b'] } }     ← not ['a', 'b']
```

:::note[Changed in v2]
v1 used `deepmerge`, which concatenated arrays. Merging `exact: ['a']` with `exact: ['b']` produced
a constraint matching either device, which is almost never what anyone meant.
:::

## Ideal versus exact

This is standard `getUserMedia` behaviour, but it's the most common source of confusion, so:

```ts
{ video: { width: 1280 } }                  // a hint — you may get something else
{ video: { width: { ideal: 1280 } } }       // the same hint, explicit
{ video: { width: { min: 640, max: 1920 } } } // a range, fails if unsatisfiable
{ video: { width: { exact: 1280 } } }       // exactly this, or OverconstrainedError
```

Plain values and `ideal` are preferences the browser tries to honour. `exact` and `min`/`max` are
requirements — if the device can't meet them, `start()` fails with an `OverconstrainedError` rather
than giving you something close.

Prefer `ideal` unless you genuinely cannot work with a different value. Then check what you
actually got:

```tsx
const { selectedVideoTrackDeviceWidth, selectedVideoTrackDeviceHeight } = useMediaStream();
```

The default `frameRate: { ideal: 60, min: 10 }` follows this: 60fps if the camera can, but never
below 10, and it fails rather than handing you a slideshow.

## Useful ones

| Constraint | Notes |
|---|---|
| `facingMode: 'user' \| 'environment'` | Front or rear camera. The right way to pick on mobile. |
| `deviceId` | A specific device, from [`getMediaDevices()`](../devices/). |
| `width` / `height` | Hints unless wrapped in `exact`. |
| `frameRate` | Lower it to save bandwidth and battery. |
| `echoCancellation` | Audio. On by default in most browsers. |
| `noiseSuppression` | Audio. Worth disabling for music. |
| `autoGainControl` | Audio. Also worth disabling for music. |

```tsx
useMediaStream({
  mediaDeviceConstraints: {
    audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
  },
});
```
