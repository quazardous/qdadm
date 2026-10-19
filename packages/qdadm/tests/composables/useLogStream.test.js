/**
 * The line buffer behind LogStream (#4110): four sources, one buffer.
 *
 * Run: npm test
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { effectScope } from 'vue'
import { useLogStream } from '../../src/composables/useLogStream'

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

/** A poll endpoint over a fixed log, two lines per call. */
function endpoint(all, per = 2) {
  return vi.fn(async (from) => {
    const lines = all.slice(from, from + per)
    return { lines, next: from + lines.length, done: from + lines.length >= all.length }
  })
}

describe('useLogStream (#4110)', () => {
  it('polls from the offset it was given back, until done', async () => {
    vi.useFakeTimers()
    const poll = endpoint(['a', 'b', 'c', 'd', 'e'])
    const log = useLogStream({ poll, intervalMs: 100 })

    await vi.advanceTimersByTimeAsync(0)
    expect(log.lines.value.map((l) => l.text)).toEqual(['a', 'b'])
    expect(log.status.value).toBe('streaming')

    await vi.advanceTimersByTimeAsync(250)
    expect(poll.mock.calls.map((c) => c[0])).toEqual([0, 2, 4])
    expect(log.lines.value.map((l) => l.n)).toEqual([1, 2, 3, 4, 5])
    expect(log.status.value).toBe('done')

    await vi.advanceTimersByTimeAsync(1000)
    expect(poll).toHaveBeenCalledTimes(3)
  })

  it('backs off on error and recovers', async () => {
    vi.useFakeTimers()
    let fail = true
    const poll = vi.fn(async () => {
      if (fail) throw new Error('502')
      return { lines: ['ok'], done: true }
    })
    const log = useLogStream({ poll, intervalMs: 100 })
    await vi.advanceTimersByTimeAsync(0)
    expect(log.status.value).toBe('error')
    expect(log.error.value).toBe('502')

    await vi.advanceTimersByTimeAsync(150)
    expect(poll).toHaveBeenCalledTimes(1) // waited 200, not 100
    fail = false
    await vi.advanceTimersByTimeAsync(100)
    expect(log.status.value).toBe('done')
    expect(log.error.value).toBeNull()
  })

  it('stops polling when its scope is disposed', async () => {
    vi.useFakeTimers()
    const poll = vi.fn(async () => ({ lines: ['x'] }))
    const scope = effectScope()
    scope.run(() => useLogStream({ poll, intervalMs: 100 }))
    await vi.advanceTimersByTimeAsync(0)
    scope.stop()
    await vi.advanceTimersByTimeAsync(1000)
    expect(poll).toHaveBeenCalledTimes(1)
  })

  it('reads server-sent events: text lines, JSON batches, and the end event', () => {
    const sources = []
    class FakeEventSource {
      constructor(url) {
        this.url = url
        this.readyState = 1
        this.listeners = {}
        this.close = vi.fn(() => (this.readyState = 2))
        sources.push(this)
      }
      addEventListener(name, fn) {
        ;(this.listeners[name] ??= []).push(fn)
      }
      emit(name, data) {
        for (const fn of this.listeners[name] ?? []) fn({ data })
      }
    }
    vi.stubGlobal('EventSource', FakeEventSource)

    const log = useLogStream({ sse: '/tasks/1/log' })
    const es = sources[0]
    expect(es.url).toBe('/tasks/1/log')
    es.emit('message', 'one\ntwo')
    es.emit('message', JSON.stringify({ lines: ['three'] }))
    es.emit('message', '{not json')
    es.emit('end', '')

    expect(log.lines.value.map((l) => l.text)).toEqual(['one', 'two', 'three', '{not json'])
    expect(log.status.value).toBe('done')
    expect(es.close).toHaveBeenCalled()
  })

  it('takes pushed lines, and ignores them once stopped', () => {
    let api
    const unsubscribe = vi.fn()
    const log = useLogStream({ subscribe: (a) => ((api = a), unsubscribe) })
    api.push(['a', 'b'])
    log.stop()
    api.push('c')
    expect(log.lines.value.map((l) => l.text)).toEqual(['a', 'b'])
    expect(unsubscribe).toHaveBeenCalled()
  })

  it('flags error lines on the text, not the escapes', () => {
    const log = useLogStream(
      { lines: ['\x1b[31mERROR\x1b[0m boom', 'fine', 'Error: again'] },
      { errorPattern: /error/gi }
    )
    expect(log.lines.value.map((l) => l.error)).toEqual([true, false, true])
    expect(log.lines.value[0].text).toBe('ERROR boom')
    expect(log.status.value).toBe('done')
  })

  it('drops the oldest lines past maxLines and keeps their numbers', () => {
    const log = useLogStream({ lines: ['1', '2', '3', '4'] }, { maxLines: 2 })
    expect(log.lines.value.map((l) => l.n)).toEqual([3, 4])
    expect(log.dropped.value).toBe(2)
  })

  it('restarts from the start of the source', async () => {
    vi.useFakeTimers()
    const poll = endpoint(['a', 'b'])
    const log = useLogStream({ poll, intervalMs: 100 })
    await vi.advanceTimersByTimeAsync(0)
    expect(log.status.value).toBe('done')
    log.restart()
    await vi.advanceTimersByTimeAsync(0)
    expect(poll.mock.calls.map((c) => c[0])).toEqual([0, 0])
    expect(log.lines.value.map((l) => l.n)).toEqual([1, 2])
  })
})
