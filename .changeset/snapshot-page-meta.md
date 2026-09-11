---
"@quazardous/qdadm-mcp": minor
---

`page_snapshot` says what the page is made of, not only what it shows (#2342).

- **A header under the `Page:` line:**
  - the layout and page components, with their source file in dev (`Layout: MainLayout → AppLayout`, `Component: BookList (src/modules/books/pages/BookList.vue)`);
  - the entity and what the current user may do with it, with the permission key checked (`Entity: books — create ✓, update ✓, delete ✗ (checks entity:books:<action>)`);
  - on an item page, the active stack (entity and id at each level).
- **qdadm zones in the tree.** A zone on screen shows as `zone "books-list-header" [blocks: filter-genre GenreFilter, export-btn ExportButton]`, with what it renders indented below it. Empty zones are left out.
- **`filter: "interactive"`** adds `— in zone "…"` to each element inside a zone.
- **`meta: false`** returns the tree as before, without the header and the zone lines.
