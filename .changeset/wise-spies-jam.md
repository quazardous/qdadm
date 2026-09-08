---
'@quazardous/qdadm': minor
---

`show` is a real layout now, instead of a name nothing could honour

`crud({ show })` has always registered its detail route with
`meta: { layout: 'show' }` — for a layout that existed nowhere. `LAYOUT_TYPES`
knew four names and `show` was not among them; the Kernel built its layout map
as a closed four-key literal, so a `layouts: { show }` an app passed was
dropped without a word; and no name pattern could reach it either. The
resolver returned `'show'`, found no component under that key, and fell back
to `base` — gracefully, which is exactly what made it invisible. The only way
to dress a detail page was to lie and declare it a form.

`show` is now a layout like the others, reachable four ways: `meta.layout`, a
`layouts: { show }` (or `ShowLayout`) on the kernel, a `*-show` route name, or
a `*Show` component name. The last two matter more than they look: an app that
declares its detail route by hand rather than through `crud({ show })` has no
`meta.layout` to go on, and they are its only path.

**Inert unless you ask for it.** With no `show` layout supplied, resolution
reaches `'show'`, finds `null`, and falls back to `base` exactly as before. No
existing page changes appearance. To use it, pass `layouts: { show }`.
