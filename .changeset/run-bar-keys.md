---
'@quazardous/qdadm': minor
---

The run bar's keys are configurable: `features.run.keys` for the app, `RunInit.keys` per run (kept with it), `{ prev, next, back }`, a `KeyboardEvent.key` each, `null`/`false` for none; the buttons' hints and `aria-keyshortcuts` follow (`RunKeys`, `resolveRunKeys`, `DEFAULT_RUN_KEYS` exported). **J and K swap by default: J previous, K next** (left and right on the keyboard, as the bar reads); L back (#5454)
