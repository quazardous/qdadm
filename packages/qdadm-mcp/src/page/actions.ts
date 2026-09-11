/**
 * Acting in the page like a user (#2247): click, type, fill, press keys,
 * hover, scroll, drag, upload — on the refs page_snapshot prints.
 *
 * Events are dispatched from inside the page, in the order a browser fires
 * them for a real pointer or keyboard. They are untrusted (`isTrusted` is
 * false): apps rarely check, and the defaults a browser runs only for trusted
 * input — a character typed, Enter submitting, Tab moving focus, Space
 * pressing — are run here by hand, unless the app prevented them.
 *
 * Loaded on first use, like the snapshot.
 */
import { getRole } from 'dom-accessibility-api'
import { DEBUG_BAR, describeElement, isShown } from './aria.ts'
import { pause, yieldToApp } from './timing.ts'

type Editable = HTMLInputElement | HTMLTextAreaElement | HTMLElement

interface Modifiers {
  ctrlKey: boolean
  shiftKey: boolean
  altKey: boolean
  metaKey: boolean
}

const TEXT_TYPES = new Set(['', 'text', 'search', 'email', 'url', 'tel', 'password', 'number'])
/** Inputs a browser does not let you type into character by character: their value is set whole. */
const SET_TYPES = new Set(['date', 'time', 'datetime-local', 'month', 'week', 'color', 'range'])
const FOCUSABLE =
  'a[href], button, input:not([type=hidden]), select, textarea, summary, [tabindex], [contenteditable=""], [contenteditable="true"]'

const collapse = (text: string | null | undefined) => (text ?? '').replace(/\s+/g, ' ').trim()

/** The topmost element of the app at a point: the debug bar floats over the app, and is looked through. */
function appElementAt(x: number, y: number): Element | null {
  if (typeof document.elementsFromPoint !== 'function') return null
  return document.elementsFromPoint(x, y).find((element) => !element.closest(DEBUG_BAR)) ?? null
}

/** `button "Save"` — how errors and results name an element. */
export function briefOf(element: Element | null): string {
  return element ? describeElement(element) : 'nothing'
}

let refFor: ((element: Element) => string) | null = null

/** The connector's refs: what an error names can then be acted on. */
export function useRefs(namer: (element: Element) => string): void {
  refFor = namer
}

const withRef = (element: Element) => `${describeElement(element)}${refFor ? ` [ref=${refFor(element)}]` : ''}`

/** The dialogs on screen: one an action opened, or closed, is what the agent needs to know next. */
export function visibleDialogs(): Element[] {
  return Array.from(document.querySelectorAll('[role="dialog"], [role="alertdialog"], dialog[open]')).filter(
    (dialog) => !dialog.closest(DEBUG_BAR) && isShown(dialog)
  )
}

function modifiersOf(names: string[]): Modifiers {
  const set = new Set(names.map((n) => n.toLowerCase()))
  return {
    ctrlKey: set.has('ctrl') || set.has('control'),
    shiftKey: set.has('shift'),
    altKey: set.has('alt') || set.has('option'),
    metaKey: set.has('meta') || set.has('cmd') || set.has('command'),
  }
}

function assertEnabled(element: Element): void {
  if ((element as HTMLButtonElement).disabled === true || element.closest('[aria-disabled="true"], fieldset:disabled, [inert]')) {
    throw new Error(`${briefOf(element)} is disabled`)
  }
}

