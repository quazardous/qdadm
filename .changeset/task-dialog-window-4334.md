---
'@quazardous/qdadm': minor
---

TaskRunner (#4334): the follow dialog moves by its title bar, resizes by its corner (the log follows) and goes full screen (Escape leaves full screen first); its size, position and full screen are kept per app and restored, clamped to the screen; under 640px it is unchanged. Customisable without a qdadm release: `configureTasks({ dialog, slots, component, tray })` for the app, the same `dialog`, `slots` and `component` on a task kind, then a page's props. TaskDialog has `header`, `before-log`, `after-log` and `actions` slots (with `result`), a kind or the app can replace the dialog, and the tray row takes an `item` slot or component.
