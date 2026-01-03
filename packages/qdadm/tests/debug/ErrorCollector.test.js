/**
 * Tests for ErrorCollector
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ErrorCollector } from '../../src/debug/ErrorCollector.js'

describe('ErrorCollector', () => {
  let collector
  let originalAddEventListener
  let originalRemoveEventListener
  let eventListeners

  beforeEach(() => {
    eventListeners = {}
    originalAddEventListener = window.addEventListener
    originalRemoveEventListener = window.removeEventListener

    window.addEventListener = vi.fn((type, handler) => {
      eventListeners[type] = eventListeners[type] || []
      eventListeners[type].push(handler)
    })

    window.removeEventListener = vi.fn((type, handler) => {
      if (eventListeners[type]) {
        const index = eventListeners[type].indexOf(handler)
        if (index > -1) {
          eventListeners[type].splice(index, 1)
        }
      }
    })

    collector = new ErrorCollector()
  })

  afterEach(() => {
    window.addEventListener = originalAddEventListener
    window.removeEventListener = originalRemoveEventListener
  })

  it('has static name "errors"', () => {
    expect(ErrorCollector.name).toBe('errors')
  })

  it('installs error and unhandledrejection listeners', () => {
    collector.install({})

    expect(window.addEventListener).toHaveBeenCalledTimes(2)
    expect(window.addEventListener).toHaveBeenCalledWith('error', expect.any(Function))
    expect(window.addEventListener).toHaveBeenCalledWith('unhandledrejection', expect.any(Function))
  })

  it('uninstalls error and unhandledrejection listeners', () => {
    collector.install({})
    collector.uninstall()

    expect(window.removeEventListener).toHaveBeenCalledTimes(2)
    expect(window.removeEventListener).toHaveBeenCalledWith('error', expect.any(Function))
    expect(window.removeEventListener).toHaveBeenCalledWith('unhandledrejection', expect.any(Function))
  })

  it('records error events with message, filename, lineno, colno', () => {
    collector.install({})

    const errorEvent = {
      message: 'Test error message',
      filename: 'test.js',
      lineno: 42,
      colno: 10,
      error: null
    }

    eventListeners['error'][0](errorEvent)

    const entries = collector.getEntries()
    expect(entries).toHaveLength(1)
    expect(entries[0].message).toBe('Test error message')
    expect(entries[0].filename).toBe('test.js')
    expect(entries[0].lineno).toBe(42)
    expect(entries[0].colno).toBe(10)
    expect(entries[0].timestamp).toBeDefined()
  })

  it('records unhandled promise rejections', () => {
    collector.install({})

    const rejectionEvent = {
      reason: new Error('Promise rejected')
    }

    eventListeners['unhandledrejection'][0](rejectionEvent)

    const entries = collector.getEntries()
    expect(entries).toHaveLength(1)
    expect(entries[0].message).toBe('Unhandled Promise Rejection')
    expect(entries[0].reason).toBe('Error: Promise rejected')
    expect(entries[0].timestamp).toBeDefined()
  })

  it('respects maxEntries option from Collector', () => {
    collector = new ErrorCollector({ maxEntries: 3 })
    collector.install({})

    for (let i = 0; i < 5; i++) {
      eventListeners['error'][0]({
        message: `Error ${i}`,
        filename: 'test.js',
        lineno: i,
        colno: 0,
        error: null
      })
    }

    const entries = collector.getEntries()
    expect(entries).toHaveLength(3)
    expect(entries[0].message).toBe('Error 2')
    expect(entries[2].message).toBe('Error 4')
  })

  it('can clear entries', () => {
    collector.install({})

    eventListeners['error'][0]({
      message: 'Test error',
      filename: 'test.js',
      lineno: 1,
      colno: 1,
      error: null
    })

    expect(collector.getEntries()).toHaveLength(1)
    collector.clear()
    expect(collector.getEntries()).toHaveLength(0)
  })

  it('getBadge returns entry count', () => {
    collector.install({})

    expect(collector.getBadge()).toBe(0)

    eventListeners['error'][0]({
      message: 'Error 1',
      filename: 'test.js',
      lineno: 1,
      colno: 1,
      error: null
    })

    expect(collector.getBadge()).toBe(1)
  })
})
