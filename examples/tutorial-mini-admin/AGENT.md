# Let an agent add a feature to this app

This example has the tutorial's Step 6 wiring: under `npm run dev`, every tab
connects to the local MCP relay on its own.

## Attach the agent

```bash
claude mcp add qdadm -- npx qdadm-mcp-relay --stdio
```

Run `npm run dev`, open http://localhost:5173/ and log in (`admin` / `admin`).
The agent works in that tab, as you. `instances` lists it as "My Admin".

## The task

> Add a required `pages` field to books and show it in the book list. Check it
> in the running app.

### 1. The code

```ts
// src/modules/books/BooksModule.ts — next to the other books fields
pages: { type: 'number', label: 'Pages', required: true, default: null },
```

```vue
<!-- src/modules/books/pages/BookList.vue — in #columns -->
<Column field="pages" header="Pages" sortable style="width: 100px" />
```

The edit and create forms build their fields from the entity, so only the list
needs a new column.

### 2. Check it through the MCP

Here is what a run on this app returned. Refs change from one run to the next:
take them from your own snapshot.

The column: `navigate` to `/books`, then `find` with `{ "role": "columnheader" }`.

```
- columnheader "Pages" [ref=e25] — in row "Title Author Year Pages Actions"
```

The form: `navigate` to `/books/1/edit`, then `page_snapshot` with
`{ "filter": "interactive" }`.

```
- spinbutton "Year" [value="1965"] [ref=e58]
- spinbutton "Pages" [ref=e59]
- button "Update" [disabled] [ref=e60]
```

The field is required. Change the year so the form has something to save,
then click Update with Pages still empty:

```
fill e58 "1966" → press_key "Tab" → click e60
feedback.toasts: warn "Validation Error" — "Please fix the errors before saving"
page_snapshot:
  Form errors:
  - Pages: Pages is required
```

Fill it in and save:

```
fill e59 "412" → press_key "Tab" → fill e58 "1965" → press_key "Tab" → click e60
feedback.toasts: success "Success" — "Book updated successfully"
feedback.signals: entity:presave, entity:postsave, entity:updated, …
```

What was stored, and what the list shows:

```
entity_get { "entity": "books", "id": "1" } → "pages": 412
navigate /books, find { "text": "412" }
- cell [ref=e81]: 412 — in row "Dune Frank Herbert 1965 412"
```

## Reading the feedback

- On the edit page, `i18nMissing` lists `entities.books.fields.title`, `author`,
  `year` and `pages`. This app ships no translations and shows each field's
  `label` instead. A key that shows up there only after your change is the one
  to look at.
- A number field keeps what was typed once it loses focus. Press Tab after
  `fill`, or Update stays disabled.
- A `type: 'number'` field holds whole numbers: typing `12.5` stores `125`.
