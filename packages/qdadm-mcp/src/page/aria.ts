/**
 * The page as an agent reads it (#2247): an accessibility tree, in the format
 * agent browser tools converged on (Playwright MCP's snapshot) — roles, names,
 * states, and a ref on every element that the action tools take back.
 *
 * ```
 * - heading "Books" [level=1] [ref=e3]
 * - button "Add Book" [ref=e4]
 * - textbox "Title *" [required] [invalid] [ref=e9]
 * - text: Title is required
 * - combobox "Genre" [collapsed] [value="Fantasy"] [ref=e11]
 * ```
 *
 * Computed in the page, from the DOM: names and roles by
 * dom-accessibility-api, visibility by the browser's own layout. Loaded on
 * first use — a page nobody inspects never downloads it.
 */
import { computeAccessibleName, getRole } from 'dom-accessibility-api'
import type { RefRegistry } from './refs.ts'

/** The debug bar is not the app: never read, never acted on. */
export const DEBUG_BAR = '.qd-debug'

const SKIPPED_TAGS = new Set(['script', 'style', 'template', 'noscript', 'link', 'meta'])
/** Roles that only group: their content goes straight to the parent. */
const TRANSPARENT = new Set(['generic', 'none', 'presentation'])
/** What an agent can act on. */
export const INTERACTIVE = new Set([
  'button',
  'link',
  'textbox',
  'searchbox',
  'checkbox',
  'radio',
  'switch',
  'combobox',
  'listbox',
  'option',
  'menuitem',
  'menuitemcheckbox',
  'menuitemradio',
  'tab',
  'slider',
  'spinbutton',
  'treeitem',
])
/** Roles whose name is worth computing without an aria-label: what an agent looks for by name. */
const NAMED = new Set([
  ...INTERACTIVE,
  'heading',
  'img',
  'dialog',
  'alertdialog',
  'columnheader',
  'rowheader',
  'progressbar',
  'meter',
  'tabpanel',
])
/** Form controls, which a qdadm form field names with its label. */
const FIELD_ROLES = new Set(['textbox', 'searchbox', 'combobox', 'spinbutton', 'slider', 'listbox', 'checkbox', 'switch'])
/** Kept even when empty: an empty cell still holds its column. */
const KEPT_EMPTY = new Set(['cell', 'gridcell', 'columnheader', 'rowheader', 'row', 'separator', 'progressbar', 'meter'])
const CHECKABLE = new Set(['checkbox', 'radio', 'switch', 'menuitemcheckbox', 'menuitemradio'])
/** Elements whose DOM content is their implementation, not something to list. */
const LEAF_TAGS = new Set(['input', 'textarea', 'select', 'svg', 'img', 'canvas', 'video', 'audio', 'iframe'])
/** Elements past this many are left out, and the snapshot says so. */
const ELEMENT_LIMIT = 8000

export interface AxNode {
  element: Element
  role: string
  name: string
  ref: string
  states: string[]
  value?: string
  url?: string
  children: AxItem[]
}
export type AxItem = AxNode | string

const collapse = (text: string | null | undefined) => (text ?? '').replace(/\s+/g, ' ').trim()
const clip = (text: string, max: number) => (text.length > max ? `${text.slice(0, max - 1)}…` : text)

/** Rendered and not hidden — by the browser's layout where there is one. */
export function isShown(element: Element): boolean {
  const check = (element as Element & { checkVisibility?: (options?: object) => boolean }).checkVisibility
  if (typeof check === 'function') {
    if (!check.call(element, { visibilityProperty: true })) return getComputedStyle(element).display === 'contents'
    // Kept for screen readers only (PrimeVue's p-hidden-accessible, sr-only): the user sees nothing there.
    const box = element.getBoundingClientRect()
    return !(box.width <= 1 && box.height <= 1 && getComputedStyle(element).overflow === 'hidden')
  }
  // No layout (jsdom): styles are all there is.
  const style = getComputedStyle(element)
  return style.display !== 'none' && style.visibility !== 'hidden' && !(element as HTMLElement).hidden
}

