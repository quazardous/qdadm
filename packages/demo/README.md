# qdadm-demo

[![Live Demo](https://img.shields.io/badge/demo-live-brightgreen)](https://quazardous.github.io/qdadm/)

Demo application showcasing [qdadm](https://github.com/quazardous/qdadm) framework features.

## Quick Start

```bash
npm install
npm run dev
```

## Default Users

| Username | Password | Role |
|----------|----------|------|
| `admin` | `admin` | admin |
| `user` | `user` | user |

### Permissions

- **admin**: Full access to all modules including Users management
- **user**: Access to Books and Loans only (Users hidden)

### Resetting Data

Clear localStorage to reset all data:

```js
localStorage.clear()
```

## Features Demonstrated

### Kernel Bootstrap

Single-call app initialization:

```js
const kernel = new Kernel({
  root: App,
  modules: import.meta.glob('./modules/*/init.js', { eager: true }),
  managers,
  authAdapter,
  pages: { login, layout },
  primevue: { plugin: PrimeVue, theme: Aura }
})

kernel.createApp().mount('#app')
```

### EntityManager with LocalStorage

```js
const books = new EntityManager({
  name: 'books',
  storage: new LocalStorage({ key: 'qdadm_demo_books' }),
  fields: {
    title: { type: 'text', label: 'Title', required: true },
    author: { type: 'text', label: 'Author' }
  }
})
```

### Permission-Based Access

```js
class UsersManager extends EntityManager {
  canRead() {
    return authAdapter.getUser()?.role === 'admin'
  }
  canWrite() {
    return authAdapter.getUser()?.role === 'admin'
  }
}
```

### Module System

Each module has an `init.js` that registers routes and navigation:

```js
export function init(registry) {
  registry.addRoutes('books', [...], { entity: 'books' })
  registry.addNavItem({ section: 'Library', route: 'book', entity: 'books' })
}
```

## Project Structure

```
src/
├── adapters/
│   └── authAdapter.js    # Auth with localStorage
├── modules/
│   ├── books/            # Books CRUD
│   ├── users/            # Users management (admin only)
│   └── loans/            # Book loans
├── pages/
│   ├── LoginPage.vue
│   └── MainLayout.vue
└── main.js               # Kernel bootstrap
```

## License

MIT
