/**
 * qdadm/email - raw MIME parsing for EmailPreview (#4113), through postal-mime
 *
 * Import from '@quazardous/qdadm/email' only if the app shows raw MIME
 * messages (an .eml, a sink that returns the source). postal-mime is an
 * optional peer dependency: install it to use this entry point. A parsed
 * email ({ headers, html, text, attachments }) needs neither.
 *
 * Usage:
 *   import { parseMime } from '@quazardous/qdadm/email'
 *   <EmailPreview :raw="capture.source" :parser="parseMime" />
 */
import PostalMime from 'postal-mime'
import type { EmailAddress, ParsedEmail } from '../utils/email'

type PostalAddress = { name: string; address?: string; group?: Array<{ name: string; address: string }> }

function flatten(list: PostalAddress[] | PostalAddress | undefined): EmailAddress[] {
  const items = !list ? [] : Array.isArray(list) ? list : [list]
  return items.flatMap((a): Array<{ name: string; address?: string }> => (a.group ? a.group : [a])).map((a) => ({ name: a.name || null, address: a.address ?? null }))
}

/** Parse a raw MIME message. The source is kept for the Source tab. */
export async function parseMime(raw: string | ArrayBuffer | Uint8Array): Promise<ParsedEmail> {
  const email = await new PostalMime({ attachmentEncoding: 'base64' }).parse(raw)
  return {
    from: flatten(email.from as PostalAddress | undefined)[0] ?? null,
    to: flatten(email.to as PostalAddress[] | undefined),
    cc: flatten(email.cc as PostalAddress[] | undefined),
    replyTo: flatten(email.replyTo as PostalAddress[] | undefined),
    subject: email.subject ?? null,
    date: email.date ?? null,
    messageId: email.messageId ?? null,
    headers: email.headers.map((h) => ({ key: h.originalKey ?? h.key, value: h.value })),
    html: email.html ?? null,
    text: email.text ?? null,
    raw: typeof raw === 'string' ? raw : new TextDecoder().decode(raw),
    attachments: email.attachments.map((a) => ({
      filename: a.filename,
      contentType: a.mimeType,
      content: a.content as string,
      contentId: a.contentId ?? null,
      disposition: a.disposition,
    })),
  }
}
