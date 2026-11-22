/**
 * Markdown and HTML for the rich dialog (#5445): `marked` and `DOMPurify`,
 * loaded the first time a dialog shows one, so an app that never does pays
 * nothing. Whatever the source, the HTML is sanitised: no script, no style,
 * no event handler, links and images in http(s), mailto, tel or relative
 * only; an outside link opens in a new tab.
 */
type Purify = typeof import('dompurify').default

let purify: Promise<Purify> | null = null

function loadPurify(): Promise<Purify> {
  purify ??= import('dompurify').then((m) => {
    const p = (m.default ?? m) as Purify
    p.addHook('afterSanitizeAttributes', (node) => {
      if (node.tagName === 'A' && node.getAttribute('href') && /^https?:/i.test(node.getAttribute('href') ?? '')) {
        node.setAttribute('target', '_blank')
        node.setAttribute('rel', 'noopener noreferrer')
      }
    })
    return p
  })
  return purify
}

const CONFIG = {
  FORBID_TAGS: ['style', 'form', 'input', 'button', 'select', 'textarea', 'iframe', 'object', 'embed'],
  FORBID_ATTR: ['style'],
  ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto|tel):|[^a-z]|[a-z+.-]+(?:[^a-z+.\-:]|$))/i,
}

/** HTML, sanitised */
export async function sanitizeHtml(source: string): Promise<string> {
  const p = await loadPurify()
  return p.sanitize(source, CONFIG) as unknown as string
}

/** Markdown to HTML, sanitised */
export async function renderMarkdown(source: string): Promise<string> {
  const { marked } = await import('marked')
  const html = await marked.parse(source, { gfm: true, breaks: false })
  return sanitizeHtml(html)
}
