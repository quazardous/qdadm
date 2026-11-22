---
'@quazardous/qdadm': minor
---

The run bar's strip takes the app's colours per item: `RunItem.tone` while it is to do, `doneTone` once done (`critical`/`danger`, `watch`/`warn`, `good`/`success`, `info`, `neutral`/`secondary`, or the app's own `--qd-tone-<name>`; `runToneColor` exported), today's colours without them; the current segment keeps its colour, with a neutral ring and a taller shape instead of the accent outline (#5455)
