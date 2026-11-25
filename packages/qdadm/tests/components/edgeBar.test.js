/**
 * The edge bar (#5506): the app's handler gives the panels for the page's
 * context, called again when it changes; global and contextual panels; the
 * tab kept or fallen back on; the gestures, the focus, the live badges.
 *
 * Run: npm test
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
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
  const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/', name: 'home', component: { template: '<div/>' } }] })
  await router.push('/')
  const s = fakeStack()
  const w = mount(QdEdgeBar, {
    attachTo: document.body,
    global: { plugins: [router], provide: { qdadmFeatures: { edgeBar }, qdadmActiveStack: s.stack, qdadmSignals: s.signals } },
  })
  await flushPromises()
  return { w, s }
}
const tabs = (w) => w.findAll('[data-edge-tab]').map((t) => t.attributes('data-edge-tab') + (t.find('.qd-edge-badge').exists() ? `(${t.find('.qd-edge-badge').text()})` : ''))
// Open: the drawer open, the panel neither inert nor hidden (#5509)
const panelShown = (w) => {
  const p = w.find('[data-edge-panel]')
  return p.exists() && w.find('[data-edge-bar]').classes('qd-edge--open') && p.attributes('inert') === undefined && p.attributes('aria-hidden') === undefined
}

describe('the edge bar (#5506)', () => {
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
})
