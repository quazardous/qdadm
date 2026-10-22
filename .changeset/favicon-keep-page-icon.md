---
"@quazardous/qdadm": patch
---

The page icon declared by the app (`<link rel="icon">` in `index.html`, or set in JS before the mount) is no longer replaced by the qdadm logo when `app.favicon` is not set; the logo is only a fallback for a page without an icon. An explicit `app.favicon` still wins, and `favicon: false` leaves the head alone (#4166).
