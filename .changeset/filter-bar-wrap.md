---
'@quazardous/qdadm': patch
---

The list's filter bar wraps (#5432): with many filters, they flow onto as many lines as needed (each about 12rem, its min-width kept, never wider than the bar) instead of pushing "clear filters" and the search's bookmark past the frame. Those two sit together at the end of the last line, inside the bar, and move down as a pair. No horizontal scroll at any width.
