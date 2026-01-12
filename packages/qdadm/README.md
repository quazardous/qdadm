# qdadm

**Vue 3 admin framework. PrimeVue. Zero boilerplate.**

Quick start: [../../README.md](../../README.md) (5 min tutorial)

Concepts & patterns: [QDADM_CREDO.md](QDADM_CREDO.md)

Changelog: [../../CHANGELOG.md](../../CHANGELOG.md)

## Installation

```bash
npm install qdadm primevue @primeuix/themes
```

## Exports

```js
// Core
import { Kernel, EntityManager } from 'qdadm'

// Storage backends
import { MockApiStorage, ApiStorage, SdkStorage } from 'qdadm'

// Auth
import { SessionAuthAdapter, LocalStorageSessionAuthAdapter } from 'qdadm'

// Security (permissions, roles)
import { SecurityChecker, PermissionMatcher, PermissionRegistry } from 'qdadm/security'
import { PersistableRoleProvider, createLocalStorageRoleGranter } from 'qdadm/security'

// Composables
import { useForm, useBareForm, useListPageBuilder } from 'qdadm/composables'

// Components
import { ListPage, PageLayout, AppLayout, FormField, FormActions } from 'qdadm/components'

// Module system
import { KernelContext } from 'qdadm/module'

// Styles
import 'qdadm/styles'
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
import { SdkStorage } from 'qdadm'

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
| [Architecture](docs/architecture.md) | PAC pattern, layers |
| [Extension](docs/extension.md) | Hooks, signals, zones |

## Peer Dependencies

- vue ^3.3.0
- vue-router ^4.0.0
- primevue ^4.0.0
- pinia ^2.0.0

## License

MIT
