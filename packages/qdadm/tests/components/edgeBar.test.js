/**
 * The edge bar (#5506): the app's handler gives the panels for the page's
 * context, called again when it changes; global and contextual panels; the
 * tab kept or fallen back on; the gestures, the focus, the live badges.
 *
 * Run: npm test
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { defineComponent, h, ref, nextTick } from 'vue'
import { mount, flushPromises } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'
import QdEdgeBar from '../../src/components/layout/QdEdgeBar.vue'
import { useEdgeBar, resetEdgeBar, badgeCount } from '../../src/edge/edgeBar'

const Inbox = defineComponent({ props: ['who'], setup: (p) => () => h('p', { class: 'inbox' }, `inbox of ${p.who ?? 'all'}`) })
const Memory = defineComponent({ props: ['taskId'], setup: (p) => () => h('p', { class: 'memory' }, `memory of ${p.taskId}`) })

/** A stack the test moves, as the kernel's ActiveStack and its signals */
function fakeStack() {
  let levels = []
  const handlers = {}
  return {
    stack: { getLevels: () => levels, getDomain: () => null },
    signals: { on: (name, fn) => ((handlers[name] = fn), () => delete handlers[name]) },
    set(next) {
      levels = next
      handlers['stack:change']?.({ data: { levels } })
    },
  }
}
const task = (id) => ({ type: 'entity', name: 'tasks', entity: 'tasks', param: 'id', foreignKey: null, id })

const unread = ref(2)
const handler = vi.fn((context) => {
  const t = context.entity('tasks')
  return [
    { key: 'inbox', label: 'Inbox', icon: 'pi pi-inbox', component: Inbox, badge: unread },
    ...(t ? [{ key: 'client', label: 'Client', tone: 'watch', component: Memory, props: { taskId: t.id }, badge: () => 1 }] : []),
  ]
})

async function mountBar(edgeBar = { panels: handler }) {
  const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/', name: 'home', component: { template: '<div/>' } }, { path: '/other', name: 'other', component: { template: '<div/>' } }] })
  await router.push('/')
  const s = fakeStack()
  const w = mount(QdEdgeBar, {
    attachTo: document.body,
    global: { plugins: [router], provide: { qdadmFeatures: { edgeBar }, qdadmActiveStack: s.stack, qdadmSignals: s.signals } },
  })
  await flushPromises()
  mounted.push(w)
  return { w, s, router }
}
// One bar at a time, as in an app: each test's goes when it ends
const mounted = []
const tabs = (w) => w.findAll('[data-edge-tab]').map((t) => t.attributes('data-edge-tab') + (t.find('.qd-edge-badge').exists() ? `(${t.find('.qd-edge-badge').text()})` : ''))
// Open: the drawer open, the panel neither inert nor hidden (#5509)
const panelShown = (w) => {
  const p = w.find('[data-edge-panel]')
  return p.exists() && w.find('[data-edge-bar]').classes('qd-edge--open') && p.attributes('inert') === undefined && p.attributes('aria-hidden') === undefined
}

