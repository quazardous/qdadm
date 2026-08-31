---
"@quazardous/qdcore": patch
---

Fix: named SSE events survive a reconnect (#1898 lot F). Listeners registered with `registerEvents()` were bound to the EventSource instance current at the time, and every reconnect builds a new one — so after the first transient drop the named channel was dead. Silently: the stream stayed connected, tickets kept being issued, `sse:connected` kept firing, and unnamed events kept flowing because `onmessage` is re-attached on each connect. Anything routing named events stopped working, which includes qdadm's live entities. The bridge now remembers the registered names and re-attaches them on every connection, so a caller registers once and the subscription holds for the life of the bridge. `registerEvents()` is also safe to call before connecting — previously a silent no-op — and safe to call twice, binding each name once per connection.
