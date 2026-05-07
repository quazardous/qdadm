# Changelog

## 1.19.3

### Patch Changes

- Three fixes reported by a downstream consumer running `vue-tsc --noEmit` against `qdadm@1.19.2`:
  - **Codegen now parameterizes the storage class with the entity type.** Generated managers were emitting `new ApiStorage(opts)` which defaults to `IStorage<EntityRecord>`; `EntityManager<XxxEntity>` expects `IStorage<XxxEntity>`, so every generated `*.ts` file failed type-check with TS2322. The codegen now emits `new ApiStorage<XxxEntity>(opts)` in both instance and class modes. Class mode also stops typing the constructor's `storage` override as `unknown` and uses `IStorage<XxxEntity>` instead.
  - **`vite-env.d.ts` declares `*.scss`, `*.css`, `*.sass` directly.** Previously these were only reachable through the `/// <reference types="vite/client" />` triple-slash, which silently failed for consumers whose `tsconfig.compilerOptions.types` didn't include `vite/client` or who didn't have `vite` installed. The internal `import('./styles.scss')` calls in `Module.ts`, `DebugModule.ts`, and `NotificationModule.ts` now type-check from any consumer context.
  - **`vite` declared as an optional peer dependency** with the wide range `^5.0.0 || ^6.0.0 || ^7.0.0 || ^8.0.0`, mirroring `@vitejs/plugin-vue@6.x`. Bumped the dev dep `@vitejs/plugin-vue` to `^6.0.0`. Consumers on Vite 7+ will see `qdadm/gen/vite-plugin` and `qdadm/vite-plugin-debug` resolve `Plugin` against their own Vite without the cross-version `Plugin<any>` mismatch that was hitting their `vue-tsc --noEmit`.

> **Note**: From 1.19.3 onwards, this per-package changelog is the source of truth, written automatically by [Changesets](https://github.com/changesets/changesets) on each release. For history up to 1.19.2 (and for cross-package release notes that pre-date Changesets adoption), see the repository root [../../CHANGELOG.md](../../CHANGELOG.md).
