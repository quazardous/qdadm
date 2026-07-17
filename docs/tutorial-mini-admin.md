# Tutorial — build a mini admin in 5 steps

This is a **verified, end-to-end walkthrough**: every step below was built and run
against the published `@quazardous/qdadm` npm package (v2.9.0; install lines
updated for v2.10.0) in a fresh `npm create vite` app. Each step produces a working app; the whole thing is
~310 lines of code.

The 5 steps:

1. [Bootstrap — hello world](#step-1--bootstrap-hello-world) (kernel, one module, one list page)
2. [Full CRUD](#step-2--full-crud) (list / create / edit / delete)
3. [Auth](#step-3--auth) (login page, guard, permission gating)
4. [Breadcrumb & menu](#step-4--breadcrumb--menu) (sections, show page, View↔Edit toggle)
5. [Child entities](#step-5--child-entities) (loans under books, dual-context breadcrumb, sibling links)

> **Prerequisites**: Node 22+, npm 10+.

---

## Step 1 — Bootstrap: hello world

### 1.1 Scaffold and install

```bash
npm create vite@latest my-admin -- --template vue-ts
cd my-admin
npm install
npm install @quazardous/qdadm primevue @primeuix/themes primeicons vue-router pinia
```

⚠️ **Gotchas (as of mid-2026):**

- The package is **`@quazardous/qdadm`** (scoped). Plain `npm install qdadm`
  installs a stale, unmaintained 1.x snapshot.
- qdadm ≥ 2.10.0 accepts vue-router 4/5 and pinia 2/3/4. On qdadm 2.9.x or
  older, pin `vue-router@4 pinia@3` or npm's latest majors hit `ERESOLVE`.

### 1.2 Required Vite config

qdadm ships raw TypeScript/Vue sources (no prebuilt dist). Vite's dependency
optimizer would otherwise pre-bundle *your* `primevue` import while serving
qdadm's raw imports from `node_modules` directly — two PrimeVue instances,
and the app dies at boot with `Error: No PrimeVue Toast provided!`.

With qdadm ≥ 2.11.0, one plugin line handles it:

```ts
// vite.config.ts
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { qdadmVitePlugin } from '@quazardous/qdadm/vite'

export default defineConfig({
  plugins: [vue(), qdadmVitePlugin()],
})
```

<details>
<summary>What the plugin applies (or the manual config for qdadm ≤ 2.10)</summary>

```ts
export default defineConfig({
  plugins: [vue()],
  resolve: {
    dedupe: ['vue', 'vue-router', 'primevue', 'pinia'],
  },
  optimizeDeps: {
    // Serve primevue raw on both sides → single instance
    exclude: ['primevue', '@primeuix/themes', '@quazardous/qdadm'],
    // qdadm's CJS dep must still be pre-bundled
    include: ['@quazardous/qdadm > pluralize'],
  },
})
```

</details>

### 1.3 TypeScript workarounds (qdadm ≤ 2.10 only)

With qdadm ≥ 2.11.0 the template's `npm run build` (vue-tsc) passes out of
the box — no shims, no flag changes (a strict-consumer CI gate keeps it
that way). On older versions, three adjustments were needed:

```bash
npm i -D @types/pluralize
```

```jsonc
// tsconfig.app.json — the template enables these; old qdadm sources fail them
"noUnusedLocals": false,
"noUnusedParameters": false,
```

```ts
// src/qdadm-shims.d.ts — the styles export was invisible to TS before 2.11
declare module '@quazardous/qdadm/styles'
```

### 1.4 The app

```ts
// src/main.ts
import { Kernel } from '@quazardous/qdadm'
import { AppLayout } from '@quazardous/qdadm/components'
import PrimeVue from 'primevue/config'
import Aura from '@primeuix/themes/aura'
import '@quazardous/qdadm/styles'
import 'primeicons/primeicons.css'

import App from './App.vue'
import { moduleDefs } from './config/modules'

const kernel = new Kernel({
  root: App,
  moduleDefs,
  // pages.layout is REQUIRED. qdadm's AppLayout gives you the full
  // admin shell (sidebar, menu, breadcrumb, user zone) for free.
  pages: { layout: AppLayout },
  homeRoute: { name: 'home', component: () => import('./pages/HomePage.vue') },
  primevue: { plugin: PrimeVue, theme: Aura },
  app: { name: 'My Admin' },
})

kernel.createApp().mount('#app')
```

```vue
<!-- src/App.vue -->
<script setup lang="ts">
import { RouterView } from 'vue-router'
import ConfirmDialog from 'primevue/confirmdialog'
</script>

<template>
  <ConfirmDialog />
  <RouterView />
</template>
```

```ts
// src/config/modules.ts
import { TasksModule } from '../modules/tasks/TasksModule'

export const moduleDefs = [TasksModule]
```

```ts
// src/modules/tasks/TasksModule.ts
import { Module, EntityManager, MockApiStorage } from '@quazardous/qdadm'

export class TasksModule extends Module {
  static name = 'tasks'

  async connect(ctx: any) {
    ctx.entity('tasks', new EntityManager({
      name: 'tasks',
      labelField: 'title',
      fields: {
        title: { type: 'text', label: 'Title', required: true, default: '' },
        done: { type: 'boolean', label: 'Done', default: false },
      },
      storage: new MockApiStorage({
        entityName: 'tasks',
        initialData: [
          { id: '1', title: 'Learn qdadm', done: false },
          { id: '2', title: 'Build an admin', done: true },
        ],
      }),
    }))

    ctx.crud('tasks', {
      list: () => import('./pages/TaskList.vue'),
    }, { nav: { section: 'Main', icon: 'pi pi-check-square' } })
  }
}
```

```vue
<!-- src/modules/tasks/pages/TaskList.vue -->
<script setup lang="ts">
import { useListPage, ListPage } from '@quazardous/qdadm'
import Column from 'primevue/column'

const list = useListPage({ entity: 'tasks' })
</script>

<template>
  <ListPage v-bind="list.props.value" v-on="list.events">
    <template #columns>
      <Column field="title" header="Title" sortable />
      <Column field="done" header="Done" style="width: 100px">
        <template #body="{ data }">{{ data.done ? '✓' : '○' }}</template>
      </Column>
    </template>
  </ListPage>
</template>
```

```vue
<!-- src/pages/HomePage.vue -->
<template>
  <div style="padding: 1.5rem">
    <h1>Welcome</h1>
    <p>My first qdadm admin.</p>
  </div>
</template>
```

Run `npm run dev` and open `/tasks`: you get the full admin shell — sidebar
with a "Main" section, branding, breadcrumb, a sortable paginated table.
**~85 lines of code.**

---

## Step 2 — Full CRUD

Add a books module with a form page. `ctx.crud()` with a `form:` entry
generates the create + edit routes; one component handles both modes.

```ts
// src/modules/books/BooksModule.ts
import { Module, EntityManager, MockApiStorage } from '@quazardous/qdadm'

export class BooksModule extends Module {
  static name = 'books'

  async connect(ctx: any) {
    ctx.entity('books', new EntityManager({
      name: 'books',
      labelField: 'title',
      fields: {
        title: { type: 'text', label: 'Title', required: true, default: '' },
        author: { type: 'text', label: 'Author', default: '' },
        year: { type: 'number', label: 'Year', default: null },
      },
      storage: new MockApiStorage({
        entityName: 'books',
        initialData: [
          { id: '1', title: 'Dune', author: 'Frank Herbert', year: 1965 },
          { id: '2', title: 'Neuromancer', author: 'William Gibson', year: 1984 },
        ],
      }),
    }))

    ctx.crud('books', {
      list: () => import('./pages/BookList.vue'),
      form: () => import('./pages/BookForm.vue'),
    }, { nav: { section: 'Library', icon: 'pi pi-book' } })
  }
}
```

Register it in `src/config/modules.ts` (`moduleDefs = [TasksModule, BooksModule]`).

```vue
<!-- src/modules/books/pages/BookList.vue -->
<script setup lang="ts">
import { useListPage, ListPage } from '@quazardous/qdadm'
import Column from 'primevue/column'

const list = useListPage({ entity: 'books' })

list.setSearch({ placeholder: 'Search books...', fields: ['title', 'author'] })

list.addCreateAction('Add Book')   // header button (permission-gated)
list.addEditAction()               // row action
list.addDeleteAction({ labelField: 'title' })  // row action + confirm dialog
</script>

<template>
  <ListPage v-bind="list.props.value" v-on="list.events">
    <template #columns>
      <Column field="title" header="Title" sortable />
      <Column field="author" header="Author" sortable />
      <Column field="year" header="Year" sortable style="width: 100px" />
    </template>
  </ListPage>
</template>
```

```vue
<!-- src/modules/books/pages/BookForm.vue -->
<script setup lang="ts">
import { useEntityItemFormPage, FormPage, FormField, FormInput } from '@quazardous/qdadm'

const form = useEntityItemFormPage({ entity: 'books' })
form.generateFields()               // fields from the manager schema

form.addSaveAction({ andClose: true })
form.addDeleteAction()
</script>

<template>
  <FormPage v-bind="form.props.value" v-on="form.events">
    <template #fields>
      <FormField v-for="field in form.fields.value" :key="field.name" :name="field.name" :label="field.label">
        <FormInput :field="field" v-model="form.data.value[field.name]" />
      </FormField>
    </template>
  </FormPage>
</template>
```

> **TS note**: on qdadm ≤ 2.10 these loops needed `as any` casts (fields vs
> `FormInput` prop type, `data.value` indexing); fixed in 2.11.

That's the whole CRUD: create (`/books/create`), edit, delete with
confirmation, search, toasts, redirects. **~55 more lines.**

---

## Step 3 — Auth

Three pieces: a session adapter (login logic), the built-in `LoginPage`,
and a roles provider for permissions.

```ts
// src/auth/authAdapter.ts
import { LocalStorageSessionAuthAdapter } from '@quazardous/qdadm'

const USERS = [
  { id: '1', username: 'admin', password: 'admin', role: 'ROLE_ADMIN' },
  { id: '2', username: 'bob', password: 'bob', role: 'ROLE_USER' },
]

class MyAuthAdapter extends LocalStorageSessionAuthAdapter {
  constructor() {
    super('my_admin_auth')
  }

  async login({ username, password }: { username: string; password: string }) {
    const user = USERS.find(u => u.username === username && u.password === password)
    if (!user) throw new Error('Invalid credentials')

    const token = btoa(`${user.id}:${Date.now()}`)
    const userData = { id: user.id, username: user.username, role: user.role }
    this.setSession(token, userData)
    this.persist()
    return { user: userData, token }
  }
}

export const authAdapter = new MyAuthAdapter()
```

⚠️ The `role` value must **exactly match** a key of `role_permissions` /
`role_hierarchy` below (e.g. `ROLE_ADMIN`, not `admin`). An unknown role
fails *silently*: the user just has no permissions.

Kernel options (`src/main.ts`):

```ts
import { AppLayout, LoginPage } from '@quazardous/qdadm/components'
import { createLocalStorageRolesProvider } from '@quazardous/qdadm/security'
import { authAdapter } from './auth/authAdapter'

const kernel = new Kernel({
  // ...
  pages: { layout: AppLayout, login: LoginPage },  // built-in login page
  authAdapter,
  // Bridges the session user into entity-level permission checks.
  // Without this line, permission gating is silently permissive.
  entityAuthAdapter: () => authAdapter.getUser(),
  security: {
    rolesProvider: createLocalStorageRolesProvider({
      key: 'my_admin_roles',
      defaults: {
        role_hierarchy: { ROLE_ADMIN: ['ROLE_USER'] },
        role_permissions: {
          ROLE_USER: ['entity:*:read', 'entity:*:list'],
          ROLE_ADMIN: ['entity:*:create', 'entity:*:update', 'entity:*:delete'],
        },
      },
    }),
  },
})
```

What you get, with zero page changes:

- Unauthenticated visits redirect to `/login` (built-in page, app branding).
- The sidebar grows a user zone (name, role, avatar, logout).
- **Permission gating is automatic**: logged in as `bob` (read-only), the
  "Add Book" button and the row edit/delete actions disappear; as `admin`
  they're back. The `entity:*:create|update|delete` permissions drive the
  `addCreateAction`/`addEditAction`/`addDeleteAction` affordances.

**~45 more lines.**

---

## Step 4 — Breadcrumb & menu

The breadcrumb trail (`Home > Books > Dune`) has been automatic since
step 1. This step adds the pieces you control:

```ts
// main.ts — order menu sections (default: registration order)
sectionOrder: ['Library', 'Main'],
// Opt-in: View ↔ Edit mode links on the breadcrumb terminal (#1332)
features: { breadcrumbModeToggle: true },
```

Add a show page so books have a read view paired with the edit form:

```ts
// BooksModule.ts — add `show:` to the crud call
ctx.crud('books', {
  list: () => import('./pages/BookList.vue'),
  show: () => import('./pages/BookShow.vue'),
  form: () => import('./pages/BookForm.vue'),
}, { nav: { section: 'Library', icon: 'pi pi-book' } })
```

```vue
<!-- src/modules/books/pages/BookShow.vue -->
<script setup lang="ts">
import { useEntityItemShowPage, ShowPage, ShowField, PageNav } from '@quazardous/qdadm'

const show = useEntityItemShowPage({ entity: 'books' })
show.generateFields()

show.addEditAction()
show.addBackAction()
</script>

<template>
  <ShowPage v-bind="show.props.value" v-on="show.events">
    <template #nav>
      <PageNav />
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

Result: `/books/1` shows the record; the breadcrumb terminal reads
`Dune | Edit` — and on `/books/1/edit` the mirror `View` link appears.
Mode links are permission-gated (`canUpdate`) and deduped against child
navlinks automatically (#1357). **~30 more lines.**

---

## Step 5 — Child entities

Loans live under books: routes mounted at `/books/:bookId/loans`, foreign
key auto-managed, breadcrumb carrying both contexts.

```ts
// BooksModule.ts — inside connect(ctx)

// 1. Declare the child on the parent manager (drives navlinks)
ctx.entity('books', new EntityManager({
  name: 'books',
  labelField: 'title',
  children: {
    loans: { entity: 'loans', foreignKey: 'book_id', label: 'Loans' },
  },
  // ... fields, storage as before
}))

// 2. The child entity
ctx.entity('loans', new EntityManager({
  name: 'loans',
  labelField: 'borrower',
  fields: {
    borrower: { type: 'text', label: 'Borrower', required: true, default: '' },
    book_id: { type: 'text', label: 'Book', default: '' },
    returned: { type: 'boolean', label: 'Returned', default: false },
  },
  storage: new MockApiStorage({
    entityName: 'loans',
    initialData: [
      { id: 'l1', borrower: 'Alice', book_id: '1', returned: false },
      { id: 'l2', borrower: 'Bob', book_id: '1', returned: true },
      { id: 'l3', borrower: 'Carol', book_id: '2', returned: false },
    ],
  }),
}))

// 3. Child CRUD mounted under the book route
ctx.crud('loans', {
  list: () => import('./pages/BookLoans.vue'),
  form: () => import('./pages/BookLoanForm.vue'),
}, {
  parentRoute: 'book',
  foreignKey: 'book_id',
  label: 'Loans',
})
```

```vue
<!-- src/modules/books/pages/BookLoans.vue -->
<script setup lang="ts">
import { useListPage, ListPage, PageNav, BoolCell } from '@quazardous/qdadm'
import Column from 'primevue/column'

// The book_id filter is auto-applied from route.meta.parent
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
      <Column field="borrower" header="Borrower" sortable />
      <Column field="returned" header="Returned" style="width: 120px">
        <template #body="{ data }">
          <BoolCell :value="data.returned" />
        </template>
      </Column>
    </template>
  </ListPage>
</template>
```

```vue
<!-- src/modules/books/pages/BookLoanForm.vue -->
<script setup lang="ts">
import { useEntityItemFormPage, FormPage, FormField, FormInput, PageNav } from '@quazardous/qdadm'

const form = useEntityItemFormPage({ entity: 'loans' })
const parentBook = form.parentData   // the book record, auto-loaded

form.addSaveAction()
</script>

<template>
  <FormPage v-bind="form.props.value" v-on="form.events">
    <template #nav>
      <PageNav />
    </template>

    <template #fields>
      <p v-if="parentBook">Loan for "{{ parentBook.title }}"</p>
      <FormField v-for="f in form.fields.value" :key="f.name" :name="f.name" :label="f.label">
        <FormInput :field="f" v-model="form.data.value[f.name]" />
      </FormField>
    </template>
  </FormPage>
</template>
```

Everything below is automatic — verified live:

- `/books/1/loans` lists **only book 1's loans** (FK filter from `route.meta.parent`).
- Sibling links on every book child page: `View | Edit | Loans`
  (mode links + child navlinks, deduped).
- Create: breadcrumb `Home > Books > Dune > Loans > Create`, the `book_id`
  field is **pre-filled and disabled**, `form.parentData` gives you the book.
- After save: redirect to the sibling child list (`/books/1/loans`).
- Edit: dual-context breadcrumb `Home > Books > Dune > Loans > Dave` —
  both entity labels resolved.

**~75 more lines. Total: ~310 lines for the whole admin.**

---

## Where to go next

- [page-compositions.md](./page-compositions.md) — "I want X → use Y" decision table
- [crud.md](./crud.md) — full reference for list/form/show/child pages
- [navigation.md](./navigation.md) — breadcrumb, navlinks, View↔Edit toggle internals
- [security.md](./security.md) — permissions, roles, ownership
- The demo app (`packages/demo`) — every feature above plus zones, hooks,
  i18n, impersonation, debug bar
