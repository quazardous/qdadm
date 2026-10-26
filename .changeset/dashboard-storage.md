---
'@quazardous/qdadm': minor
---

CardsDashboard: the app chooses where arrangements are kept (#4338), with the `storage` prop or `configureDashboards({ storage })`. A storage has `load(key)` and `save(key, arrangement | null)`, sync or async, so a dashboard can follow the account across devices. `localStorage` stays the default. An async load holds the cards back for a short grace (`loadGrace`, 150 ms), so a quick answer shows without a flash of the default order. A failed load keeps the defaults. An edit is saved once, on Done (or Reset), instead of at each move. A failed save shows a toast and keeps the edit open. `useCardsArrangement` takes `{ storage, autoSave, loadGrace }`; `commit()` and `reset()` now return a promise.
