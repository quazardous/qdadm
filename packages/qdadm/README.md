# qdadm

**Vue 3 admin framework. PrimeVue. Zero boilerplate.**

Quick start: [../../README.md](../../README.md) (5 min tutorial)

Concepts & patterns: [QDADM_CREDO.md](QDADM_CREDO.md)

Changelog: [../../CHANGELOG.md](../../CHANGELOG.md)

## Installation

```bash
npm install @quazardous/qdadm primevue @primeuix/themes
```

## Exports

```js
// Core
import { Kernel, EntityManager } from '@quazardous/qdadm'

// Storage backends
import { MockApiStorage, ApiStorage, SdkStorage } from '@quazardous/qdadm'

// Auth
import { SessionAuthAdapter, LocalStorageSessionAuthAdapter } from '@quazardous/qdadm'

// Security (permissions, roles)
import { SecurityChecker, PermissionMatcher, PermissionRegistry } from '@quazardous/qdadm/security'
import { PersistableRoleProvider, createLocalStorageRolesProvider } from '@quazardous/qdadm/security'

// Composables
import { useForm, useBareForm, useListPageBuilder } from '@quazardous/qdadm/composables'

// Components
import { ListPage, PageLayout, AppLayout, FormField, FormActions } from '@quazardous/qdadm/components'

// Module system
import { KernelContext } from '@quazardous/qdadm/module'

// Styles
import '@quazardous/qdadm/styles'
```

## ctx.crud() - Route Helper

Register CRUD routes + navigation in one call:

```js
class BooksModule extends Module {
  async connect(ctx) {
    ctx.entity('books', { ... })

    // Full CRUD with single form
    ctx.crud('books', {
      list: () => import('./pages/BookList.vue'),
      form: () => import('./pages/BookForm.vue')  // create + edit
    }, {
      nav: { section: 'Library', icon: 'pi pi-book' }
    })

    // List only (read-only entity)
    ctx.crud('settings', {
      list: () => import('./pages/SettingsPage.vue')
    }, { nav: { section: 'Config', icon: 'pi pi-cog' } })
  }
}
```

Auto-generates: routes, route family, nav item. Use `ctx.routes()` for custom pages.

## SdkStorage

Adapter for generated SDK clients (hey-api, openapi-generator, etc.):

```js
import { SdkStorage } from '@quazardous/qdadm'

const storage = new SdkStorage({
  sdk,
  methods: {
    list: 'getApiBooks',
    get: 'getApiBooksById',
    create: 'postApiBooks',
    update: 'patchApiBooksById',
    delete: 'deleteApiBooksById'
  }
})
```

Options: `transformRequest`, `transformResponse`, `responseFormat`, `clientSidePagination`.

## Documentation

| Doc | Purpose |
|-----|---------|
| [QDADM_CREDO](QDADM_CREDO.md) | Philosophy, patterns, concepts |
| [Architecture](../../docs/architecture.md) | PAC pattern, layers |
| [Extension](../../docs/extension.md) | Hooks, signals, zones |

## Peer Dependencies

- vue ^3.3.0
- vue-router ^4.0.0
- primevue ^4.0.0
- pinia ^2.0.0

## License

MIT
