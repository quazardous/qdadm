# Navigation — breadcrumb, sibling navlinks, View↔Edit toggle

How qdadm builds the top navigation bar of entity pages: the breadcrumb trail
on the left, the sibling links on the right, and the optional View↔Edit mode
toggle. Everything here is derived from routes and entity managers — pages
declare nothing.

Rendered by `AppLayout`'s inline breadcrumb bar (the default layout) and by
`DefaultBreadcrumb` (the `breadcrumb` zone default in `BaseLayout`). Both read
the same composable and render the same structure.

## The semantic breadcrumb

`useSemanticBreadcrumb()` derives a semantic trail from the current **URL
path** and the registered routes — one item per level, each with a `kind`:

| Kind | Example path | Meaning |
|------|--------------|---------|
| `entity-list` | `/books` | Entity collection |
| `entity-show` | `/books/1` | Item, view mode |
| `entity-edit` | `/books/1/edit` | Item, edit mode |
| `entity-create` | `/books/create` | Creation page |
| `route` | `/books/stats` | Generic (non-entity) route |

Mode detection is positional: the trailing path segment maps through
`ACTION_MAP` (`edit`, `show`, `view`, `create`, `new`, `delete`). The
framework therefore always knows **which mode of which item** you are on —
this is what the View↔Edit toggle exploits.

Two prerequisites, both provided automatically by `ctx.crud()`:

- routes must carry `meta.entity` (raw `ctx.routes()` declarations lose the
  item-name crumb — see [crud.md](./crud.md));
- item labels come from the active stack: the item crumb shows
  `manager.getEntityLabel(data)` once the entity is hydrated (`"Dune"`, not
  `"Book #1"`), with a `...` placeholder before that.

A route can override the whole trail with `meta.breadcrumb` (an array of
semantic items) — used for custom pages that want a hand-built trail.

## `useNavContext()` — the rendering contract

`useNavContext()` turns the semantic trail into render-ready pieces:

```ts
const { breadcrumb, navlinks, modeToggle } = useNavContext()
```

- **`breadcrumb`** — `BreadcrumbItem[]` (label, optional `to`, optional
  icon). Home first (when `qdadmHomeRoute` resolves), then one item per
  chain level. The terminal item never links: it is the current page.
  Mid-trail item crumbs link to the item's *default route* —
  `${routePrefix}-edit` when it exists, `-show` as fallback (this
  edit-preference is a landing default for "go to this item", not a mode
  statement).
- **`navlinks`** — the right-side sibling links (below).
- **`modeToggle`** — the View↔Edit toggle descriptor (below).

Child pages can replace either list via the provided refs
(`qdadmBreadcrumbOverride`, `qdadmNavlinksOverride`) — `PageNav` uses this.

## Sibling navlinks (the right-side links)

On a **child route** (a route with `meta.parent = { entity, param }`, e.g.
`/books/:bookId/loans`), the right side of the bar shows the parent item's
tab set:

- **`Details`** — back to the parent item's default route;
- one link per **sibling route** of the same parent (`getSiblingRoutes`),
  labeled by `meta.navLabel` or the sibling manager's `labelPlural`, with the
  active one highlighted.

Only routes with `meta.layout: 'list' | 'page'` become tabs. Item-mode routes
(`-create`, `-edit`, `-new`, `-show`) are **deliberately excluded**: show and
edit are two modes of the same item, not sibling tabs — surfacing them as
navigation would flatten a modal distinction into spatial navigation. The
mode toggle below is the affordance for that distinction.

## View↔Edit mode toggle (opt-in)

When the terminal crumb is `entity-show` or `entity-edit` and the **twin-mode
route exists**, the navlinks group grows one last entry: a plain text
`Edit` / `View` link that switches mode for the same item.

```js
// Kernel bootstrap (or the plugin's `features` option)
const kernel = new Kernel({
  // ...
  features: { breadcrumbModeToggle: true },
})
```

Resolution rules (`useNavContext().modeToggle`, null when any fails):

1. terminal semantic item is `entity-show` / `entity-edit` **with an id**
   (`entity-create` never toggles);
2. the twin route exists: `${manager.routePrefix}-edit` / `-show`, checked
   with `router.hasRoute` — no twin, no toggle (mono-mode entities are
   unaffected);
3. the Edit direction is permission-gated: `manager.canUpdate(entity?)`,
   ownership-aware once the item is hydrated;
4. the target is always the **opposite** of the current mode.

Rendering contract (both breadcrumb components):

- the toggle is the **last pipe-separated entry of the right-side navlinks
  group**, styled like the other navlinks — plain text, no icon;
- labels resolve through i18n keys `breadcrumb.view` / `breadcrumb.edit`
  (fallbacks `View` / `Edit`), locale-reactive;
- navigation is a plain `router.push`: leaving a dirty edit form triggers the
  form page's own unsaved-changes guard (`useUnsavedChangesGuard`'s
  `onBeforeRouteLeave`) — the toggle needs no plumbing of its own.

The toggle needs the show/edit **pair** to exist. With `ctx.crud()` that
means declaring both pages:

```js
ctx.crud('books', {
  list: () => import('./pages/BookList.vue'),
  show: () => import('./pages/BookShow.vue'),   // ← the pair…
  form: () => import('./pages/BookForm.vue')    // ← …that makes book-show ↔ book-edit
}, { nav: { section: 'Library', icon: 'pi pi-book' } })
```

The imperative per-page actions (`show.addEditAction()`,
`form.addCancelAction()`) keep working unchanged — the toggle is additive.

For consumers typing against the API: `BreadcrumbModeToggle`,
`BreadcrumbItem` and `NavLinkItem` are exported from the main barrel.
