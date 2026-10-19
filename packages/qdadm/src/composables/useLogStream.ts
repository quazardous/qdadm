/**
 * useLogStream - the line buffer behind LogStream (#4110)
 *
 * Reads a backend log as it is written, from one of four sources the app
 * picks, and keeps the lines parsed once (ANSI styles, error flag) so the
 * view only slices them.
 *
 * ```ts
 * // Offsets: GET /tasks/42/log?from=<n> → { lines, next, done }
 * useLogStream({ poll: (from) => api.get(`/tasks/42/log`, { params: { from } }).then((r) => r.data) })
 *
 * // Server-sent events, one line (or several, newline-separated) per message
 * useLogStream({ sse: '/tasks/42/log/stream', endEvent: 'end' })
 *
 * // Anything that pushes: an SSEBridge event, a WebSocket…
 * useLogStream({ subscribe: ({ push, end }) => bridge.onEvent('task:log', (p) => push(p.data.lines)) })
 *
 * // A finished log
 * useLogStream({ lines: text.split('\n') })
 * ```
 */

import { shallowRef, ref, onScopeDispose, getCurrentScope, type Ref, type ShallowRef } from 'vue'
import { parseAnsiLine, stripAnsi, type AnsiSegment, type AnsiStyle } from '../utils/ansi'

export interface LogPollResult {
  lines: string[]
  /** Offset to ask for next. Defaults to the previous one plus the lines received. */
  next?: number
  /** True once the log is complete: polling stops. */
  done?: boolean
}

export interface LogPushApi {
  push: (lines: string | string[]) => void
  end: () => void
  fail: (error: unknown) => void
}

export type LogSource =
  | { poll: (from: number) => Promise<LogPollResult>; intervalMs?: number; from?: number }
  | {
      sse: string | (() => EventSource)
      /** Event carrying lines. Default `message`. */
      event?: string
      /** Event that closes the log. Default `end`. */
      endEvent?: string
      /** Turn a message's data into lines. Default: JSON `{ lines, done }` or plain text split on newlines. */
      parse?: (data: string) => string[] | LogPollResult
    }
  | { subscribe: (api: LogPushApi) => (() => void) | void }
  | { lines: string[] }

export interface LogLine {
  /** 1-based number in the whole log, kept when old lines are dropped. */
  n: number
  raw: string
  /** The line without ANSI escapes: what search, errors and download read. */
  text: string
  segments: AnsiSegment[]
  error: boolean
}

export type LogStreamStatus = 'idle' | 'streaming' | 'done' | 'error'

export interface UseLogStreamOptions {
  /** Lines matching it are flagged as errors. */
  errorPattern?: RegExp | string | null
  /** Oldest lines are dropped past this count. Default 100 000. */
  maxLines?: number
  /** Start reading at once. Default true. */
  immediate?: boolean
}

export interface UseLogStreamReturn {
  lines: ShallowRef<LogLine[]>
  status: Ref<LogStreamStatus>
  error: Ref<string | null>
  /** Lines dropped from the start because of maxLines. */
  dropped: Ref<number>
  start: () => void
  stop: () => void
  /** Empty the buffer and read the source again from its start. */
  restart: () => void
  /** Add lines by hand (used by the push sources, open to the app). */
  append: (lines: string | string[]) => void
}

const MAX_BACKOFF_MS = 30_000

function toRegExp(pattern: RegExp | string | null | undefined): RegExp | null {
  if (!pattern) return null
  if (typeof pattern === 'string') return new RegExp(pattern, 'i')
  // A global or sticky regex keeps lastIndex between test() calls and skips lines.
  return new RegExp(pattern.source, pattern.flags.replace(/[gy]/g, ''))
}

function splitLines(chunk: string | string[]): string[] {
  const list = Array.isArray(chunk) ? chunk : [chunk]
  return list.flatMap((l) => String(l).replace(/\r\n?/g, '\n').split('\n'))
}

function defaultParse(data: string): string[] | LogPollResult {
  const trimmed = data.trimStart()
  if (trimmed.startsWith('{')) {
    try {
      const parsed = JSON.parse(data)
      if (parsed && Array.isArray(parsed.lines)) return parsed as LogPollResult
    } catch {
      // not JSON: a line that happens to start with a brace
    }
  }
  return splitLines(data)
}

