/**
 * How YamlConfigEditor reaches the server (#4303): load, check, save with a
 * reason against a revision, history. `restYamlAdapter` speaks this REST
 * contract; any other transport implements YamlConfigAdapter.
 *
 *   GET    <url>          → { yaml, schema?, revision?, readOnly? }
 *   POST   <url>/check    { yaml }                    → { problems: [{ path, message }] }
 *   PUT    <url>          { yaml, reason, revision }  → { revision? }
 *                         409 → { yaml, revision } (the server's current version)
 *   GET    <url>/history  → [{ revision, author?, date?, reason?, before?, after }]
 *
 * With `path`, every call carries `?path=<a.b.c>`: the server serves and
 * saves that part of the document only.
 */
import { toPath, type JsonSchema, type YamlProblem } from '@quazardous/vanilla-yamleditor'

export type YamlRevision = string | number

export interface YamlConfigDocument {
  yaml: string
  schema?: JsonSchema
  revision?: YamlRevision
  /** The user may only read it. */
  readOnly?: boolean
}

export interface YamlHistoryEntry {
  revision: YamlRevision
  author?: string
  /** ISO date. */
  date?: string
  reason?: string
  /** The text before this revision; absent for the first one. */
  before?: string
  /** The text this revision saved. */
  after: string
}

export interface YamlSaveInput {
  yaml: string
  reason: string
  revision?: YamlRevision
}

export interface YamlConfigAdapter {
  load(): Promise<YamlConfigDocument>
  /** The server's checks; without it, saving only runs the schema. */
  check?(yaml: string): Promise<YamlProblem[]>
  /** Throws YamlConflictError when the revision moved meanwhile. */
  save(input: YamlSaveInput): Promise<{ revision?: YamlRevision }>
  history?(): Promise<YamlHistoryEntry[]>
}

/** The document was saved by someone else since it was loaded. */
export class YamlConflictError extends Error {
  /** The server's current version. */
  readonly current: YamlConfigDocument

  constructor(current: YamlConfigDocument) {
    super('The document changed since it was loaded')
    this.name = 'YamlConflictError'
    this.current = current
  }
}

/** A problem path from a server: an array, or `a.b[0].c` / `a/b/0`. */
export const normalizeProblemPath = toPath

/** Problems as an adapter may return them: a list, or `{ problems }`, with string or array paths. */
export function normalizeProblems(raw: unknown): YamlProblem[] {
  const list = Array.isArray(raw) ? raw : Array.isArray((raw as { problems?: unknown })?.problems) ? (raw as { problems: unknown[] }).problems : []
  return list
    .filter((p): p is { path?: unknown; message?: unknown; severity?: unknown } => !!p && typeof p === 'object')
    .map((p) => ({
      path: normalizeProblemPath(p.path),
      message: String(p.message ?? ''),
      severity: p.severity === 'warning' ? ('warning' as const) : ('error' as const),
    }))
}

export interface RestYamlAdapterOptions {
  /** Edit part of the document: sent as `?path=`. */
  path?: string | (string | number)[]
  /** The app's fetch (auth headers, base URL…). Default: window.fetch. */
  fetch?: typeof fetch
  headers?: Record<string, string>
}

export function restYamlAdapter(url: string, options: RestYamlAdapterOptions = {}): YamlConfigAdapter {
  const doFetch = options.fetch ?? ((input: RequestInfo | URL, init?: RequestInit) => fetch(input, init))
  const path = Array.isArray(options.path) ? options.path.join('.') : options.path
  const base = url.replace(/\/$/, '')
  const at = (suffix = '') => {
    const target = base + suffix
    return path ? `${target}${target.includes('?') ? '&' : '?'}path=${encodeURIComponent(path)}` : target
  }
  const headers = { Accept: 'application/json', ...options.headers }

  async function call(target: string, init: RequestInit = {}): Promise<{ status: number; body: unknown }> {
    const res = await doFetch(target, { ...init, headers: { ...headers, ...(init.body ? { 'Content-Type': 'application/json' } : {}), ...(init.headers as Record<string, string>) } })
    const text = await res.text()
    let body: unknown = text
    try {
      body = text ? JSON.parse(text) : null
    } catch {
      // Not JSON: keep the text for the error message
    }
    if (!res.ok && res.status !== 409) {
      const message = (body as { message?: string; detail?: string })?.message ?? (body as { detail?: string })?.detail ?? `${res.status} ${res.statusText}`
      throw new Error(String(message))
    }
    return { status: res.status, body }
  }

  const toDocument = (body: unknown): YamlConfigDocument => {
    const b = (body ?? {}) as Partial<YamlConfigDocument>
    return { yaml: String(b.yaml ?? ''), schema: b.schema, revision: b.revision, readOnly: b.readOnly }
  }

  return {
    async load() {
      return toDocument((await call(at())).body)
    },
    async check(yaml) {
      return normalizeProblems((await call(at('/check'), { method: 'POST', body: JSON.stringify({ yaml }) })).body)
    },
    async save(input) {
      const { status, body } = await call(at(), { method: 'PUT', body: JSON.stringify(input) })
      if (status === 409) {
        const current = body && typeof body === 'object' && 'yaml' in body ? toDocument(body) : toDocument((await call(at())).body)
        throw new YamlConflictError(current)
      }
      return { revision: (body as { revision?: YamlRevision } | null)?.revision }
    },
    async history() {
      const { body } = await call(at('/history'))
      const list = Array.isArray(body) ? body : ((body as { entries?: unknown[] })?.entries ?? [])
      return list as YamlHistoryEntry[]
    },
  }
}
