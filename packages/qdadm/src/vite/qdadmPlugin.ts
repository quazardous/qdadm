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
 *   pre-bundle so BOTH pipelines resolve the same raw modules.
 * - `optimizeDeps.include` pre-bundles qdadm's CJS dep `pluralize`, which
 *   cannot be served raw as ESM.
 *
 * Returned partial config is deep-merged by Vite (arrays concatenate), so
 * consumer overrides in their own `defineConfig` still apply.
 */
import type { Plugin } from 'vite'

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
    config: () => ({
      resolve: {
        dedupe: ['vue', 'vue-router', 'primevue', 'pinia', ...(options.dedupe ?? [])],
      },
      optimizeDeps: {
        exclude: ['primevue', '@primeuix/themes', '@quazardous/qdadm'],
        include: ['@quazardous/qdadm > pluralize'],
      },
    }),
  }
}
