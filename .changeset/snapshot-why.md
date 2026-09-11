---
"@quazardous/qdadm-mcp": minor
---

`page_snapshot` says why each entity action is allowed or not (#2363), from qdadm's `security.explain`:

```
Entity: books — list ✓, create ✓, update ✓, delete ✗ (checks entity:books:<action>)
Why: list ✓ via ROLE_USER → entity:*:list
     create ✓ — decided by the app's grant function
     update ✓ via ROLE_USER → entity:*:update
     delete ✗ — no grant covers entity:books:delete (roles: ROLE_USER)
```

When the entity refuses an action before the grant check, such as a read-only entity, the line says so.