export function useLogStream(source: LogSource, options: UseLogStreamOptions = {}): UseLogStreamReturn {
  const { maxLines = 100_000, immediate = true } = options
  const errorRe = toRegExp(options.errorPattern)

  const lines = shallowRef<LogLine[]>([])
  const status = ref<LogStreamStatus>('idle')
  const error = ref<string | null>(null)
  const dropped = ref(0)

  let ansiState: AnsiStyle = {}
  let counter = 0
  let teardown: (() => void) | null = null
  // A restart must not let a poll answer from the previous run append.
  let run = 0

  function append(chunk: string | string[]): void {
    const incoming = splitLines(chunk)
    if (incoming.length === 0) return
    const parsed: LogLine[] = incoming.map((raw) => {
      const { segments, state } = parseAnsiLine(raw, ansiState)
      ansiState = state
      const text = stripAnsi(raw)
      return { n: ++counter, raw, text, segments, error: errorRe ? errorRe.test(text) : false }
    })
    let next = lines.value.concat(parsed)
    if (next.length > maxLines) {
      dropped.value += next.length - maxLines
      next = next.slice(next.length - maxLines)
    }
    lines.value = next
  }

  function finish(): void {
    status.value = 'done'
    teardown?.()
    teardown = null
  }

  function fail(err: unknown): void {
    error.value = err instanceof Error ? err.message : String(err)
    status.value = 'error'
  }

  function startPoll(src: Extract<LogSource, { poll: unknown }>): void {
    const interval = src.intervalMs ?? 1000
    const current = run
    let offset = src.from ?? 0
    let delay = interval
    let timer: ReturnType<typeof setTimeout> | null = null
    let stopped = false

    const tick = async () => {
      if (stopped || current !== run) return
      try {
        const result = await src.poll(offset)
        if (stopped || current !== run) return
        const received = result?.lines ?? []
        append(received)
        offset = result?.next ?? offset + received.length
        status.value = 'streaming'
        error.value = null
        delay = interval
        if (result?.done) return finish()
      } catch (err) {
        if (stopped || current !== run) return
        fail(err)
        delay = Math.min(delay * 2, MAX_BACKOFF_MS)
      }
      timer = setTimeout(tick, delay)
    }
    teardown = () => {
      stopped = true
      if (timer) clearTimeout(timer)
    }
    void tick()
  }

  function startSse(src: Extract<LogSource, { sse: unknown }>): void {
    const es = typeof src.sse === 'string' ? new EventSource(src.sse) : src.sse()
    const parse = src.parse ?? defaultParse
    const onLines = (event: Event) => {
      const result = parse(String((event as MessageEvent).data ?? ''))
      if (Array.isArray(result)) append(result)
      else {
        append(result.lines ?? [])
        if (result.done) finish()
      }
    }
    const onEnd = () => finish()
    const onError = () => {
      // EventSource reconnects by itself; only a closed source is a failure.
      if (es.readyState === 2) fail('The log stream closed')
    }
    es.addEventListener(src.event ?? 'message', onLines)
    es.addEventListener(src.endEvent ?? 'end', onEnd)
    es.addEventListener('error', onError)
    teardown = () => es.close()
  }

  function startSubscribe(src: Extract<LogSource, { subscribe: unknown }>): void {
    const current = run
    const guard = <A extends unknown[]>(fn: (...args: A) => void) => (...args: A) => {
      if (current === run && status.value === 'streaming') fn(...args)
    }
    const unsubscribe = src.subscribe({ push: guard(append), end: guard(finish), fail: guard(fail) })
    if (status.value === 'streaming' && current === run) {
      teardown = () => unsubscribe?.()
    } else {
      unsubscribe?.()
    }
  }

  function start(): void {
    if (teardown || status.value === 'streaming' || status.value === 'done') return
    run++
    error.value = null
    if ('lines' in source) {
      append(source.lines)
      status.value = 'done'
      return
    }
    status.value = 'streaming'
    if ('poll' in source) startPoll(source)
    else if ('sse' in source) startSse(source)
    else startSubscribe(source)
  }

  function stop(): void {
    run++
    teardown?.()
    teardown = null
    if (status.value === 'streaming') status.value = 'idle'
  }

  function restart(): void {
    stop()
    lines.value = []
    dropped.value = 0
    counter = 0
    ansiState = {}
    status.value = 'idle'
    start()
  }

  if (getCurrentScope()) onScopeDispose(stop)
  if (immediate) start()

  return { lines, status, error, dropped, start, stop, restart, append }
}
