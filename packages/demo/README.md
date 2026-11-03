# qdadm-demo

[![Live Demo](https://img.shields.io/badge/demo-live-brightgreen)](https://quazardous.github.io/qdadm/)

The app built on [qdadm](../../README.md) in this repository: what each feature
looks like, and how a feature is meant to be built. Copy its modules, they are
kept to the [credo](../../docs/QDADM_CREDO.md).

## Run it

```bash
npm install          # at the repository root
npm run dev -w packages/demo
```

Accounts (password = username): `admin` (ROLE_ADMIN), `bob` and `june`
(ROLE_USER). `localStorage.clear()` resets the data.

## How it is put together

- `src/main.js`: the `Kernel` bootstrap. Who may do what is there too, as
  grants in `security.rolesProvider` (ROLE_USER reads and lists, ROLE_ADMIN
  also writes and deletes).
- `src/config/modules.js`: the modules, in order. `src/config/storages.js`:
  the shared storage settings.
- `src/modules/<name>/<Name>Module.js`: one module per feature. In
  `connect(ctx)` it declares its messages (`ctx.messages`), its entities
  (`ctx.entity`), its pages (`ctx.crud`, `ctx.routes`) and its menu entries.
- `src/modules/<name>/pages/`: pages built with the builders
  (`useListPage`, `useEntityItemFormPage`, `useEntityItemShowPage`); no page
  calls a storage or an API.
- `src/modules/_template/`: a module to copy for a new entity.
- `src/fixtures/`: the initial data.

## What to look at

| Module | Shows |
|---|---|
| `books` | The reference CRUD: list with search and filters, show page, form, a child list (loans) in a tab, severity tags |
| `loans` | A child entity (`parents`), owner rights (`isOwn`) |
| `users` | Admin-only pages |
| `favorites`, `settings` | `LocalStorage`, `MemoryStorage` |
| `jsonplaceholder`, `products`, `countries` | Remote APIs: `ApiStorage`, limit/skip pagination, client-side pagination with a cache |
| `ops` | Long tasks (TaskRunner, phases), waiting states, logs, payloads, emails, YAML config, dashboards, sessions |
| `notifications` | The notification panel |

The storages: `MockApiStorage` (fixtures in localStorage), `LocalStorage`,
`MemoryStorage`, `ApiStorage` and two subclasses for APIs with their own
pagination. See the [storage docs](../../docs/crud.md).

## License

MIT
