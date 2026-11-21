---
"@quazardous/qdadm": minor
---

A new `flash` block for cards (#5414): a "flash info" banner carrying an urgent message about the card, such as a source that is down or a threshold that was crossed.

- **Placement.** `place: 'top'` draws it under the header and `'bottom'` above the foot. That holds wherever the block is declared: `envelope.blocks`, a dashboard block's `card.blocks`, or the data of a `blocks` card.
- **Shown in every state.** The banner appears even when the card cannot draw its body, for example when it is unreachable.
- **Levels.** Each message is `info`, `warning` or `critical`, with the card's tones and icons. The most serious message comes first, and a critical one is announced as an alert.
- **Links.** A message can link to a route with `to`.
- **Dismissing.** With `dismissible`, the reader can close the banner. Add an `id` to keep it hidden for the rest of the browser session.
