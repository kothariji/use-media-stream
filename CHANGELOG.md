# [2.0.0](https://github.com/kothariji/use-media-stream/compare/v1.0.3...v2.0.0)

### Bug Fixes

- **`stop()` now releases the stream `getMediaDevices()` opened.** It guarded on `isStreaming`, which `getMediaDevices()` never sets, so listing devices left the camera and mic running with no way to release them.
- **The stream is released when the component unmounts.** There was no cleanup at all, so navigating away kept the camera on until the tab closed.
- **`isVideoMuted` / `isAudioMuted` recover.** Nothing listened for `unmute`, so once a track went silent the flags stayed wrong forever.
- **CommonJS builds load.** `"type": "module"` applies to every `.js` in the package, so Node loaded `lib/cjs` through the ESM loader and its requires resolved against the wrong base.
- **ESM builds load in Node.** Emitted import specifiers were extensionless, which Node's ESM resolver rejects. Bundlers papered over it, so it went unnoticed.
- **`start()` reports unsupported browsers properly** instead of throwing a raw `TypeError`.
- **The hook can be server-rendered.** `isSupported` read `navigator?.mediaDevices`, but optional chaining still throws on an identifier that was never declared, and Node had no global `navigator` before v21. Any SSR render on Node 18 or 20 died with `ReferenceError: navigator is not defined`.
- **`muteAudio()` / `muteVideo()` no longer set the mute flag when no stream is open.** The flag then contradicted the tracks once one was acquired.
- **`updateMediaDeviceConstraints({ resetStream: true })` no longer switches the camera on when nothing is streaming.** There is nothing to reset in that case; the constraints are still recorded and apply to the next `start()`.

### Breaking Changes

- **`stop()` releases any stream the hook holds**, not just one started by `start()`. If you relied on a stream surviving `stop()` after `getMediaDevices()`, acquire it with `start()`.
- **Unmounting releases the stream.** If you were passing the `MediaStream` to something outliving the component, it will now be stopped.
- **`error` is `Error | null`**, was `unknown`. Narrowing code still compiles; code assigning it elsewhere as `unknown` may not.
- **`getStreamRequest` and `getMediaDevicesRequest` are a `RequestState` union**, were `string`.
- **Requires Node >= 18** (was >= 16) for consumers who run it server-side. `react >= 16` is unchanged.

### Features

- **Device arrays and handlers are referentially stable.** `audioInputDevices` and friends were rebuilt every render, so a consumer's `useEffect(..., [audioInputDevices])` looped forever. Handlers are memoised too, so they survive in `React.memo` children.
- **`unmute` listeners are exposed**, matching the `mute` ones: `addVideoUnmuteEventListener`, `addAudioUnmuteEventListener` and their `remove` counterparts. The hook already listened internally.
- Default constraints drop the meaningless `deviceId: ''` on audio and video, and `audio` is simply `true`.
- Zero runtime dependencies — `deepmerge` was a peer dependency that pnpm and yarn 1 never installed.
- Exports `UseMediaStreamProps`, `UpdateMediaDeviceConstraintsOptions`, `RequestState`, `TrackKind`, `UseMediaStreamReturn`, `REQUEST_STATES` and `defaultMediaDeviceConstraints`, plus the hook as a named export.
- `mediaDeviceConstraints` and `resetStream` are optional, as they always were at runtime.
- Smaller output: `target` moved to `es2020`, dropping the `__awaiter` downlevel helpers.

### Internal

- 24 tests, including regression tests for both leaks, each verified to fail when its fix is reverted.
- CI across Node 20/22/24, plus a job that installs the packed tarball and loads it through both `require()` and `import`.
- A playground app for testing against a real camera.

# [1.0.3](https://github.com/kothariji/use-media-stream/compare/v1.0.2...v1.0.3) (2024-01-24)

### Features

- add [demo link](https://stackblitz.com/edit/use-media-stream?file=src/App.tsx) for the hook

# [1.0.2](https://github.com/kothariji/use-media-stream/compare/v1.0.1...v1.0.2) (2024-01-23)

### Features

- update `package-lock.json`
- add badges to `README.md`

# [1.0.1](https://github.com/kothariji/use-media-stream/compare/v1.0.1...v1.0.1) (2024-01-23)

### Features

- add `CHANGELOG.md`
- fix broken markdown table in Readme.md
