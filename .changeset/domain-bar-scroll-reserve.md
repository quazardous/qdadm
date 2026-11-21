---
'@quazardous/qdadm': patch
---

Domain bar (#5442): going compact on the scroll no longer makes the page flicker. The bar lost the height of its cards row, and the browser's scroll anchoring (or the scroll clamped on a short page) brought the top back into view, so the bar flipped full and compact in a loop. A spacer under the bar now keeps the height it lost, in the same render as the compact bar, and goes with it back at the top; a compact the person chose keeps none.
