---
"@quazardous/qdadm": patch
---

The edge bar (#5509): its tabs are one strip of joined handles, the chevron at its outer end, at the top or the bottom of the bar (`tabsAt`); the tabs and the panel slide as one drawer, in a single slower motion (`--qd-edge-duration`, 0.32s), where the panel used to slide in while the tabs jumped. Closed, the panel is hidden and inert; its content stays drawn until the drawer is shut.
