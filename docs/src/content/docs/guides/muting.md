---
title: Muting and track events
description: Muting without releasing the device, and reacting to tracks going quiet or ending.
---

## Muting

```tsx
const { isAudioMuted, muteAudio, unmuteAudio } = useMediaStream();

<button onClick={isAudioMuted ? unmuteAudio : muteAudio}>
  {isAudioMuted ? 'Unmute' : 'Mute'}
</button>
```

There's a matching pair for video: `muteVideo` / `unmuteVideo` with `isVideoMuted`.

## Muting is not stopping

This is the distinction worth getting right:

| | `muteAudio()` | `stop()` |
|---|---|---|
| What it does | sets `track.enabled = false` | ends every track |
| Device | stays open | released |
| Camera light | **stays on** | goes off |
| Reversing it | instant | re-acquires, may re-prompt |
| Data produced | silence / black frames | nothing, the track is dead |

Mute is for a mute button — the kind you toggle repeatedly during a call. It's instant because the
device never closes, and remote peers keep receiving a track, just an empty one.

`stop()` is for finishing. It's the only one that turns the camera light off, which is what people
watch for when they want to know they're off camera.

:::caution
Because the device stays open, **muting does not turn the camera light off**. If someone is muting
video for privacy, they'll expect the light to go out. Use `stop()` for that.
:::

Calling a mute function with no stream open does nothing — the flags stay `false` rather than
claiming a mute that isn't real.

## Tracks muting themselves

`isVideoMuted` and `isAudioMuted` also follow the track's own `mute` and `unmute` events, which the
browser fires when a track stops delivering data for reasons that have nothing to do with you — the
OS grabbing the microphone, a hardware mute switch, a network stall on a remote track.

So the flags reflect **"is data flowing"**, not only "did I call mute". They recover on their own
when the track does.

## Track events

For anything beyond the flags, attach your own listeners:

```tsx
const { addVideoEndedEventListener, removeVideoEndedEventListener } = useMediaStream();

useEffect(() => {
  const onEnded = () => console.log('camera went away');
  addVideoEndedEventListener(onEnded);
  return () => removeVideoEndedEventListener(onEnded);
}, [addVideoEndedEventListener, removeVideoEndedEventListener]);
```

There are twelve functions, one per combination:

```
add | remove  +  Video | Audio  +  Ended | Mute | Unmute  +  EventListener
```

So `addAudioMuteEventListener`, `removeVideoUnmuteEventListener`, and so on.

| Event | Fires when |
|---|---|
| `ended` | the track is finished for good and won't recover |
| `mute` | the track stops delivering data, possibly temporarily |
| `unmute` | data resumes |

Despite the name, `mute` is not about the user muting anything — that's `track.enabled`, which
doesn't fire events at all. `mute` means the source went quiet.

:::caution[Re-attach after the stream changes]
Listeners attach to the tracks held **right now**. Anything that replaces the stream — `stop()`
then `start()`, or `updateMediaDeviceConstraints({ resetStream: true })` — produces new tracks,
and your listener isn't on them. Re-attach after switching devices.
:::

The add/remove functions keep a **stable identity** across renders, so they're safe as effect
dependencies, and passing the same function reference to `remove*` that you passed to `add*`
detaches it correctly.
