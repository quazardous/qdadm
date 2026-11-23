# A storage's list contract

What a list asks of its entity's storage, what it must answer, and when the
manager pages from its own cache instead of the server. This is the contract
behind every entity list. A backend or a storage that gets it wrong usually
does not fail: the list simply shows one page, or the wrong rows.

- [What `list(params)` receives](#what-listparams-receives)
- [What it must return](#what-it-must-return)
- [Speaking your API's dialect](#speaking-your-apis-dialect) (`ApiStorage`)
- [The local cache](#the-local-cache)
- [A storage of your own](#a-storage-of-your-own)
- [Testing it](#testing-it)

## What `list(params)` receives

A list calls `manager.query(params)`, which reads through the storage's
`list(params)`:

| Param | Meaning |
|---|---|
| `page` | The page, from 1 |
| `page_size` | Rows per page |
| `sort_by` | The field sorted on, or absent |
| `sort_order` | `asc` or `desc`, with `sort_by` |
| `search` | What was typed in the search box, or absent |
| `filters` | An object, one key per active filter (blank ones left out) |

There is no `offset`. A backend paged by offset and limit computes it:
`offset = (page - 1) * page_size`, `limit = page_size`.

`ApiStorage` sends all of these as query parameters, the filters flat beside
the others (`?page=2&page_size=20&status=open`). Their names are qdadm's;
`paramMapping` gives them your backend's ([below](#speaking-your-apis-dialect)).

A filter of several values ([crud.md](./crud.md#several-values-grouped-and-badged))
gives an array. `ApiStorage` writes it the way `arrayFormat` says, whatever
the HTTP client:

| `arrayFormat` | On the wire |
|---|---|
| `'comma'` (default) | `types=a,b` |
| `'repeat'` | `types=a&types=b` |
| `'brackets'` | `types[]=a&types[]=b` |
| `'client'` | the array as is, left to the client (axios writes brackets) |

Per parameter: `arrayFormat: { '*': 'comma', tags: 'repeat' }`. A storage of
your own receives the array and sends it as its backend reads it.

## What it must return

```js
{ items: [...], total: 60 }
```

- `items`: the rows of the page asked for.
- `total`: the number of **all** the rows matching the query, filters and
  search included. It is not the length of the page. The paginator draws its
  pages from it, and the cache decides from it whether the whole entity fits.

When it is wrong, nothing fails, but the list shows the wrong thing:

| `total` | What the list shows |
|---|---|
| Missing from an object body | `ApiStorage` returns 0. The list falls back to the rows it got, so the paginator shows a single page |
| The page's length | One page only: the next page is never offered |
| The count of all rows, ignoring the filters | Pages that come back empty past the filtered rows |
| Right, but under the threshold and the items incomplete | An incomplete cache (see [The local cache](#the-local-cache)) |

## Speaking your API's dialect

Everything below is `ApiStorage`'s; a storage of your own does its own
mapping.

**The parameters.** `paramMapping` renames the whole outgoing query:
pagination, sort and search included, not only the filters.

```js
new ApiStorage({
  endpoint: '/posts',
  // json-server / JSONPlaceholder
  paramMapping: {
    page: '_page', page_size: '_limit',
    sort_by: '_sort', sort_order: '_order',
    search: 'q',
  },
  responseTotalHeader: 'X-Total-Count',
})

new ApiStorage({
  endpoint: '/api/tasks',
  paramMapping: { page_size: 'limit', status: 'state' },
})
```

**The search box sends `search`.** If your backend calls it something else,
map it. An unmapped `search` reaches an API that has never heard of it. That
API answers with everything, so the list looks as if the search did nothing.

`searchFields` stays on the front. It tells qdadm which fields to look at when
filtering a cached page locally; a backend that searches knows its own columns.

Filters keep precedence over the pagination keys: a filter named `page`
overwrites the page number. Rename one of the two.

**The answer.** In this order:

1. **The total from a header**, when `responseTotalHeader` names one
   (`X-Total-Count` is the json-server convention). From a browser, the
   server must expose it to CORS (`Access-Control-Expose-Headers: X-Total-Count`),
   or it reads as missing.
2. **The total from the body**: `responseTotalKey` (default `total`), else
   `total`. A body that is a bare array counts as its own total.
3. **The items** from `responseItemsKey` (default `items`), else `items`, else
   the body itself when it is an array.

An envelope such as `{ items, total, offset, limit }` works as is: the extra
keys are ignored.

An entity whose list goes to an endpoint of its own (`resolveStorage`
returning an `endpoint`, see [extension.md](./extension.md#multi-storage--multi-endpoint))
reads the total from `total`, then `pagination.total`, on the body or its
wrapper.

## The local cache

Under a threshold, the manager stops asking the server for each page. It
reads the whole entity once and then filters, sorts and pages it locally.

**When:**

1. The first time a list reads the entity, the manager asks for one
   unfiltered page of `localFilterThreshold` rows (100 by default).
2. If the answer's `total` is at most that threshold and every row came back,
   it becomes the cache. If only part of them came back, the rest is read in
   the background.
3. From then on, every list read of that entity, whatever its filters,
   search, sort and page, is answered from the cache (`fromCache: true`),
   without a request.
4. If `total` is over the threshold, the entity is marked too big and every
   read goes to the server, page by page.

The decision is taken on the **whole entity's** count, from that unfiltered
read, not on the filtered count of the list on screen.

**What keeps it fresh:**

- the manager's own writes (create, update, delete) repair it;
- a change from elsewhere drops it: an event from the live stream
  ([live-entities.md](./live-entities.md)), or the app's `invalidate()`;
- `cacheTtlMs` sets how long it lives (default: no limit);
- the list's refresh button, or `list.refresh()`, drops it and reads again
  ([crud.md](./crud.md#refresh)).

**When it is off:**

| Setting | Effect |
|---|---|
| `localFilterThreshold: 0` on the entity | Never cached: always server paging |
| `cacheTtlMs: 0` on the entity | Never cached |
| A storage whose `capabilities` lack `supportsTotal: true` | Never cached ([below](#a-storage-of-your-own)) |
| A storage whose `capabilities` say `supportsCaching: false` | Never cached |
| A list with its own endpoint (`resolveStorage`) | Not cached for that list |

**Turn it off** (`localFilterThreshold: 0`) for data that changes all the
time without telling the front, such as tasks or queues. Under the threshold,
a list would otherwise keep showing its first read until something drops the
cache. With a live stream that announces changes, the cache stays right and
can stay on.

```js
ctx.entity('tasks', {
  storage: tasksStorage,
  localFilterThreshold: 0,   // always ask the server: the queue moves all the time
})
```

## A storage of your own

A backend that `ApiStorage` cannot speak to (offset paging, a signed SDK,
several calls per page) gets a storage of its own. Its `list()` honours the
same contract:

```js
import { IStorage } from '@quazardous/qdadm'

export class TasksStorage extends IStorage {
  // Without supportsTotal the manager never caches this entity, which may be
  // exactly what you want; say it either way
  static capabilities = { supportsTotal: true, supportsFilters: true, supportsPagination: true, supportsCaching: false }

  async list({ page = 1, page_size = 20, sort_by, sort_order, search, filters = {} } = {}) {
    const query = new URLSearchParams({
      offset: String((page - 1) * page_size),
      limit: String(page_size),
      ...(sort_by ? { sort: `${sort_order === 'desc' ? '-' : ''}${sort_by}` } : {}),
      ...(search ? { q: search } : {}),
      ...Object.fromEntries(Object.entries(filters).map(([k, v]) => [k, String(v)])),
    })
    const res = await fetch(`/api/tasks?${query}`)
    const body = await res.json()
    return {
      items: body.items,
      // A fetch Response's headers are a Headers object: read them with get().
      // res.headers['x-total-count'] is always undefined, and the list falls
      // back to one page.
      total: body.total ?? Number(res.headers.get('X-Total-Count')),
    }
  }
}
```

- `IStorage`'s default capabilities are all `false`. Declare what your
  storage does: `supportsTotal: true` once `total` is right, and
  `supportsCaching: false` to keep the cache off for it.
- `get`, `create`, `update`, `patch` and `delete` follow the same idea; only
  `list` has a contract this detailed.

## Testing it

A backend serving 60 rows page by page, with a known total, is enough to
catch every row of the table above.

**Against the manager** (vitest, no browser): qdadm's own copy is
`packages/qdadm/tests/entity/listContract.test.js`.

```js
const ROWS = Array.from({ length: 60 }, (_, i) => ({ id: i + 1, title: `Task ${i + 1}` }))
const calls = []
const client = {
  async get(url, { params }) {
    calls.push(params)
    const items = ROWS.slice((params.page - 1) * params.page_size, params.page * params.page_size)
    return { data: { items, total: ROWS.length }, headers: {} }
  },
}
const manager = new EntityManager({
  name: 'tasks',
  storage: new ApiStorage({ endpoint: '/api/tasks', client }),
  localFilterThreshold: 0,   // server paging
})

const res = await manager.query({ page: 2, page_size: 20 })
expect(calls.at(-1)).toMatchObject({ page: 2, page_size: 20 })
expect(res.total).toBe(60)
expect(res.items[0].id).toBe(21)
```

**In the browser** (Playwright): the app's own list, its backend answered by
a route. qdadm has no Playwright setup of its own, so this one is not run
here; adapt the selectors to your page.

```js
test('the tasks list pages through the server', async ({ page }) => {
  const rows = Array.from({ length: 60 }, (_, i) => ({ id: i + 1, title: `Task ${i + 1}` }))
  const asked = []
  await page.route('**/api/tasks?*', (route) => {
    const url = new URL(route.request().url())
    const p = Number(url.searchParams.get('page') ?? 1)
    const size = Number(url.searchParams.get('page_size') ?? 20)
    asked.push(p)
    route.fulfill({ json: { items: rows.slice((p - 1) * size, p * size), total: rows.length } })
  })
  await page.goto('/tasks')
  const next = page.locator('.p-paginator-next')
  await expect(next).toBeEnabled()
  await next.click()
  await expect(page.locator('.p-datatable-tbody > tr').first()).toContainText('Task 21')
  expect(asked).toContain(2)
})
```

The entity must page through the server for this test: give it
`localFilterThreshold: 0`, or serve more rows than the threshold. Otherwise
the first read caches all 60 rows and page 2 never reaches the route.
