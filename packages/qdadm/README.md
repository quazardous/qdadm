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

## Consuming via `file:` link from a sibling monorepo

If you install qdadm with a `file:../path/to/qdadm` link instead of from npm — typically during local development on qdadm itself, or before a release lands — pnpm/npm resolves the symlink into the qdadm-monorepo's hoisted `node_modules`. That can pull a *second* copy of `primevue` (and `vue`, `vue-router`, `@primeuix/themes`) into your host bundle even though qdadm itself only declares them as peers.

Symptom: PrimeVue components render without their Aura preset tokens — component-level CSS variables (`--p-paginator-nav-button-width`, etc.) end up undefined, so paginator buttons collapse to 16×16, datatables lose padding, rounded corners disappear. Plugin singletons rely on a shared runtime registry; two instances split the registry in half.

Fix in the host's bundler config — `dedupe` collapses duplicates back to a single resolved copy:

```ts
// vite.config.ts
export default defineConfig({
  resolve: {
    dedupe: ['vue', 'vue-router', 'primevue', '@primeuix/themes'],
  },
})
```

This is the canonical Vite/Webpack pattern for Vue plugin singletons. The `file:` link can stay in place — useful for hot-reload during qdadm development — and the dedupe ensures only one instance of each peer ends up in the bundle.

Installing qdadm from npm (`@quazardous/qdadm@^1.19.3`) doesn't have this issue: the published tarball ships no `node_modules/`, so peers always resolve from the host. The trap is specific to `file:` / `workspace:` links onto a package that lives inside another monorepo.

## License

MIT
