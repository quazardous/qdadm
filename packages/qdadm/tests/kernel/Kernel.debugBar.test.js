/**
 * `debugBar: { enabled: false }` must actually disable (#1900 lot D).
 *
 * A consumer wrote it to switch the bar off and found it running in
 * PRODUCTION. Two defects composed: the component was registered whatever
 * `enabled` said, and providing `debugBar` forced `options.debug = true`,
 * which DebugModule.enabled() reads as "turn on". Their only way out was to
 * omit the key entirely — they wrote it in capitals in their own code so
 * nobody would try again.
 *
 * Run: npm test
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { Kernel } from '../../src/kernel/Kernel'
import { getQdadmDebugBarRef } from '../../src/kernel/Kernel.vue'

class FakeDebugModule {
  static name = 'debug'
  constructor(options) {
    this.options = options
  }
  async connect() {}
}

const FakeBar = { name: 'FakeDebugBar', render: () => null }

function makeKernel(debugBar) {
  return new Kernel({
    root: {},
    moduleDefs: [],
    ...(debugBar === undefined ? {} : { debugBar }),
  })
}

function setSearch(search) {
  Object.defineProperty(window, 'location', {
    value: { search },
    writable: true,
    configurable: true,
  })
}

describe('Kernel — debugBar enabled flag', () => {
  beforeEach(() => {
    getQdadmDebugBarRef().value = null
    localStorage.clear()
    setSearch('')
  })
  afterEach(() => {
    localStorage.clear()
    setSearch('')
  })

  it('registers the bar when enabled is not given', () => {
    makeKernel({ module: FakeDebugModule, component: FakeBar })

    expect(getQdadmDebugBarRef().value).toEqual(FakeBar)
  })

  it('registers the bar on enabled: true', () => {
    makeKernel({ module: FakeDebugModule, component: FakeBar, enabled: true })

    expect(getQdadmDebugBarRef().value).toEqual(FakeBar)
  })

  it('registers NOTHING on enabled: false', () => {
    // The defect: this used to register the component anyway, so the bar
    // rendered in production for a consumer who had explicitly disabled it.
    makeKernel({ module: FakeDebugModule, component: FakeBar, enabled: false })

    expect(getQdadmDebugBarRef().value).toBeNull()
  })

  it('does not force debug mode on when the bar is disabled', () => {
    // The second half: providing debugBar forced options.debug = true, and
    // DebugModule.enabled() returns isDev || debug — so the module switched
    // itself back on regardless of the flag.
    const kernel = makeKernel({ module: FakeDebugModule, component: FakeBar, enabled: false })

    expect(kernel.options.debug).toBeFalsy()
  })

  it('still turns debug mode on when the bar is enabled', () => {
    const kernel = makeKernel({ module: FakeDebugModule, component: FakeBar })

    expect(kernel.options.debug).toBe(true)
  })

  it('?qddebug=off beats even an explicit enabled: true', () => {
    // The emergency switch exists for the case where the bar is taking the
    // app down. It must not be arguable with (#1900 lot C.3).
    setSearch('?qddebug=off')

    const kernel = makeKernel({ module: FakeDebugModule, component: FakeBar, enabled: true })

    expect(getQdadmDebugBarRef().value).toBeNull()
    expect(kernel.options.debug).toBeFalsy()
  })

  it('a remembered kill still holds once the parameter is gone', () => {
    setSearch('?qddebug=off')
    makeKernel({ module: FakeDebugModule, component: FakeBar })
    getQdadmDebugBarRef().value = null

    setSearch('')
    makeKernel({ module: FakeDebugModule, component: FakeBar })

    expect(getQdadmDebugBarRef().value).toBeNull()
  })

  it('?qddebug=on gives the bar back', () => {
    setSearch('?qddebug=off')
    makeKernel({ module: FakeDebugModule, component: FakeBar })
    getQdadmDebugBarRef().value = null

    setSearch('?qddebug=on')
    makeKernel({ module: FakeDebugModule, component: FakeBar })

    expect(getQdadmDebugBarRef().value).toEqual(FakeBar)
  })

  it('leaves an explicit debug: true alone when the bar is disabled', () => {
    const kernel = new Kernel({
      root: {},
      moduleDefs: [],
      debug: true,
      debugBar: { module: FakeDebugModule, component: FakeBar, enabled: false },
    })

    // Disabling the bar must not disable debug mode someone asked for.
    expect(kernel.options.debug).toBe(true)
  })
})
