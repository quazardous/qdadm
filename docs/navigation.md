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
const { breadcrumb, navlinks, modeToggle, modeLinks } = useNavContext()
```

- **`breadcrumb`** — `BreadcrumbItem[]` (label, optional `to`, optional
  icon). Home first (when `qdadmHomeRoute` resolves), then one item per
  chain level. The terminal item never links: it is the current page.
  Mid-trail item crumbs link to the item's *default route* —
  `${routePrefix}-edit` when it exists, `-show` as fallback (this
  edit-preference is a landing default for "go to this item", not a mode
  statement).
- **`navlinks`** — the right-side sibling links (below).
- **`modeToggle`** — the single View↔Edit toggle descriptor of item pages
  (kept for compatibility; null elsewhere).
- **`modeLinks`** — the uniform list the breadcrumb components render: one
  opposite-mode entry on item pages, the **parent's** View/Edit pair on child
  pages (below).

Child pages can replace either list via the provided refs
(`qdadmBreadcrumbOverride`, `qdadmNavlinksOverride`) — `PageNav` uses this.

## Sibling navlinks (the right-side links)

On a **child route** (a route with `meta.parent = { entity, param }`, e.g.
`/books/:bookId/loans`), the right side of the bar shows the parent item's
tab set:

- **`Details`** — back to the parent item's default route (label via i18n key
  `breadcrumb.details`, fallback `Details`). Note the default route **prefers
  `-edit`** over `-show` (`getDefaultItemRoute`), so with mode links enabled
  Details usually points where the `Edit` mode link points — and is then
  **deduped away** (see below);
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
route exists**, the navlinks group gains a leading entry: a plain text
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

Rendering contract (one shared component, `NavlinksGroup`, used by both
AppLayout's inline breadcrumb and `DefaultBreadcrumb` — #1357):

- the mode links **lead the right-side navlinks group** (pipe-separated,
  sibling tabs follow), styled like the other navlinks — plain text, no icon;
- labels resolve through i18n keys `breadcrumb.view` / `breadcrumb.edit`
  (fallbacks `View` / `Edit`), locale-reactive;
- **dedup (#1357)**: a navlink whose target route is already covered by a
  shown mode link is dropped. In practice this removes the auto `Details`
  link on child pages (it resolves to the parent's edit route — the same
  destination as the `Edit` mode link). With the feature flag off, no mode
  links are shown and every navlink stays (back-compat);
- navigation is a plain `router.push`: leaving a dirty edit form triggers the
  form page's own unsaved-changes guard (`useUnsavedChangesGuard`'s
  `onBeforeRouteLeave`) — the toggle needs no plumbing of its own.

### On child pages (#1353)

On a **child-list page** (`/books/:id/loans`) the terminal is the child
collection — the page is in *neither* mode of the parent item. The navlinks
group then carries the **parent's** mode links: both `View` and `Edit`
(each under the same existence/permission rules, parent id in the params,
`entityData` — the parent item on such pages — feeding the `canUpdate`
gate). The `Details` navlink is deduped when a mode link covers its route
(#1357); it remains the "go back to the item" affordance only for consumers
without the feature flag.

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

## Auto-injected nav affordances — inventory (#1357)

What appears "automatically" around a page, and what is actually opt-in:

| Affordance | Where | Automatic? | Label resolution |
|---|---|---|---|
| Breadcrumb trail | breadcrumb bar (left) | yes — derived from the URL + route meta | manager `labelPlural` / `getEntityLabel`, `meta.navLabel` |
| `Details` link | navlinks group, child pages only | yes — whenever the route has `meta.parent` | i18n `breadcrumb.details`, fallback `Details` |
| Sibling tabs | navlinks group, child pages only | yes — one per sibling route with `meta.layout: 'list' \| 'page'` | `meta.navLabel` → sibling `labelPlural` → route name |
| View↔Edit mode links | navlinks group (leading) | **opt-in** — `features.breadcrumbModeToggle` | i18n `breadcrumb.view` / `breadcrumb.edit`, fallbacks `View` / `Edit` |
| List header create action (e.g. "Add Book") | list page header | **opt-in** — the page calls `list.addCreateAction(label?)` | explicit label, or `Create ${Entity}` |

All navlinks-group entries render through the shared `NavlinksGroup`
component (exported), which owns the feature gate, the ordering (mode links
lead) and the dedup rule.

For consumers typing against the API: `BreadcrumbModeToggle`,
`BreadcrumbItem` and `NavLinkItem` are exported from the main barrel.
