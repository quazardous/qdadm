// @vitest-environment node
/**
 * qdadmVitePlugin (#1385) — config shape contract.
 * (node env: importing vite's runtime helpers under jsdom trips esbuild's
 * TextEncoder invariant check.)
 *
 * The plugin must exclude primevue/@primeuix/themes/@quazardous/qdadm from
 * optimizeDeps (single raw pipeline → one PrimeVue instance), pre-bundle
 * qdadm's CJS transitives in BOTH nested (npm install) and plain (symlinked
 * install) forms, and dedupe the peer singletons. When the package resolves
 * through a symlink, its realpath must land in server.fs.allow together
 * with the workspace root (skybot feedback, #1389).
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
    // non-symlinked root → nested form only (plain form would warn)
    expect(config.optimizeDeps.include).toEqual(['@quazardous/qdadm > pluralize'])
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

  it('symlinked install: plain CJS include + fs.allow with realpath and workspace root', () => {
    // fabricate <root>/node_modules/@quazardous/qdadm -> symlink to a real dir
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'qdadm-plugin-'))
    const target = path.join(tmp, 'linked-qdadm')
    const root = path.join(tmp, 'app')
    fs.mkdirSync(target, { recursive: true })
    fs.mkdirSync(path.join(root, 'node_modules', '@quazardous'), { recursive: true })
    fs.symlinkSync(target, path.join(root, 'node_modules', '@quazardous', 'qdadm'))

    const config = qdadmVitePlugin().config({ root })
    expect(config.optimizeDeps.include).toEqual(['pluralize'])
    expect(config.server.fs.allow).toContain(fs.realpathSync(target))

    fs.rmSync(tmp, { recursive: true, force: true })
  })

  it('omits server.fs.allow when qdadm is not a symlinked install', () => {
    // In this repo's root, node_modules/@quazardous/qdadm does not exist
    // as a real dir at the scratch root used here — realpath throws or is
    // identical, so no fs.allow entry must be emitted.
    const config = qdadmVitePlugin().config({ root: '/nonexistent-root' })
    expect(config.server).toBeUndefined()
  })
})
