---
"@quazardous/qdadm": patch
---

A first visit no longer lands on `/login?session_lost=1` (#2292).

The auth guard added `session_lost=1` to every redirect to login. It now adds it only when a session this tab had is gone, the same case that emits `auth:session-lost`. A first visit goes to `/login`, so an app can read the flag to tell a returning user their session expired.
