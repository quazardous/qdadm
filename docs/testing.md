# Testing a qdadm app

The examples below are real tests: they live in
[examples/tutorial-mini-admin/tests](../examples/tutorial-mini-admin/tests) and run
with the repository's `npm test`.

## Setup

[Vitest](https://vitest.dev) with jsdom. Give the tests their own config: an app's
`vite.config.ts` may carry dev-only plugins (the MCP relay plugin starts a server)
that a test run must not load.

```ts
// vitest.config.ts
import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import { qdadmVitePlugin } from '@quazardous/qdadm/vite'

export default defineConfig({
  plugins: [vue(), qdadmVitePlugin()],
  test: { environment: 'jsdom', include: ['tests/**/*.test.ts'] },
})
```

## An entity

An `EntityManager` works on its own: no kernel, no DOM. Give it the storage your
module uses, a `MockApiStorage` for data kept in memory and localStorage.

```ts
// tests/books.entity.test.ts
const books = new EntityManager<Book>({
  name: 'books',
  labelField: 'title',
  fields: { title: { type: 'text', label: 'Title', required: true, default: '' } /* … */ },
  storage: new MockApiStorage({ entityName: 'books', storageKey: 'test_books', initialData: [/* … */] }),
})

expect((await books.list()).items.map((b) => b.title)).toEqual(['Dune'])
const created = await books.create({ title: 'Neuromancer' })
expect((await books.get(created.id)).title).toBe('Neuromancer')
expect(books.getRequiredFields()).toEqual(['title'])
```

`required` is enforced by the form pages, not by `create()`:
`getRequiredFields()` is what to check at this level.

## A page

Boot the app's own `Kernel`, with its modules and pages, and mount it in jsdom.
[tests/books.page.test.ts](../examples/tutorial-mini-admin/tests/books.page.test.ts)
does it for the books list:

1. **Set the session before importing the app.** A localStorage auth adapter reads its
   session when its module loads. Store it the way the adapter does
   (`{ token, user }` under its key), then import the app with `await import(…)`.
   The test never types into a login form.
2. **Give jsdom what PrimeVue asks for**: `window.matchMedia` and `ResizeObserver`.
3. **Build the Kernel as `main.ts` does**, without what a test does not need: the
   MCP connector, the stylesheets, `debug`.
4. **Mount, navigate, wait:** `kernel.createApp().mount(host)`, then
   `await kernel.router.push('/books')`, then `vi.waitFor` until the rows show.
   The first boot takes a few seconds, so give the test a timeout above Vitest's
   default 5 s.

## While developing: the MCP

For end-to-end checks on the running app, an agent drives the real tab through
the MCP. `page_snapshot` shows what the page is made of and what it is doing;
`fill`, `click` and `entity_get` act and check what was stored. See
[DEBUG.md](DEBUG.md) and the tutorial's [AGENT.md](../examples/tutorial-mini-admin/AGENT.md).
