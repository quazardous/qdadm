---
'@quazardous/qdadm': minor
---

A value shown once (#5319): an entity's `revealOnce: { keys, item? }` takes the values a create answer reveals once (an API key's token, a generated password) out of it before the cache, the postsave hooks and the signals see it. `manager.createRevealing(data)` returns `{ entity, revealed }`, and the create form shows them in the new `QdRevealOnce` dialog (copy button, a warning, "I have copied it") before it navigates, keeping them in the page's memory only. The clipboard code LogStream used is now a shared `copyText` helper.
