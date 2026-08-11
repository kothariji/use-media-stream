# [2.0.1](https://github.com/kothariji/use-media-stream/compare/v2.0.0...v2.0.1) (2026-08-11)

Two bugs with one cause: nothing owned stream acquisition, so `start()` could neither tell a stale
stream from a current one nor see one already in flight.

### Bug Fixes

- **`start()` no longer drops constraints recorded since the open stream was acquired.** It reused any open stream, so the one `getMediaDevices()` opens to read device labels became the one you kept — and constraints set with `resetStream: false` were silently ignored, contrary to the documented behaviour. It now reuses a stream only if it was acquired with the constraints currently in effect, and releases it rather than leaking it otherwise. Reuse still happens in the common `getMediaDevices()` then `start()` flow, so the camera is not acquired twice.
- **Concurrent callers share one acquisition.** Two `start()` calls in the same tick — or a `start()` racing a `getMediaDevices()` — each opened a stream. The second overwrote the internal reference and the first was left running with nothing able to stop it, which `stop()` and unmount could not release.

Both are covered by regression tests verified to fail when the fix is removed.

A correctness release. The camera and mic were left running in two situations, neither entry
point could be loaded from Node, and the hook could not be server-rendered at all. The public
API is unchanged apart from additions, but the lifecycle fixes change behaviour by definition —
read the breaking changes before upgrading.

### Breaking Changes

- **`stop()` releases any stream the hook holds**, not just one started by `start()`. If you relied on a stream surviving `stop()` after `getMediaDevices()`, acquire it with `start()`.
- **Unmounting releases the stream.** If you passed the `MediaStream` to something that outlives the component, it is now stopped when the component goes away.
- **Nested constraints merge, arrays replace.** Dropping `deepmerge` kept its object semantics, but where it concatenated arrays this replaces them. `{ deviceId: { exact: ['a'] } }` overridden with `{ exact: ['b'] }` is now `['b']`, not `['a', 'b']`.
- **`error` is `Error | null`**, was `unknown`. Narrowing code still compiles; code passing it on as `unknown` may not.
- **`getStreamRequest` and `getMediaDevicesRequest` are a `RequestState` union**, were `string`. Exhaustive `switch` statements now typecheck; assigning an arbitrary string does not.
- **`defaultMediaDeviceConstraints` changed shape.** `audio` is `true` rather than `{ deviceId: '' }`, and `video` no longer carries `deviceId: ''`. Only relevant if you read the exported constant; an empty non-exact `deviceId` matched nothing and was ignored.
- **`engines.node` is `>=18`**, was `>=16`, for consumers who render server-side. The `react >= 16` peer range is unchanged.

### Bug Fixes

- **`stop()` now releases the stream `getMediaDevices()` opened.** It guarded on `isStreaming`, which `getMediaDevices()` never sets, so listing devices left the camera and mic running with no public way to release them.
- **The stream is released when the component unmounts.** There was no cleanup at all, so navigating away kept the camera on until the tab was closed.
- **The hook can be server-rendered.** `isSupported` read `navigator?.mediaDevices`, but optional chaining guards a missing property, not an identifier that was never declared — and Node had no global `navigator` before v21. Every SSR render on Node 18 or 20 died with `ReferenceError: navigator is not defined`.
- **CommonJS builds load.** `"type": "module"` applies to every `.js` in the package, so Node loaded `lib/cjs` through the ESM loader and its internal requires resolved against the wrong base.
- **ESM builds load in Node.** Emitted import specifiers were extensionless, which Node's ESM resolver rejects. Bundlers resolve them anyway, which is why this went unnoticed since v1.
- **`isVideoMuted` / `isAudioMuted` recover.** Nothing listened for `unmute`, so once a track went silent the flags stayed wrong forever.
- **`start()` reports unsupported browsers** instead of throwing a raw `TypeError`. The check moved into the one function `start()` and `getMediaDevices()` both route through.
- **`muteAudio()` / `muteVideo()` no longer set the mute flag when no stream is open.** The flag then contradicted the tracks once one was acquired.
- **`updateMediaDeviceConstraints({ resetStream: true })` no longer switches the camera on when nothing is streaming.** There is nothing to reset; the constraints are still recorded and apply to the next `start()`.
- **The device arrays no longer change identity every render.** A consumer with `useEffect(..., [audioInputDevices])` re-ran forever.

### Features

- **Zero runtime dependencies.** `deepmerge` was declared as a `peerDependency`, so it landed in every consumer's top-level tree — and pnpm and yarn 1 do not auto-install peers, making it a missing-module crash there.
- **Ships a real dual package.** Adds an `exports` map with `types`/`import`/`require`, keeps `main`/`module`/`types` for older resolvers, and marks `sideEffects: false` for tree shaking. Verified against `node10`, `node16` (CJS and ESM) and `bundler`.
- **Published with provenance**, via npm trusted publishing over OIDC. `npm audit signatures` verifies the tarball was built by this repository's release workflow.
- **`unmute` listeners are exposed**, matching the `mute` ones: `addVideoUnmuteEventListener`, `addAudioUnmuteEventListener` and their `remove` counterparts. The hook already listened internally.
- **Handlers are referentially stable**, so they survive in `React.memo` children. `start`, `getMediaDevices` and `updateMediaDeviceConstraints` change only when the constraints or streaming state they close over do.
- **Types are exported**: `UseMediaStreamProps`, `UpdateMediaDeviceConstraintsOptions`, `UseMediaStreamReturn`, `RequestState`, `TrackKind`, `TrackEvent`, plus the values `REQUEST_STATES` and `defaultMediaDeviceConstraints`. Previously nothing but the default export was exported, so a wrapper around the hook could not be typed.
- **The hook is available as a named export** as well as the default: `import { useMediaStream } from 'use-media-stream'`.
- **`mediaDeviceConstraints` and `resetStream` are optional**, as they always were at runtime. `useMediaStream({})` and `updateMediaDeviceConstraints({ constraints })` now typecheck.
- Smaller output: `target` moved from `es2016` to `es2020`, dropping the `__awaiter` and `__generator` downlevel helpers in favour of native `async`/`await`.

### Internal

- **39 tests, 100% branch coverage.** Every regression test was verified to fail when its fix is mutated back out, so they test the bugs rather than the implementation.
- **CI across Node 20, 22 and 24**, plus a job that installs the packed tarball into a scratch project and loads it through both `require()` and `import`. Runnable locally as `npm run verify:package`, which also runs `attw` and `publint`.
- **Releases publish from a tag**, not a laptop: `npm version <bump> && git push --follow-tags`. Prereleases go to the `next` dist-tag rather than `latest`.
- `npm run build` cleans `lib/` first — `tsc` does not, and a stale artifact once made a broken build look correct.
- Toolchain moved to TypeScript 7 with `nodenext` resolution, React 19 types, and vitest.
- A playground app (`playground/`) for testing against a real camera.

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
