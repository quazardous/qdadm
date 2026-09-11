/**
 * The missing-qdadmVitePlugin hint (#2259): logged once, in dev, only when the plugin's define is absent; and
 * PrimeVue's toast error names the plugin.
 *
 * Run: npm test
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  explainMissingToast,
  hasQdadmVitePlugin,
  resetVitePluginWarning,
  warnWithoutQdadmVitePlugin,
} from '../../src/kernel/vitePluginCheck'

afterEach(() => resetVitePluginWarning())

describe('missing qdadmVitePlugin (#2259)', () => {
  it('sees the define the plugin sets — this suite runs with it, like an app', () => {
    expect(hasQdadmVitePlugin()).toBe(true)
  })

  it('without the plugin, in dev: one error that says what to add, once', () => {
    const log = vi.fn()
    expect(warnWithoutQdadmVitePlugin({ present: false, dev: true, log })).toBe(true)
    expect(warnWithoutQdadmVitePlugin({ present: false, dev: true, log })).toBe(false)
    expect(log).toHaveBeenCalledTimes(1)
    expect(log.mock.calls[0][0]).toMatch(/^\[qdadm\] qdadmVitePlugin\(\) is missing from vite\.config/)
    expect(log.mock.calls[0][0]).toContain('plugins: [vue(), qdadmVitePlugin()]')
  })

  it('silent with the plugin, and in a production build', () => {
    const log = vi.fn()
    expect(warnWithoutQdadmVitePlugin({ present: true, dev: true, log })).toBe(false)
    expect(warnWithoutQdadmVitePlugin({ present: false, dev: false, log })).toBe(false)
    expect(log).not.toHaveBeenCalled()
  })

  it("PrimeVue's missing-toast error names the plugin; any other error passes through untouched", () => {
    expect(() =>
      explainMissingToast(() => {
        throw new Error('No PrimeVue Toast provided!')
      })
    ).toThrow(/^No PrimeVue Toast provided! The usual cause: qdadmVitePlugin\(\) is missing/)

    const other = new Error('something else')
    expect(() =>
      explainMissingToast(() => {
        throw other
      })
    ).toThrow(other)
    expect(explainMissingToast(() => 'toast')).toBe('toast')
  })
})
