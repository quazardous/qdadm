# 0008 — Namespaced localStorage keys for shared origins

**Status:** Accepted (backfilled 2026-08-20)

## Context

`MockApiStorage` persists to `localStorage` so a demo survives a reload, and
`LocalStorageSessionAuthAdapter` keeps the session there too. Both defaulted to
generic keys — `mockapi_${entityName}_data`, `qdadm_auth`.

`localStorage` is scoped to an **origin**, not to a path. This repo publishes
three apps to GitHub Pages under one origin (`/demo`, `/hello-world`,
`/tutorial`). With generic keys, opening two of them means one app's `books`
overwrite the other's, and a login in one silently authenticates the other.
The same collision hits any consumer running several qdadm apps on one host, or
a dev machine cycling apps on `localhost`.

## Decision

Storage keys are **overridable, and the examples override them**:

- `MockApiStorage` accepts `storageKey`, defaulting to
  `mockapi_${entityName}_data`, and exposes it as a public getter.
- `LocalStorageSessionAuthAdapter` accepts `storageKey` and carries a mutable
  `defaults.storageKey` so an app can set its namespace once at boot.
- Every example in this repo passes an explicit, app-prefixed key
  (`tutorial_mockapi_books_data`, `hello_mockapi_tasks_data`, …).

The default stays generic on purpose: a first-time single-app user should not
have to name a storage key to get a working demo.

## Consequences

- The published examples coexist on one origin without corrupting each other.
- The convention is visible where it matters — a reader copying from the
  tutorial copies the prefix and the comment explaining it.
- Because the key is public, tooling can find the data: the MCP connector's
  storage dump reads the manager's storage key rather than guessing at
  `mockapi_*`.
- Renaming a key orphans whatever is already in a user's browser. There is no
  migration; for mock data that is acceptable, and for the auth session it
  means a logout.
- The safe default is still the colliding one. An app deployed alongside
  another qdadm app has to opt in, and nothing warns it at runtime.
