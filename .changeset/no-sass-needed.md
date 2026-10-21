---
"@quazardous/qdadm": patch
---

fix(styles): an app builds without sass (#4140). `NotificationModule`, which the kernel injects into every app, and `DebugModule` lazy-loaded `.scss` files. `vite build` then failed with `Preprocessor dependency "sass-embedded" not found`, since sass is only an optional peer. Both now load plain CSS: the notifications stylesheet is written in CSS, and the debug bar's is compiled from its SCSS into a committed `styles.generated.css` (`npm run gen:debug-css`, checked by a test). sass is only needed to import `@quazardous/qdadm/styles/scss`.
