---
"@quazardous/qdadm": minor
---

The domain bar gets a `ribbon` look: a panel glued to the top edge of the content, full width, a rule at the bottom, its pages as tabs, the current one merged into the panel; compact on scroll keeps the edge. Per domain (`ctx.domain(name, { look: 'ribbon' })`) or for the whole app (`features: { domainBar: { look: 'ribbon' } }`); the card stays the default. Both looks are drawn from CSS custom properties (`--qd-domain-bar-*`, `--qd-ribbon-*`) an app changes in its own CSS.
