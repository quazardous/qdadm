---
"@quazardous/qdadm": minor
---

Sidebar user box (#4157): `app.userRoute` turns the user's name and avatar into a link to their profile page (an app route, or an external URL opened in a new tab), and only the sign-out glyph logs out. `app.userAvatar` (default `user.avatar` / `user.avatarUrl`) shows a picture, with the initials when there is none or it fails to load. The logout and profile tooltips come from the i18n catalog. `useUserBox()`, `resolveUserAvatar()` and `isExternalUserLink()` are exported for custom layouts.
