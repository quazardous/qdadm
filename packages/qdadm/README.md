# qdadm

**Vue 3 admin framework. PrimeVue. Zero boilerplate.**

Full documentation: [../../README.md](../../README.md)

Changelog: [../../CHANGELOG.md](../../CHANGELOG.md)

## Installation

```bash
npm install qdadm
```

## Quick Start

```js
import { Kernel, EntityManager, LocalStorage } from 'qdadm'
import PrimeVue from 'primevue/config'
import Aura from '@primeuix/themes/aura'
import 'qdadm/styles'

const kernel = new Kernel({
  root: App,
  modules: import.meta.glob('./modules/*/init.js', { eager: true }),
  managers: {
    books: new EntityManager({
      name: 'books',
      storage: new LocalStorage({ key: 'books' }),
      labelField: 'title'
    })
  },
  authAdapter,
  pages: { login: LoginPage, layout: MainLayout },
  homeRoute: 'book',
  app: { name: 'My App' },
  primevue: { plugin: PrimeVue, theme: Aura }
})

kernel.createApp().mount('#app')
```

## Exports

```js
// Main
import { Kernel, createQdadm, EntityManager, ApiStorage, LocalStorage, SdkStorage } from 'qdadm'

// Composables
import { useForm, useBareForm, useListPageBuilder } from 'qdadm/composables'

// Components
import { ListPage, PageLayout, FormField, FormActions } from 'qdadm/components'

// Module system
import { initModules, getRoutes, setSectionOrder } from 'qdadm/module'

// Utilities
import { formatDate, truncate } from 'qdadm/utils'

// Styles
import 'qdadm/styles'
```

## SdkStorage

Adapter for generated SDK clients (hey-api, openapi-generator, etc.). Maps SDK methods to standard CRUD operations with optional transforms.

### Basic Usage

```js
import { EntityManager, SdkStorage } from 'qdadm'
import { Sdk } from './generated/sdk.gen.js'

const sdk = new Sdk({ client: myClient })

const storage = new SdkStorage({
  sdk,
  methods: {
    list: 'getApiAdminTasks',
    get: 'getApiAdminTasksById',
    create: 'postApiAdminTasks',
    update: 'patchApiAdminTasksById',
    delete: 'deleteApiAdminTasksById'
  }
})

const manager = new EntityManager({
  name: 'tasks',
  storage,
  labelField: 'name'
})
```

### Configuration Options

| Option | Type | Description |
|--------|------|-------------|
| `sdk` | object | SDK instance |
| `getSdk` | function | Callback for lazy SDK loading |
| `methods` | object | Map operations to SDK method names or callbacks |
| `transformRequest` | function | Global request transform `(operation, params) => params` |
| `transformResponse` | function | Global response transform `(operation, data) => data` |
| `transforms` | object | Per-method transforms (override global) |
| `responseFormat` | object | Configure response normalization |
| `clientSidePagination` | boolean | Handle pagination locally (default: false) |

### Method Mapping

Methods can be strings (SDK method name) or callbacks for full control:

```js
methods: {
  // String: calls sdk.getItems({ query: params })
  list: 'getItems',

  // Callback: full control over SDK invocation
  get: async (sdk, id) => {
    const result = await sdk.getItemById({ path: { id } })
    return result.data
  }
}
```

### Transform Callbacks

**Global transforms** apply to all operations:

```js
new SdkStorage({
  sdk,
  methods: { list: 'getItems', get: 'getItemById' },
  transformRequest: (operation, params) => {
    if (operation === 'list') {
      return { query: params }
    }
    return params
  },
  transformResponse: (operation, response) => response.data
})
```

**Per-method transforms** override global ones:

```js
new SdkStorage({
  sdk,
  methods: { list: 'getItems' },
  transforms: {
    list: {
      request: (params) => ({ query: { ...params, active: true } }),
      response: (data) => ({ items: data.results, total: data.count })
    }
  }
})
```

### Response Format Normalization

For APIs with non-standard response shapes, configure normalization before transforms:

```js
new SdkStorage({
  sdk,
  methods: { list: 'getItems' },
  responseFormat: {
    dataField: 'results',      // Field containing array (e.g., 'data', 'results')
    totalField: 'count',       // Field for total count (null = compute from array)
    itemsField: 'data.items'   // Nested path (takes precedence over dataField)
  }
})
```

### Client-Side Pagination

For SDKs that return all items without server-side pagination:

```js
new SdkStorage({
  sdk,
  methods: { list: 'getAllItems' },
  clientSidePagination: true  // Fetches all, paginates/sorts/filters in-memory
})
```

### Real-World Example (hey-api SDK)

```js
import { Sdk } from '@/generated/sdk.gen.js'
import { client } from '@/generated/client.gen.js'

// Configure client
client.setConfig({ baseUrl: '/api' })

const sdk = new Sdk({ client })

const taskStorage = new SdkStorage({
  sdk,
  methods: {
    list: 'getApiAdminTasks',
    get: 'getApiAdminTasksById',
    create: 'postApiAdminTasks',
    patch: 'patchApiAdminTasksById',
    delete: 'deleteApiAdminTasksById'
  },
  transforms: {
    list: {
      response: (data) => ({
        items: data.items.map(t => ({ ...t, statusLabel: t.status.toUpperCase() })),
        total: data.total
      })
    }
  }
})
```

## Peer Dependencies

- vue ^3.3.0
- vue-router ^4.0.0
- primevue ^4.0.0
- pinia ^2.0.0
- vanilla-jsoneditor ^0.23.0

## License

MIT
