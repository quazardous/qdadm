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
 * - `optimizeDeps.include` pre-bundles qdadm's CJS transitives (currently
 *   `pluralize`), which cannot be served raw as ESM. The list lives HERE —
 *   consumers should not have to track qdadm's internal CJS deps (skybot
 *   feedback on #1389). Both the nested (`@quazardous/qdadm > pluralize`,
 *   npm installs) and plain (`pluralize`, symlinked installs where the
 *   nested path can't resolve) forms are declared; the unused one is a
 *   no-op warning at worst.
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

/** qdadm's CJS transitive deps that must be pre-bundled (internal knowledge). */
const CJS_TRANSITIVES = ['pluralize']

export interface QdadmVitePluginOptions {
  /**
   * Extra packages to dedupe on top of the defaults
   * (vue, vue-router, primevue, pinia).
   */
  dedupe?: string[]
}

export function qdadmVitePlugin(options: QdadmVitePluginOptions = {}): Plugin {
  return {
    name: 'qdadm',
    config: (userConfig: UserConfig = {}) => {
      const root = path.resolve(userConfig.root ?? process.cwd())

      // Symlinked install (file:/workspace link)? Allow serving from the
      // link target, which typically lives outside the consumer's root.
      const fsAllow: string[] = []
      let symlinked = false
      try {
        const pkgDir = path.join(root, 'node_modules', '@quazardous', 'qdadm')
        const real = fs.realpathSync(pkgDir)
        if (real !== pkgDir) {
          symlinked = true
          fsAllow.push(searchForWorkspaceRoot(root), real)
        }
      } catch {
        // not installed under root node_modules (aliased/hoisted) — nothing to allow
      }

      return {
        resolve: {
          dedupe: ['vue', 'vue-router', 'primevue', 'pinia', ...(options.dedupe ?? [])],
        },
        optimizeDeps: {
          exclude: ['primevue', '@primeuix/themes', '@quazardous/qdadm'],
          // One form per install mode: the nested path resolves through a
          // real node_modules chain (npm installs), the plain form through a
          // symlink realpath — declaring the unused one logs a "Failed to
          // resolve dependency" warning (skybot testbed, #1389).
          include: symlinked
            ? [...CJS_TRANSITIVES]
            : CJS_TRANSITIVES.map((dep) => `@quazardous/qdadm > ${dep}`),
        },
        ...(fsAllow.length > 0 ? { server: { fs: { allow: fsAllow } } } : {}),
      }
    },
  }
}
