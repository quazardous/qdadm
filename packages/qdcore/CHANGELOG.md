# Changelog

## 1.2.0

### Minor Changes

- 05a334c: `sse.idleTimeout` — because a stream can die without anyone being told

  Measured against a proxy that cut the socket: `EventSource` went on reporting
  `readyState` OPEN with no `error` event, forever, while nothing arrived. A
  `fetch` reader on the same URL never had `read()` resolve either. Both APIs
  simply waited, and `SSEBridge` — which only listens for `onerror` — waited
  with them. Not the reported symptom of a stream reconnecting too often: a
  stream that stops for good and says nothing.

  Time since the last sign of life is the one signal that did not lie:

  ```js
  sse: { url: '/events', idleTimeout: 45000 }
  ```

  Past the budget the bridge treats the stream as dead — `sse:error`,
  `sse:disconnected`, drop, and reconnect on its usual timer with a fresh ticket
  if you issue one.

  **Off by default**, because the right budget depends on how often your server
  speaks. Too short kills a quiet but healthy stream on a schedule.

  What counts as a sign of life differs by transport, and the difference is the
  browser's, not ours: an SSE heartbeat is a comment line, which `EventSource`
  consumes without surfacing anything. On the default transport the watchdog
  sees **data frames only** — budget for your data, not for your pings.

  Also new, and not wired to anything by default: `SSEBridge` now takes a
  `transport`. `EventSourceTransport` is the default and behaves exactly as
  before; `FetchTransport` reads the wire format itself, which lets it send
  headers — no credential in a query string, and none in an access log — and see
  a clean end-of-stream. It does not replace the watchdog: an abrupt socket cut
  is invisible to both.

## 1.1.2

### Patch Changes

- 2d8ebc6: The SSE stream now connects for a restored session, survives a second login, keeps the token out of the logs, and says when a config key is ignored (#1898, from a consumer's production incident). Four fixes that composed into one symptom — the stream only ever connected on a _fresh interactive login_, never on a reload nor after logging in again. `connectOnSignal` was a `once()` while `disconnectOnSignal` was an `on()`, so a second login reconnected nothing; it is now symmetric, and ignores the signal while already connected. A session restored from storage connects the stream at boot: `auth:login` is emitted by the login _page_, so a reload — which never renders it — left the stream dead. The bridge redacts the value of `tokenParam` before logging a URL, since that option exists precisely to carry a secret and any error reporter capturing logs would outlive the session with it. And an unrecognised `sse` key now warns in dev naming **what happens instead** — an unknown `getToken` means the durable session token goes into the stream URL, which is how the incident happened: "ignored" reads as "no effect", not as "falls back to a more sensitive secret".

## 1.1.1

### Patch Changes

- d1c5235: Fix: named SSE events survive a reconnect (#1898 lot F). Listeners registered with `registerEvents()` were bound to the EventSource instance current at the time, and every reconnect builds a new one — so after the first transient drop the named channel was dead. Silently: the stream stayed connected, tickets kept being issued, `sse:connected` kept firing, and unnamed events kept flowing because `onmessage` is re-attached on each connect. Anything routing named events stopped working, which includes qdadm's live entities. The bridge now remembers the registered names and re-attaches them on every connection, so a caller registers once and the subscription holds for the life of the bridge. `registerEvents()` is also safe to call before connecting — previously a silent no-op — and safe to call twice, binding each name once per connection.

## 1.1.0

### Minor Changes

- e910984: SSE: the auth token may now be fetched asynchronously, and the kernel `sse` config can supply it (#1888 lot A, BookShepherd report #1887). `EventSource` accepts no headers, so the token rides in the query string and lands in access logs — apps that refuse to leak a durable credential there can now serve a short-lived, single-use ticket instead: `getToken` accepts `() => string | null | Promise<string | null>`, awaited before each connect. `SSEConfig` gains `getToken` (an explicit `null` sends no token at all), plus `connectOnSignal` / `disconnectOnSignal` passthrough — without them the async token was unreachable for anyone using the kernel's `sse` config rather than building an `SSEBridge` by hand. Purely additive: synchronous `getToken` implementations keep working unchanged. A connect that awaited its token now checks it has not been superseded before opening the connection, so a `disconnect()` or a second `connect()` during the fetch no longer resurrects a torn-down stream.

## 1.0.0

### Major Changes

- Promote to 1.0.0 — stability contract (#1026). No API change: the 0.2.x
  label was versioning debt on a de-facto frozen API (qdadm 2.x has depended
  on it in production through its whole line). From 1.0, strict semver:
  breaking changes only in a major. Versioning stays independent from qdadm —
  qdcore is shared with qdcms and follows its own cadence.

All notable changes to `@quazardous/qdcore` will be documented in this file.

## [0.2.1] - 2026-05-07

### Changed — first npm publication

- Same code as the unpublished `0.2.0` reference inside the qdadm-monorepo. Metadata completed (`repository.directory`, `homepage`, `bugs`) so the package can ship under the `@quazardous` scope. From this version onwards, qdcore resolves directly from the npm registry — consumers no longer need a workspace link or local `npm pack`.

For the history of unpublished `0.1.x` and `0.2.0` (extraction from qdadm, plugin/migration/entity move to `@quazardous/qdcms-core`, i18n primitives extraction), see the qdadm root [CHANGELOG.md](../../CHANGELOG.md) entries — qdcore versions tracked qdadm releases before this first standalone publish.
