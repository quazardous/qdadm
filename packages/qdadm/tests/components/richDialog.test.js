/**
 * The rich dialog (#5445): blocks drawn by content handlers (native or the
 * app's; an unknown kind skipped), markdown and html sanitised, an action
 * area of declared buttons and controls (native or the app's) or the app's
 * own footer, the read-to-the-end gate and required controls, the answer
 * `{ action, values }`, and opens queued one at a time.
 *
 * Run: npm test
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { defineComponent, h, nextTick } from 'vue'
import PrimeVue from 'primevue/config'
import { QdRichDialog, QdRichDialogHost, registerDialogContent, registerDialogControl, sanitizeHtml, renderMarkdown, openRichDialog } from '../../src/components/dialogs/rich'
import { resetDialogHandlers } from '../../src/components/dialogs/rich/registry'

const global = { plugins: [PrimeVue] }
const dialog = (props, slots) => mount(QdRichDialog, { props: { visible: true, title: 'T', ...props }, slots, global, attachTo: document.body })
const $ = (sel) => document.body.querySelector(sel)
const $$ = (sel) => [...document.body.querySelectorAll(sel)]
const settle = async () => {
  for (let i = 0; i < 5; i++) {
    await flushPromises()
    await new Promise((r) => setTimeout(r, 0))
  }
}

beforeEach(() => resetDialogHandlers())
afterEach(() => {
  vi.restoreAllMocks()
  document.body.innerHTML = ''
})

describe('the sanitiser (#5445)', () => {
  it('no script, no event handler, no javascript: link, no style; outside links in a new tab', async () => {
    const out = await sanitizeHtml('<p onclick="x()">Hi<script>alert(1)</script></p><a href="javascript:alert(1)">bad</a><a href="https://ok.example">ok</a><img src="x" onerror="y()"><span style="color:red">s</span><iframe src="https://e"></iframe>')
    expect(out).not.toMatch(/script|onclick|onerror|javascript:|style=|iframe/)
    expect(out).toContain('<a href="https://ok.example" target="_blank" rel="noopener noreferrer">ok</a>')
  })

  it('markdown: headings, lists, code, tables, sanitised', async () => {
    const out = await renderMarkdown('# Title\n\n- one\n- two\n\n`code`\n\n| a | b |\n|---|---|\n| 1 | 2 |\n\n<script>x()</script>[l](javascript:alert(1))')
    expect(out).toContain('<h1>Title</h1>')
    expect(out).toContain('<li>one</li>')
    expect(out).toContain('<code>code</code>')
    expect(out).toContain('<table>')
    expect(out).not.toMatch(/<script|href="javascript:/)
  })
})

describe('the rich dialog (#5445)', () => {
  it('blocks by their handler; the app registers its own; an unknown kind is skipped, with a warning', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const env = import.meta.env.DEV
    import.meta.env.DEV = true
    registerDialogContent('demo.changes', defineComponent({ props: ['block'], setup: (p) => () => h('ul', { class: 'changes' }, p.block.items.map((i) => h('li', i))) }))
    expect(() => registerDialogContent('markdown', {})).toThrow(/draws 'markdown' itself/)
    const w = dialog({ blocks: [
      { kind: 'text', title: 'Welcome', meta: 'v2', text: 'One.\n\nTwo <b>bold</b>.' },
      { kind: 'markdown', source: '**strong**' },
      { kind: 'demo.changes', items: ['a', 'b'] },
      { kind: 'nope' },
    ] })
    await settle()
    expect($$('[data-rich-block]').map((s) => s.dataset.richBlock)).toEqual(['text', 'markdown', 'demo.changes'])
    expect($('.qd-rich-block-title').textContent).toBe('Welcome')
    expect($('.qd-rich-block-meta').textContent).toBe('v2')
    expect($$('.qd-rich-text p').map((p) => p.textContent)).toEqual(['One.', 'Two <b>bold</b>.'])
    expect($('[data-rich-markdown]').innerHTML).toContain('<strong>strong</strong>')
    expect($$('.changes li')).toHaveLength(2)
    expect(warn.mock.calls.flat().join(' ')).toMatch(/no content handler for the kind 'nope'/)
    import.meta.env.DEV = env
    w.unmount()
  })

  it('buttons answer with their key and the controls values; toggle by default, checkbox on request, the app\'s own control', async () => {
    registerDialogControl('demo.pick', defineComponent({ props: ['control', 'modelValue', 'read'], emits: ['update:modelValue'], setup: (p, { emit }) => () => h('button', { class: 'pick', onClick: () => emit('update:modelValue', p.control.choices[1]) }, String(p.modelValue ?? '-')) }))
    const w = dialog({
      blocks: [{ kind: 'text', text: 'Hi' }],
      controls: [
        { key: 'dontShowAgain', label: 'Do not show again' },
        { key: 'mail', kind: 'checkbox', label: 'Mail me', value: true },
        { key: 'who', kind: 'demo.pick', choices: ['ann', 'bob'] },
      ],
      actions: [{ key: 'later', label: 'Later' }, { key: 'ok', label: 'Got it' }],
    })
    await settle()
    expect($('[data-rich-control="dontShowAgain"] [role="switch"], [data-rich-control="dontShowAgain"] input')).toBeTruthy()
    expect($('[data-rich-control="dontShowAgain"] label').textContent).toBe('Do not show again')
    expect($('[data-rich-control="mail"] .p-checkbox')).toBeTruthy()
    // The toggle, by its label; the app's control
    $('[data-rich-control="dontShowAgain"] input').click()
    $('.pick').click()
    await settle()
    $('[data-rich-action="ok"]').click()
    await settle()
    expect(w.emitted('action')[0][0]).toEqual({ action: 'ok', values: { dontShowAgain: true, mail: true, who: 'bob' } })
    expect(w.emitted('update:visible').at(-1)).toEqual([false])
    w.unmount()
  })

  it('read to the end: the gated button waits, with a hint, until the end; a required control too', async () => {
    // jsdom draws nothing: the scrolling area is 1000 px of content in a 200 px box
    Object.defineProperty(HTMLElement.prototype, 'scrollHeight', { configurable: true, get() { return this.hasAttribute?.('data-rich-body') ? 1000 : 0 } })
    Object.defineProperty(HTMLElement.prototype, 'clientHeight', { configurable: true, get() { return this.hasAttribute?.('data-rich-body') ? 200 : 0 } })
    const w = dialog({
      readToEnd: true,
      dismissable: false,
      blocks: [{ kind: 'text', text: 'Long' }],
      controls: [{ key: 'agree', label: 'I agree', required: true }],
      actions: [{ key: 'decline', label: 'Decline' }, { key: 'accept', label: 'Accept', requiresRead: true }],
    })
    await settle()
    const body = $('[data-rich-body]')
    const accept = () => $('[data-rich-action="accept"]')
    expect(accept().disabled).toBe(true)
    expect($('[data-rich-hint]').textContent).toMatch(/Scroll to the end/)
    expect(accept().getAttribute('aria-describedby')).toBe($('[data-rich-hint]').id)
    body.scrollTop = 800
    body.dispatchEvent(new Event('scroll'))
    await settle()
    // Read, but the required toggle is off
    expect(accept().disabled).toBe(true)
    expect($('[data-rich-hint]').textContent).toMatch(/required/)
    $('[data-rich-control="agree"] input').click()
    await settle()
    expect(accept().disabled).toBe(false)
    expect($('[data-rich-hint]')).toBeNull()
    // Not dismissable: no ×
    expect($('.p-dialog-close-button, .p-dialog-header-close')).toBeNull()
    w.unmount()
    // Back to jsdom's own: the overrides go, Element's getters show through again
    Reflect.deleteProperty(HTMLElement.prototype, 'scrollHeight')
    Reflect.deleteProperty(HTMLElement.prototype, 'clientHeight')
  })

  it("the app's own footer: given read, values, resolve and close", async () => {
    const Footer = defineComponent({ props: ['read', 'ready', 'values', 'resolve', 'close'], setup: (p) => () => h('div', { class: 'own' }, [
      h('button', { class: 'go', onClick: () => p.resolve('go', { note: 'x' }) }, 'Go'),
      h('button', { class: 'no', onClick: () => p.close() }, 'No'),
    ]) })
    const w = dialog({ blocks: [{ kind: 'text', text: 'Hi' }], controls: [{ key: 'k', value: 1 }] }, { footer: (p) => h(Footer, p) })
    await settle()
    expect($('[data-rich-action]')).toBeNull()
    $('.go').click()
    await settle()
    expect(w.emitted('action')[0][0]).toEqual({ action: 'go', values: { k: 1, note: 'x' } })
    w.unmount()
  })

  it('opens are queued, one at a time; each resolves with its answer; dismissed is action null', async () => {
    const host = mount(QdRichDialogHost, { global, attachTo: document.body })
    const first = openRichDialog({ title: 'Licence', blocks: [{ kind: 'text', text: 'L' }], actions: [{ key: 'accept', label: 'Accept' }], dismissable: false })
    const second = openRichDialog({ title: 'News', blocks: [{ kind: 'text', text: 'N' }], actions: [{ key: 'ok', label: 'OK' }] })
    await settle()
    expect($$('.qd-rich-dialog-title').map((t) => t.textContent.trim())).toEqual(['Licence'])
    $('[data-rich-action="accept"]').click()
    await settle()
    expect(await first).toEqual({ action: 'accept', values: {} })
    await settle()
    expect($$('.qd-rich-dialog-title').map((t) => t.textContent.trim())).toEqual(['News'])
    // ×: dismissed
    $('.p-dialog-close-button, .p-dialog-header-close').click()
    await settle()
    expect(await second).toEqual({ action: null, values: {} })
    await nextTick()
    host.unmount()
  })
})
