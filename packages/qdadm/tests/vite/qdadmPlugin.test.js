// @vitest-environment node
/**
 * qdadmVitePlugin (#1385) — config shape contract.
 * (node env: importing vite's runtime helpers under jsdom trips esbuild's
 * TextEncoder invariant check.)
 *
 * The plugin must exclude primevue/@primeuix/themes/@quazardous/qdadm from
 * optimizeDeps (single raw pipeline → one PrimeVue instance) and dedupe the
 * peer singletons. It must NOT emit optimizeDeps.include: qdadm has no CJS
 * transitives (pluralize vendored as ESM, #1454), and an include entry that
 * can't resolve from the consumer root breaks file:-linked installs. When
 * the package resolves through a symlink, its realpath must land in
 * server.fs.allow together with the workspace root (skybot feedback, #1389).
 *
 * Run: npm test
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, it, expect } from 'vitest'
import { qdadmVitePlugin } from '../../src/vite/qdadmPlugin'

describe('qdadmVitePlugin', () => {
  it('returns the dedupe + optimizeDeps config that fixes the dual-PrimeVue split', () => {
    const plugin = qdadmVitePlugin()
    expect(plugin.name).toBe('qdadm')

    const config = plugin.config({})
    expect(config.resolve.dedupe).toEqual(['vue', 'vue-router', 'primevue', 'pinia'])
    expect(config.optimizeDeps.exclude).toEqual([
      'primevue',
      '@primeuix/themes',
      '@quazardous/qdadm',
    ])
    // no CJS transitives left (#1454) — an include entry unresolvable from
    // the consumer root would break file:-linked installs
    expect(config.optimizeDeps.include).toBeUndefined()
  })

  it('appends extra dedupe entries after the defaults', () => {
    const config = qdadmVitePlugin({ dedupe: ['vanilla-jsoneditor'] }).config({})
    expect(config.resolve.dedupe).toEqual([
      'vue',
      'vue-router',
      'primevue',
      'pinia',
      'vanilla-jsoneditor',
    ])
  })

  it('symlinked install: no include either + fs.allow with realpath and workspace root', () => {
    // fabricate <root>/node_modules/@quazardous/qdadm -> symlink to a real dir
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'qdadm-plugin-'))
    const target = path.join(tmp, 'linked-qdadm')
    const root = path.join(tmp, 'app')
    fs.mkdirSync(target, { recursive: true })
    fs.mkdirSync(path.join(root, 'node_modules', '@quazardous'), { recursive: true })
    fs.symlinkSync(target, path.join(root, 'node_modules', '@quazardous', 'qdadm'))

    const config = qdadmVitePlugin().config({ root })
    expect(config.optimizeDeps.include).toBeUndefined()
    expect(config.server.fs.allow).toContain(fs.realpathSync(target))

    fs.rmSync(tmp, { recursive: true, force: true })
  })

  it('flavor option aliases primevue and switches dedupe/exclude to the flavor (#1393)', () => {
    const config = qdadmVitePlugin({ primevue: { package: 'openvue' } }).config({})

    expect(config.resolve.alias).toHaveLength(1)
    expect(config.resolve.alias[0].replacement).toBe('openvue$1')
    expect('primevue/button'.replace(config.resolve.alias[0].find, config.resolve.alias[0].replacement)).toBe('openvue/button')
    expect('primevue'.replace(config.resolve.alias[0].find, config.resolve.alias[0].replacement)).toBe('openvue')
    // packages merely PREFIXED with primevue must not be rewritten
    expect('primevue-extras'.replace(config.resolve.alias[0].find, config.resolve.alias[0].replacement)).toBe('primevue-extras')

    expect(config.resolve.dedupe).toContain('openvue')
    expect(config.resolve.dedupe).not.toContain('primevue')
    expect(config.optimizeDeps.exclude).toEqual(['openvue', 'primevue', '@primeuix/themes', '@quazardous/qdadm'])
  })

  it('flavor themes package aliases @primeuix/themes when provided', () => {
    const config = qdadmVitePlugin({
      primevue: { package: 'openvue', themes: '@acme/themes' },
    }).config({})

    expect(config.resolve.alias).toHaveLength(2)
    expect('@primeuix/themes/aura'.replace(config.resolve.alias[1].find, config.resolve.alias[1].replacement)).toBe('@acme/themes/aura')
    expect(config.optimizeDeps.exclude).toEqual(['openvue', 'primevue', '@acme/themes', '@primeuix/themes', '@quazardous/qdadm'])
  })

  it('no flavor → no alias, stock lists (back-compat)', () => {
    const config = qdadmVitePlugin().config({})
    expect(config.resolve.alias).toBeUndefined()
    expect(config.resolve.dedupe).toContain('primevue')
    expect(config.optimizeDeps.exclude).toEqual(['primevue', '@primeuix/themes', '@quazardous/qdadm'])
  })

  it('omits server.fs.allow when qdadm is not a symlinked install', () => {
    // In this repo's root, node_modules/@quazardous/qdadm does not exist
    // as a real dir at the scratch root used here — realpath throws or is
    // identical, so no fs.allow entry must be emitted.
    const config = qdadmVitePlugin().config({ root: '/nonexistent-root' })
    expect(config.server).toBeUndefined()
  })
})
