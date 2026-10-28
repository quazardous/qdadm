---
'@quazardous/qdadm': minor
---

`formatBytes(bytes, locale?, units?)` writes sizes in the locale: the number through `Intl` (`1,4 Mo`, `1.4 MB`, no trailing `.0`) and the units of the language, o / ko / Mo / Go / To in French, B / KB / MB / GB / TB otherwise (`byteUnits(locale)`). A value that rounds up to 1024 moves to the next unit. `formatBytes(n)` still works, with the browser locale; English output changes from `1.0 MB` to `1 MB`.

`useFormatBytes()` formats in the app's language with the catalogue's units (`core.units.bytes.*`); PayloadViewer and EmailPreview use it. ShowDisplay has a `bytes` type, and the show field resolver maps the schema types `bytes` and `filesize` to it.
