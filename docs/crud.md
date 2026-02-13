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

**Options:**

| Option | Type | Description |
|--------|------|-------------|
| `nav` | `{ section, icon?, label? }` | Add navigation menu item |
| `parentRoute` | `string` | Mount as child of this route (e.g. `'book'`) |
| `foreignKey` | `string` | FK field linking child to parent (e.g. `'book_id'`) |
| `label` | `string` | Tab label for child route (e.g. `'Loans'`) |
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
  label: 'Loans'
})

// List-only (no form)
ctx.crud('genres', {
  list: () => import('./pages/GenreList.vue')
})
```

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

Custom non-CRUD pages:

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
```

---

## List Page

```vue
<script setup>
import { useListPage, ListPage, SeverityTag } from 'qdadm'
import Column from 'primevue/column'

const list = useListPage({ entity: 'books' })

list.setSearch({ placeholder: 'Search books...' })
list.addFilter('genre', { optionsEntity: 'genres', optionLabel: 'name' })
list.addCreateAction()
list.addEditAction()
list.addDeleteAction({ labelField: 'title' })
</script>

<template>
  <ListPage v-bind="list.props.value" v-on="list.events">
    <template #columns>
      <Column field="title" header="Title" sortable />
      <Column field="author" header="Author" sortable />
      <Column field="genre" header="Genre" sortable>
        <template #body="{ data }">
          <SeverityTag field="genre" :value="data.genre" />
        </template>
      </Column>
      <Column field="year" header="Year" sortable style="width: 100px" />
    </template>
  </ListPage>
</template>
```

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
| `generateColumns()` | Auto-generate columns from schema |
| `loadItems(params?, { force? })` | Force reload data |

### Filter modes

```js
// Options from another entity
list.addFilter('genre', { optionsEntity: 'genres', optionLabel: 'name' })

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
```

### ListPage slots

| Slot | Purpose |
|------|---------|
| `#columns` | PrimeVue `<Column>` definitions |
| `#nav` | `<PageNav>` for child routes |
| `#beforeTable` | Content above the table (zones, alerts) |
| `#header-actions` | Custom header action buttons |
| `#empty` | Empty state content |

### Options

```ts
useListPage({
  entity: 'books',
  defaultSort: 'title',        // Default sort field
  defaultSortOrder: 1,         // 1 = asc, -1 = desc
  pageSize: 20,                // Rows per page
  serverSide: false,           // Server-side pagination
  loadOnMount: true,           // Auto-load on mount
  persistFilters: true,        // Remember filters across navigation
  syncUrlParams: true,         // Sync filters/sort with URL
})
```

---

## Form Page

**Important:** `FormPage` does NOT auto-render fields. The `#fields` slot is required.

`generateFields()` populates field definitions and default values, but you render them in the template.

### Minimal form

```vue
<script setup>
import { useEntityItemFormPage, FormPage, FormField, FormInput, PageNav } from 'qdadm'

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
import { useEntityItemFormPage, FormPage, FormField, FormInput, FieldGroups, PageNav } from 'qdadm'

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
| `addDeleteAction()` | Delete button (hidden in create mode) |
| `addCancelAction()` | Cancel navigation |
| `addAction(name, config)` | Custom action |

### Mode detection

A single form component handles both create and edit. The mode is auto-detected from the route:

- `form.isCreate.value` — true on the create route
- `form.isEdit.value` — true on the edit route
- `form.data.value` — empty defaults on create, loaded entity on edit

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

---

## Show Page

```vue
<script setup>
import { useEntityItemShowPage, ShowPage, ShowField, PageNav } from 'qdadm'

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
| `addAction(name, config)` | Custom action |

### Field display types

| Type | Renders as |
|------|------------|
| `text` | Plain text (default) |
| `badge` | PrimeVue Tag with severity |
| `currency` | Formatted currency string |
| `number` | Locale-formatted number |
| `boolean` | Checkmark / X icon |
| `image` | `<img>` tag |
| `textarea` | Monospace text block |
| `reference` | Router link to related entity |
| `date` | Formatted date string |

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

## Child Entity List

Parent filter is auto-applied from `route.meta.parent`. No extra config needed in the composable.

```vue
<script setup>
import { useListPage, ListPage, PageNav } from 'qdadm'
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
      <Column field="borrower_name" header="Borrower" sortable />
      <Column field="borrowed_at" header="Borrowed" sortable />
      <Column field="returned_at" header="Returned" sortable />
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

### Child form

The foreign key field is auto-filled and auto-disabled from the parent route:

```vue
<script setup>
import { useEntityItemFormPage, FormPage, FormField, FormInput, PageNav } from 'qdadm'

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

The `book_id` field is auto-filled from the route param and hidden (`f.hidden`). No manual handling needed.

---

## Child Page (non-entity)

For custom tabs on entity items that don't map to a child entity.

```vue
<script setup>
import { useChildPage, PageLayout } from 'qdadm'

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

---

## Field Definition

Fields are defined in the EntityManager and shared across all page types:

```js
ctx.entity('books', new EntityManager({
  name: 'books',
  idField: 'bookId',
  labelField: 'title',
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
| `validate` | `(value, formData) => string \| null` | Custom validator |

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
}, { parentRoute: 'book', foreignKey: 'book_id', label: 'Loans' })

ctx.crud('reviews', {
  list: () => import('./pages/BookReviews.vue')
}, { parentRoute: 'book', foreignKey: 'book_id', label: 'Reviews' })
```

### Child entity + custom child page

```js
// Book has loans (entity) + info (custom page)
ctx.crud('loans', { list, form }, { parentRoute: 'book', foreignKey: 'book_id', label: 'Loans' })
ctx.childPage('book', 'info', { component: () => import('./pages/BookInfo.vue'), label: 'Info' })
```

Tabs appear automatically: Details | Loans | Info

### Permission-aware form fields

```vue
<script setup>
import { useAuth } from 'qdadm'
const { user } = useAuth()
const isAdmin = computed(() => user.value?.role === 'ROLE_ADMIN')

const form = useEntityItemFormPage({ entity: 'loans' })
form.generateFields()
</script>

<template>
  <FormPage v-bind="form.props.value" v-on="form.events">
    <template #fields>
      <div class="form-grid">
        <!-- Admin selects any user -->
        <FormField v-if="isAdmin" name="user_id" label="Borrower">
          <FormInput :field="form.getFieldConfig('user_id')" v-model="form.data.value.user_id" />
        </FormField>
        <!-- Non-admin sees locked value -->
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
