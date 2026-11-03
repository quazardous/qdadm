/**
 * In debug mode (which the debug bar turns on) a hook or a signal whose
 * payload holds a cycle still reaches its handlers (#4685). The event
 * kernel's own tracing used to JSON-stringify every payload: a manager that
 * kept its I18n made every save fail in dev.
 *
 * Run: npm test
 */
import { describe, it, expect, vi } from 'vitest'
import { Kernel } from '../../src/kernel/Kernel'

describe('debug mode and payloads with a cycle (#4685)', () => {
  it('a hook and a signal with a circular payload reach their handlers', async () => {
    const debugLog = vi.spyOn(console, 'debug').mockImplementation(() => {})
    const kernel = new Kernel({ root: {}, moduleDefs: [], debug: true })
    const manager = { name: 'suppliers' }
    manager.self = manager

    const hook = vi.fn()
    kernel.hookRegistry.register('entity:presave', hook)
    await kernel.hookRegistry.invoke('entity:presave', { manager, record: { id: 1 } }, { throwOnError: true })
    expect(hook).toHaveBeenCalledTimes(1)

    const signal = vi.fn()
    kernel.signals.on('entity:created', signal)
    await kernel.signals.emit('entity:created', { manager })
    expect(signal).toHaveBeenCalledTimes(1)
    debugLog.mockRestore()
  })
})
