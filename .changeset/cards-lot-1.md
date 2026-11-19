---
'@quazardous/qdadm': minor
---

Ready-made dashboard cards (#5339, lot 1 of #5337).

- `QdCard`, the envelope every card shares: title, status (`critical | watch | good | info`, a side bar, a hue and a word), source and freshness, the surface link to the domain's board and the main action (`{ verb, count, mode: 'next' | 'list', to | run | onClick }`), the `loading`, `unreachable`, `empty` and `invalid` states, sizes `s | m | l`.
- `registerCard({ type, component, meta, schema })` and `QdCardView`: a card type ships its sheet and the JSON Schema of its data; data that does not fit draws the `invalid` state with its reasons instead of breaking the board.
- The generic cards `metric`, `queue`, `goal` and `bullet`, data only, drawn in SVG and CSS.
- `QdCardsGallery`: every registered card in each size, state and theme.
- The `qdadm-cards` CLI and `@quazardous/qdadm/cards/tools` (`writeCardsIndex`, `checkCards`): the index and the bestiary (`docs/cards.md`) generated from the sheets, and their check.
