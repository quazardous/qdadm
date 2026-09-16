---
"@quazardous/qdadm": minor
---

A detail page can subscribe to its record on the stream: `sse.subscriptions` (#2664).

For backends that send a record's changes only to the tabs that asked for it.

```js
sse: { url: '/api/events', entities: ['offers'], subscriptions: { url: '/api/events/subscriptions' } }
```

- A page on `useEntityItemShowPage` sends `POST {session, entity, id}` when it shows a record, renews at half of the returned `expires_in`, and sends `DELETE` with the same body when it leaves or shows another record. Lists do not subscribe, nor do entities with `live.refresh: false`.
- `session` is a per-tab id qdadm keeps in `sessionStorage` and appends to the stream URL (`sessionParam`, default `session`), so the stream and the subscriptions name the same tab. Do not put your own session parameter in `sse.url`.
- Calls go through the kernel's `apiClient`, with the app's own auth. A failure never breaks the page; debug mode logs the entity, the id and the status.

Without `sse.subscriptions`, nothing changes.
