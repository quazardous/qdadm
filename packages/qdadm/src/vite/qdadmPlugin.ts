/**
 * qdadm Vite consumer plugin (#1385)
 *
 * qdadm publishes raw TS/.vue sources. Without help, Vite pre-bundles the
 * host app's `primevue` import into `.vite/deps` while qdadm's raw sources
 * import `node_modules/primevue/...` directly — two module instances whose
 * injection symbols don't match, and the app dies at boot with
 * `Error: No PrimeVue Toast provided!`.
 *
 * This plugin applies the required config in one line:
 *
 * ```ts
 * // vite.config.ts
 * import { qdadmVitePlugin } from '@quazardous/qdadm/vite'
 *
 * export default defineConfig({
 *   plugins: [vue(), qdadmVitePlugin()],
 * })
 * ```
 *
 * - `resolve.dedupe` collapses duplicate peer copies (also covers the
 *   `file:`/workspace-link scenario described in the package README).
 * - `optimizeDeps.exclude` keeps primevue/@primeuix/themes/qdadm out of the
 *   pre-bundle so BOTH pipelines resolve the same raw modules. Excluding
 *   qdadm also keeps HMR sane when the package is consumed via a symlink.
 * - qdadm has NO CJS transitives (pluralize is vendored as ESM, #1454), so
 *   there is nothing to `optimizeDeps.include` — which also means nothing
 *   for the optimizer to fail resolving in file:-linked installs where
 *   npm (install-links=false) never materializes qdadm's deps at the
 *   consumer root.
 * - When `node_modules/@quazardous/qdadm` is a symlink (file:/workspace
 *   link — qdadm's own dev mode against a testbed app), its realpath is
 *   appended to `server.fs.allow` so qdadm's `?raw` dynamic imports (i18n
 *   YAML defaults) are servable from outside the consumer's workspace
 *   root. The workspace root is re-added explicitly because a populated
 *   `fs.allow` disables Vite's implicit default.
 *
 * Returned partial config is deep-merged by Vite (arrays concatenate), so
 * consumer overrides in their own `defineConfig` still apply.
 */
import fs from 'node:fs'
import path from 'node:path'
import { searchForWorkspaceRoot, type Plugin, type UserConfig } from 'vite'

export interface QdadmVitePluginOptions {
  /**
   * Extra packages to dedupe on top of the defaults
   * (vue, vue-router, primevue, pinia).
   */
  dedupe?: string[]
  /**
   * PrimeVue "flavor" (#1393): alias every `primevue/*` import to a
   * compatible fork (e.g. OpenVue). qdadm officially maintains and tests
   * `primevue@4` (MIT) only — a flavor keeping the v4 module layout/API is
   * drop-in; divergences are the consumer's to absorb.
   *
   * ```ts
   * qdadmVitePlugin({ primevue: { package: 'openvue' } })
   * ```
   */
  primevue?: {
    /** Package that replaces `primevue` (e.g. 'openvue'). */
    package: string
    /**
     * Optional package replacing `@primeuix/themes` — only needed if the
     * flavor ships its own themes fork (none does today; OpenVue keeps the
     * MIT @primeuix/* versions).
     */
    themes?: string
  }
}

export function qdadmVitePlugin(options: QdadmVitePluginOptions = {}): Plugin {
  return {
    name: 'qdadm',
    config: (userConfig: UserConfig = {}) => {
      const root = path.resolve(userConfig.root ?? process.cwd())

      // Symlinked install (file:/workspace link)? Allow serving from the
      // link target, which typically lives outside the consumer's root.
      const fsAllow: string[] = []
      try {
        const pkgDir = path.join(root, 'node_modules', '@quazardous', 'qdadm')
        const real = fs.realpathSync(pkgDir)
        if (real !== pkgDir) {
          fsAllow.push(searchForWorkspaceRoot(root), real)
        }
      } catch {
        // not installed under root node_modules (aliased/hoisted) — nothing to allow
      }

      // Flavor aliasing (#1393): after the alias, no `primevue`/themes ids
      // remain in the graph — dedupe/exclude lists must name the flavor.
      const flavor = options.primevue ?? null
      const widgetPkg = flavor?.package ?? 'primevue'
      const themesPkg = flavor?.themes ?? '@primeuix/themes'
      const alias = []
      if (flavor) {
        alias.push({ find: /^primevue(\/|$)/, replacement: `${flavor.package}$1` })
        if (flavor.themes) {
          alias.push({ find: /^@primeuix\/themes(\/|$)/, replacement: `${flavor.themes}$1` })
        }
      }

      // With a flavor, the original packages may still be installed — keep
      // them excluded too, or the optimizer pre-bundles a stray
      // `primevue/*` id that bypassed the alias (split-instance again).
      const widgetExcludes = flavor ? [widgetPkg, 'primevue'] : [widgetPkg]
      const themesExcludes =
        flavor?.themes ? [themesPkg, '@primeuix/themes'] : [themesPkg]

      return {
        resolve: {
          ...(alias.length > 0 ? { alias } : {}),
          dedupe: ['vue', 'vue-router', widgetPkg, 'pinia', ...(options.dedupe ?? [])],
        },
        optimizeDeps: {
          exclude: [...widgetExcludes, ...themesExcludes, '@quazardous/qdadm'],
        },
        ...(fsAllow.length > 0 ? { server: { fs: { allow: fsAllow } } } : {}),
      }
    },
  }
}
