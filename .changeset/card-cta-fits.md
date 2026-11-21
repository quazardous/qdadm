---
"@quazardous/qdadm": patch
---

A card's footer no longer pushes its buttons past the card's edge (#5413). When there is not enough room beside the footer text, the CTA zone wraps onto its own line, right-aligned. A link or action label too long for the card is cut with an ellipsis and its icon stays visible. The full label is kept in the button's `title` and `aria-label`.
