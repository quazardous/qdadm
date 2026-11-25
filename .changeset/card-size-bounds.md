---
"@quazardous/qdadm": minor
---

Dashboards (#5513): the app chooses the smallest and largest card size, `configureDashboards({ cardSizes: { min, max } })` or `<CardsDashboard :card-sizes>`, `'WxH'` up to `6x4` (default 1x1 to 3x2); a card's own sizes are kept within, a default or saved size outside gives the nearest allowed, the picker draws max columns × max rows. The grid's dimensions are CSS tokens on `:root`, overridable for one dashboard with `[data-dashboard="<id>"]`: `--qd-card-min`, `--qd-card-row`, `--qd-cards-gap`, `--qd-cards-columns`; `minCardWidth` defaults to the token. `cardBounds`, `sizesWithin`, `boundCardSizes`, `CARD_LIMIT` exported.
