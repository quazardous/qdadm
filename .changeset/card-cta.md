---
"@quazardous/qdadm": minor
---

Every card has a CTA zone in its foot holding all its gestures: `envelope.links` (`[{ label, icon, to | run | onClick }]`), the app's own buttons from a `#cta` slot, and the main action; a dashboard block's `card.links` reaches the card it draws. `QdFavoritesCard` and `QdRecentCard` take `moreTo` (the app's full list) and `more: 'overflow' | 'always'` for a "See all (N)" link; the Favourites card then drops its "+N" line.
