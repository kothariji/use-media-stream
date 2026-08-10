---
title: Devices
description: Listing cameras and microphones, and letting people switch between them.
---

## Listing devices

```tsx
const { getMediaDevices, audioInputDevices, videoInputDevices, audioOutputDevices } = useMediaStream();

useEffect(() => {
  getMediaDevices();
}, [getMediaDevices]);
```

`getMediaDevices()` returns the full list and also populates `devices`, plus three arrays split by
kind:

| | `MediaDeviceInfo.kind` |
|---|---|
| `audioInputDevices` | `audioinput` — microphones |
| `audioOutputDevices` | `audiooutput` — speakers |
| `videoInputDevices` | `videoinput` — cameras |

:::caution[It opens a stream]
Device **labels are blank** until the user has granted permission — that's a browser privacy rule,
not a quirk of this hook. So `getMediaDevices()` acquires a stream first in order to read them.

That stream is real and the camera light comes on. Release it with `stop()` like any other, or
leave it if you're about to use it anyway.
:::

If you only need the microphone list, ask for audio alone so the camera never lights up:

```tsx
useMediaStream({ mediaDeviceConstraints: { video: false } });
```

## What's currently selected

The `selected*` values read the **live track's** settings, which is what the browser actually gave
you — not what you asked for:

```tsx
const {
  selectedAudioTrackDeviceId,
  selectedVideoTrackDeviceId,
  selectedVideoTrackDeviceWidth,
  selectedVideoTrackDeviceHeight,
  selectedVideoTrackDeviceAspectRatio,
} = useMediaStream();
```

Ask for 1280×720 on a webcam that can't do it and you'll get something else — these tell you what.
They're `undefined` while no stream is running.

## Switching camera

```tsx
function CameraPicker() {
  const { videoInputDevices, selectedVideoTrackDeviceId, updateMediaDeviceConstraints } = useMediaStream();

  return (
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
    </select>
  );
}
```

`resetStream: true` is what makes the switch take effect: the current stream is released and a new
one acquired with the merged constraints. Without it the constraints are recorded but the live
stream keeps running on the old device, which is what you want if you're setting up before
starting.

`isStreaming` is preserved across the swap, so a stream that was running stays running.

:::note
If no stream is open, `resetStream: true` does nothing rather than switching the camera on. The
constraints are still recorded and apply to the next `start()`.
:::

## Front and back camera on mobile

Phones expose `facingMode` rather than useful device labels, so prefer it over `deviceId`:

```tsx
updateMediaDeviceConstraints({
  constraints: { video: { facingMode: 'environment' } }, // rear camera
  resetStream: true,
});
```

`'user'` is the selfie camera and the default.

## Speakers

`audioOutputDevices` is listed for completeness, but output can't be chosen through
`getUserMedia` — it isn't an input. To route audio to a specific speaker, use
[`HTMLMediaElement.setSinkId()`](https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/setSinkId)
on the element itself, passing the `deviceId` from this list.

## Devices appearing and disappearing

The arrays don't refresh by themselves. To follow devices being plugged in or removed, listen to
the browser event and re-run the query:

```tsx
useEffect(() => {
  const onChange = () => getMediaDevices();
  navigator.mediaDevices?.addEventListener('devicechange', onChange);
  return () => navigator.mediaDevices?.removeEventListener('devicechange', onChange);
}, [getMediaDevices]);
```

The three arrays keep a **stable identity** between renders, so using them as effect dependencies
is safe and won't loop.
