/**
 * Payload helpers for PayloadViewer / PayloadDiff (#4112).
 *
 * What an integration sends its providers is rarely JSON: XML to suppliers
 * and SOAP marketplaces, CSV feeds, form-encoded payment calls, raw text,
 * files. These read each format without a dependency, and never through the
 * DOM: XML is tokenized by hand, so nothing in a captured message is ever
 * interpreted as HTML.
 */

export type PayloadFormat = 'json' | 'xml' | 'csv' | 'form' | 'text' | 'binary'

export type PayloadBody = string | Record<string, unknown> | unknown[] | ArrayBuffer | Uint8Array | null | undefined

/** Decide what a value hides: return the replacement, or undefined to keep it. */
export type PayloadMask = (key: string, value: string) => string | undefined

// --- Format detection ---

// Not instanceof: bytes from another realm (an iframe, a worker, Node's
// TextEncoder under jsdom) are not instances of this realm's classes.
const isArrayBuffer = (v: unknown): v is ArrayBuffer => Object.prototype.toString.call(v) === '[object ArrayBuffer]'
const isByteView = (v: unknown): v is Uint8Array => ArrayBuffer.isView(v) && !(Object.prototype.toString.call(v) === '[object DataView]')

export function isBinary(body: PayloadBody): body is ArrayBuffer | Uint8Array {
  return isArrayBuffer(body) || isByteView(body)
}

/** Bytes of a binary body, or of a string (UTF-8). */
export function toBytes(body: PayloadBody): Uint8Array {
  if (isByteView(body)) return new Uint8Array(body.buffer, body.byteOffset, body.byteLength)
  if (isArrayBuffer(body)) return new Uint8Array(body)
  return new TextEncoder().encode(typeof body === 'string' ? body : JSON.stringify(body ?? null))
}

export function formatFromContentType(contentType: string | null | undefined): PayloadFormat | null {
  if (!contentType) return null
  const ct = contentType.toLowerCase()
  if (ct.includes('json')) return 'json'
  if (ct.includes('xml')) return 'xml'
  if (ct.includes('csv') || ct.includes('tab-separated-values')) return 'csv'
  if (ct.includes('x-www-form-urlencoded')) return 'form'
  if (ct.startsWith('text/')) return 'text'
  if (ct.startsWith('application/octet-stream') || ct.startsWith('image/') || ct.includes('pdf') || ct.includes('zip')) {
    return 'binary'
  }
  return null
}

const CSV_SEPARATORS = [',', ';', '\t', '|']

/** The separator that splits the first lines into the same number of columns, if any. */
export function detectCsvSeparator(text: string): string | null {
  const lines = text.split(/\r?\n/).filter((l) => l.trim() !== '').slice(0, 6)
  if (lines.length < 2) return null
  let best: string | null = null
  let bestCols = 1
  for (const sep of CSV_SEPARATORS) {
    const counts = lines.map((l) => parseCsvLine(l, sep).length)
    if (counts.every((c) => c === counts[0]) && counts[0]! > bestCols) {
      best = sep
      bestCols = counts[0]!
    }
  }
  return best
}

/** The format of a body: the explicit one, else the content type, else what it looks like. */
export function detectFormat(body: PayloadBody, contentType?: string | null, format?: PayloadFormat | null): PayloadFormat {
  if (format) return format
  if (isBinary(body)) return formatFromContentType(contentType) === 'binary' || !looksLikeText(body) ? 'binary' : sniff(new TextDecoder().decode(body))
  if (body !== null && typeof body === 'object') return 'json'
  const fromType = formatFromContentType(contentType)
  if (fromType) return fromType
  return sniff(String(body ?? ''))
}

function looksLikeText(bytes: ArrayBuffer | Uint8Array): boolean {
  const view = toBytes(bytes)
  const sample = view.subarray(0, 512)
  for (const b of sample) if (b === 0) return false
  return true
}

