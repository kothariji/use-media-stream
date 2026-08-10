---
title: Server rendering
description: Using use-media-stream with Next.js, Remix and other frameworks that render on the server.
---

The hook is safe to import and render on the server. There is no `typeof window` dance and no
dynamic import needed.

```tsx
const { isSupported, start } = useMediaStream();

if (!isSupported) return <p>Camera not available</p>;
```

During SSR `isSupported` is `false`, and nothing touches `navigator` until you call something. The
same branch covers both the server and a browser too old for `getUserMedia`.

:::note[Fixed in v2]
v1 read `navigator?.mediaDevices` at render. Optional chaining guards a missing *property*, not an
identifier that was never *declared* — and Node had no global `navigator` before v21. Any server
render on Node 18 or 20 crashed with `ReferenceError: navigator is not defined`.
:::

## Next.js

The App Router renders on the server by default, and hooks need a client component:

```tsx
'use client';

import useMediaStream from 'use-media-stream';

export function Camera() {
  const { stream, start, stop, isStreaming } = useMediaStream();
  // ...
}
```

That's the only requirement. `'use client'` is about hooks and event handlers generally, not
anything specific to this package — you'd need it for `useState` too.

The Pages Router needs nothing special; the hook renders fine alongside `getServerSideProps` and
friends.

## Hydration

`isSupported` is `false` on the server and `true` in a capable browser, so anything rendered from it
differs between the two passes. React handles this — the client render corrects it — but if you're
strict about hydration warnings, gate on mount instead:

```tsx
const [mounted, setMounted] = useState(false);
useEffect(() => setMounted(true), []);

if (!mounted) return null;
return <Camera />;
```

Worth doing only if the mismatch actually bothers you; there's nothing unsafe about the simpler
version.

## Static export

Static builds work the same way. The hook renders to its "not supported" state at build time and
becomes live once JavaScript runs.

The [demo](../../demo/) on this site is a static Astro page with the hook as a client-only React
island — this documentation is itself the proof it works.

## Permissions still need a gesture

Server rendering changes nothing about this: browsers require a **user gesture** before granting
camera access. `start()` belongs in an event handler, not an effect. A page that turns the camera on
by itself will be blocked, and would be poor behaviour even if it weren't.
