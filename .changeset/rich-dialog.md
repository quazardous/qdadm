---
'@quazardous/qdadm': minor
---

Rich dialog (#5445): a generic modal with no business meaning (what's new, a licence, a charter are uses of it). `useRichDialog().open(options)` returns a Promise of `{ action, values }`, and opens are queued one at a time; the kernel and `<QdadmRoot />` mount the host. `QdRichDialog` is the same as a component.
- Blocks stack in a scrolling area. Each is drawn by a content handler: native `text`, `markdown` (marked) and `html`, both sanitised with DOMPurify and loaded on first use, or the app's own (`registerDialogContent`). An unknown kind is warned and skipped.
- The action area holds declared buttons and controls. Controls use native `toggle` (default) and `checkbox` handlers, or the app's own (`registerDialogControl`), and their values come back in the result. Alternatively, the app's own footer (`footer` / `#footer`) receives `read`, `ready`, `values`, `resolve` and `close`.
- `readToEnd` and `required` controls gate the `requiresRead` buttons, with a hint linked for screen readers. `dismissable: false` turns off Escape and ×.
- New dependencies: `marked` and `dompurify`.
