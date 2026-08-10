---
title: Migrating from v1
description: What changed in v2.0.0 and what you need to do about it.
---

**Most code needs no changes.** The API is the same apart from additions. What changed is
behaviour: two fixes turn the camera off in cases where v1 left it on, which is breaking by
definition even though it's what you wanted.

```sh
npm install use-media-stream@latest
```

## Check these

### `stop()` releases any stream, not just one from `start()`

`getMediaDevices()` opens a stream to read device labels. In v1, `stop()` guarded on `isStreaming`
— which `getMediaDevices()` never set — so that stream stayed live with no way to release it.

**Do something if:** you worked around this with your own teardown. You can delete it.

### Unmounting releases the stream

v1 had no cleanup at all. Navigating away left the camera on until the tab closed.

**Do something if:** you pass the `MediaStream` to something that outlives the component — a
recorder, a WebRTC peer connection, a global store. It will now be stopped on unmount. Keep the
hook mounted for as long as the stream is needed.

### Arrays in constraints are replaced, not concatenated

v1 used `deepmerge`, which concatenated arrays:

```ts
// base:     { deviceId: { exact: ['a'] } }
// override: { deviceId: { exact: ['b'] } }

// v1 →  { exact: ['a', 'b'] }
// v2 →  { exact: ['b'] }
```

Objects still merge recursively, exactly as before.

**Do something if:** you relied on the concatenation. Almost nobody did — it produced a constraint
matching either device, which is rarely what anyone means.

### `error` is `Error | null`, was `unknown`

```tsx
// v1
if (error instanceof Error) console.log(error.message);

// v2
console.log(error?.message);
```

Existing narrowing still compiles. Only code that passed `error` somewhere expecting `unknown`
needs a look.

### Request states are a union, not `string`

`getStreamRequest` and `getMediaDevicesRequest` are now
`'IDLE' | 'PENDING' | 'FULFILLED' | 'REJECTED'`. Exhaustive `switch` statements typecheck;
assigning an arbitrary string no longer does.

### `defaultMediaDeviceConstraints` changed shape

`audio` is `true` rather than `{ deviceId: '' }`, and `video` no longer carries `deviceId: ''`. An
empty non-exact `deviceId` matched nothing and was ignored.

**Do something if:** you read the exported constant. Behaviour is unchanged.

### Node 18 or newer

`engines.node` moved from `>=16` to `>=18`, relevant only if you render server-side. The React peer
range is unchanged at `>= 16`.

## Things that got better on their own

- **`deepmerge` is gone.** It was a `peerDependency`, so it sat in your top-level tree — and pnpm
  and yarn 1 never installed it at all. The package now has **zero runtime dependencies**.
- **Both entry points load.** `require()` and `import` were each broken from Node in different
  ways. Bundlers hid it.
- **[Server rendering works](../../guides/server-rendering/).** v1 crashed with
  `ReferenceError: navigator is not defined` on Node 18 and 20.
- **Mute flags recover.** Nothing listened for `unmute`, so once a track went silent the flags
  stayed wrong forever.
- **Device arrays are stable.** They were rebuilt every render, so
  `useEffect(..., [audioInputDevices])` looped forever.
- **`start()` reports unsupported browsers** instead of throwing a raw `TypeError`.

## New in v2

- `unmute` listeners, matching the `mute` ones
- [Types are exported](../api/#exports) — `UseMediaStreamProps`, `UseMediaStreamReturn`,
  `RequestState` and the rest. v1 exported nothing but the hook.
- The hook as a **named export** as well as the default
- `mediaDeviceConstraints` and `resetStream` are optional, as they always were at runtime
- Published with provenance

The full list is in the [changelog](https://github.com/kothariji/use-media-stream/blob/master/CHANGELOG.md).
