# CRUD Pages

How to build canonical pages in qdadm.

## Overview

| Page type | Composable | Component | Registration |
|-----------|-----------|-----------|-------------|
| List | `useListPage` | `ListPage` | `ctx.crud(entity, { list })` |
| Form (create/edit) | `useEntityItemFormPage` | `FormPage` | `ctx.crud(entity, { form })` |
| Show (read-only) | `useEntityItemShowPage` | `ShowPage` | `ctx.crud(entity, { show })` |
| Child list | `useListPage` | `ListPage` | `ctx.crud(entity, { list }, { parentRoute })` |
| Child form | `useEntityItemFormPage` | `FormPage` | `ctx.crud(entity, { form }, { parentRoute })` |
| Child page (non-entity) | `useChildPage` | `PageLayout` | `ctx.childPage(parent, name, opts)` |
| Custom page | none | `PageLayout` | `ctx.routes(path, routes)` |

All composables follow the same pattern: create builder → configure → bind to component via `v-bind="xxx.props.value" v-on="xxx.events"`.

---

## Module Registration

### ctx.crud()

```js
ctx.crud(entity, pages, options?)
```

**Pages:**

```ts
{
  list?: () => import('./pages/BookList.vue'),
  form?: () => import('./pages/BookForm.vue'),   // handles create + edit
  show?: () => import('./pages/BookShow.vue'),
  create?: () => import('./pages/BookCreate.vue'),  // override form for create only
  edit?: () => import('./pages/BookEdit.vue'),       // override form for edit only
}
```

Use `form` for the single-form pattern (recommended). Use `create`/`edit` only when create and edit are truly different pages.

> **Why `ctx.crud` and not hand-rolled routes:** beyond generating the routes,
> `ctx.crud` binds `entity` (+ `parent`, `label`) into the route **meta** and
> registers the route family. That meta is what `useSemanticBreadcrumb` /
> `useNavContext` read to resolve the **item-name breadcrumb** ("My Pool" instead
> of the static label), the active stack, and permission binding. Declaring an
> entity's form via raw `ctx.routes()` **silently** loses all of that — nothing
> errors, the breadcrumb just degrades. Full navigation reference (breadcrumb,
> sibling navlinks, View↔Edit toggle): [navigation.md](./navigation.md).

**Options:**

| Option | Type | Description |
|--------|------|-------------|
| `nav` | `{ section, icon?, label? }` | Add navigation menu item |
| `parentRoute` | `string` | Mount as child of this route (e.g. `'book'`) |
| `foreignKey` | `string` | FK field linking child to parent (e.g. `'book_id'`) |
| `label` | `string` | Tab label for child route (e.g. `'Loans'`) |
| `parentParam` | `string` | Explicit URL param name for the parent id (overrides the naming policy below) |
| `routePrefix` | `string` | Override route name prefix |
| `pathSegment` | `string` | Override URL path (e.g. `'tasks'` instead of `'job-tasks'`) |

**Examples:**

```js
// Top-level CRUD with nav item
ctx.crud('books', {
  list: () => import('./pages/BookList.vue'),
  form: () => import('./pages/BookForm.vue')
}, {
  nav: { section: 'Library', icon: 'pi pi-book' }
})

// Child CRUD under a parent
ctx.crud('loans', {
  list: () => import('./pages/BookLoans.vue'),
  form: () => import('./pages/BookLoanForm.vue')
}, {
  parentRoute: 'book',
  foreignKey: 'book_id',
  // The tab reads the child's labelPlural (from the catalogue, so it follows
  // the locale); a `label: 'Loans'` here would pin it in one language
})

// List-only (no form)
ctx.crud('genres', {
  list: () => import('./pages/GenreList.vue')
})
```

> **After a deploy:** a tab left open still runs the old build, and its lazy
> pages point to chunks the deploy removed. When one fails to load, qdadm
> reloads the page once, at the page the user was going to, which loads the new
> build. If that page still fails, it shows an error toast asking for a reload
> instead of reloading again.

### ctx.childPage()

Non-entity tab on an entity item page:

```js
ctx.childPage('book', 'info', {
  component: () => import('./pages/BookInfo.vue'),
  label: 'Info',
  icon: 'pi pi-info-circle'
})
```

Registers route `/books/:bookId/info`, name `book-info`. Appears as tab alongside entity children.

### ctx.routes()

Custom non-CRUD pages. **For entities, prefer `ctx.crud`** — raw routes skip the
breadcrumb/active-stack wiring (see the note above). If you genuinely need a
custom entity route, pass the meta yourself via the third argument:
`ctx.routes(path, routes, { entity: 'botPools' })` (`RouteOptions` also accepts
`parent`, `label`, `layout` and `permission`).

