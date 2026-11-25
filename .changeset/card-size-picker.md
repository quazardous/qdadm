---
"@quazardous/qdadm": minor
---

A dashboard card's size is width × height, `'1x1'` to `'3x2'` (#5503), picked on a small grid instead of the Small / Medium / Large choice: hovering or dragging from its corner lights the rectangle, a click or a release picks it, the sizes the card does not allow greyed out, the keyboard too (arrows, Enter, Escape). A card two rows high spans two grid rows; its body reads the slot's size with `useCardSlotSize()`. `card.rows` sets a block's default height; `sizes` takes `'WxH'`, `s`, `m`, `l` still read as `1x1`, `2x1`, `3x1` (saved arrangements included). `CARD_SIZES` now lists the six sizes; `cardSize`, `cardRows`, `cardSizeParts`, `normalizeCardSize`, `CARD_MAX` and `QdCardSizePicker` are exported.