/** Scroll the element into view if needed, and tell where a pointer would land and what it would hit. */
async function aim(element: Element, hitTest = true): Promise<{ x: number; y: number; target: Element }> {
  if (element.closest(DEBUG_BAR)) throw new Error('that element belongs to the debug bar, not to the app')
  if (!isShown(element)) throw new Error(`${briefOf(element)} is not visible — take a new page_snapshot`)
  let box = element.getBoundingClientRect()
  const inView = box.top >= 0 && box.left >= 0 && box.bottom <= window.innerHeight && box.right <= window.innerWidth
  if (!inView && typeof element.scrollIntoView === 'function') {
    element.scrollIntoView({ block: 'center', inline: 'center', behavior: 'instant' as ScrollBehavior })
    await yieldToApp()
    box = element.getBoundingClientRect()
  }
  // No layout (jsdom): aim at the element itself.
  if (box.width === 0 && box.height === 0) return { x: 0, y: 0, target: element }
  const x = box.left + box.width / 2
  const y = box.top + box.height / 2
  if (!hitTest) return { x, y, target: element }
  const hit = appElementAt(x, y)
  if (!hit || hit === element || element.contains(hit)) return { x, y, target: hit ?? element }
  // Its own label, or an ancestor it lets clicks through to, is fine.
  if ((hit instanceof HTMLLabelElement && hit.control === element) || hit.contains(element)) return { x, y, target: element }
  // Name what covers it the way the agent can act on it: the control hit, and the dialog it sits in.
  const control = hit.closest('button, a[href], input, select, textarea, [role="button"], [role="link"], [role="option"], [role="menuitem"]') ?? hit
  const layer = hit.closest('[role="dialog"], [role="alertdialog"], dialog')
  throw new Error(
    `${briefOf(element)} is covered by ${withRef(control)}${layer && layer !== control ? ` in ${withRef(layer)}` : ''} — ` +
      'close what is over it (a dialog, an overlay, a menu) first, or scroll'
  )
}

function fire(target: Element, type: string, init: PointerEventInit, pointer = false): boolean {
  const bubbles = !type.endsWith('enter') && !type.endsWith('leave')
  const Ctor = pointer && typeof PointerEvent === 'function' ? PointerEvent : MouseEvent
  const extra = pointer ? { pointerId: 1, pointerType: 'mouse', isPrimary: true } : {}
  return target.dispatchEvent(new Ctor(type, { bubbles, cancelable: bubbles, composed: true, ...extra, ...init }))
}

let hovered: Element | null = null

/** Move the pointer onto `target`: out/leave on what it leaves, over/enter on what it enters, then a move. */
function pointTo(target: Element, init: PointerEventInit): void {
  if (hovered !== target) {
    const previous = hovered?.isConnected ? hovered : null
    if (previous) {
      fire(previous, 'pointerout', init, true)
      fire(previous, 'mouseout', init)
      for (let e: Element | null = previous; e && !e.contains(target); e = e.parentElement) {
        fire(e, 'pointerleave', init, true)
        fire(e, 'mouseleave', init)
      }
    }
    fire(target, 'pointerover', init, true)
    fire(target, 'mouseover', init)
    const entered: Element[] = []
    for (let e: Element | null = target; e && !(previous && e.contains(previous)); e = e.parentElement) entered.unshift(e)
    for (const e of entered) {
      fire(e, 'pointerenter', init, true)
      fire(e, 'mouseenter', init)
    }
    hovered = target
  }
  fire(target, 'pointermove', init, true)
  fire(target, 'mousemove', init)
}

/** What a mouse press does to focus: the focusable element under it takes it, or focus leaves. */
function focusFrom(target: Element): void {
  const focusable = target.closest<HTMLElement>(FOCUSABLE)
  if (focusable && !(focusable as HTMLButtonElement).disabled) focusable.focus({ preventScroll: true })
  else (document.activeElement as HTMLElement | null)?.blur?.()
}

export interface ClickOptions {
  button?: string
  clickCount?: number
  modifiers?: string[]
}

export async function click(element: Element, options: ClickOptions = {}): Promise<string> {
  const { x, y, target } = await aim(element)
  assertEnabled(element)
  const button = options.button === 'right' ? 2 : options.button === 'middle' ? 1 : 0
  const count = Math.min(Math.max(Number(options.clickCount) || 1, 1), 3)
  const base = { clientX: x, clientY: y, screenX: x, screenY: y, button, ...modifiersOf(options.modifiers ?? []) }
  const pressed = button === 2 ? 2 : button === 1 ? 4 : 1
  pointTo(target, { ...base, buttons: 0 })
  for (let n = 1; n <= count; n++) {
    // A prevented pointerdown suppresses the mouse events that follow, not the click.
    const pointerOk = fire(target, 'pointerdown', { ...base, buttons: pressed, detail: n }, true)
    const downOk = pointerOk && fire(target, 'mousedown', { ...base, buttons: pressed, detail: n })
    if (downOk && n === 1) focusFrom(target)
    fire(target, 'pointerup', { ...base, buttons: 0, detail: n }, true)
    if (pointerOk) fire(target, 'mouseup', { ...base, buttons: 0, detail: n })
    // A dispatched click runs the element's activation: a link follows, a checkbox toggles, a label forwards.
    if (button === 0) fire(target, 'click', { ...base, detail: n })
    else if (button === 1) fire(target, 'auxclick', { ...base, detail: n })
  }
  if (button === 2) fire(target, 'contextmenu', { ...base, buttons: 0, detail: 0 })
  if (button === 0 && count === 2) fire(target, 'dblclick', { ...base, detail: 2 })
  const verb = button === 2 ? 'right-clicked' : count === 2 ? 'double-clicked' : count === 3 ? 'triple-clicked' : 'clicked'
  return `${verb} ${briefOf(element)}`
}

