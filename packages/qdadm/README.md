# qdadm

**Vue 3 admin framework. PrimeVue. Zero boilerplate.**

Quick start: [README](https://github.com/quazardous/qdadm/blob/main/README.md) (5 min tutorial)

Concepts & patterns: [QDADM_CREDO](https://github.com/quazardous/qdadm/blob/main/packages/qdadm/QDADM_CREDO.md)

Changelog: [CHANGELOG](https://github.com/quazardous/qdadm/blob/main/CHANGELOG.md)

## Installation

```bash
npm install @quazardous/qdadm primevue @primeuix/themes primeicons vue-router pinia
```

qdadm ships raw TS/Vue sources, so Vite needs a small config assist to keep
PrimeVue as a single module instance in dev. One line:

```ts
// vite.config.ts
import { qdadmVitePlugin } from '@quazardous/qdadm/vite'

export default defineConfig({
  plugins: [vue(), qdadmVitePlugin()],
})
```

(It applies `resolve.dedupe` + the `optimizeDeps` exclude/include set — see
the plugin's JSDoc for details. Without it, dev boots to a blank page with
`Error: No PrimeVue Toast provided!`.)

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
import { useBareForm, useListPage } from '@quazardous/qdadm/composables'

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
| [QDADM_CREDO](https://github.com/quazardous/qdadm/blob/main/packages/qdadm/QDADM_CREDO.md) | Philosophy, patterns, concepts |
| [Page compositions](https://github.com/quazardous/qdadm/blob/main/docs/page-compositions.md) | **Start here** — which composition for which need |
| [CRUD Pages](https://github.com/quazardous/qdadm/blob/main/docs/crud.md) | List / form / show / child pages reference |
| [Navigation](https://github.com/quazardous/qdadm/blob/main/docs/navigation.md) | Breadcrumb, sibling navlinks, View↔Edit toggle |
| [Architecture](https://github.com/quazardous/qdadm/blob/main/docs/architecture.md) | PAC pattern, layers |
| [Extension](https://github.com/quazardous/qdadm/blob/main/docs/extension.md) | Decorators, bundles, multi-storage |
| [Hooks](https://github.com/quazardous/qdadm/blob/main/docs/hooks.md) | Alter / invoke registry |
| [Signals](https://github.com/quazardous/qdadm/blob/main/docs/signals.md) | Event bus, SSE bridge |
| [Zones](https://github.com/quazardous/qdadm/blob/main/docs/zones.md) | Extensible UI blocks |
| [Security](https://github.com/quazardous/qdadm/blob/main/docs/security.md) | Permissions, roles |
| [i18n](https://github.com/quazardous/qdadm/blob/main/docs/i18n.md) | Messages, providers, strategies |
| [Codegen](https://github.com/quazardous/qdadm/blob/main/docs/gen.md) | Generate managers (OpenAPI / manual) |
| [Deferred](https://github.com/quazardous/qdadm/blob/main/docs/deferred.md) | Deferred values & warmup |
| [AGENT_GUIDE](https://github.com/quazardous/qdadm/blob/main/docs/AGENT_GUIDE.md) | Quick index for AI agents |

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

Installing qdadm from npm avoids the *duplicate-copy* trap (the published tarball ships no `node_modules/`, so peers resolve from the host) — but a related *split-pipeline* trap still applies in Vite dev: the host's `primevue` import gets pre-bundled into `.vite/deps` while qdadm's raw sources import `node_modules/primevue/` directly, which also yields two PrimeVue instances. `qdadmVitePlugin()` (see Installation above) handles both cases — dedupe for links, optimizeDeps exclude/include for the pre-bundle split.

One more caveat: qdadm ships TypeScript sources, so with a `file:` link your `vue-tsc` / lint / test counters measure qdadm's **working tree**, not a released version. Any local qdadm edit moves your numbers with zero change on your side — don't calibrate quality ratchets or CI thresholds against a linked checkout; pin them to the published package your CI actually installs.

## License

MIT
