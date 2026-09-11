---
'@quazardous/qdadm': patch
---

ShowPage with a `#media` slot: the fields column no longer grows to its longest unbreakable content (a URL, a `<pre>`) and pushes the card past its container. Both grid tracks — desktop and below 768px — are `minmax(0, 1fr)`, so such content scrolls or wraps inside the column.
