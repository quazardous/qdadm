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
import { Kernel, createQdadm, EntityManager, ApiStorage, LocalStorage } from 'qdadm'

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

## Peer Dependencies

- vue ^3.3.0
- vue-router ^4.0.0
- primevue ^4.0.0
- pinia ^2.0.0
- vanilla-jsoneditor ^0.23.0

## License

MIT