/** A PrimeIcons class, for buttons that show nothing but an icon. */
function iconOf(element: Element): string | null {
  for (const icon of Array.from(element.querySelectorAll('[class*="pi-"]'))) {
    const name = Array.from(icon.classList).find((c) => c.startsWith('pi-') && c !== 'pi-fw' && c !== 'pi-spin')
    if (name) return name.slice(3)
  }
  return null
}

/** PrimeVue classes that say nothing about what a part is. */
const GENERIC_CLASS = /^p-(button|component|disabled|focus|ripple|invalid|hidden-accessible|filled|fluid)/

/** The PrimeVue part a button is — its icons are inline SVG, with no name to read. */
function kindOf(element: Element): string | null {
  const part = Array.from(element.classList).find((c) => c.startsWith('p-') && !GENERIC_CLASS.test(c))
  return part ? part.slice(2) : null
}

function statesOf(element: Element, role: string): string[] {
  const states: string[] = []
  const attr = (name: string) => element.getAttribute(name)
  if (role === 'heading') {
    const level = attr('aria-level') ?? /^h([1-6])$/.exec(element.localName)?.[1]
    if (level) states.push(`level=${level}`)
  }
  if (CHECKABLE.has(role)) {
    const input = element instanceof HTMLInputElement && (element.type === 'checkbox' || element.type === 'radio') ? element : null
    const checked = input ? (input.indeterminate ? 'mixed' : String(input.checked)) : attr('aria-checked')
    if (checked === 'true') states.push('checked')
    else if (checked === 'mixed') states.push('checked=mixed')
  }
  const pressed = attr('aria-pressed')
  if (pressed === 'true') states.push('pressed')
  else if (pressed === 'mixed') states.push('pressed=mixed')
  const expanded = attr('aria-expanded')
  if (expanded === 'true') states.push('expanded')
  else if (expanded === 'false') states.push('collapsed')
  if (attr('aria-selected') === 'true' || (element instanceof HTMLOptionElement && element.selected)) states.push('selected')
  const current = attr('aria-current')
  if (current && current !== 'false') states.push('current')
  if ((element as HTMLButtonElement).disabled === true || attr('aria-disabled') === 'true') states.push('disabled')
  if ((element as HTMLInputElement).required === true || attr('aria-required') === 'true') states.push('required')
  if (
    attr('aria-invalid') === 'true' ||
    element.classList.contains('p-invalid') ||
    (role === 'combobox' && !!element.parentElement?.classList.contains('p-invalid'))
  ) {
    states.push('invalid')
  }
  if ((element as HTMLInputElement).readOnly === true || attr('aria-readonly') === 'true') states.push('readonly')
  if (element === document.activeElement && element !== document.body) states.push('focused')
  return states
}

function valueOf(element: Element, role: string): string | undefined {
  if (element instanceof HTMLInputElement) {
    if (element.type === 'password') return element.value ? '••••••' : undefined
    if (element.type === 'file') return Array.from(element.files ?? []).map((f) => f.name).join(', ') || undefined
    if (['checkbox', 'radio', 'button', 'submit', 'reset', 'image', 'hidden'].includes(element.type)) return undefined
    return element.value || undefined
  }
  if (element instanceof HTMLTextAreaElement) return element.value || undefined
  if (element instanceof HTMLSelectElement) return Array.from(element.selectedOptions).map((o) => o.label).join(', ') || undefined
  const now = element.getAttribute('aria-valuetext') ?? element.getAttribute('aria-valuenow')
  if (now !== null) return now
  if ((element as HTMLElement).isContentEditable || role === 'combobox') return collapse(element.textContent) || undefined
  return undefined
}

interface Walk {
  refs: RefRegistry
  style: typeof window.getComputedStyle
  maxRows: number
  visited: number
  truncated: boolean
}

