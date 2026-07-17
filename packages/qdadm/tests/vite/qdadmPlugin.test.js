/**
 * qdadmVitePlugin (#1385) — config shape contract.
 *
 * The plugin must exclude primevue/@primeuix/themes/@quazardous/qdadm from
 * optimizeDeps (single raw pipeline → one PrimeVue instance), pre-bundle the
 * CJS dep pluralize, and dedupe the peer singletons.
 *
 * Run: npm test
 */
import { describe, it, expect } from 'vitest'
import { qdadmVitePlugin } from '../../src/vite/qdadmPlugin'

describe('qdadmVitePlugin', () => {
  it('returns the dedupe + optimizeDeps config that fixes the dual-PrimeVue split', () => {
    const plugin = qdadmVitePlugin()
    expect(plugin.name).toBe('qdadm')

    const config = plugin.config()
    expect(config.resolve.dedupe).toEqual(['vue', 'vue-router', 'primevue', 'pinia'])
    expect(config.optimizeDeps.exclude).toEqual([
      'primevue',
      '@primeuix/themes',
      '@quazardous/qdadm',
    ])
    expect(config.optimizeDeps.include).toEqual(['@quazardous/qdadm > pluralize'])
  })

  it('appends extra dedupe entries after the defaults', () => {
    const config = qdadmVitePlugin({ dedupe: ['vanilla-jsoneditor'] }).config()
    expect(config.resolve.dedupe).toEqual([
      'vue',
      'vue-router',
      'primevue',
      'pinia',
      'vanilla-jsoneditor',
    ])
  })
})
