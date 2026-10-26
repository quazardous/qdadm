---
'@quazardous/qdadm': minor
---

Sessions module (#4336): `SessionsModule` (or `createSessionsModule`) beats every 30 s while the tab is visible and someone is signed in, shows "Also signed in: X (since 10 min)" in the app banner while others are here, and adds a Sessions page under a permission: who is signed in, the paged sign-in history with a notice when it is incomplete, and Close on a session with a required reason. It runs over a `SessionsAdapter`; `restSessionsAdapter(base)` speaks the HTTP contract (heartbeat, list, history, close), with `historyNotice` to map a server's own field.
