---
"@quazardous/qdadm": patch
---

A deep link opened without a session comes back after the login (#5524): the route guard sends to `login?redirect=<the page>` and an expired session to `login?expired=1&redirect=<the page that was open>`; `LoginPage` honours `?redirect=` (form and `beginLogin`) ahead of its `redirectTo` prop, and `OAuthCallbackPage` follows it. Only a local path is followed: `safeRedirect(value, fallback)`, exported, refuses `//host`, schemes, backslashes and control characters.