function sniff(text: string): PayloadFormat {
  const t = text.trim()
  if (t === '') return 'text'
  if (text.includes('\u0000')) return 'binary'
  if ((t.startsWith('{') && t.endsWith('}')) || (t.startsWith('[') && t.endsWith(']'))) {
    try {
      JSON.parse(t)
      return 'json'
    } catch {
      // brackets, but not JSON
    }
  }
  if (t.startsWith('<') && t.endsWith('>')) return 'xml'
  if (/^[\w.%+\-[\]]+=[^\s&]*(&[\w.%+\-[\]]+=[^\s&]*)*$/.test(t)) return 'form'
  if (detectCsvSeparator(t)) return 'csv'
  return 'text'
}

/** The body as text: decoded bytes, pretty JSON for an object. */
export function bodyText(body: PayloadBody): string {
  if (body === null || body === undefined) return ''
  if (isBinary(body)) return new TextDecoder().decode(body)
  if (typeof body === 'object') return JSON.stringify(body, null, 2)
  return String(body)
}

export const FORMAT_EXTENSIONS: Record<PayloadFormat, string> = {
  json: 'json',
  xml: 'xml',
  csv: 'csv',
  form: 'txt',
  text: 'txt',
  binary: 'bin',
}

// --- Masking ---

const DEFAULT_MASKED = ['password', 'passwd', 'secret', 'token', 'access_token', 'refresh_token', 'api_key', 'apikey', 'authorization', 'cookie', 'set-cookie', 'card_number', 'cvv', 'cvc']

/**
 * A mask that hides the values of the given keys, compared without case.
 * `maskKeys()` hides the usual suspects (password, token, authorization…).
 */
export function maskKeys(keys: string[] = DEFAULT_MASKED, replacement = '••••••'): PayloadMask {
  const set = new Set(keys.map((k) => k.toLowerCase()))
  return (key) => (set.has(key.toLowerCase()) ? replacement : undefined)
}

function maskValue(mask: PayloadMask | null | undefined, key: string, value: string): string {
  if (!mask) return value
  return mask(key, value) ?? value
}

/** Apply a mask to every key of a JSON value, at any depth. */
export function maskJson(value: unknown, mask: PayloadMask | null | undefined): unknown {
  if (!mask) return value
  if (Array.isArray(value)) return value.map((v) => maskJson(v, mask))
  if (value !== null && typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (v !== null && typeof v === 'object') out[k] = maskJson(v, mask)
      else {
        const masked = mask(k, v === undefined ? '' : String(v))
        out[k] = masked === undefined ? v : masked
      }
    }
    return out
  }
  return value
}

// --- JSON ---

export function parseJson(body: PayloadBody): { ok: true; value: unknown } | { ok: false; error: string } {
  if (body !== null && typeof body === 'object' && !isBinary(body)) return { ok: true, value: body }
  try {
    return { ok: true, value: JSON.parse(bodyText(body)) }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}

/** JSON with keys sorted at every depth, so two payloads differing only by key order compare equal. */
export function stableJson(value: unknown): string {
  const sort = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(sort)
    if (v !== null && typeof v === 'object') {
      return Object.fromEntries(Object.keys(v as object).sort().map((k) => [k, sort((v as Record<string, unknown>)[k])]))
    }
    return v
  }
  return JSON.stringify(sort(value), null, 2)
}

// --- XML ---

export interface XmlToken {
  kind: 'open' | 'close' | 'self' | 'text' | 'comment' | 'cdata' | 'decl' | 'doctype'
  raw: string
  name?: string
  attrs?: Array<{ name: string; value: string; quote: string }>
}