function pushText(out: AxItem[], text: string): void {
  const last = out.length - 1
  if (typeof out[last] === 'string') out[last] = `${out[last]} ${text}`
  else out.push(text)
}

function walk(node: Node, w: Walk, out: AxItem[]): void {
  if (node.nodeType === Node.TEXT_NODE) {
    const text = collapse(node.textContent)
    if (text) pushText(out, text)
    return
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return
  const element = node as Element
  const tag = element.localName
  if (SKIPPED_TAGS.has(tag) || element.matches(DEBUG_BAR) || element.getAttribute('aria-hidden') === 'true') return
  if (!isShown(element)) return
  if (++w.visited > ELEMENT_LIMIT) {
    w.truncated = true
    return
  }

  const role = getRole(element)
  const labelled = element.hasAttribute('aria-label') || element.hasAttribute('aria-labelledby') || element.hasAttribute('title')
  const children: AxItem[] = []
  const walkChildren = () => {
    if (LEAF_TAGS.has(tag)) return
    const kids =
      tag === 'slot'
        ? (element as HTMLSlotElement).assignedNodes({ flatten: true })
        : Array.from(((element as HTMLElement).shadowRoot ?? element).childNodes)
    for (const kid of kids) walk(kid, w, children)
  }

  if (!role || TRANSPARENT.has(role) || (tag === 'svg' && !labelled)) {
    walkChildren()
    for (const child of children) {
      if (typeof child === 'string') pushText(out, child)
      else out.push(child)
    }
    return
  }

  let name = ''
  if (NAMED.has(role) || labelled) {
    try {
      // Pseudo-element content left out: for PrimeIcons it is a private-use glyph, not a name.
      name = collapse(computeAccessibleName(element, { getComputedStyle: w.style, computedStyleSupportsPseudoElements: false }))
    } catch {
      /* a malformed aria-labelledby must not break the snapshot */
    }
  }
  if (role === 'img' && !name) return

  // Minted before the children: refs read in document order.
  const ax: AxNode = { element, role, name, ref: w.refs.refOf(element), states: statesOf(element, role), children }
  walkChildren()
  const value = valueOf(element, role)
  if (value !== undefined) ax.value = value
  if (!name && FIELD_ROLES.has(role)) {
    // A qdadm form field whose label is not tied to its input still shows that label to the user.
    const label = element.closest('.form-field')?.querySelector(':scope > label') as HTMLLabelElement | null
    if (label && !label.control) ax.name = name = collapse(label.textContent)
  }
  // A select that shows its value as its label: say it once, as the value.
  if (ax.value !== undefined && ax.value === name) ax.name = name = ''
  if (role === 'link') {
    const href = element.getAttribute('href')
    if (href) ax.url = href
  }
  if (!name && (role === 'button' || role === 'link')) {
    const icon = iconOf(element)
    const kind = icon ? null : kindOf(element)
    if (icon) ax.states.unshift(`icon=${icon}`)
    else if (kind) ax.states.unshift(`kind=${kind}`)
  }
  const placeholder = element.getAttribute('placeholder')
  if (!name && ax.value === undefined && placeholder) ax.states.push(`placeholder=${JSON.stringify(clip(placeholder, 60))}`)
  // Text already said by the name or the value.
  if (name || ax.value) {
    ax.children = children.filter((c) => typeof c !== 'string' || !(name.includes(c) || (ax.value ?? '').includes(c)))
  }
  // A structural element with nothing in it (a breadcrumb separator's list item) says nothing.
  if (!name && ax.value === undefined && ax.children.length === 0 && ax.states.length === 0 && !INTERACTIVE.has(role) && !KEPT_EMPTY.has(role)) {
    return
  }
  if (role === 'rowgroup' || role === 'table' || role === 'grid' || role === 'treegrid') {
    const rows = ax.children.filter((c): c is AxNode => typeof c !== 'string' && c.role === 'row')
    if (rows.length > w.maxRows) {
      const dropped = new Set<AxItem>(rows.slice(w.maxRows))
      ax.children = ax.children.filter((c) => !dropped.has(c))
      ax.children.push(`(${dropped.size} more rows — maxRows to see them)`)
    }
  }
  out.push(ax)
}

function collect(refs: RefRegistry, root: Element | null, maxRows: number): { items: AxItem[]; truncated: boolean } {
  const cache = new Map<Element, CSSStyleDeclaration>()
  // One layout read per element per snapshot: names and visibility ask for the same styles.
  const style = ((element: Element, pseudo?: string | null) => {
    if (pseudo) return getComputedStyle(element, pseudo)
    let s = cache.get(element)
    if (!s) {
      s = getComputedStyle(element)
      cache.set(element, s)
    }
    return s
  }) as typeof window.getComputedStyle
  const w: Walk = { refs, style, maxRows, visited: 0, truncated: false }
  const items: AxItem[] = []
  if (root) walk(root, w, items)
  else for (const child of Array.from(document.body.childNodes)) walk(child, w, items)
  return { items, truncated: w.truncated }
}

export function describeNode(node: AxNode): string {
  let line = node.role
  if (node.name) line += ` ${JSON.stringify(clip(node.name, 100))}`
  for (const state of node.states) line += ` [${state}]`
  if (node.value !== undefined) line += ` [value=${JSON.stringify(clip(node.value, 200))}]`
  return `${line} [ref=${node.ref}]`
}

function render(items: AxItem[], depth: number, lines: string[]): void {
  const pad = '  '.repeat(depth)
  for (const item of items) {
    if (typeof item === 'string') {
      lines.push(`${pad}- text: ${clip(item, 300)}`)
      continue
    }
    const [only] = item.children
    if (item.children.length === 1 && typeof only === 'string' && !item.url) {
      lines.push(`${pad}- ${describeNode(item)}: ${clip(only, 300)}`)
      continue
    }
    lines.push(`${pad}- ${describeNode(item)}${item.children.length > 0 || item.url ? ':' : ''}`)
    if (item.url) lines.push(`${pad}  - /url: ${item.url}`)
    render(item.children, depth + 1, lines)
  }
}

function* nodes(items: AxItem[], ancestors: AxNode[] = []): Generator<{ node: AxNode; ancestors: AxNode[] }> {
  for (const item of items) {
    if (typeof item === 'string') continue
    yield { node: item, ancestors }
    yield* nodes(item.children, [...ancestors, item])
  }
}

/** The text of a node as its tree says it: cells of a row stay apart. */
function textOf(node: AxNode): string {
  return node.children
    .map((c) => (typeof c === 'string' ? c : c.name || c.value || textOf(c)))
    .filter(Boolean)
    .join(' ')
}

function cut(text: string, maxChars: number, hint: string): string {
  if (text.length <= maxChars) return text
  const end = text.lastIndexOf('\n', maxChars)
  return `${text.slice(0, end > 0 ? end : maxChars)}\n… cut at ${maxChars} characters — ${hint}`
}

/** qdadm form fields in error, label first: in the tree, the message is only text next to its input. */
function formErrors(root: Element | null): string[] {
  return Array.from((root ?? document).querySelectorAll('.form-field'))
    .filter((field) => !field.closest(DEBUG_BAR) && isShown(field))
    .flatMap((field) => {
      const error = collapse(field.querySelector('.field-error, .p-error, .form-field-error, small.p-invalid')?.textContent)
      if (!error) return []
      const label = collapse(field.querySelector('label')?.textContent).replace(/\s*\*$/, '')
      return [`${label || '(a field)'}: ${error}`]
    })
}

export interface SnapshotOptions {
  /** 'all' (default): the tree. 'interactive': a flat list of what can be acted on. */
  filter?: string
  /** Snapshot this element's subtree only. */
  root?: Element | null
  maxRows?: number
  maxChars?: number
}

export function snapshot(refs: RefRegistry, options: SnapshotOptions = {}): string {
  const maxRows = Math.min(Math.max(Number(options.maxRows) || 20, 1), 500)
  const maxChars = Math.min(Math.max(Number(options.maxChars) || 30000, 1000), 200000)
  const { items, truncated } = collect(refs, options.root ?? null, maxRows)
  const lines: string[] = []
  if (options.filter === 'interactive') {
    for (const { node } of nodes(items)) if (INTERACTIVE.has(node.role)) lines.push(`- ${describeNode(node)}`)
  } else {
    render(items, 0, lines)
  }
  if (lines.length === 0) lines.push(options.root ? '(nothing visible in this element)' : '(nothing visible)')
  if (truncated) lines.push(`… stopped after ${ELEMENT_LIMIT} elements — pass ref to read one part`)
  const errors = formErrors(options.root ?? null)
  if (errors.length > 0) lines.push('', 'Form errors:', ...errors.map((e) => `- ${e}`))
  return cut(lines.join('\n'), maxChars, 'pass ref to read one part, or filter "interactive"')
}

export interface FindOptions {
  /** Case-insensitive, in the name, the value or the text. */
  text?: string
  role?: string
  root?: Element | null
  limit?: number
}

/** Elements by role and/or text, each with where it sits (its row, dialog, form…). */
export function find(refs: RefRegistry, options: FindOptions): string {
  const text = options.text ? options.text.toLowerCase() : null
  const role = options.role ? options.role.toLowerCase() : null
  if (!text && !role) throw new Error('find needs text, role, or both')
  const limit = Math.min(Math.max(Number(options.limit) || 30, 1), 200)
  const { items } = collect(refs, options.root ?? null, Number.MAX_SAFE_INTEGER)
  const found: string[] = []
  let total = 0
  for (const { node, ancestors } of nodes(items)) {
    if (role && node.role !== role) continue
    if (text) {
      const own = [node.name, node.value ?? '', ...node.children.filter((c): c is string => typeof c === 'string')]
      if (!own.some((t) => t.toLowerCase().includes(text))) continue
    }
    if (++total > limit) continue
    const context = [...ancestors]
      .reverse()
      .find((a) => ['row', 'dialog', 'alertdialog', 'form', 'tabpanel', 'listitem', 'navigation', 'region', 'menu'].includes(a.role))
    const where = context ? ` — in ${context.role} ${JSON.stringify(clip(context.name || textOf(context), 60))}` : ''
    found.push(`- ${describeNode(node)}${where}`)
  }
  if (found.length === 0) return `Nothing visible matches${role ? ` role "${role}"` : ''}${text ? ` text "${options.text}"` : ''}.`
  return [...found, ...(total > limit ? [`… ${total - limit} more — narrow the search, or raise limit`] : [])].join('\n')
}

/** The page's visible text, debug bar left out. */
export function pageText(root: Element | null, maxChars?: number): string {
  const limit = Math.min(Math.max(Number(maxChars) || 30000, 1000), 200000)
  const target = (root ?? document.body) as HTMLElement
  let text: string
  if (typeof target.innerText === 'string') {
    // Hidden only while reading: no frame is painted in between.
    const bars = Array.from(document.querySelectorAll<HTMLElement>(DEBUG_BAR)).filter((bar) => !bar.contains(target))
    const previous = bars.map((bar) => bar.style.display)
    for (const bar of bars) bar.style.display = 'none'
    try {
      text = target.innerText
    } finally {
      bars.forEach((bar, i) => (bar.style.display = previous[i]))
    }
  } else {
    // No layout (jsdom): no innerText either.
    const copy = target.cloneNode(true) as HTMLElement
    for (const bar of Array.from(copy.querySelectorAll(DEBUG_BAR))) bar.remove()
    text = copy.textContent ?? ''
  }
  text = text.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim()
  return cut(text || '(no visible text)', limit, 'pass ref to read one part')
}
