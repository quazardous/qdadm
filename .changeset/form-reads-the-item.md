---
"@quazardous/qdadm": minor
---

An edit form reads the record itself, never a row from the list cache (#2484).

In symmetric mode — the default — a valid list cache answered `get()` with the **list row**. An edit form opened after its list had loaded was filled from that row, and when the list endpoint returned summaries, the missing fields showed empty and were saved back empty: a role lost its permissions in production.

- `EntityManager.get(id, context, { listCache: false })` reads the item from storage.
- The edit form loads with it, whatever the entity mode. Show pages still read the cache: they only display.
- In debug mode, the form reports once in the console a field it edits that the loaded record does not carry, so an incomplete record endpoint shows up before a save.
- The kernel provides `qdadmDebug` to composables.

The roles docs note `asymmetric: true` for APIs whose roles list is a summary.
