---
"@quazardous/qdadm": minor
---

The notification badge keeps a trace of what happened, and shows what is in progress (#2677).

**Toasts are recorded.** With `notifications.enabled`, every toast still pops up exactly as before, and is also kept in the history. It never was: `NotificationModule` swapped its listener inside the `_app:toasts` zone, which nothing renders, so the panel only ever showed what a module added by hand. The dead swap is removed.

**Keep levels** decide how long an entry stays: `none` (not recorded), `short` (5 minutes, read or not — default for `success` and `info`), `long` (until cleared — default for `warn` and `error`). Set one per toast (`orchestrator.toast.success(summary, detail, { keep })`) or per app (`notifications.keep`, `notifications.shortKeepMs`).

**The badge** shows the unread count, and a ring while tracked work lasts longer than 400 ms. qdadm tracks its detail, form and list page loads; apps track their own work with `useNotifications().track(promise)`.

**Entries can lead somewhere** with `to` (a vue-router location), on toasts and on `addNotification`.

`keep` and `to` are accepted by `orchestrator.toast.*` options and by `useSignalToast` (last argument, and `add`). `useSignalToast`'s `forceToast` is deprecated and does nothing: toasts always pop up.

**Changes made elsewhere leave a line:** a detail page reloaded by a live update adds one short entry linked to the record, without a pop-up. Lists add nothing.

**The detail page refresh bar is gone** — on short reloads it read as a CSS glitch. A reloading record keeps `aria-busy`, and the badge shows the activity.

`addNotification` now takes `{ severity, summary, detail?, emitter?, keep?, to? }` and returns `''` when the entry is not recorded. New doc: `docs/notifications.md`.