describe('the edge bar (#5506)', () => {
  afterEach(() => {
    while (mounted.length) mounted.pop().unmount()
  })

  beforeEach(() => {
    resetEdgeBar()
    unread.value = 2
    handler.mockClear()
  })

  it('no panel given: no bar', async () => {
    const { w } = await mountBar({ panels: () => [] })
    expect(w.find('[data-edge-bar]').exists()).toBe(false)
    expect(useEdgeBar().present.value).toBe(false)
  })

  it('a global panel always; a contextual one in its context, the handler called again when it changes', async () => {
    const { w, s } = await mountBar()
    expect(tabs(w)).toEqual(['inbox(2)'])
    s.set([task('12')])
    await nextTick()
    expect(tabs(w)).toEqual(['inbox(2)', 'client(1)'])
    expect(handler.mock.calls.at(-1)[0].entity('tasks').id).toBe('12')
  })

  it('a tab opens the panel on it, its component with its props; the open tab closes it', async () => {
    const { w, s } = await mountBar()
    s.set([task('12')])
    await nextTick()
    await w.find('[data-edge-tab="client"]').trigger('click')
    expect(panelShown(w)).toBe(true)
    expect(w.find('.memory').text()).toBe('memory of 12')
    expect(w.find('[data-edge-tab="client"]').attributes('aria-selected')).toBe('true')
    expect(document.activeElement.hasAttribute('data-edge-panel')).toBe(true)
    await w.find('[data-edge-tab="client"]').trigger('click')
    await nextTick()
    expect(panelShown(w)).toBe(false)
    expect(document.activeElement.dataset.edgeTab).toBe('client')
  })

  it('the chevron and Escape close it, the focus back on what opened it', async () => {
    const { w } = await mountBar()
    await w.find('[data-edge-chevron]').trigger('click')
    expect(panelShown(w)).toBe(true)
    expect(w.find('[data-edge-chevron]').attributes('aria-expanded')).toBe('true')
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await nextTick()
    await nextTick()
    expect(panelShown(w)).toBe(false)
    expect(document.activeElement.hasAttribute('data-edge-chevron')).toBe(true)
  })

  it('leaving the context: the open panel falls back to what is left; kept when still given', async () => {
    const { w, s } = await mountBar()
    s.set([task('12')])
    await nextTick()
    useEdgeBar().open('client')
    await nextTick()
    s.set([task('13')])
    await nextTick()
    expect(w.find('.memory').text()).toBe('memory of 13')
    s.set([])
    await nextTick()
    expect(useEdgeBar().tab.value).toBe('inbox')
    expect(panelShown(w)).toBe(true)
    expect(w.find('.inbox').exists()).toBe(true)
  })

  it('a page opens a panel; a key not given here does nothing', async () => {
    const { w } = await mountBar()
    const edge = useEdgeBar()
    expect(edge.open('client')).toBe(false)
    expect(edge.open('inbox')).toBe(true)
    await nextTick()
    expect(panelShown(w)).toBe(true)
  })

  it('badges stay live while it is closed, and say themselves in the tab\'s name', async () => {
    const { w } = await mountBar()
    unread.value = 5
    await nextTick()
    expect(tabs(w)).toEqual(['inbox(5)'])
    expect(w.find('[data-edge-tab="inbox"]').attributes('aria-label')).toBe('Inbox, 5 unread')
    unread.value = 0
    await nextTick()
    expect(tabs(w)).toEqual(['inbox'])
    expect(badgeCount(() => 3)).toBe(3)
    expect(badgeCount(0)).toBe(null)
  })

  it('a failing handler gives no bar, with a warning', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { w } = await mountBar({ panels: () => { throw new Error('boom') } })
    expect(w.find('[data-edge-bar]').exists()).toBe(false)
    expect(warn).toHaveBeenCalled()
    warn.mockRestore()
  })

  it('closed, the panel is inert and hidden; the tabs at the top by default, at the bottom when asked (#5509)', async () => {
    const top = await mountBar()
    const p = top.w.find('[data-edge-panel]')
    expect(p.attributes('inert')).toBeDefined()
    expect(p.attributes('aria-hidden')).toBe('true')
    expect(top.w.find('[data-edge-bar]').classes()).toContain('qd-edge--tabs-top')
    // The chevron at the strip's outer end: first at the top
    expect(top.w.find('.qd-edge-hooks > :first-child').attributes('data-edge-chevron')).toBe('')
    top.w.unmount()
    resetEdgeBar()
    const bottom = await mountBar({ panels: handler, tabsAt: 'bottom' })
    expect(bottom.w.find('[data-edge-bar]').classes()).toContain('qd-edge--tabs-bottom')
    expect(bottom.w.find('.qd-edge-hooks > :last-child').attributes('data-edge-chevron')).toBe('')
  })

  it('pinned: a click outside and Escape leave it open; the chevron still closes it (#5511)', async () => {
    const { w } = await mountBar()
    await w.find('[data-edge-tab="inbox"]').trigger('click')
    await w.find('[data-edge-pin]').trigger('click')
    expect(useEdgeBar().pinned.value).toBe(true)
    expect(useEdgeBar().docked.value).toBe(true)
    expect(w.find('[data-edge-pin]').attributes('aria-pressed')).toBe('true')
    expect(w.find('[data-edge-bar]').classes()).toContain('qd-edge--pinned')
    document.body.dispatchEvent(new Event('pointerdown', { bubbles: true }))
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await nextTick()
    expect(panelShown(w)).toBe(true)
    await w.find('[data-edge-chevron]').trigger('click')
    expect(panelShown(w)).toBe(false)
    expect(useEdgeBar().docked.value).toBe(false)
  })

  it('the pin is kept by the browser, with whether it was open and on which tab (#5511)', async () => {
    const { w } = await mountBar()
    await w.find('[data-edge-tab="inbox"]').trigger('click')
    await w.find('[data-edge-pin]').trigger('click')
    expect(JSON.parse(localStorage.getItem('qdadm_edge_pinned'))).toEqual({ pinned: true, open: true, tab: 'inbox' })
    await w.find('[data-edge-pin]').trigger('click')
    expect(localStorage.getItem('qdadm_edge_pinned')).toBe(null)
  })

  it('pinnable: false, or a narrow screen: no pin (#5511)', async () => {
    const off = await mountBar({ panels: handler, pinnable: false })
    useEdgeBar().open('inbox')
    await nextTick()
    expect(off.w.find('[data-edge-pin]').exists()).toBe(false)
    off.w.unmount()
    resetEdgeBar()
    const mm = window.matchMedia
    window.matchMedia = () => ({ matches: true, addEventListener() {}, removeEventListener() {} })
    const narrow = await mountBar()
    useEdgeBar().open('inbox')
    await nextTick()
    expect(narrow.w.find('[data-edge-pin]').exists()).toBe(false)
    useEdgeBar().pin(true)
    expect(useEdgeBar().docked.value).toBe(false)
    window.matchMedia = mm
  })

  it('resizable: the handle\'s keys move the width within the bounds; a double click goes back; the width kept (#5519)', async () => {
    // jsdom lays nothing out: lengths as px through a stub
    const rect = HTMLElement.prototype.getBoundingClientRect
    HTMLElement.prototype.getBoundingClientRect = function () {
      const w = parseFloat(this.style?.width) || 0
      const unit = (this.style?.width ?? '').endsWith('rem') ? 16 : (this.style?.width ?? '').endsWith('vw') ? window.innerWidth / 100 : 1
      return { width: w * unit, left: 0, right: w * unit, top: 0, bottom: 0, height: 0, x: 0, y: 0 }
    }
    try {
      const { w } = await mountBar({ panels: handler, minWidth: '300px', maxWidth: '500px' })
      useEdgeBar().open('inbox')
      await nextTick()
      const handle = w.find('[data-edge-resize]')
      expect(handle.attributes('role')).toBe('separator')
      expect(handle.attributes('aria-valuenow')).toBe('416')
      await handle.trigger('keydown', { key: 'ArrowRight' })
      expect(useEdgeBar().width.value).toBe(400)
      await handle.trigger('keydown', { key: 'ArrowLeft', shiftKey: true })
      expect(useEdgeBar().width.value).toBe(464)
      await handle.trigger('keydown', { key: 'End' })
      expect(useEdgeBar().width.value).toBe(500)
      await handle.trigger('keydown', { key: 'Home' })
      expect(useEdgeBar().width.value).toBe(300)
      expect(localStorage.getItem('qdadm_edge_width')).toBe('300')
      expect(w.find('[data-edge-bar]').attributes('style')).toContain('--qd-edge-panel-width: 300px')
      await handle.trigger('dblclick')
      expect(useEdgeBar().width.value).toBe(null)
      expect(localStorage.getItem('qdadm_edge_width')).toBe(null)
    } finally {
      HTMLElement.prototype.getBoundingClientRect = rect
    }
  })

  it('resizable: false, or a narrow screen: no handle (#5519)', async () => {
    const off = await mountBar({ panels: handler, resizable: false })
    useEdgeBar().open('inbox')
    await nextTick()
    expect(off.w.find('[data-edge-resize]').exists()).toBe(false)
    off.w.unmount()
    resetEdgeBar()
    const mm = window.matchMedia
    window.matchMedia = () => ({ matches: true, addEventListener() {}, removeEventListener() {} })
    const narrow = await mountBar()
    useEdgeBar().open('inbox')
    await nextTick()
    expect(narrow.w.find('[data-edge-resize]').exists()).toBe(false)
    window.matchMedia = mm
  })

  it('a page with no panel keeps it open in the state: back on a page with panels, open again (#5518)', async () => {
    let none = false
    const { w, s } = await mountBar({ panels: (ctx) => (none ? [] : handler(ctx)) })
    s.set([task('12')])
    await nextTick()
    useEdgeBar().open('client')
    useEdgeBar().pin(true)
    await nextTick()
    // The task list: no panel, no bar
    none = true
    s.set([])
    await nextTick()
    expect(w.find('[data-edge-bar]').exists()).toBe(false)
    expect(useEdgeBar().isOpen.value).toBe(true)
    expect(useEdgeBar().docked.value).toBe(false)
    // Another task: open again, on its tab, beside the page
    none = false
    s.set([task('13')])
    await nextTick()
    await nextTick()
    expect(panelShown(w)).toBe(true)
    expect(useEdgeBar().tab.value).toBe('client')
    expect(useEdgeBar().docked.value).toBe(true)
    expect(w.find('.memory').text()).toBe('memory of 13')
  })

  it('the open state is kept for the session (#5518)', async () => {
    await mountBar()
    useEdgeBar().open('inbox')
    expect(sessionStorage.getItem('qdadm_edge_open')).toBe('1')
    useEdgeBar().close()
    expect(sessionStorage.getItem('qdadm_edge_open')).toBe('0')
  })

  it('unpinned: a click outside closes it, unless that click navigates (#5518)', async () => {
    const wait = (ms) => new Promise((r) => setTimeout(r, ms))
    const { w, router } = await mountBar()
    useEdgeBar().open('inbox')
    await nextTick()
    // A click that navigates, as a RouterLink does: push within the click
    const nav = () => router.push('/other')
    document.body.addEventListener('click', nav, { once: true })
    document.body.dispatchEvent(new Event('pointerdown', { bubbles: true }))
    document.body.dispatchEvent(new Event('click', { bubbles: true }))
    await wait(30)
    await flushPromises()
    expect(panelShown(w)).toBe(true)
    // A plain click
    document.body.dispatchEvent(new Event('pointerdown', { bubbles: true }))
    document.body.dispatchEvent(new Event('click', { bubbles: true }))
    await wait(30)
    await flushPromises()
    expect(panelShown(w)).toBe(false)
  })
})
