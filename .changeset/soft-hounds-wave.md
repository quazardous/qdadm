---
'qdadm-demo': patch
---

The demo's todos search works, and its storage stops copying a pipeline

Two bugs, one cause. `TodosLocalOverlayStorage` needed its local patches
applied before anything filtered, and got that by **copying its parent's whole
`list()`** — the comment said so out loud: "we shadow the parent and inline the
same pipeline". The copy then drifted. Search support was added to the
original and the todos list went on ignoring it.

The parent now exposes a `_transformItems()` hook for exactly that one step, so
the overlay overrides four lines instead of forty and there is one pipeline
again. The next thing added to it will reach todos without anyone remembering
to copy it across.

The json-server dialect also gained `search: 'q'`, which is how JSONPlaceholder
spells full-text search — without it qdadm sent `search=` to an API that has
never heard of it, which answered with everything.
