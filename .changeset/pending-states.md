---
'@quazardous/qdadm': minor
---

Waiting states for asynchronous reads (#4665). `useAsyncRead(loader)` returns `{ data, error, loading, ready, pending, load }`: loading from the start, `data` undefined until the first answer (`null` and `[]` are answers), `ready` after the first success, `pending` for a gesture's `:disabled`, the latest call wins, and a failure stops the wait and keeps the last good data. `QdPending` is a neutral spinner badge until its value is read (a muted "Unavailable" when the read fails), `QdPendingZone` an area with a skeleton or a spinner, a readable error with Retry, and a dimmed content while it reads again. Both take the composable as `:read`, set `aria-busy`, and stand still under `prefers-reduced-motion`.