const XML_TOKEN = /<!--[\s\S]*?-->|<!\[CDATA\[[\s\S]*?\]\]>|<\?[\s\S]*?\?>|<!DOCTYPE[^>[]*(?:\[[\s\S]*?\])?\s*>|<\/?[^\s/>!?]+(?:\s+[^\s=/>]+(?:\s*=\s*(?:"[^"]*"|'[^']*'))?)*\s*\/?>|[^<]+/gi
const XML_ATTR = /([^\s=/>]+)(?:\s*=\s*("[^"]*"|'[^']*'))?/g

export function tokenizeXml(text: string): XmlToken[] | null {
  const tokens: XmlToken[] = []
  let consumed = 0
  XML_TOKEN.lastIndex = 0
  for (let m = XML_TOKEN.exec(text); m; m = XML_TOKEN.exec(text)) {
    if (m.index !== consumed) return null
    consumed = m.index + m[0].length
    const raw = m[0]
    if (raw.startsWith('<!--')) tokens.push({ kind: 'comment', raw })
    else if (raw.startsWith('<![CDATA[')) tokens.push({ kind: 'cdata', raw })
    else if (raw.startsWith('<?')) tokens.push({ kind: 'decl', raw })
    else if (/^<!DOCTYPE/i.test(raw)) tokens.push({ kind: 'doctype', raw })
    else if (raw.startsWith('</')) tokens.push({ kind: 'close', raw, name: raw.slice(2, -1).trim() })
    else if (raw.startsWith('<')) {
      const self = raw.endsWith('/>')
      const inner = raw.slice(1, self ? -2 : -1)
      const name = inner.match(/^[^\s/>]+/)![0]
      const attrs: XmlToken['attrs'] = []
      XML_ATTR.lastIndex = 0
      const rest = inner.slice(name.length)
      for (let a = XML_ATTR.exec(rest); a; a = XML_ATTR.exec(rest)) {
        const quoted = a[2] ?? '""'
        attrs.push({ name: a[1]!, value: quoted.slice(1, -1), quote: quoted[0]! })
      }
      tokens.push({ kind: self ? 'self' : 'open', raw, name, attrs })
    } else tokens.push({ kind: 'text', raw })
  }
  if (consumed !== text.length) return null
  return tokens
}

/** A highlighted XML line: pieces with a class, never HTML. */
export type XmlPiece = { text: string; cls?: string }

export interface PrettyXml {
  ok: boolean
  /** Why it could not be read as XML, when `ok` is false. */
  error?: string
  lines: XmlPiece[][]
}

function tagPieces(token: XmlToken, mask: PayloadMask | null | undefined): XmlPiece[] {
  const close = token.kind === 'close'
  const pieces: XmlPiece[] = [{ text: close ? '</' : '<', cls: 'pl-punct' }, { text: token.name!, cls: 'pl-tag' }]
  for (const attr of token.attrs ?? []) {
    pieces.push({ text: ' ' }, { text: attr.name, cls: 'pl-attr' }, { text: '=', cls: 'pl-punct' })
    pieces.push({ text: `${attr.quote}${maskValue(mask, attr.name, attr.value)}${attr.quote}`, cls: 'pl-value' })
  }
  pieces.push({ text: token.kind === 'self' ? '/>' : '>', cls: 'pl-punct' })
  return pieces
}

/**
 * Indent XML, one element per line, an element holding only text on one line.
 * Unbalanced or unreadable XML comes back `ok: false` with its raw lines.
 */
export function prettyXml(text: string, mask?: PayloadMask | null): PrettyXml {
  const raw = (): XmlPiece[][] => text.split(/\r?\n/).map((l) => [{ text: l }])
  const tokens = tokenizeXml(text.trim())
  if (!tokens) return { ok: false, error: 'not well-formed', lines: raw() }

  const lines: XmlPiece[][] = []
  const stack: string[] = []
  const indent = () => [{ text: '  '.repeat(stack.length) }]

  for (let i = 0; i < tokens.length; i++) {
    const tok = tokens[i]!
    if (tok.kind === 'text') {
      const value = tok.raw.trim()
      if (value) lines.push([...indent(), { text: maskValue(mask, stack.at(-1) ?? '', value), cls: 'pl-text' }])
      continue
    }
    if (tok.kind === 'open') {
      const next = tokens[i + 1]
      const after = tokens[i + 2]
      // <name>text</name> stays on one line.
      if (next?.kind === 'text' && after?.kind === 'close' && after.name === tok.name) {
        lines.push([...indent(), ...tagPieces(tok, mask), { text: maskValue(mask, tok.name!, next.raw.trim()), cls: 'pl-text' }, ...tagPieces(after, mask)])
        i += 2
        continue
      }
      lines.push([...indent(), ...tagPieces(tok, mask)])
      stack.push(tok.name!)
      continue
    }
    if (tok.kind === 'close') {
      if (stack.at(-1) !== tok.name) {
        return { ok: false, error: `</${tok.name}> does not close <${stack.at(-1) ?? '—'}>`, lines: raw() }
      }
      stack.pop()
      lines.push([...indent(), ...tagPieces(tok, mask)])
      continue
    }
    if (tok.kind === 'self') {
      lines.push([...indent(), ...tagPieces(tok, mask)])
      continue
    }
    const cls = tok.kind === 'comment' ? 'pl-comment' : tok.kind === 'cdata' ? 'pl-cdata' : 'pl-decl'
    for (const part of tok.raw.split(/\r?\n/)) lines.push([...indent(), { text: part, cls }])
  }
  if (stack.length) return { ok: false, error: `<${stack.at(-1)}> is never closed`, lines: raw() }
  return { ok: true, lines }
}

export const piecesText = (line: XmlPiece[]) => line.map((p) => p.text).join('')

// --- CSV ---

/** One CSV line, with quoted fields ("a, b" and doubled quotes). */
export function parseCsvLine(line: string, sep: string): string[] {
  const out: string[] = []
  let field = ''
  let quoted = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]!
    if (quoted) {
      if (c === '"' && line[i + 1] === '"') {
        field += '"'
        i++
      } else if (c === '"') quoted = false
      else field += c
    } else if (c === '"' && field === '') quoted = true
    else if (c === sep) {
      out.push(field)
      field = ''
    } else field += c
  }
  out.push(field)
  return out
}

/** Rows of a CSV text; a quoted field may span lines. */
export function parseCsv(text: string, sep?: string | null): { separator: string; rows: string[][] } {
  const separator = sep ?? detectCsvSeparator(text) ?? ','
  const rows: string[][] = []
  let pending = ''
  for (const line of text.replace(/\r\n?/g, '\n').split('\n')) {
    pending = pending ? `${pending}\n${line}` : line
    // An odd count of quotes: the field goes on to the next line.
    if ((pending.match(/"/g)?.length ?? 0) % 2 === 1) continue
    if (pending.trim() !== '') rows.push(parseCsvLine(pending, separator))
    pending = ''
  }
  if (pending.trim() !== '') rows.push(parseCsvLine(pending, separator))
  return { separator, rows }
}

/** Mask the columns whose header the mask names. */
export function maskCsv(rows: string[][], mask: PayloadMask | null | undefined, hasHeader: boolean): string[][] {
  if (!mask || !hasHeader || rows.length === 0) return rows
  const header = rows[0]!
  return [header, ...rows.slice(1).map((row) => row.map((cell, i) => maskValue(mask, header[i] ?? '', cell)))]
}

// --- Form-encoded ---

export function parseForm(text: string, mask?: PayloadMask | null): Array<[string, string]> {
  const params = new URLSearchParams(text.trim().replace(/^\?/, ''))
  return [...params.entries()].map(([k, v]) => [k, maskValue(mask, k, v)])
}

// --- Headers ---

export function maskHeaders(headers: Record<string, unknown> | null | undefined, mask: PayloadMask | null | undefined): Array<[string, string]> {
  return Object.entries(headers ?? {}).map(([k, v]) => [k, maskValue(mask, k, Array.isArray(v) ? v.join(', ') : String(v ?? ''))])
}

// --- Hex ---

export function hexDump(bytes: Uint8Array, limit = 256): string[] {
  const out: string[] = []
  const view = bytes.subarray(0, limit)
  for (let off = 0; off < view.length; off += 16) {
    const chunk = view.subarray(off, off + 16)
    const hex = [...chunk].map((b) => b.toString(16).padStart(2, '0')).join(' ')
    const ascii = [...chunk].map((b) => (b >= 32 && b < 127 ? String.fromCharCode(b) : '.')).join('')
    out.push(`${off.toString(16).padStart(8, '0')}  ${hex.padEnd(47)}  ${ascii}`)
  }
  return out
}

// --- Normalising for a diff ---

/**
 * The body as lines worth comparing: pretty JSON with sorted keys, indented
 * XML, sorted form fields. Formatting noise disappears, so a line diff of the
 * result reads as a diff of the content.
 */
export function normalizeLines(body: PayloadBody, format: PayloadFormat, mask?: PayloadMask | null): string[] {
  if (format === 'json') {
    const parsed = parseJson(body)
    if (parsed.ok) return stableJson(maskJson(parsed.value, mask)).split('\n')
  }
  if (format === 'xml') {
    const pretty = prettyXml(bodyText(body), mask)
    if (pretty.ok) return pretty.lines.map(piecesText)
  }
  if (format === 'form') {
    return parseForm(bodyText(body), mask).map(([k, v]) => `${k}=${v}`).sort()
  }
  if (format === 'binary') return hexDump(toBytes(body), Infinity)
  return bodyText(body).replace(/\r\n?/g, '\n').split('\n')
}

// --- Line diff (Myers) ---

export type DiffOp = { type: 'equal' | 'delete' | 'insert'; left?: number; right?: number; text: string }

/** Myers' O((N+M)·D) diff of two line lists. */
export function diffLines(a: string[], b: string[]): DiffOp[] {
  const n = a.length
  const m = b.length
  const max = n + m
  const offset = max + 1
  const v = new Int32Array(2 * max + 3)
  const trace: Int32Array[] = []
  outer: for (let d = 0; d <= max; d++) {
    trace.push(v.slice())
    for (let k = -d; k <= d; k += 2) {
      let x = k === -d || (k !== d && v[offset + k - 1]! < v[offset + k + 1]!) ? v[offset + k + 1]! : v[offset + k - 1]! + 1
      let y = x - k
      while (x < n && y < m && a[x] === b[y]) {
        x++
        y++
      }
      v[offset + k] = x
      if (x >= n && y >= m) break outer
    }
  }
  // Walk the trace back from the end.
  const ops: DiffOp[] = []
  let x = n
  let y = m
  for (let d = trace.length - 1; d >= 0; d--) {
    const vd = trace[d]!
    const k = x - y
    const prevK = k === -d || (k !== d && vd[offset + k - 1]! < vd[offset + k + 1]!) ? k + 1 : k - 1
    const prevX = vd[offset + prevK]!
    const prevY = prevX - prevK
    while (x > prevX && y > prevY) {
      x--
      y--
      ops.push({ type: 'equal', left: x, right: y, text: a[x]! })
    }
    if (d > 0) {
      if (x === prevX) {
        y--
        ops.push({ type: 'insert', right: y, text: b[y]! })
      } else {
        x--
        ops.push({ type: 'delete', left: x, text: a[x]! })
      }
    }
  }
  return ops.reverse()
}

// --- Keyed CSV diff ---

export interface CsvRowDiff {
  status: 'same' | 'changed' | 'added' | 'removed'
  key: string
  left?: string[]
  right?: string[]
  /** Indexes (in `header`) of the cells that differ. */
  changed: number[]
}

/** Rows matched on a key column; cells compared by header name, so a reordered column is not a change. */
export function diffCsv(left: string[][], right: string[][], key: string): { header: string[]; rows: CsvRowDiff[] } | null {
  const lh = left[0] ?? []
  const rh = right[0] ?? []
  if (!lh.includes(key) || !rh.includes(key)) return null
  const header = [...lh, ...rh.filter((h) => !lh.includes(h))]
  const align = (h: string[], row: string[]) => header.map((name) => (h.includes(name) ? row[h.indexOf(name)] ?? '' : ''))
  const index = (h: string[], rows: string[][]) => new Map(rows.slice(1).map((r) => [r[h.indexOf(key)] ?? '', align(h, r)]))
  const L = index(lh, left)
  const R = index(rh, right)
  const rows: CsvRowDiff[] = []
  for (const [k, l] of L) {
    const r = R.get(k)
    if (!r) rows.push({ status: 'removed', key: k, left: l, changed: [] })
    else {
      const changed = header.map((_, i) => i).filter((i) => l[i] !== r[i])
      rows.push({ status: changed.length ? 'changed' : 'same', key: k, left: l, right: r, changed })
    }
  }
  for (const [k, r] of R) if (!L.has(k)) rows.push({ status: 'added', key: k, right: r, changed: [] })
  return { header, rows }
}
