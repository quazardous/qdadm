---
'@quazardous/qdadm': minor
---

The domain bar extends downward when full (#5424): its indicators become a row of mini cards under the title and the navigation (title on top, value large, a metric's sparkline across, status as a side bar; `--qd-domain-card-width`, `--qd-domain-card-min-height`, `--qd-domain-card-viz-height`). Compact keeps its pills, now with their sparkline while the line has room (dropped when short of room, `data-fit="tight"`), the title in the tooltip. No shadow in either mode (`--qd-domain-bar-compact-shadow` now `none`).
