# Notifications

Try it in the demo: **Features → Notifications**, and the *Simulate a change
made elsewhere* button on a JP user.

One place, the badge on the sidebar logo, says what is happening in the app:

- **what happened** — a history of toasts and other entries, in a panel;
- **what needs attention** — the logo blinks for an unread warning or error, and
  a count shows how many entries are unread;
- **what is in progress** — a ring turns around the logo while work lasts.

## Enable

```js
new Kernel({
  notifications: { enabled: true },
})
```

Without it, nothing changes: toasts pop up and leave no trace, and the badge is
not rendered.

## Toasts leave a trace

Toasts display exactly as before. With notifications enabled, each one is also
recorded in the history — for as long as its **keep level** says:

| `keep` | Stays in the list | Default for |
|---|---|---|
| `'none'` | not recorded | — |
| `'short'` | 5 minutes, then dropped, read or not | `success`, `info` |
| `'long'` | until cleared, or pushed out by the cap | `warn`, `error` |

A routine "Saved" is not news five minutes later; a failure stays until someone
clears it.

Set it per toast, from the orchestrator or from a component:

```js
orchestrator.toast.success('Exported', '1 240 rows', { keep: 'long' })
orchestrator.toast.info('Autosaved', undefined, { keep: 'none' })

const toast = useSignalToast('ImportPage')
toast.warn('Import finished', '3 rows skipped', undefined, { keep: 'long' })
```

`forceToast` no longer does anything: toasts always pop up.

Or change the defaults for the app:

```js
notifications: {
  enabled: true,
  keep: { success: 'none', info: 'short', warn: 'long', error: 'long' },
  shortKeepMs: 10 * 60 * 1000,
  maxNotifications: 100,        // default 50
}
```

The history lives in memory: it is per browser tab, and a page reload empties it.

## Entries that lead somewhere

An entry with `to` — a vue-router location — takes the user there when clicked:

```js
orchestrator.toast.warn('Import finished with errors', '3 rows skipped', {
  to: { name: 'import-show', params: { id: 42 } },
})
```

## Changes made elsewhere

When a detail page reloads because its record changed outside the session (see
[live entities](live-entities.md)), it adds one `short` entry — `Offer "Dune"
updated elsewhere` — linked to the record, without a pop-up. Lists add nothing:
a list refreshing for fifty rows would bury the history.

## Activity on the badge

qdadm counts its own page loads — detail, form and list pages, first loads and
live reloads — and the ring appears once work has lasted **400 ms**. A fast
reload shows nothing, so the badge does not flicker.

Count your own work the same way:

```js
const { track } = useNotifications()

await track(api.post('/reports/generate', params))
```

`track` returns the promise unchanged. The ring stays while any tracked work is
in progress, and clears when the last one settles.

## From code

```js
const {
  notifications, unreadCount, hasAlert, isBusy,
  addNotification, markRead, markAllRead, removeNotification, clearNotifications,
  registerStatus, updateStatus, removeStatus,
  track, open, close, toggle,
} = useNotifications()

addNotification({ severity: 'info', summary: 'Sync complete', keep: 'short', to: { name: 'sync' } })
```

`addNotification` returns the entry's id, or `''` when its keep level is `none`.
Without notifications enabled, `useNotifications()` returns a store that does
nothing, so code using it needs no guard.

## Status items

A module can pin a standing status at the top of the panel, apart from the
history:

```js
registerStatus({ id: 'overdue', label: '3 books overdue', severity: 'warn', count: 3, to: { name: 'loans' } })
updateStatus('overdue', { label: '2 books overdue', count: 2 })
removeStatus('overdue')
```

A `warn` or `error` status also makes the logo blink.
