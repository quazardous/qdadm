---
"@quazardous/qdadm": minor
---

Top banner (#4200): `app.banner` and `useAppBanner()` show messages in a strip across the top of AppLayout, BaseLayout and LoginPage. The layout and the top toasts start below it (`--qd-banner-height`). With several messages it shows one at a time with ‹ n/N ›. Each message can be closable or not; closing one shows the next, and a closed message with an `id` stays closed for the session. New component `AppBanner`.