export async function hover(element: Element): Promise<string> {
  const { x, y, target } = await aim(element, false)
  const hit = x || y ? (appElementAt(x, y) ?? target) : target
  pointTo(element.contains(hit) ? hit : target, { clientX: x, clientY: y, screenX: x, screenY: y, buttons: 0 })
  return `hovering ${briefOf(element)}`
}

// ── text ────────────────────────────────────────────────────────────────

function isEditable(element: Element): element is Editable {
  if (element instanceof HTMLInputElement) return TEXT_TYPES.has(element.type) || SET_TYPES.has(element.type)
  if (element instanceof HTMLTextAreaElement) return true
  return (element as HTMLElement).isContentEditable === true
}

/** The element itself when it takes text, else the one input inside it (PrimeVue wraps its inputs). */
function editableIn(element: Element): Editable {
  if (isEditable(element)) return element
  const inner = Array.from(element.querySelectorAll('input, textarea, [contenteditable=""], [contenteditable="true"]')).filter(isEditable)
  if (inner.length === 1) return inner[0]
  throw new Error(
    `${briefOf(element)} does not take text${inner.length > 1 ? ` (it holds ${inner.length} inputs: pick one's ref)` : ''} — ` +
      'give the ref of a textbox, searchbox, spinbutton or combobox'
  )
}

function assertWritable(element: Editable): void {
  assertEnabled(element)
  if ((element as HTMLInputElement).readOnly === true || element.getAttribute('aria-readonly') === 'true') {
    throw new Error(`${briefOf(element)} is read-only`)
  }
}

function setNativeValue(element: HTMLInputElement | HTMLTextAreaElement, value: string): void {
  const proto = element instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype
  Object.getOwnPropertyDescriptor(proto, 'value')?.set?.call(element, value)
}

function selectionOf(element: HTMLInputElement | HTMLTextAreaElement): [number, number] {
  try {
    if (element.selectionStart !== null) return [element.selectionStart, element.selectionEnd ?? element.selectionStart]
  } catch {
    /* email and number inputs expose no selection */
  }
  return [element.value.length, element.value.length]
}

/** What the browser does for a typed character or an editing key: beforeinput, the edit, input. */
function edit(element: Editable, inputType: string, data: string | null): void {
  if (!element.dispatchEvent(new InputEvent('beforeinput', { inputType, data, bubbles: true, cancelable: true, composed: true }))) return
  if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
    const value = element.value
    const [start, end] = selectionOf(element)
    let from = start
    let to = end
    if (start === end && inputType === 'deleteContentBackward') from = Math.max(0, start - 1)
    if (start === end && inputType === 'deleteContentForward') to = Math.min(value.length, end + 1)
    const insert = inputType.startsWith('delete') ? '' : (data ?? '')
    setNativeValue(element, value.slice(0, from) + insert + value.slice(to))
    try {
      element.setSelectionRange(from + insert.length, from + insert.length)
    } catch {
      /* no selection on this input type */
    }
  } else if (typeof document.execCommand === 'function' && document.queryCommandSupported?.('insertText')) {
    // contenteditable: the browser's own editing, which fires input itself.
    if (inputType.startsWith('delete')) document.execCommand(inputType === 'deleteContentForward' ? 'forwardDelete' : 'delete')
    else document.execCommand('insertText', false, data ?? '')
    return
  } else {
    element.textContent = inputType.startsWith('delete') ? (element.textContent ?? '').slice(0, -1) : `${element.textContent ?? ''}${data ?? ''}`
  }
  element.dispatchEvent(new InputEvent('input', { inputType, data, bubbles: true, composed: true }))
}

