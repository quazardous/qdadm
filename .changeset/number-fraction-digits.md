---
"@quazardous/qdadm": minor
---

A `number` field can hold decimals (#2316). Its form input accepted whole numbers only, so typing `12.5` saved `125` without any error.

- `fractionDigits: 2` (always two decimals) or `fractionDigits: { min: 0, max: 2 }` sets how many digits the input accepts after the decimal point.
- `min`, `max` and `step` bound the input and set its increment.
- A field without these options renders as before, and a stored value that already has decimals still shows them.
