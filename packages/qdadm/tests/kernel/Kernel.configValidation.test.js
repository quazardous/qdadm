/**
 * A configuration that does not apply must say so (#1906 lot B2).
 *
 * `sse` was the only config whose keys were checked. Every other one accepted
 * anything in silence — and the worst of them is the top level: a misspelled
 * key there does not degrade a feature, it removes a whole SECTION of
 * configuration. `securty:` means no security config at all. TypeScript
 * catches that; the consumers whose module files are plain JavaScript get
 * nothing.
 *
 * Run: npm test
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { Kernel } from '../../src/kernel/Kernel'

function ours(spy, needle) {
  return spy.mock.calls.map((c) => String(c[0])).filter((m) => m.includes(needle))
}

afterEach(() => vi.restoreAllMocks())

describe('top-level kernel options', () => {
  it('names a misspelled key and what is lost by it', () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    new Kernel({ root: {}, moduleDefs: [], securty: { role_hierarchy: {} } })

    const [message] = ours(spy, 'securty')
    expect(message).toBeDefined()
    expect(message).toContain('IGNORED')
    // Naming the consequence, not merely the fact — the #1898 lesson.
    expect(message).toContain('no role hierarchy or permissions will be applied')
    expect(message).toContain('Did you mean "security"?')
  })

  it('says nothing when every key is recognised', () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    new Kernel({ root: {}, moduleDefs: [], debug: true, security: {}, basePath: '/admin' })

    expect(ours(spy, 'is not a recognised option')).toHaveLength(0)
  })
})

describe('security config', () => {
  it('warns about an unknown key, naming what falls through', () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const kernel = new Kernel({ root: {}, moduleDefs: [] })

    kernel._validateSecurityConfig({ role_permission: { admin: ['x'] } })

    const [message] = ours(spy, 'security.role_permission')
    expect(message).toContain('no role will carry any permission')
    expect(message).toContain('Did you mean "role_permissions"?')
  })

  it('accepts the documented keys in silence', () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const kernel = new Kernel({ root: {}, moduleDefs: [] })

    kernel._validateSecurityConfig({
      role_hierarchy: {}, role_permissions: {}, role_labels: {},
      entity_permissions: true, rolesProvider: {},
    })

    expect(ours(spy, 'is not a recognised option')).toHaveLength(0)
  })
})

describe('the known-options list cannot drift from the interface', () => {
  it('matches KernelOptions exactly', () => {
    // A hand-maintained list that falls behind starts warning about options
    // that DO work — a validator nobody trusts, which is the failure this
    // whole ticket exists to avoid (ADR 0011). So the list is compared to the
    // interface itself rather than to a copy of it.
    const src = readFileSync(resolve(process.cwd(), 'src/kernel/Kernel.types.ts'), 'utf8')
    const start = src.indexOf('{', src.indexOf('export interface KernelOptions'))
    let depth = 0
    let end = start
    while (true) {
      if (src[end] === '{') depth++
      else if (src[end] === '}') depth--
      if (depth === 0) break
      end++
    }
    const body = src
      .slice(start, end)
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/.*/g, '')
    const declared = new Set([...body.matchAll(/^ {2}([a-zA-Z_][a-zA-Z0-9_]*)\??\s*:/gm)].map((m) => m[1]))

    // Drive the validator: anything the interface declares must not warn.
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const options = { root: {}, moduleDefs: [] }
    for (const key of declared) if (!(key in options)) options[key] = undefined
    new Kernel(options)

    const complained = ours(spy, 'is not a recognised option')
    expect(complained).toEqual([])
    expect(declared.size).toBeGreaterThan(30)
  })
})