function selectAll(element: Editable): void {
  if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
    try {
      element.setSelectionRange(0, element.value.length)
    } catch {
      /* no selection on this input type */
    }
  } else {
    const range = document.createRange()
    range.selectNodeContents(element)
    const selection = window.getSelection()
    selection?.removeAllRanges()
    selection?.addRange(range)
  }
}

function clearText(element: Editable): void {
  const current = element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement ? element.value : element.textContent
  if (!current) return
  selectAll(element)
  if ((element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) && selectionOf(element)[0] !== 0) {
    // An input with no selection API: replace the whole value.
    element.dispatchEvent(new InputEvent('beforeinput', { inputType: 'deleteContentBackward', bubbles: true, cancelable: true, composed: true }))
    setNativeValue(element, '')
    element.dispatchEvent(new InputEvent('input', { inputType: 'deleteContentBackward', bubbles: true, composed: true }))
    return
  }
  edit(element, 'deleteContentBackward', null)
}

const KEY_ALIASES: Record<string, string> = {
  esc: 'Escape',
  escape: 'Escape',
  enter: 'Enter',
  return: 'Enter',
  tab: 'Tab',
  space: ' ',
  backspace: 'Backspace',
  delete: 'Delete',
  del: 'Delete',
  up: 'ArrowUp',
  down: 'ArrowDown',
  left: 'ArrowLeft',
  right: 'ArrowRight',
  arrowup: 'ArrowUp',
  arrowdown: 'ArrowDown',
  arrowleft: 'ArrowLeft',
  arrowright: 'ArrowRight',
  home: 'Home',
  end: 'End',
  pageup: 'PageUp',
  pagedown: 'PageDown',
}
const KEY_CODES: Record<string, number> = {
  Enter: 13, Tab: 9, Escape: 27, ' ': 32, Backspace: 8, Delete: 46, ArrowLeft: 37, ArrowUp: 38, ArrowRight: 39, ArrowDown: 40,
  Home: 36, End: 35, PageUp: 33, PageDown: 34,
}

function keyInit(key: string, modifiers: Modifiers): KeyboardEventInit & { keyCode: number; which: number } {
  const upper = key.length === 1 ? key.toUpperCase() : key
  const code = key === ' ' ? 'Space' : /^[a-z]$/i.test(key) ? `Key${upper}` : /^\d$/.test(key) ? `Digit${key}` : key
  const keyCode = KEY_CODES[key] ?? (key.length === 1 ? upper.charCodeAt(0) : 0)
  return { key, code, keyCode, which: keyCode, bubbles: true, cancelable: true, composed: true, ...modifiers }
}

function tabbables(): HTMLElement[] {
  const all = Array.from(document.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (e) => e.tabIndex >= 0 && !(e as HTMLButtonElement).disabled && !e.closest(`${DEBUG_BAR}, [inert]`) && isShown(e)
  )
  return [...all.filter((e) => e.tabIndex > 0).sort((a, b) => a.tabIndex - b.tabIndex), ...all.filter((e) => e.tabIndex === 0)]
}

function moveFocus(from: Element, step: 1 | -1): void {
  const order = tabbables()
  if (order.length === 0) return
  let index = order.indexOf(from as HTMLElement)
  if (index === -1) {
    // Focus sits on something not tabbable: continue from where it is in the document.
    index = order.findIndex((e) => from.compareDocumentPosition(e) & Node.DOCUMENT_POSITION_FOLLOWING)
    if (step === 1) index -= 1
    if (index < 0) index = step === 1 ? -1 : 0
  }
  order[(index + step + order.length) % order.length].focus()
}

