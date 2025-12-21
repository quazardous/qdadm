# qdadm

Vue 3 framework for building admin dashboards with PrimeVue.

## Packages

| Package | Description |
|---------|-------------|
| [qdadm](packages/qdadm) | Core framework library |
| [demo](packages/demo) | Demo application |

## Quick Start

```bash
# Install dependencies
npm install

# Run demo
npm run dev
```

## Features

- **Kernel**: All-in-one bootstrap (Vue app, router, Pinia, PrimeVue, auth guard)
- **EntityManager**: CRUD operations with permission control (`canRead`/`canWrite`)
- **Module System**: Auto-discovery of modules with routes and navigation
- **Components**: Forms, lists, dialogs, editors ready to use
- **Composables**: `useForm`, `useListPageBuilder`, `useBareForm`, etc.

## Documentation

See [packages/qdadm/README.md](packages/qdadm/README.md) for full documentation.

## License

MIT
