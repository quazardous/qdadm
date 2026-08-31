---
"@quazardous/qdadm": minor
---

Declare which entities your backend writes out of session, and qdadm routes its events to the right cache (#1888 lot C, reported in #1887). `sse: { entities: ['runs', 'jobs'] }` — or `true` / `'*'` for all — makes the stream's `entity:{created,updated,deleted}` frames (`data: {"entity": "runs", "id": 42}`) invalidate that entity's cache; the frame names are registered for you. Undeclared entities are ignored, since a stream carries more than entity mutations, with a one-off dev warning per entity so a dropped frame is never silent. The routing runs inside the front's security scope: an event for an entity the current user cannot read is dropped rather than refetched. `LiveEntityRouter` is transport-agnostic — its `notify(entity, action, id)` entry point takes a plain fact, so a WebSocket or a `BroadcastChannel` between two tabs attaches the same way SSE does.