/** The defaults a browser runs for a trusted key press, which a dispatched one does not get. */
function keyDefault(target: Element, key: string, modifiers: Modifiers): void {
  const editable = isEditable(target) && !(target as HTMLInputElement).readOnly && !(target as HTMLInputElement).disabled
  const shortcut = modifiers.ctrlKey || modifiers.metaKey || modifiers.altKey
  if (editable && key.length === 1 && !shortcut) return edit(target, 'insertText', key)
  if (editable && (modifiers.ctrlKey || modifiers.metaKey) && key.toLowerCase() === 'a') return selectAll(target)
  if (editable && key === 'Backspace') return edit(target, 'deleteContentBackward', null)
  if (editable && key === 'Delete') return edit(target, 'deleteContentForward', null)
  if (key === 'Tab') return moveFocus(target, modifiers.shiftKey ? -1 : 1)
  if (key === 'Enter') {
    if (target instanceof HTMLTextAreaElement || (target as HTMLElement).isContentEditable) return edit(target as Editable, 'insertLineBreak', '\n')
    if (target instanceof HTMLInputElement && target.form) {
      const form = target.form
      const submitter = form.querySelector('button:not([type=button]):not([type=reset]), input[type=submit]')
      const fields = form.querySelectorAll('input:not([type=hidden]):not([type=checkbox]):not([type=radio]):not([type=submit])')
      if (submitter || fields.length === 1) form.requestSubmit()
      return
    }
    if (target.matches('button, a[href], summary, [role=button], [role=link], [role=menuitem], [role=option], [role=tab]')) {
      ;(target as HTMLElement).click()
    }
    return
  }
  if (key === ' ' && target.matches('button, summary, input[type=checkbox], input[type=radio], [role=button], [role=checkbox], [role=switch], [role=radio], [role=tab]')) {
    ;(target as HTMLElement).click()
    return
  }
  if (editable && (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) && !modifiers.shiftKey) {
    const [start, end] = selectionOf(target)
    const caret =
      key === 'ArrowLeft' ? Math.max(0, Math.min(start, end) - (start === end ? 1 : 0))
      : key === 'ArrowRight' ? Math.min(target.value.length, Math.max(start, end) + (start === end ? 1 : 0))
      : key === 'Home' ? 0
      : key === 'End' ? target.value.length
      : null
    if (caret !== null) {
      try {
        target.setSelectionRange(caret, caret)
      } catch {
        /* no selection on this input type */
      }
    }
  }
}

function pressOne(target: Element, combo: string): void {
  const parts = combo.split('+').filter(Boolean)
  const raw = parts.pop() ?? ''
  const key = KEY_ALIASES[raw.toLowerCase()] ?? (raw.length === 1 ? raw : raw)
  const modifiers = modifiersOf(parts)
  const init = keyInit(key, modifiers)
  let proceed = target.dispatchEvent(new KeyboardEvent('keydown', init))
  const printable = key.length === 1 && !modifiers.ctrlKey && !modifiers.metaKey && !modifiers.altKey
  if (proceed && (printable || key === 'Enter')) {
    proceed = target.dispatchEvent(new KeyboardEvent('keypress', { ...init, charCode: printable ? key.charCodeAt(0) : 13 }))
  }
  if (proceed) keyDefault(target, key, modifiers)
  target.dispatchEvent(new KeyboardEvent('keyup', init))
}

const focused = (): Element => (document.activeElement && document.activeElement !== document.body ? document.activeElement : document.body)

/** Keys as a user presses them: "Enter", "Control+a", "Shift+Tab", or several: "ArrowDown ArrowDown Enter". */
export async function pressKeys(element: Element | null, keys: string): Promise<string> {
  const combos = String(keys).trim().split(/\s+/).filter(Boolean)
  if (combos.length === 0) throw new Error('press_key needs keys, e.g. "Enter", "Escape", "Control+a", "Shift+Tab"')
  if (element) {
    await aim(element, false)
    ;(element as HTMLElement).focus?.({ preventScroll: true })
  }
  // A keyboard user's focus stays inside an open dialog: keys pressed with focus elsewhere go to the dialog.
  const keyTarget = () => {
    if (element && combos.length === 1) return element
    const dialog = visibleDialogs().at(-1)
    const active = focused()
    return dialog && !dialog.contains(active) ? dialog : active
  }
  const first = keyTarget()
  for (const combo of combos) {
    pressOne(keyTarget(), combo)
    await yieldToApp()
  }
  return `pressed ${combos.join(' ')} on ${briefOf(first)}`
}

export interface TypeOptions {
  clear?: boolean
  submit?: boolean
}

async function typeInto(target: Editable, text: string): Promise<void> {
  for (const char of Array.from(text)) {
    if (char === '\n') pressOne(target, 'Enter')
    else pressOne(target, char === ' ' ? 'Space' : char)
  }
  await yieldToApp()
}