A page only some users may open declares a permission: the router refuses it to
the others (see [Security](security.md#which-permission-a-page-needs)).
`ctx.routes(path, routes, { permission: 'admin:settings' })` sets it on every route
of the group; a route's own `meta.permission` wins.

```js
ctx.routes('books/stats', [
  {
    path: '',
    name: 'book-stats',
    component: () => import('./pages/BookStats.vue'),
    meta: {
      breadcrumb: [{ kind: 'route', route: 'book-stats', label: 'Statistics' }]
    }
  }
])

ctx.navItem({ section: 'Library', route: 'book-stats', icon: 'pi pi-chart-bar', label: 'Stats' })
ctx.navItem({ section: 'Admin', route: 'settings', icon: 'pi pi-cog', label: 'Settings' })
```

- A route entry follows its route's `meta.permission`: hidden from whoever the
  router would refuse. Its own `permission` replaces that for the menu only. The
  entry stays active on its route and the pages under it.
- `entity` does two things: it shows the entry to whoever may list or read that
  entity, and makes it active on that entity's pages only. Use it for an entry
  that opens the entity, `permission` for any other page. With both, both must pass.
- The page is guarded by its route's permission, not by the menu: an entry's own
  `permission` hides it without refusing the URL.

### Links to other tools

A menu entry can point out of the app — a BI dashboard, monitoring, a database
admin — with `href` instead of `route`:

```js
ctx.navItem({ section: 'Admin', label: 'BI (Metabase)', icon: 'pi pi-chart-bar',
              href: 'https://bi.example.com' })
ctx.navItem({ section: 'Admin', label: 'Adminer', icon: 'pi pi-database',
              href: 'https://db.example.com', permission: 'tools:adminer' })
```

- An entry takes exactly one of `route` and `href`; both or neither throws at boot.
- An absolute URL opens in a new tab (`rel="noopener noreferrer"`), marked with a
  small icon; a relative one stays in the same tab. `target` overrides both.
- A link is never the active entry, and has no entity guard: `permission` alone
  decides who sees it.

---

## List Page

```vue
<script setup>
import { useListPage, ListPage, SeverityTag } from '@quazardous/qdadm'
import Column from 'primevue/column'

const list = useListPage({ entity: 'books' })

list.generateColumns({ only: ['title', 'author', 'genre', 'year'] })
list.setSearch({ placeholder: 'Search books...' })
list.addFilter('genre', { optionsEntity: 'genres', optionLabel: 'name' })
list.addCreateAction()
list.addEditAction()
list.addDeleteAction({ labelField: 'title' })
</script>

<template>
  <ListPage v-bind="list.props.value" v-on="list.events" />
</template>
```

The page title comes from the manager's `labelPlural`. If the manager declares a
`description` (see [Field Definition](#field-definition)), it renders as a muted
subtitle under the title — a one-liner telling the user what the entity is.
Override per page with the `subtitle` option (`null` suppresses it).

### Builder methods

| Method | Description |
|--------|-------------|
| `setSearch({ placeholder, fields })` | Full-text search bar |
| `addFilter(name, config)` | Filter dropdown |
| `addCreateAction(label?)` | Header "New" button |
| `addEditAction()` | Row edit action |
| `addViewAction()` | Row view action (read-only) |
| `addDeleteAction({ labelField? })` | Row delete action |
| `addBulkDeleteAction()` | Bulk delete with selection |
| `addHeaderAction(name, config)` | Custom header action |
| `addAction(name, config)` | Custom row action |
| `addColumn(field, { header?, sortable?, style?, body? })` | One declared column |
| `column(field, overrides?)` | `{ field, header }` for a `<Column v-bind>` in a `#columns` slot, header translated |
| `generateColumns({ exclude?, only? })` | One column per listable field, in declaration order (no `password`, `textarea`, `json`, nor `listable: false`); cells render by field type |
| `loadItems(params?, { force? })` | Force reload data |

### Columns

Declare them; the list renders them, headers from the catalogue
(`entities.<entity>.fields.<field>`), cells by field type (a date, a boolean,
an option's label, a severity tag when the manager has a severity map):

```js
list.generateColumns()                                   // every listable field
list.generateColumns({ only: ['title', 'author'] })      // or some of them
list.addColumn('year', { sortable: true, style: 'width: 100px' })
```

One cell of your own, the rest declared: a `#column-<field>` slot gets
`{ data, value }`.

```vue
<ListPage v-bind="list.props.value" v-on="list.events">
  <template #column-genre="{ value }"><Tag :value="value" /></template>
</ListPage>
```

A table entirely your own: the `#columns` slot replaces the declared columns.
Bind each `Column` with `list.column(field)`: it gives `field` and the
translated `header`, so headers follow the user's language.

```vue
<template #columns>
  <Column v-bind="list.column('title')" sortable />
  <Column v-bind="list.column('genre')">
    <template #body="{ data }"><SeverityTag field="genre" :value="data.genre" /></template>
  </Column>
</template>
```

A header typed in the template (`header="Title"`) stays in that language.

### Filter labels

A filter without a `placeholder` shows its field's label from the catalogue
(`entities.<entity>.fields.<field>`), and its empty choice reads "All <field>"
(`core.filters.all`); both follow the locale. Static `options` get that empty
choice too, unless they hold a `null` option of their own or `allLabel: false`. Static `options` translate through
`entities.<entity>.fields.<field>.options.<value>`, and so do options read from
the rows (`optionsFromCache`), `true` / `false` included. A `placeholder` or
`allLabel` given by the page is kept as written.

### Filter modes

```js
// Options from another entity
list.addFilter('genre', { optionsEntity: 'genres', optionLabel: 'name' })

// Options from an endpoint of this entity (GET distinct/<name>, or a path)
// On an SdkStorage this needs its `request` option — see the README's storage adapters
list.addFilter('run_id', { optionsEndpoint: true })

// Options extracted from current data
list.addFilter('author', { optionsFromCache: true })

// Static options
list.addFilter('status', { options: [
  { label: 'Active', value: 'active' },
  { label: 'Inactive', value: 'inactive' }
]})

// Virtual filter (transforms value before query)
list.addFilter('availability', {
  options: [{ label: 'Available', value: 'available' }, { label: 'On loan', value: 'loaned' }],
  toQuery: (v) => v === 'available' ? { returned_at: null } : { returned_at: { $ne: null } }
})

// The choices, from the app, at any time: they replace the filter's own, and
// no loader reads them again (call it again, from a watch, when they change)
list.setFilterOptions('taken_by', [{ label: 'Me', value: '@me' }, ...people])
```

- **Cache options** are kept once they are complete: rows that the filter
  does not narrow. On an empty list, or with the filter's value already set
  (from the address, a link, a card), the choices are the `processor`'s and
  that value's for now, built again on the next load.
- **The value filtered on is always among the choices:** one that they lack
  (`?genre=poetry`) is added as its raw value, so the select shows what it
  filters on and can change it or clear it.

### Cascading filters

A filter's choices may depend on other filters' values: `dependsOn` names
them. When one changes (picked, cleared, restored from the address or the
session), the choices are read again with their values: as `params` of an
`optionsEndpoint` request, or as `filters` of `optionsEntity`'s list. A list of
names sends each under its own name; an object renames
(`{ universe: 'universe_id' }`); an empty value is left out.

```js
list.addFilter('provider', { optionsEndpoint: 'providers', dependsOn: ['universe'] })
list.addFilter('type', { optionsEndpoint: 'types', dependsOn: ['universe', 'provider'] })
// GET types?universe=it&provider=legacy
```

The old choices stay shown while the new ones load (`_optionsLoading` on the
filter), and an answer older than the latest is ignored. A value the new
choices no longer hold is cleared the usual way: the list reloads, the address
and the session follow, and the filters depending on it read again in turn.
`validate(value, { options, values })` decides instead whether the value
stands (`true` keeps it; it may return a Promise). The first read, at mount,
already uses the restored values. A dependency the list does not declare, or a
cycle, is said in development and that `dependsOn` ignored.

### Custom row actions (dynamic callbacks)

`addAction(name, config)` adds a per-row action. Beyond a static config, `icon`,
`tooltip`, and `severity` may be **functions of the row**, and `visible` /
`disabled` are row predicates — so the button can reflect per-row state (resolved
in `useListPage.ts` via `resolveValue`):

```js
list.addAction('favorite', {
  icon: (row) => isFavorite(row) ? 'pi pi-star-fill' : 'pi pi-star',
  tooltip: (row) => isFavorite(row) ? 'Remove from favorites' : 'Add to favorites',
  severity: (row) => isFavorite(row) ? 'warn' : 'secondary',
  visible: (row) => row.status !== 'archived',   // hide for some rows
  disabled: (row) => row.locked,                 // render but disable
  onClick: (row) => toggleFavorite(row),
})
```

| Action field | Static or `(row) => …` | Purpose |
|---|---|---|
| `icon` | both | PrimeVue icon class |
| `tooltip` | both | Hover text, and the button's accessible name |
| `ariaLabel` | both | The accessible name, when it should differ from the tooltip |
| `severity` | both | Button severity/color |
| `visible` | `(row) => boolean` | Omit the action for this row |
| `disabled` | `(row) => boolean` | Render but disable |
| `onClick` | `(row) => void` | Handler |

This row-aware signature is what makes actions packageable into reusable
composables — see [Reusable list behaviors](#reusable-list-behaviors-augmenting-composables).

### Row bands

A row can carry a band under its cells: one full-width line, across every
column (actions and selection included), for what a cell is too narrow for (a
component per record type, a short reading, the details of a source). The app
decides row by row: `rowBand(row)` picks the rows that get one, the
`#row-band` slot draws it; a row left out keeps the classic row. Without
`rowBand`, every row gets a band; without the slot, nothing changes.

```js
const list = useListPage({ entity: 'tasks', rowBand: (task) => !!bandFor(task.type) })
```

```vue
<ListPage v-bind="list.props.value" v-on="list.events">
  <template #row-band="{ data }">
    <component :is="bandFor(data.type)" :task="data" />
  </template>
</ListPage>
```

The row and its band read as one object: no border between them (the
separator comes after the band), one hover and one selection for the pair, and
a click in the band is a click on the row, unless it lands on a link or a
button of the band's own. The row is described by its band
(`aria-describedby`). Sorting, paging and a run (`useRun`) are unchanged.
`--qd-list-band-padding` and `--qd-list-band-bg` style the band.

`rowBandPosition: 'above'` draws the band above the row's cells instead, as a
header line (a long text over short cells), for the whole list. The pair stays
one object, with the separator after the row. It is drawn with PrimeVue's row
groups: a list that groups its own rows (`tableProps.rowGroupMode`) keeps its
band below, with a warning in development.

```js
const list = useListPage({ entity: 'tasks', rowBand: (task) => !!task.message, rowBandPosition: 'above' })
```

### ListPage slots

**Escape hatch — any DataTable prop** *(since 2.3)*: the `tableProps` prop is
forwarded verbatim to the underlying PrimeVue `DataTable`, bound last (it can
override ListPage defaults). E.g. sort `null` values last:

```vue
<ListPage v-bind="list.props.value" v-on="list.events" :table-props="{ nullSortOrder: -1 }">
```

| Slot | Purpose |
|------|---------|
| `#columns` | PrimeVue `<Column>` definitions |
| `#row-band` | A full-width band under (or, with `rowBandPosition: 'above'`, above) the rows `rowBand` picks, receives `{ data, index }` (see Row bands) |
| `#nav` | `<PageNav>` for child routes |
| `#beforeTable` | Content above the table (zones, alerts) |
| `#header-actions` | Custom header action buttons |
| `#empty` | Empty state content |

### Options

```ts
useListPage({
  entity: 'books',
  defaultSort: 'title',        // Default sort field
  defaultSortOrder: -1,        // -1 = desc (the default), 1 = asc
  pageSize: 20,                // Rows per page
  serverSide: false,           // Server-side pagination
  loadOnMount: true,           // Auto-load on mount
  persistFilters: true,        // Remember filters across navigation
  persistSort: true,           // Remember active sort across navigation (per entity)
  syncUrlParams: true,         // Put filters + search in the URL (see below)
  subtitle: 'Custom subtitle', // Override manager.description (null = no subtitle)
})
```

#### Where each piece of list state lives

| State | URL | Session | Restored on a fresh link |
|---|---|---|---|
| Filters | yes (`syncUrlParams`) | yes (`persistFilters`) | yes |
| Search | yes (`syncUrlParams`) | yes (`persistFilters`) | yes |
| Sort | no | yes (`persistSort`) | no |
| Rows per page | no | yes (always) | no |
| Current page | yes (`syncUrlParams`) | no | yes |

Filters, search and the page go to the URL under the list's entity —
`?offers.page=2` — so two lists on one route do not collide. The sort is
remembered per entity in the session and never appears in the URL; rows per
page is one app-wide setting in a cookie. All three go through the same seam
— see [route-state.md](./route-state.md).

Filters and a search brought back from the session, on a list reached by a
bare address (`/tasks` from the side menu), go into the address once the list
is mounted, by replace, with no history step: the address says what the list
shows, a copied link keeps it, and the app's `domainResolver` sees them. A
value the address already carries wins over the session's and is left as is.

The session memory (filters, search, and the sort the default keeps there)
is the entity's, shared by every list of it. When several pages list one
entity (one per universe, a parent's children), give each its own with
`sessionKey`; the address keeps the entity's prefix (`tasks.universe`), so
links and saved searches do not change:

```js
useListPage({ entity: 'tasks', sessionKey: universe ? `tasks:universe:${universe}` : undefined })
```

An address that names at least one of the list's filters, or its search,
describes a whole state: a card's link to `/tasks?tasks.provider=amazon`
does not inherit the universe kept in the session. The session's other
filters go back to their default and its search goes, except the filters
declared `keepFromSession: true`, preferences that stay whatever the link
(`addFilter('criticality', { …, keepFromSession: true })`). The session is
then rewritten from what is shown. A bare address takes the session back.
The same rule applies when the address changes under a mounted list (a link
to the list while already on it, Back): the list follows its address.

A filter with a `default` that the user empties on purpose (its "All"
choice) is written explicitly, `tasks.state=null`, and kept as `null` in the
session: an absent filter means its default, so the empty choice has to be
said. It reads back as `null`, one change is one load, and Clear filters
still returns it to its default. The token is the entity's
`filterEmptyValue` or the filter's own `emptyValue` when either is set
(`addFilter('state', { default: 'open', emptyValue: 'all', … })`), read back
as `null` too. A filter without a default stays implicit when empty.

The page is written only once it leaves 1, and removed again when it returns,
so a pristine list leaves a clean link. Changing a filter resets it, since the
results are renumbered. A list URL is therefore shareable as what the sender
was actually looking at, and leaving a list for a detail view and coming back
returns to the same page.

`page` and `search` are qdadm's own keys within a scope: a filter named either
of them collides, the list's own state wins, and qdadm says so once at
declaration time. Rename the filter.

`syncUrlParams` governs **writing** — it has never stopped a query string
being read, so a hand-typed deep link still restores.

**To remember this somewhere other than the URL** — web storage, a cookie,
nowhere at all, or a persister you wrote — see
[route-state.md](./route-state.md).

---

## Form Page

> For the **field-rendering surface** — the `FormInput` façade, rich widgets
> (`LookupField`, `KeyValueEditor`, `Scope`/`PermissionEditor`, JSON editors,
> the structured/raw JSON dual) and non-entity forms (`useBareForm`) — see
> [forms.md](./forms.md).

**Important:** `FormPage` does NOT auto-render fields. The `#fields` slot is required.

`generateFields()` populates field definitions and default values, but you render them in the template.

### Minimal form

```vue
<script setup>
import { useEntityItemFormPage, FormPage, FormField, FormInput, PageNav } from '@quazardous/qdadm'

const form = useEntityItemFormPage({ entity: 'genres' })
form.generateFields()
form.addSaveAction({ andClose: true })
form.addDeleteAction()
</script>

<template>
  <FormPage v-bind="form.props.value" v-on="form.events">
    <template #nav>
      <PageNav showDetailsLink />
    </template>

    <template #fields>
      <div class="form-grid">
        <FormField v-for="f in form.fields.value" :key="f.name" :name="f.name" :label="f.label">
          <FormInput :field="f" v-model="form.data.value[f.name]" />
        </FormField>
      </div>
    </template>
  </FormPage>
</template>
```

### With field groups

```vue
<script setup>
import { useEntityItemFormPage, FormPage, FormField, FormInput, FieldGroups, PageNav } from '@quazardous/qdadm'

const form = useEntityItemFormPage({ entity: 'books' })
form.generateFields()
form.group('basic', ['title', 'author'], { label: 'Basic Information', icon: 'book' })
form.group('details', ['year', 'genre'], { label: 'Publication Details', icon: 'info-circle' })
form.addSaveAction({ andClose: true })
form.addDeleteAction()
</script>

<template>
  <FormPage v-bind="form.props.value" v-on="form.events">
    <template #nav>
      <PageNav />
    </template>

    <template #fields>
      <FieldGroups :groups="form.groups.value" :data="form.data.value" layout="accordion">
        <template #field="{ field }">
          <FormField :name="field.name" :label="field.label">
            <FormInput :field="field" v-model="form.data.value[field.name]" />
          </FormField>
        </template>
      </FieldGroups>
    </template>
  </FormPage>
</template>
```

### Builder methods

| Method | Description |
|--------|-------------|
| `generateFields(options?)` | Auto-generate from entity schema |
| `addField(name, config)` | Add or override a field |
| `updateField(name, config)` | Customize an existing field |
| `getFieldConfig(name)` | Get resolved field config |
| `group(name, fields, { label, icon })` | Organize into groups |
| `addSaveAction({ andClose? })` | Save button |
| `addDeleteAction({ label?, icon?, confirmHeader?, confirmMessage? })` | Delete button in the footer (hidden in create mode). Its own words when the gesture is not a deletion (`label: 'Revoke'`; `confirmMessage` a string or `(item, label) => string`); the confirmation's accept button says the label |
| `addCancelAction()` | Cancel navigation |
| `addAction(name, { label, icon, onClick, … })` | Custom action; `label` may be `() => t('…')`, read at each render so it follows the locale |

### Mode detection

A single form component handles both create and edit. The mode is auto-detected from the route:

- `form.isCreate.value` — true on the create route
- `form.isEdit.value` — true on the edit route
- `form.data.value` — empty defaults on create, loaded entity on edit

On edit, the form reads the record itself, never a row from the list cache: a
list endpoint may return summaries, and a field the form shows empty is saved
back empty. In debug mode, a field the form edits that the loaded record does
not carry at all is reported once in the console.

### FormPage slots

| Slot | Purpose |
|------|---------|
| `#fields` | **Required.** Form field rendering |
| `#nav` | `<PageNav>` for breadcrumb/tabs |
| `#toolbar` | Custom toolbar between header and form |
| `#header-actions` | Custom header action buttons |
| `#footer` | Replace default FormActions |
| `#error` | Custom error display |
| `#loading` | Custom loading display |

### Options

```ts
useEntityItemFormPage({
  entity: 'books',
  loadOnMount: true,            // Auto-load entity in edit mode
  enableGuard: true,            // Unsaved changes dialog
  usePatch: false,              // PATCH instead of PUT
  generateFormFields: true,     // Auto-call generateFields()
  validateOnBlur: true,         // Validate fields on blur
  validateOnSubmit: true,       // Validate all on submit
  transformLoad: (data) => data,
  transformSave: (data) => data,
  onSaveSuccess: (data) => {},
  onDeleteSuccess: () => {},
})
```

### FieldGroups layouts

| Layout | Description |
|--------|-------------|
| `flat` | All fields in a single column |
| `accordion` | Collapsible sections |
| `tabs` | Tab panels |
| `sections` | Labeled sections |
| `cards` | Card-wrapped sections |

With `tabs` or `accordion`, the active tab (or the open panels) is kept when
the record re-renders — a `reload()` or a live update does not send the user
back to the first group. To own it — restore it, keep it in the URL — bind
`v-model:active`: a group name for `tabs`, an array of names for `accordion`.

```vue
<FieldGroups :groups="show.groups.value" :data="show.data.value" layout="tabs" v-model:active="tab" />
```

### A value shown once

An API key's value, a generated password, a recovery code: the server hands
it back once, in the create answer, and keeps only its hash. Say so on the
entity, with the response keys to reveal and, when the entity is nested in
the answer, where it sits:

```js
// POST /keys → { key: { id, name, scopes, … }, token: 'sbx_…' }
ctx.entity('keys', {
  storage,
  revealOnce: { keys: ['token'], item: 'key' },
  fields: { … },
})
```

`create()` takes them out of the answer before anything else sees it: the
entity it returns, the cache, the postsave hooks and the `entity:created`
signal never carry them. `manager.createRevealing(data)` returns
`{ entity, revealed }` for code that wants them.

The create form does the rest. After the save, before it navigates, it shows
the values in `QdRevealOnce`: each one in monospace with a Copy button, a
warning that it will not be shown again, and one way out, "I have copied it".
The values live in the page's memory only (not in `data`, the dirty snapshot
or a store) and go when the user confirms. A reload finds nothing to replay.
Labels come from `entities.<entity>.reveal.<key>`, else the key.

A custom form page that does not use `FormPage` renders the dialog itself:

```vue
<QdRevealOnce :revealed="form.revealed.value" @confirm="form.confirmRevealed" />
```

In the demo: Security › API keys.

---

## Show Page

```vue
<script setup>
import { useEntityItemShowPage, ShowPage, ShowField, PageNav } from '@quazardous/qdadm'

const show = useEntityItemShowPage({ entity: 'products' })
show.generateFields()
show.updateField('price', { type: 'currency', currencyCode: 'USD' })
show.updateField('stock', { type: 'badge', severity: (v) => v < 10 ? 'danger' : 'success' })
show.addEditAction()
show.addDeleteAction()
show.addBackAction({ route: 'product' })
</script>

<template>
  <ShowPage v-bind="show.props.value" v-on="show.events">
    <template #nav>
      <PageNav showDetailsLink />
    </template>

    <template #fields>
      <ShowField
        v-for="f in show.fields.value"
        :key="f.name"
        :field="f"
        :value="show.data.value?.[f.name]"
        horizontal
        label-width="140px"
      />
    </template>
  </ShowPage>
</template>
```

### Layouts

A page's chrome is resolved in this order: an explicit `layout` option, then
`route.meta.layout`, then the component's name, then the route's name, then
`base`.

| Layout | Reached by |
|---|---|
| `list` | `meta.layout: 'list'` (set by `crud`), a `*List` component, a `*-list` route |
| `form` | a `*Form` / `*Edit` / `*Create` component, a `*-edit` / `*-create` route |
| `show` | `meta.layout: 'show'` (set by `crud({ show })`), a `*Show` component, a `*-show` route |
| `dashboard` | a `*Dashboard` component, a `*-dashboard` route |
| `base` | everything else, and the fallback whenever the resolved layout has no component |

Supply the ones you want on the kernel; any you omit fall back to `base`:

```js
createApp({ layouts: { list: MyListLayout, form: MyFormLayout, show: MyShowLayout, base: MyBaseLayout } })
```

### With media zone

```vue
<template>
  <ShowPage v-bind="show.props.value" v-on="show.events" media-width="200px">
    <template #media>
      <img :src="show.data.value?.thumbnail" alt="" />
    </template>

    <template #fields>
      <ShowField v-for="f in show.fields.value" :key="f.name"
        :field="f" :value="show.data.value?.[f.name]" horizontal />
    </template>
  </ShowPage>
</template>
```

### Builder methods

| Method | Description |
|--------|-------------|
| `generateFields(options?)` | Auto-generate from entity schema |
| `addField(name, config)` | Add custom display field |
| `updateField(name, config)` | Customize field display |
| `group(name, fields, { label, icon })` | Organize into groups |
| `addEditAction()` | Navigate to edit form |
| `addDeleteAction()` | Delete with confirmation |
| `addBackAction({ route })` | Back navigation |
| `addAction({ name, label, icon, onClick, placement, … })` | Custom action (below) |
| `addLazyAction({ name, label, resolve })` | An action whose visibility comes from elsewhere: hidden until `resolve(data)` says otherwise |

### Actions on an item page

A page's gestures are actions: buttons in its header or its footer, with the
permissions, the loading and the disabled state handled the same way for all.
`addEditAction()`, `addDeleteAction()` and `addBackAction()` are the built-in
ones; `addAction()` adds the page's own.

- **Where:** `placement: 'header'` puts an action beside Edit, at the top;
  `'footer'` at the bottom, beside Back. By default only `edit` goes to the
  header, every other action to the footer.
- **Order:** the order they are declared in, lazy actions included.
- **What they see:** `visible(ctx)` and `disabled(ctx)` receive
  `{ data, canEdit, canDelete, loading }`: `data` is the record shown, `null`
  while it loads (so an action never offers itself for the record being left).
  `label`, `icon`, `severity` and `tooltip` take a value or a function of the
  record, read again at each render, so they follow the record and the locale.
- **A tooltip** says what the gesture does when the label only names it
  (`tooltip`, shown on hover). A disabled action keeps it, on a wrapper the
  pointer and the keyboard reach, with the text for screen readers.
- **A menu of related gestures:** `items` makes the action a split button,
  its own button with a chevron joined on its right. The chevron opens a menu
  lined up with the button (its right edge when the button sits on the right
  of the window), upwards when there is no room below. Each entry is
  `{ name, label, icon?, tooltip?, severity?, onClick, visible?, disabled? }`:
  `label`, `icon` and `tooltip` take a function of the record, and `visible`
  and `disabled` take the same context as the action. Hidden entries are left
  out; with none left, the action is a plain button. Without `onClick`, the
  button only opens the menu (a group of gestures). From the keyboard, the
  arrows move in the menu and Escape closes it, back on the chevron.

```js
show.addAction({
  name: 'copy', label: 'Copy', icon: 'pi pi-copy', onClick: copyMarkdown,
  items: [{ name: 'copy-json', label: 'Copy as JSON', onClick: copyJson }],
})
show.addAction({
  name: 'take', label: 'Take', onClick: take,
  items: [{ name: 'follow', label: (task) => (task?.following ? 'Unfollow' : 'Follow'), onClick: toggleFollow }],
})
```

```js
const show = useEntityItemShowPage({ entity: 'tasks' })
show.addBackAction()

// Business gestures that depend on the record
show.addAction({
  name: 'take',
  label: () => t('tasks.take'),
  icon: 'pi pi-hand',
  visible: ({ data, canEdit }) => canEdit && data?.state === 'open' && !data.assignee,
  onClick: () => take(show.data.value),
})
show.addAction({
  name: 'handled',
  label: () => t('tasks.handled'),
  tooltip: () => t('tasks.handledHint'),   // "Closes the task until it recurs; asks for a reason"
  severity: 'success',
  visible: ({ data }) => data?.state === 'taken',
  disabled: ({ loading }) => loading,
  onClick: () => markHandled(show.data.value),
})
show.addAction({
  name: 'follow',
  label: (task) => (task?.following ? t('tasks.unfollow') : t('tasks.follow')),
  icon: (task) => (task?.following ? 'pi pi-eye-slash' : 'pi pi-eye'),
  visible: ({ data }) => !!data,
  onClick: () => toggleFollow(show.data.value),
})

// An external link: opened in a new tab, offered only when there is one
show.addAction({
  name: 'issue',
  label: () => t('tasks.openIssue'),
  icon: 'pi pi-external-link',
  visible: ({ data }) => !!data?.issue_url,
  onClick: () => window.open(show.data.value.issue_url, '_blank', 'noopener'),
})
```

The `#toolbar` slot is for layout around the page (a banner, a summary). Put
gestures in `addAction()` rather than in buttons of your own there: they then
get the page's placement, its permissions and its loading and disabled
states, and an agent driving the app finds them where it finds the others.

### Field display types

| Type | Renders as |
|------|------------|
| `text` | Plain text (default) |
| `badge` | PrimeVue Tag with severity |
| `currency` | Formatted currency string |
| `number` | Locale-formatted number |
| `bytes` | A file size in the app's language: `1,4 Mo` in French, `1.4 MB` in English (schema types `bytes` and `filesize`) |
| `boolean` | Checkmark / X icon |
| `image` | `<img>` tag |
| `textarea` | Monospace text block |
| `reference` | Router link to related entity |
| `date` | Formatted date string |

An empty value (`null`, `undefined`, `''`) shows `-`. Set another marker for the
whole app on the kernel, or for one field with `emptyText`:

```js
new Kernel({ display: { emptyPlaceholder: '—' } })

fields: { elected_at: { type: 'date', emptyText: 'not judged yet' } }
```

The kernel option also applies to the formatters in `@quazardous/qdadm/utils`
(`formatDate`, `formatNumber`…), so list columns show the same marker.

`formatBytes(bytes, locale?, units?)` writes a size in base 1024 with the
locale's number format and units: o, ko, Mo, Go, To in French, B, KB, MB, GB, TB
otherwise (`byteUnits(locale)`). In a component, `useFormatBytes()` gives the
same in the app's language, with the units of the catalogue
(`core.units.bytes.{b,kb,mb,gb,tb}`), so an app can rename them:

```vue
<script setup>
const formatBytes = useFormatBytes()
</script>
<Column header="Size"><template #body="{ data }">{{ formatBytes(data.size) }}</template></Column>
```

### ShowPage slots

| Slot | Purpose |
|------|---------|
| `#fields` | **Required.** Field display |
| `#media` | Left column (images, avatars) |
| `#nav` | `<PageNav>` for breadcrumb/tabs |
| `#toolbar` | Custom toolbar |
| `#header-actions` | Custom header actions |
| `#footer` | Custom footer |
| `#error` | Custom error display |
| `#loading` | Custom loading display |

---

## A run: one item after the other

A run walks a set of items of one entity from their edit page (or show page),
without going back to the list: "Book 3 of 14 to process", with Previous /
Next. The bar (`QdRunBar`) shows when the URL carries `?run=<key>`; the page
needs nothing else.

```
← Back to the list L │ ‹ Previous J   Book 3 of 14 to process  sorted by Year ↑ · filter: Fiction   Next K ›
                                     ▰▰▣▰▱▱▱▱▱▱▱▱▱▱
```

- **Where:** one slim line at the foot of the content, stuck at the bottom of
  the window and flush to its edges, drawn like the domain bar's toolbox (the
  side menu's height, font and icons, no card). `AppLayout` hosts it; in an
  app without it, `FormPage` and `ShowPage` draw it at their top instead. A
  custom layout hosts it the same way: `provide(RUN_BAR_HOST, true)` and
  `<QdRunBar placement="foot" />`. `--qd-run-bar-*` restyle it.
- **Back to the list (L)** ends the run and goes back where it started (the
  list, with its filters and search), or to the run's `returnTo`. A run with
  nowhere to go back shows no such button.

- **The strip:** one segment per item: done (filled), urgent (warm), the rest
  grey. The current one keeps its colour, with a neutral ring and a taller
  shape. Each says its state in its title too, and opens its item.
- **Colours per item, from the app:** `tone` while the item is to do,
  `doneTone` once done: `critical` (`danger`), `watch` (`warn`), `good`
  (`success`), `info`, `neutral` (`secondary`), or the name of the app's own
  `--qd-tone-<name>`. Without them, the defaults above.
- **J and K** go to the previous and the next item (left and right on the
  keyboard, as the bar reads), **L** back to the list, except while typing in
  a field. The keys are the app's choice, and a run's own:

  ```js
  features: { run: { keys: { prev: 'ArrowLeft', next: 'ArrowRight', back: null } } }   // the Kernel's options
  await run.start({ entity: 'orders', items, keys: { back: 'Escape' } })   // this run only
  ```

  A `KeyboardEvent.key` each (letters in either case); `null` or `false`
  turns one off. The hints on the buttons and their `aria-keyshortcuts`
  follow.
- **In a form, Save & Close becomes "Save and go to the next":** it saves,
  marks the item done and opens the next one still to do. With nothing
  changed, it goes on without saving. Leaving a changed form for another item
  asks first, as leaving the page does.
- **At the end,** "The 14 items are done", and back where the run started.

**Where runs start:**

- **A filtered list starts one on its own:** opening a row of a list with a
  filter or a search walks the list's rows, in their order, from that row.
  The bar says the filter and the order. An unfiltered list opens the row as
  before. `list.startRun({ label })` walks the rows from the first.
- **A card's action:** `action: { verb: 'Process the 1st', mode: 'next', run }`,
  where `run` holds the items behind the card.
- **Anywhere,** with `useRun()`:

```ts
import { useRun } from '@quazardous/qdadm'

const run = useRun()
await run.start({
  entity: 'orders',
  items: orders.map((o) => ({ id: o.id, urgent: o.late, label: o.number, tone: 'danger', doneTone: 'success' })),
  label: 'to process',     // after "3 of 14"
  order: 'urgency',        // "sorted by urgency"
  filter: 'to process, all markets',
})
```

The items open on the entity's edit page, else its show page (`route: { name,
param }` to choose). On a show page, the page's own main gesture calls
`run.doneAndNext()` once it has done its work; `run.markDone()` marks the item
without moving. `useRun()` also gives `position`, `total`, `remaining`,
`prev`, `next`, `goTo(i)` and `end()`.

A run is kept in the tab (`sessionStorage`), under the key the URL carries: a
reload keeps it, another tab does not see it.

## Child Entity List

Parent filter is auto-applied from `route.meta.parent`. No extra config needed in the composable.

```vue
<script setup>
import { useListPage, ListPage, PageNav } from '@quazardous/qdadm'
import Column from 'primevue/column'

const list = useListPage({ entity: 'loans' })

list.addCreateAction('New Loan')
list.addEditAction()
list.addDeleteAction()
</script>

<template>
  <ListPage v-bind="list.props.value" v-on="list.events">
    <template #nav>
      <PageNav />
    </template>

    <template #columns>
      <Column v-bind="list.column('borrower_name')" sortable />
      <Column v-bind="list.column('borrowed_at')" sortable />
      <Column v-bind="list.column('returned_at')" sortable />
    </template>

    <template #empty>
      <div class="text-center p-4 text-color-secondary">No loans for this book</div>
    </template>
  </ListPage>
</template>
```

**What `parentRoute` does automatically:**
- Routes mounted under parent: `/books/:bookId/loans`
- Parent filter injected: `loans.list({ book_id: bookId })`
- Breadcrumb: Books > Book Title > Loans
- Tab navigation via `<PageNav />`

**Parent param naming** *(since 2.2)*: the URL param carrying the parent id must
not collide with the child's own `:id`. The default policy (`auto`) keeps the
bare `idField` param for **list-only** families (`/jobs/:id/tasks`, unchanged
URLs) and namespaces the parent as soon as the family has a **show/edit** route
(`/jobs/:jobId/tasks/:id` — the principal, child id stays `:id`). Overrides,
by precedence: per-call `parentParam` > kernel `routeParamResolver` (global
mapping service) > kernel `parentParamMode` (`auto` | `always` | `bare`; `bare`
throws an explicit error on collision instead of silently shadowing the parent).
Framework consumers (breadcrumb, parent chain, FK filter) read the resolved name
from `route.meta.parent.param` — no page code change needed.

### Child form

The foreign key field is auto-filled and auto-disabled from the parent route:

```vue
<script setup>
import { useEntityItemFormPage, FormPage, FormField, FormInput, PageNav } from '@quazardous/qdadm'

const form = useEntityItemFormPage({ entity: 'loans' })
form.generateFields()
form.addSaveAction({ andClose: true })
</script>

<template>
  <FormPage v-bind="form.props.value" v-on="form.events">
    <template #nav>
      <PageNav />
    </template>

    <template #fields>
      <div class="form-grid">
        <FormField v-for="f in form.fields.value" :key="f.name"
          :name="f.name" :label="f.label" :hidden="f.hidden">
          <FormInput :field="f" v-model="form.data.value[f.name]" />
        </FormField>
      </div>
    </template>
  </FormPage>
</template>
```

The `book_id` field is filled from the route param and shown disabled: the user sees which book the loan belongs to and cannot change it. No manual handling needed; to leave it out of the form, skip it in the `v-for` or `form.removeField('book_id')`.

---

## Child Page (non-entity)

For custom tabs on entity items that don't map to a child entity.

```vue
<script setup>
import { useChildPage, PageLayout } from '@quazardous/qdadm'

const { parentData: book, parentLoading, parentManager } = useChildPage()
</script>

<template>
  <PageLayout title="Book Info">
    <div v-if="parentLoading" class="text-center p-4">
      <i class="pi pi-spin pi-spinner" style="font-size: 2rem"></i>
    </div>
    <div v-else-if="book">
      <dl>
        <dt>Title</dt><dd>{{ book.title }}</dd>
        <dt>Author</dt><dd>{{ book.author }}</dd>
        <dt>ID</dt><dd><code>{{ book[parentManager?.idField] }}</code></dd>
      </dl>
    </div>
  </PageLayout>
</template>
```

`useChildPage()` returns:

| Property | Type | Description |
|----------|------|-------------|
| `parentData` | `ComputedRef` | Hydrated parent entity record |
| `parentLoading` | `ComputedRef<boolean>` | Loading state |
| `parentManager` | `ComputedRef<EntityManager>` | Parent entity manager |
| `parentConfig` | `ComputedRef` | Route meta parent config |
| `parentEntity` | `ComputedRef<string>` | Parent entity name |
| `parentId` | `ComputedRef<string>` | Parent entity ID |

Whoever cannot read the parent item cannot open the page, and `PageNav` leaves
its link out. A page that acts asks for more: `ctx.childPage('book-show',
'reprint', { component, permission: 'entity:books:update' })` (see
[security](security.md#which-permission-a-page-needs)).

`parentData` follows the record: when it changes (a write, a change from the
[live stream](live-entities.md), or `manager.invalidate(id)` from the app,
say at the end of a [task](tasks.md#refreshing-what-a-task-changed)), it is
read again and the page and the breadcrumb update without a navigation. Bursts
collapse over the entity's `live.coalesceMs`, a read never overlaps another,
and a failed read keeps what is shown.

---

## A tabbed item

An item driven by several pages (its own page, child pages, child lists) can
show them as tabs under one header: the item's header, a tab per page, and the
page below. A tab switch changes only the page.

```js
ctx.crud('instances', { list, show })
ctx.childPage('instance-show', 'guide', { component: Guide, label: 'Guide' })
ctx.childPage('instance-show', 'deploy', { component: Deploy, label: 'Deploy', permission: 'entity:instances:update' })
ctx.itemTabs('instances', { header: InstanceHeader })
```

- **The tabs** are the item's own page ("Details", or `details: 'Overview'`,
  or `details: false` to leave it out), then its child pages and child lists
  in declaration order. A tab the user cannot open is left out (the rule of
  the [router guard](security.md#which-permission-a-page-needs)). Forms are not
  tabs; they open from their list and keep the frame around them.
- **The header** is the entity's label and the item's by default, or the
  `header` component, given `{ item, manager, loading, id }`. The item comes
  from the active stack, so it follows changes like `parentData` does.
- **The pages** stay what they are. Their names, paths, guards and breadcrumb
  do not change: they become children of one frame route, whose component is
  `EntityItemLayout` (or `component` for your own frame). The tabs are the
  navigation: the breadcrumb leaves out its sibling links and the View link
  (the Details tab), and keeps Edit; a `<PageNav/>` in a page stays silent.
- Without a show page, the item opens on its first tab.

Every page of the item must use the same param for the item's id. A child
list with forms namespaces it (`:instanceId`), a child page keeps the id field
(`:name`): give the child list `parentParam: 'name'`. A page left out of the
tabs for this reason is named in a warning at boot.

---

## Tabs on a page of your own

A page that is not an entity's (a profile, settings) puts its parts in tabs
with `QdTabs`, over PrimeVue's tabs (the same look and ARIA as `FieldGroups`):

```vue
<QdTabs :tabs="[
  { key: 'profile', label: t('profile.tab'), icon: 'pi pi-user' },
  { key: 'groups', label: t('groups.tab'), badge: groups.length, permission: 'entity:groups:list' },
]">
  <template #profile>…</template>
  <template #groups>…</template>
</QdTabs>
```

- **The tab is in the address**, `?tab=groups` (the first tab needs none): a
  link opens it, a reload keeps it, back and forward follow it. It replaces
  the address, adding no history entry, and keeps the rest of the query.
  `query="section"` names the parameter, `:query="false"` leaves the address
  alone; `v-model` gives the current key.
- **A badge per tab:** `badge: 3`, or `{ count, tone: 'critical' | 'watch' }`,
  hidden at zero.
- **By permission:** a tab with `permission` is not drawn for a user without
  it, and the address cannot open it. `disabled` greys one out.
- **Lazy:** a panel mounts when first opened, then stays; `:lazy="false"`
  mounts them all.

Which tabs for what: an entity's **fields** in tabs is `FieldGroups`
(`layout="tabs"`); a **record's pages** as tabs is
[`ctx.itemTabs`](#a-tabbed-item), each tab a route; anything else is
`QdTabs`.

## Storage for demos and tests

`MockApiStorage` keeps an entity's records in localStorage, seeded from
fixtures. `latency` and `failRate` make it behave like a remote server, so the
pages' waiting and error states show:

```js
new MockApiStorage({
  entityName: 'suppliers',
  initialData: suppliersFixture,
  authCheck,                 // throws a 401 when it returns false
  latency: [250, 800],       // ms per call, or a fixed number
  failRate: 0.05,            // a 503 on 5 % of the calls
})
```

Its search matches the term in every string field of a record; the list's
`setSearch({ fields })` narrows what the page searches when the records are
cached in the page.

## Field Definition

Fields are defined in the EntityManager and shared across all page types:

```js
ctx.entity('books', new EntityManager({
  name: 'books',
  idField: 'bookId',
  labelField: 'title',
  // Optional one-liner shown under the list page title
  description: 'The library catalog — every title we track.',
  fields: {
    title:   { type: 'text', label: 'Title', required: true, default: '' },
    author:  { type: 'text', label: 'Author', required: true, default: '' },
    year:    { type: 'number', label: 'Year', default: () => new Date().getFullYear() },
    genre:   { type: 'select', label: 'Genre', reference: { entity: 'genres' }, default: 'fiction' },
    summary: { type: 'textarea', label: 'Summary' },
    active:  { type: 'boolean', label: 'Active', default: true },
    email:   { type: 'email', label: 'Contact Email' },
  },
  storage: booksStorage
}))
```

### Field types

| Type | Form input | Show display |
|------|-----------|--------------|
| `text` | InputText | Plain text |
| `number` | InputNumber | Formatted number |
| `boolean` | Checkbox | BoolCell icon |
| `select` | Select dropdown | Text (or badge with severity) |
| `textarea` | Textarea | Monospace block |
| `email` | InputText (email) | Plain text |
| `password` | Password | Hidden |
| `date` | DatePicker | Formatted date |
| `datetime` | DatePicker | Formatted datetime |

### Field options

| Option | Type | Description |
|--------|------|-------------|
| `type` | `string` | Field type (see above) |
| `label` | `string` | Display label |
| `required` | `boolean` | Required validation |
| `default` | `any \| () => any` | Default value (static or factory) |
| `editable` | `boolean` | Include in form (default: true) |
| `listable` | `boolean` | Include in list columns (default: true) |
| `reference` | `{ entity }` | Populate select from another entity |
| `options` | `Array` | Static options for select |
| `optionLabel` | `string` | Label field in options |
| `optionValue` | `string` | Value field in options |
| `placeholder` | `string` | Input placeholder |
| `disabled` | `boolean` | Disable input |
| `readonly` | `boolean` | Read-only input |
| `fractionDigits` | `number \| { min?, max? }` | Number fields: digits the input takes after the decimal point (`2` = always two). Without it, whole numbers only |
| `min` / `max` | `number` | Number fields: bounds of the input |
| `step` | `number` | Number fields: increment of the input |
| `validate` | `(value, formData) => string \| null` | Custom validator |
| `emptyText` | `string` | Shown in detail pages for an empty value (default: the kernel's `display.emptyPlaceholder`, `-`) |
| `nullSort` | `'first' \| 'last' \| 'low' \| 'high'` | Null placement when locally sorted (default `'last'`; `'low'` = null behaves as the smallest value — right for "last seen" dates). Manager-level `nullSort` option sets the default for all fields |

---

## Severity Maps

EntityManager supports severity maps for colored badges:

```js
ctx.entity('books', new EntityManager({
  // ...
}).setSeverityMap('genre', {
  fiction: 'info',
  'sci-fi': 'primary',
  fantasy: 'warn',
  mystery: 'danger',
}))
```

Use in list pages with `<SeverityTag>`:

```vue
<Column field="genre" header="Genre" sortable>
  <template #body="{ data }">
    <SeverityTag field="genre" :value="data.genre" />
  </template>
</Column>
```

Show pages auto-inject severity from the manager when `generateFields()` is called — no extra config needed.

---

## Recipes

### Read-only entity (list only, no form)

```js
ctx.crud('genres', {
  list: () => import('./pages/GenreList.vue')
})
```

### Entity without nav item

```js
ctx.crud('genres', {
  list: () => import('./pages/GenreList.vue'),
  form: () => import('./pages/GenreForm.vue')
})
// No nav option = no menu entry
```

### Multiple child entities

```js
// Books have loans and reviews
ctx.crud('loans', {
  list: () => import('./pages/BookLoans.vue'),
  form: () => import('./pages/BookLoanForm.vue')
}, { parentRoute: 'book', foreignKey: 'book_id' })

ctx.crud('reviews', {
  list: () => import('./pages/BookReviews.vue')
}, { parentRoute: 'book', foreignKey: 'book_id' })
```

### Child entity + custom child page

```js
// Book has loans (entity) + info (custom page)
ctx.crud('loans', { list, form }, { parentRoute: 'book', foreignKey: 'book_id' })
ctx.childPage('book', 'info', { component: () => import('./pages/BookInfo.vue'), label: 'Info' })
```

Tabs appear automatically: Details | Loans | Info

### Reusable list behaviors (augmenting composables)

A cross-cutting list behavior — a favorite toggle, a status badge action, a
shared filter — is best packaged as a composable that **takes the list builder
and augments it**. The builder is a plain object (`addAction`, `addFilter`,
`manager`, …), so a composable can layer state + actions onto any list without
the page knowing the details. Combined with the row-aware action callbacks
above, this is the canonical way to share UI behavior across entities.

```js
// composables/useFavoriteAction.js — works on ANY list
import { ref, onMounted } from 'vue'
import { useOrchestrator, useSignalToast } from '@quazardous/qdadm'

export function useFavoriteAction(list, entityType) {
  const toast = useSignalToast('FavoriteAction')
  const { getManager, hasManager } = useOrchestrator()
  const favorites = hasManager('favorites') ? getManager('favorites') : null
  const favoriteIds = ref(new Set())

  const isFavorite = (row) => favoriteIds.value.has(String(row[list.manager.idField]))
  async function toggle(row) { /* create/delete in favorites, update favoriteIds, toast */ }

  onMounted(async () => { /* load favoriteIds for entityType */ })

  // Inject the row-aware action onto the builder
  list.addAction('favorite', {
    icon: (row) => isFavorite(row) ? 'pi pi-star-fill' : 'pi pi-star',
    severity: (row) => isFavorite(row) ? 'warn' : 'secondary',
    tooltip: (row) => isFavorite(row) ? 'Remove from favorites' : 'Add to favorites',
    onClick: toggle,
  })

  return { isFavorite, toggle }   // expose for the page if it needs them
}
```

Drop it on any list page in one line — the same composable serves every entity:

```js
const list = useListPage({ entity: 'books' })
useFavoriteAction(list, 'book')        // ⭐ adds the star toggle

const products = useListPage({ entity: 'products' })
useFavoriteAction(products, 'product') // same behavior, different entity
```

The same shape works for `useEntityItemFormPage` / `useEntityItemShowPage`
builders (call `addField` / `addAction` on them). Full working example:
`packages/demo/src/composables/useFavoriteAction.js`.

### Permission-aware form fields

```vue
<script setup>
import { useAuth, useSecurity } from '@quazardous/qdadm'
const { user } = useAuth()
// A permission granted in the roles provider, not a role test
const { isGranted } = useSecurity()
const anyBorrower = isGranted('loans:any-borrower')

const form = useEntityItemFormPage({ entity: 'loans' })
form.generateFields()
</script>

<template>
  <FormPage v-bind="form.props.value" v-on="form.events">
    <template #fields>
      <div class="form-grid">
        <!-- Admin selects any user -->
        <FormField v-if="anyBorrower" name="user_id" label="Borrower">
          <FormInput :field="form.getFieldConfig('user_id')" v-model="form.data.value.user_id" />
        </FormField>
        <!-- Without it, the borrower is the user, locked -->
        <FormField v-else name="user_id" label="Borrower">
          <InputText :modelValue="user?.username" disabled class="w-full" />
        </FormField>

        <!-- Other fields rendered normally -->
        <template v-for="f in form.fields.value" :key="f.name">
          <FormField v-if="f.name !== 'user_id'" :name="f.name" :label="f.label">
            <FormInput :field="f" v-model="form.data.value[f.name]" />
          </FormField>
        </template>
      </div>
    </template>
  </FormPage>
</template>
```

### Zone extensibility in pages

```vue
<template #fields>
  <Zone name="books-detail-content">
    <FieldGroups :groups="form.groups.value" :data="form.data.value" layout="accordion">
      <template #field="{ field }">
        <FormField :name="field.name" :label="field.label">
          <FormInput :field="field" v-model="form.data.value[field.name]" />
        </FormField>
      </template>
    </FieldGroups>
  </Zone>
</template>
```

Other modules can inject, replace, or wrap content in this zone via `ctx.block()`.
