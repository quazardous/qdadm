---
"@quazardous/qdadm-mcp": patch
---

DOM screenshots of a scrolled page show fixed elements where the user sees them (#2312).

A `position: fixed` sidebar came out cut, with black under it, and a full-screen overlay came out garbled: the page is rendered whole, as at scroll 0, then cropped at the scroll. The clone snapdom renders now gives each fixed element the box the user sees. The page itself is not touched, and a picture of one element or of the whole page renders as before.