/** Type text character by character — masks, number inputs and autocompletes see every key. */
export async function typeText(element: Element | null, text: string, options: TypeOptions = {}): Promise<string> {
  const start = element ?? focused()
  if (!element && start === document.body) throw new Error('nothing is focused — pass the ref of the field to type into')
  const target = editableIn(start)
  await aim(target, false)
  assertWritable(target)
  target.focus({ preventScroll: true })
  if (options.clear) clearText(target)
  else if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
    try {
      target.setSelectionRange(target.value.length, target.value.length)
    } catch {
      /* no selection on this input type */
    }
  }
  await typeInto(target, String(text))
  if (options.submit) pressOne(target, 'Enter')
  return `typed into ${briefOf(target)}${options.submit ? ', then Enter' : ''}`
}

// ── fill ────────────────────────────────────────────────────────────────

const optionName = (option: Element) => collapse(option.getAttribute('aria-label') || option.textContent)

async function until<T>(probe: () => T | null | undefined, timeoutMs: number): Promise<T | null> {
  const end = Date.now() + timeoutMs
  for (;;) {
    const value = probe()
    if (value) return value
    if (Date.now() > end) return null
    await pause(50)
  }
}

/** Options on screen for a combobox: in the listbox it controls, else any open one. */
function visibleOptions(control: Element): Element[] {
  const controls = control.getAttribute('aria-controls') || control.getAttribute('aria-owns')
  const listbox = controls ? document.getElementById(controls) : null
  return Array.from((listbox ?? document).querySelectorAll('[role="option"]')).filter((o) => !o.closest(DEBUG_BAR) && isShown(o))
}

function pickOption(options: Element[], wanted: string): Element | null {
  const lower = wanted.toLowerCase()
  const names = options.map(optionName)
  const exact = options.filter((_, i) => names[i] === wanted)
  if (exact.length >= 1) return exact[0]
  const folded = options.filter((_, i) => names[i].toLowerCase() === lower)
  if (folded.length >= 1) return folded[0]
  const partial = options.filter((_, i) => names[i].toLowerCase().includes(lower))
  return partial.length === 1 ? partial[0] : null
}

const listOf = (options: Element[]) =>
  options.length === 0 ? 'none shown' : options.slice(0, 20).map((o) => JSON.stringify(optionName(o))).join(', ') + (options.length > 20 ? '…' : '')

const truthy = (value: unknown) => value === true || ['true', 'on', 'yes', '1', 'checked'].includes(String(value).toLowerCase())

/**
 * Set a field the way a user would, whatever it is: a text field is cleared and
 * typed into; a checkbox or switch clicked if its state differs; a select or a
 * PrimeVue dropdown opened and the option clicked; a date input set whole.
 */
