---
'@quazardous/qdcore': minor
---

`sse.idleTimeout` — because a stream can die without anyone being told

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
