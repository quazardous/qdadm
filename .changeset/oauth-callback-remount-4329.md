---
'@quazardous/qdadm': patch
---

OAuthCallbackPage no longer flashes "no login attempt pending" after a successful sign-in (#4329). It navigates to the destination before emitting `auth:login`, so the app remount that signal triggers happens there, not on the callback. A second mount of the same callback awaits the first completion instead of calling `completeLogin` again, and a used callback opened while signed in (reload, back button) redirects instead of showing an error.