export async function fill(element: Element, value: unknown): Promise<string> {
  if (element.closest(DEBUG_BAR)) throw new Error('that element belongs to the debug bar, not to the app')
  const role = getRole(element)
  const input = element instanceof HTMLInputElement ? element : null

  if (input?.type === 'file') throw new Error(`${briefOf(element)} is a file input — use upload_file`)

  const checkable = input && (input.type === 'checkbox' || input.type === 'radio') ? input : null
  if (checkable || role === 'checkbox' || role === 'switch' || role === 'radio') {
    const wanted = truthy(value)
    const checked = checkable ? checkable.checked : element.getAttribute('aria-checked') === 'true'
    if (checked === wanted) return `${briefOf(element)} was already ${wanted ? 'checked' : 'unchecked'}`
    if (!wanted && (checkable?.type === 'radio' || role === 'radio')) throw new Error('a radio button is unchecked by checking another one')
    await click(element)
    return `${wanted ? 'checked' : 'unchecked'} ${briefOf(element)}`
  }

  if (element instanceof HTMLSelectElement) {
    await aim(element, false)
    assertEnabled(element)
    const wanted = (Array.isArray(value) ? value : [value]).map(String)
    const options = Array.from(element.options)
    const chosen = wanted.map((w) => options.find((o) => o.value === w) ?? pickOption(options, w) as HTMLOptionElement | null)
    const missing = wanted.filter((_, i) => !chosen[i])
    if (missing.length > 0) throw new Error(`no option ${missing.map((m) => JSON.stringify(m)).join(', ')} in ${briefOf(element)} — options: ${listOf(options)}`)
    element.focus({ preventScroll: true })
    for (const option of options) option.selected = chosen.includes(option)
    element.dispatchEvent(new Event('input', { bubbles: true, composed: true }))
    element.dispatchEvent(new Event('change', { bubbles: true }))
    return `selected ${chosen.map((o) => JSON.stringify(o!.label)).join(', ')} in ${briefOf(element)}`
  }

  if (input && SET_TYPES.has(input.type)) {
    await aim(input, false)
    assertWritable(input)
    input.focus({ preventScroll: true })
    setNativeValue(input, String(value))
    input.dispatchEvent(new InputEvent('input', { inputType: 'insertReplacementText', bubbles: true, composed: true }))
    input.dispatchEvent(new Event('change', { bubbles: true }))
    return `set ${briefOf(input)} to ${JSON.stringify(input.value)}`
  }

  const text = String(value ?? '')
  const typable = isEditable(element) ? element : null
  if ((role === 'combobox' || role === 'listbox') && !typable) {
    // A PrimeVue Select: open it, click the option.
    await aim(element)
    assertEnabled(element)
    if (role === 'combobox' && element.getAttribute('aria-expanded') !== 'true') await click(element)
    const options = role === 'listbox' ? Array.from(element.querySelectorAll('[role="option"]')).filter(isShown) : await until(() => {
      const shown = visibleOptions(element)
      return shown.length > 0 ? shown : null
    }, 2000) ?? []
    const option = pickOption(options, text)
    if (!option) {
      if (role === 'combobox') pressOne(focused(), 'Escape')
      throw new Error(`no option ${JSON.stringify(text)} in ${briefOf(element)} — options: ${listOf(options)}`)
    }
    const name = optionName(option)
    await click(option)
    return `picked ${JSON.stringify(name)} in ${briefOf(element)}`
  }

  const target = typable ?? editableIn(element)
  await aim(target, false)
  assertWritable(target)
  target.focus({ preventScroll: true })
  clearText(target)
  await typeInto(target, text)
  if (role === 'combobox') {
    // An autocomplete: when the suggestions hold exactly that value, pick it.
    const option = await until(() => {
      const shown = visibleOptions(target)
      const match = shown.find((o) => optionName(o).toLowerCase() === text.toLowerCase())
      return match ?? null
    }, 1500)
    if (option) {
      await click(option)
      return `typed ${JSON.stringify(text)} in ${briefOf(target)} and picked the suggestion`
    }
  }
  target.dispatchEvent(new Event('change', { bubbles: true }))
  return `filled ${briefOf(target)}`
}

// ── scroll, drag, upload ────────────────────────────────────────────────

function scrollerOf(element: Element | null, horizontal: boolean): Element {
  for (let e = element; e && e !== document.body && e !== document.documentElement; e = e.parentElement) {
    const style = getComputedStyle(e)
    const overflow = horizontal ? style.overflowX : style.overflowY
    const room = horizontal ? e.scrollWidth > e.clientWidth : e.scrollHeight > e.clientHeight
    if (/(auto|scroll|overlay)/.test(overflow) && room) return e
  }
  return document.scrollingElement ?? document.documentElement
}

export async function scroll(element: Element | null, direction?: string, amount?: number): Promise<string> {
  if (element && !direction) {
    await aim(element, false)
    element.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'instant' as ScrollBehavior })
    await yieldToApp()
    return `scrolled ${briefOf(element)} into view`
  }
  const dir = (direction ?? 'down').toLowerCase()
  if (!['up', 'down', 'left', 'right'].includes(dir)) throw new Error('direction is up, down, left or right')
  const horizontal = dir === 'left' || dir === 'right'
  const px = Number(amount) || Math.round((horizontal ? window.innerWidth : window.innerHeight) * 0.8)
  const dx = dir === 'left' ? -px : dir === 'right' ? px : 0
  const dy = dir === 'up' ? -px : dir === 'down' ? px : 0
  const under = element ?? appElementAt(window.innerWidth / 2, window.innerHeight / 2)
  const scroller = scrollerOf(under, horizontal)
  const before = horizontal ? scroller.scrollLeft : scroller.scrollTop
  // Wheel first: virtual scrollers listen to it, and may prevent the plain scroll.
  const wheel = typeof WheelEvent === 'function' ? new WheelEvent('wheel', { deltaX: dx, deltaY: dy, bubbles: true, cancelable: true, composed: true }) : null
  if (!wheel || (under ?? document.body).dispatchEvent(wheel)) scroller.scrollBy({ left: dx, top: dy, behavior: 'instant' as ScrollBehavior })
  await yieldToApp()
  const after = horizontal ? scroller.scrollLeft : scroller.scrollTop
  const max = horizontal ? scroller.scrollWidth - scroller.clientWidth : scroller.scrollHeight - scroller.clientHeight
  const which = scroller === document.scrollingElement || scroller === document.documentElement ? 'the page' : briefOf(scroller)
  if (after === before) return `${which} did not move: it is already at the ${dir === 'up' || dir === 'left' ? 'start' : 'end'}`
  return `scrolled ${which} ${dir} by ${Math.abs(after - before)}px (${Math.round(after)} of ${Math.round(max)})`
}

