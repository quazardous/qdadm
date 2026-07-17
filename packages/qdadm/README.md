# qdadm

**Vue 3 admin framework. PrimeVue. Zero boilerplate.**

## Installation

```bash
npm install @quazardous/qdadm primevue @primeuix/themes primeicons vue-router pinia
```

```ts
// vite.config.ts — the plugin wires the resolver/optimizer settings
// qdadm's raw-source packaging needs (npm and file:/workspace installs)
import { qdadmVitePlugin } from '@quazardous/qdadm/vite'

export default defineConfig({
  plugins: [vue(), qdadmVitePlugin()],
})
```

## Documentation

Start with the **[step-by-step tutorial](https://github.com/quazardous/qdadm/blob/main/docs/tutorial-mini-admin.md)** — bootstrap, CRUD, auth, navigation, parent-child in ~310 lines.

- [Full documentation](https://github.com/quazardous/qdadm/tree/main/docs)
- [Concepts & patterns (CREDO)](https://github.com/quazardous/qdadm/blob/main/docs/QDADM_CREDO.md)
- [Changelog](https://github.com/quazardous/qdadm/blob/main/CHANGELOG.md)

## Peer Dependencies

vue ^3.3 · vue-router ^4 || ^5 · primevue ^4 · pinia ^2 || ^3 || ^4

## License

MIT
