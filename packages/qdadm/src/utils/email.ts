/**
 * Email helpers for EmailPreview (#4113).
 *
 * A captured email is shown inside a sandboxed iframe: no scripts, no
 * same-origin access, and a Content-Security-Policy that blocks every
 * remote load (images included, until the user asks) — an email is
 * untrusted HTML written by whoever sent it, and a remote image is a read
 * receipt. Nothing here needs postal-mime; raw MIME parsing lives in
 * `@quazardous/qdadm/email`.
 */

export interface EmailAddress {
  name?: string | null
  address?: string | null
}

export type EmailAddressInput = string | EmailAddress | Array<string | EmailAddress> | null | undefined

export interface EmailAttachment {
  filename?: string | null
  contentType?: string | null
  size?: number | null
  /** Where to fetch it (absolute, or relative to the page). */
  url?: string | null
  /** Its bytes, or base64 text. */
  content?: string | ArrayBuffer | Uint8Array | null
  /** `cid:` references in the HTML point here. */
  contentId?: string | null
  disposition?: 'attachment' | 'inline' | null
}

export interface ParsedEmail {
  from?: EmailAddressInput
  to?: EmailAddressInput
  cc?: EmailAddressInput
  replyTo?: EmailAddressInput
  subject?: string | null
  date?: string | Date | null
  messageId?: string | null
  /** Every header, in order. */
  headers?: Array<{ key: string; value: string }> | Record<string, string | string[]> | null
  html?: string | null
  text?: string | null
  /** The raw MIME source, for the Source tab. */
  raw?: string | null
  attachments?: EmailAttachment[] | null
}

/** Parse a raw MIME message into a ParsedEmail; see `@quazardous/qdadm/email`. */
export type EmailParser = (raw: string | ArrayBuffer | Uint8Array) => Promise<ParsedEmail>

// --- Addresses ---

export function addressList(input: EmailAddressInput): EmailAddress[] {
  if (!input) return []
  const list = Array.isArray(input) ? input : [input]
  return list.map((a) => (typeof a === 'string' ? { address: a } : a))
}

export function formatAddress(a: EmailAddress): string {
  if (a.name && a.address) return `${a.name} <${a.address}>`
  return a.address ?? a.name ?? ''
}

export function formatAddresses(input: EmailAddressInput): string {
  return addressList(input).map(formatAddress).join(', ')
}

// --- Headers ---

export function headerList(email: ParsedEmail): Array<{ key: string; value: string }> {
  const h = email.headers
  if (!h) return []
  if (Array.isArray(h)) return h
  return Object.entries(h).flatMap(([key, v]) => (Array.isArray(v) ? v : [v]).map((value) => ({ key, value: String(value) })))
}

// --- Attachments ---

function base64FromBytes(bytes: Uint8Array): string {
  let bin = ''
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(bin)
}

function toUint8(content: ArrayBuffer | Uint8Array): Uint8Array {
  return ArrayBuffer.isView(content) ? new Uint8Array(content.buffer, content.byteOffset, content.byteLength) : new Uint8Array(content)
}

/** A URL for an attachment's bytes: its own URL, or a data URL of its content. */
export function attachmentUrl(att: EmailAttachment): string | null {
  if (att.url) return att.url
  if (att.content === null || att.content === undefined) return null
  const type = att.contentType || 'application/octet-stream'
  const b64 = typeof att.content === 'string' ? att.content.replace(/\s+/g, '') : base64FromBytes(toUint8(att.content))
  return `data:${type};base64,${b64}`
}

export function attachmentSize(att: EmailAttachment): number | null {
  if (typeof att.size === 'number') return att.size
  const c = att.content
  if (!c) return null
  if (typeof c === 'string') return Math.floor((c.replace(/\s+/g, '').length * 3) / 4)
  return toUint8(c).byteLength
}

const stripCid = (id: string) => id.trim().replace(/^<|>$/g, '')

// --- The HTML document ---