export async function drag(source: Element, destination: Element): Promise<string> {
  const to = await aim(destination, false)
  const from = await aim(source)
  assertEnabled(source)
  const draggable = source.closest('[draggable="true"]')
  const start = { clientX: from.x, clientY: from.y, screenX: from.x, screenY: from.y, button: 0 }
  pointTo(from.target, { ...start, buttons: 0 })
  fire(from.target, 'pointerdown', { ...start, buttons: 1 }, true)
  fire(from.target, 'mousedown', { ...start, buttons: 1 })

  if (draggable && typeof DragEvent === 'function' && typeof DataTransfer === 'function') {
    const dataTransfer = new DataTransfer()
    const drag = (target: Element, type: string, at: { x: number; y: number }) =>
      target.dispatchEvent(new DragEvent(type, { dataTransfer, bubbles: true, cancelable: true, composed: true, clientX: at.x, clientY: at.y }))
    if (!drag(draggable, 'dragstart', from)) return `the app refused to start dragging ${briefOf(source)}`
    const over = (to.x || to.y ? appElementAt(to.x, to.y) : null) ?? destination
    drag(over, 'dragenter', to)
    const accepted = !drag(over, 'dragover', to)
    if (accepted) drag(over, 'drop', to)
    drag(draggable, 'dragend', to)
    return accepted ? `dragged ${briefOf(source)} onto ${briefOf(destination)}` : `${briefOf(destination)} does not accept the drop`
  }

  // Pointer-driven drag (sortable lists, sliders): move in steps, release over the destination.
  const steps = 10
  for (let i = 1; i <= steps; i++) {
    const x = from.x + ((to.x - from.x) * i) / steps
    const y = from.y + ((to.y - from.y) * i) / steps
    const under = (x || y ? appElementAt(x, y) : null) ?? destination
    const init = { clientX: x, clientY: y, screenX: x, screenY: y, buttons: 1, button: 0 }
    pointTo(under, init)
    await yieldToApp()
  }
  const end = (to.x || to.y ? appElementAt(to.x, to.y) : null) ?? destination
  const release = { clientX: to.x, clientY: to.y, screenX: to.x, screenY: to.y, buttons: 0, button: 0 }
  fire(end, 'pointerup', release, true)
  fire(end, 'mouseup', release)
  return `dragged ${briefOf(source)} to ${briefOf(destination)}`
}

export interface UploadFile {
  name: string
  mimeType?: string
  text?: string
  base64?: string
}

export function upload(element: Element, files: UploadFile[]): string {
  const input = element instanceof HTMLInputElement && element.type === 'file' ? element : element.querySelector<HTMLInputElement>('input[type=file]')
  if (!input) throw new Error(`${briefOf(element)} is not a file input and holds none — give the ref of the upload button or its input`)
  if (!Array.isArray(files) || files.length === 0) throw new Error('upload_file needs files: [{ name, text } or { name, base64, mimeType }]')
  assertEnabled(input)
  const transfer = new DataTransfer()
  for (const file of files) {
    const bytes =
      typeof file.base64 === 'string' ? Uint8Array.from(atob(file.base64), (c) => c.charCodeAt(0)) : new TextEncoder().encode(String(file.text ?? ''))
    transfer.items.add(new File([bytes], String(file.name), { type: file.mimeType ?? 'application/octet-stream' }))
  }
  input.files = transfer.files
  input.dispatchEvent(new Event('input', { bubbles: true, composed: true }))
  input.dispatchEvent(new Event('change', { bubbles: true }))
  return `attached ${Array.from(input.files ?? []).map((f) => `${f.name} (${f.size} bytes)`).join(', ')} to ${briefOf(element)}`
}
