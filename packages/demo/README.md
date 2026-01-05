# qdadm-demo

[![Live Demo](https://img.shields.io/badge/demo-live-brightgreen)](https://quazardous.github.io/qdadm/)

Demo application showcasing [qdadm](https://github.com/quazardous/qdadm) framework features with **6 different storage backends**.

## Quick Start

```bash
npm install
npm run dev
```

## Storage Backends

This demo showcases qdadm's storage abstraction with six different backends:

| Backend | Type | Persistence | Use Case |
|---------|------|-------------|----------|
| **MockApiStorage** | localStorage | Yes | Demo/prototyping with fixtures |
| **LocalStorage** | localStorage | Yes | Browser-local persistent data |
| **MemoryStorage** | volatile | No | Session-scoped temporary data |
| **ApiStorage** | REST API | Remote | Standard REST API integration |
| **DummyJsonStorage** | REST API | Remote | APIs with limit/skip pagination |
| **RestCountriesStorage** | REST API | Remote | Client-side pagination + caching |

## Demo Entities by Backend

### MockApiStorage (Library)
- **Books** - Full CRUD with genre filter, admin-only delete
- **Genres** - Parent entity with child route to filtered books
- **Loans** - Ownership-based access, enrichment pattern
- **Users** - Admin-only access for user management

### LocalStorage
- **Favorites** - User bookmarks stored in browser localStorage

### MemoryStorage
- **Settings** - Key/value pairs (volatile, lost on refresh)

### ApiStorage (JSONPlaceholder)
- **JP Users** - External users with detail page
- **Posts** - Posts with author relationship
- **Todos** - Simple todo list with completion toggle

### DummyJsonStorage
- **Products** - Products with thumbnails, price, category

### RestCountriesStorage
- **Countries** - 250 countries with flag, capital, region

## Default Users

| Username | Password | Role |
|----------|----------|------|
| `admin` | `admin` | ROLE_ADMIN |
| `bob` | `bob` | ROLE_USER |
| `june` | `june` | ROLE_USER |

### Permissions

- **ROLE_ADMIN**: Full access to all modules including Users management
- **ROLE_USER**: Access to Books, Loans, and external APIs (Users hidden)

### Resetting Data

Clear localStorage to reset all MockApiStorage data:

```js
localStorage.clear()
```

## Key Features Demonstrated

### 1. Kernel Bootstrap

Single-call app initialization:

```js
const kernel = new Kernel({
  root: App,
  modules: import.meta.glob('./modules/*/init.js', { eager: true }),
  sectionOrder: ['Library', 'Memory Storage', 'Local Storage', ...],
  managers: allManagers,
  authAdapter,
  primevue: { plugin: PrimeVue, theme: Aura }
})

kernel.createApp().mount('#app')
```

### 2. Multiple Storage Backends

```js
// MockApiStorage - localStorage persistence with fixtures
const booksStorage = new MockApiStorage({
  entityName: 'books',
  initialData: booksFixture
})

// LocalStorage - browser localStorage
const favoritesStorage = new LocalStorage({
  key: 'qdadm-demo-favorites'
})

// MemoryStorage - volatile (session only)
const settingsStorage = new MemoryStorage({
  initialData: [{ id: 'theme', key: 'theme', value: 'light' }]
})

// ApiStorage - REST API integration
const jpStorage = new ApiStorage({
  endpoint: '/users',
  client: axios.create({ baseURL: 'https://jsonplaceholder.typicode.com' })
})
```

### 3. Custom Storage Classes

```js
// DummyJSON uses limit/skip pagination
class DummyJsonStorage extends ApiStorage {
  async list(params = {}) {
    const { page = 1, page_size = 20 } = params
    const limit = page_size
    const skip = (page - 1) * page_size
    // ... convert pagination format
  }
}

// REST Countries with client-side pagination + caching
class RestCountriesStorage extends ApiStorage {
  constructor(options = {}) {
    super({ ...options, idField: 'cca3' })
    this._cache = null
    this._cacheTTL = 5 * 60 * 1000  // 5 minutes
  }
}
```

### 4. Permission-Based Access

```js
class UsersManager extends EntityManager {
  canRead() {
    return authAdapter.getUser()?.role === 'ROLE_ADMIN'
  }
  canDelete() {
    return authAdapter.getUser()?.role === 'ROLE_ADMIN'
  }
}
```

### 5. Module System

Each module registers routes and navigation:

```js
export function init({ registry }) {
  registry.addRoutes('books', [...], { entity: 'books' })
  registry.addNavItem({
    section: 'Library',
    route: 'book',
    icon: 'pi pi-book',
    label: 'Books'
  })
}
```

## Project Structure

```
src/
├── adapters/
│   └── authAdapter.js        # Auth with localStorage (entity permissions inline in main.js)
├── modules/
│   ├── books/                # MockApiStorage - Books CRUD
│   ├── genres/               # MockApiStorage - Genres with children
│   ├── loans/                # MockApiStorage - Ownership-based
│   ├── users/                # MockApiStorage - Admin only
│   ├── favorites/            # LocalStorage - Persistent bookmarks
│   ├── settings/             # MemoryStorage - Volatile config
│   ├── jp-users/             # ApiStorage - JSONPlaceholder
│   ├── posts/                # ApiStorage - JSONPlaceholder
│   ├── todos/                # ApiStorage - JSONPlaceholder
│   ├── products/             # DummyJsonStorage - limit/skip
│   └── countries/            # RestCountriesStorage - caching
├── fixtures/                 # Initial data for MockApiStorage
├── pages/
│   ├── LoginPage.vue
│   ├── MainLayout.vue
│   └── WelcomePage.vue       # Architecture overview
└── main.js                   # Kernel bootstrap + storage setup
```

## License

MIT