/** Remote images an HTML part asks for (src, srcset, background, CSS url()). */
export function countRemoteImages(html: string): number {
  const matches = html.match(/\b(?:src|background)\s*=\s*["']?\s*(?:https?:)?\/\/|url\(\s*["']?\s*(?:https?:)?\/\//gi)
  return matches?.length ?? 0
}

function originOf(url: string): string | null {
  try {
    return new URL(url, typeof location !== 'undefined' ? location.href : 'http://localhost/').origin
  } catch {
    return null
  }
}

export interface EmailDocumentOptions {
  attachments?: EmailAttachment[] | null
  /** Let remote images load. */
  allowRemoteImages?: boolean
}

/**
 * The iframe's `srcdoc`: the email's HTML behind a CSP that only lets inline
 * styles and data/cid images through, with `cid:` references pointing at
 * their attachments and links opening in a new tab.
 *
 * The CSP is a `<meta>` placed first, so the parser puts it in the head
 * before anything the email itself declares.
 */
export function emailDocument(html: string, options: EmailDocumentOptions = {}): string {
  const imgSources = new Set(['data:'])
  const byCid = new Map<string, string>()
  for (const att of options.attachments ?? []) {
    if (!att.contentId) continue
    const url = attachmentUrl(att)
    if (!url) continue
    byCid.set(stripCid(att.contentId).toLowerCase(), url)
    if (!url.startsWith('data:')) {
      const origin = originOf(url)
      if (origin) imgSources.add(origin)
    }
  }
  if (options.allowRemoteImages) {
    imgSources.add('https:')
    imgSources.add('http:')
  }
  const resolve = (url: string) =>
    url.startsWith('data:') ? url : new URL(url, typeof location !== 'undefined' ? location.href : 'http://localhost/').href
  const withCids = html.replace(/cid:([^"'\s)>]+)/gi, (whole, id: string) => {
    let key = id
    try {
      key = decodeURIComponent(id)
    } catch {
      // a stray % in the id: compare it as written
    }
    const url = byCid.get(stripCid(key).toLowerCase())
    return url ? resolve(url) : whole
  })
  const csp = [
    "default-src 'none'",
    "style-src 'unsafe-inline'",
    `img-src ${[...imgSources].join(' ')}`,
    'font-src data:',
    "form-action 'none'",
  ].join('; ')
  const head =
    `<meta http-equiv="Content-Security-Policy" content="${csp}">` +
    '<meta charset="utf-8"><base target="_blank">' +
    '<style>html{color-scheme:light}body{margin:0;padding:12px;font-family:system-ui,sans-serif;background:#fff;color:#222}img{max-width:100%;height:auto}</style>'
  return `<!doctype html>${head}${withoutLeaks(withCids)}`
}

/**
 * What the CSP does not stop: a meta refresh navigates the frame itself to a
 * remote page (the sandbox allows a frame to navigate itself), DNS prefetch /
 * preconnect hints reach out before any policy applies, and a `<base>` would
 * re-aim every relative link.
 *
 * Read with DOMParser, whose documents are inert (nothing runs, nothing
 * loads): the browser decodes attributes the way the frame would, so
 * `http-equiv="&#x72;efresh"` is caught too. A regex is the fallback where
 * there is no DOM.
 */
function withoutLeaks(html: string): string {
  if (typeof DOMParser === 'undefined') {
    return html
      .replace(/<meta\b[^>]*http-equiv[^>]*>/gi, '')
      .replace(/<link\b[^>]*>/gi, '')
      .replace(/<base\b[^>]*>/gi, '')
  }
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const HINTS = ['dns-prefetch', 'preconnect', 'prefetch', 'prerender', 'preload', 'modulepreload']
  doc.querySelectorAll('meta[http-equiv], base').forEach((el) => el.remove())
  doc.querySelectorAll('link').forEach((el) => {
    const rel = (el.getAttribute('rel') ?? '').toLowerCase().split(/\s+/)
    if (rel.some((r) => HINTS.includes(r)) || rel.includes('stylesheet') || rel.includes('import')) el.remove()
  })
  return doc.documentElement.outerHTML
}

/** The iframe sandbox: no scripts, an opaque origin, links may open a new tab. */
export const EMAIL_SANDBOX = 'allow-popups allow-popups-to-escape-sandbox'

// --- Mailpit ---

interface MailpitAddress {
  Name?: string
  Address?: string
}

interface MailpitPart {
  PartID: string
  FileName?: string
  ContentType?: string
  ContentID?: string
  Size?: number
}

export interface MailpitMessage {
  ID: string
  From?: MailpitAddress | null
  To?: MailpitAddress[] | null
  Cc?: MailpitAddress[] | null
  ReplyTo?: MailpitAddress[] | null
  Subject?: string
  Date?: string
  MessageID?: string
  HTML?: string
  Text?: string
  Attachments?: MailpitPart[] | null
  Inline?: MailpitPart[] | null
}

/**
 * A Mailpit message (`GET /api/v1/message/{ID}`) as a ParsedEmail. Parts are
 * fetched from `${baseUrl}/api/v1/message/{ID}/part/{PartID}`; headers come
 * from `/headers`, and the source from `/raw`, if the app wants them.
 */
export function fromMailpit(message: MailpitMessage, baseUrl = ''): ParsedEmail {
  const addr = (a?: MailpitAddress | null): EmailAddress => ({ name: a?.Name || null, address: a?.Address || null })
  const part = (p: MailpitPart, disposition: 'attachment' | 'inline'): EmailAttachment => ({
    filename: p.FileName ?? null,
    contentType: p.ContentType ?? null,
    size: p.Size ?? null,
    contentId: p.ContentID ?? null,
    url: `${baseUrl.replace(/\/$/, '')}/api/v1/message/${encodeURIComponent(message.ID)}/part/${encodeURIComponent(p.PartID)}`,
    disposition,
  })
  return {
    from: message.From ? addr(message.From) : null,
    to: (message.To ?? []).map(addr),
    cc: (message.Cc ?? []).map(addr),
    replyTo: (message.ReplyTo ?? []).map(addr),
    subject: message.Subject ?? null,
    date: message.Date ?? null,
    messageId: message.MessageID ?? null,
    html: message.HTML ?? null,
    text: message.Text ?? null,
    attachments: [...(message.Attachments ?? []).map((p) => part(p, 'attachment')), ...(message.Inline ?? []).map((p) => part(p, 'inline'))],
  }
}
