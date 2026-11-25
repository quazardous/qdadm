---
"@quazardous/qdadm": minor
---

The edge bar's panel is resizable (#5519): a handle on its inner edge, dragged or moved from the keyboard (a `separator`: arrows, Shift, Home, End), within `minWidth` (default 18rem) and `maxWidth` (default 60vw, never past 92vw); a double click goes back to `width`. The browser keeps the width; pinned, the page's room follows it. No handle on a narrow screen; `resizable: false` takes it away. `useEdgeBar().width` and `resize(px)`.
