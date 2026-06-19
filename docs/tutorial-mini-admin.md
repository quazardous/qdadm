# Tutorial — build a mini admin

The hands-on way to learn qdadm is the **demo app** plus the **page-compositions guide** —
both are kept in sync with the real API.

## 1. Run the demo

```bash
npm install        # from the repo root
npm run dev        # demo at http://localhost:5175
```

## 2. Read a real module

The `books` module is the worked example — a full CRUD with a child entity (`loans`),
a custom child page, and a stats page:

| File | Shows |
|------|-------|
| `packages/demo/src/modules/books/BooksModule.js` | Module class: `ctx.entity()`, `ctx.crud()`, child routes, nav |
| `packages/demo/src/modules/books/pages/BookList.vue` | List page (`useListPage` + `ListPage`) |
| `packages/demo/src/modules/books/pages/BookForm.vue` | Single create+edit form (`useEntityItemFormPage` + `FormPage`) |
| `packages/demo/src/modules/books/pages/BookLoans.vue` | Child list under a parent |
| `packages/demo/src/modules/books/pages/BookStats.vue` | Custom non-CRUD page |
| `packages/demo/src/modules/_template/` | Empty module to copy when starting your own |

## 3. Pick the right composition

- **[page-compositions.md](./page-compositions.md)** — "I want X → use Y" decision table
  (start here).
- **[crud.md](./crud.md)** — full reference for each page type (methods, slots, options).

## 4. Concepts

- **[QDADM_CREDO.md](../packages/qdadm/QDADM_CREDO.md)** — philosophy (storage invisible,
  ListPage by default).
- **[architecture.md](./architecture.md)** — PAC pattern and layer isolation.
