/**
 * Runs (#5343): a set of items walked one after the other from their show or
 * form page, kept in the tab, with the bar that says where you are.
 *
 * Run: npm test
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { defineComponent, h, provide } from 'vue'
import { mount, flushPromises } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'
import { createRun, saveRun, loadRun, nextPending, runIndexOf, runToneColor } from '../../src/run/run'
import { useRun } from '../../src/run/useRun'
import QdRunBar from '../../src/components/run/QdRunBar.vue'
import { RUN_BAR_HOST } from '../../src/components/run/host'
import { resolveRunKeys } from '../../src/run/keys'

const ROUTE = { name: 'order-edit', param: 'id' }

function makeRouter() {
  const Stub = { template: '<div />' }
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', name: 'home', component: Stub },
      { path: '/orders', name: 'order', component: Stub },
      { path: '/orders/:id/edit', name: 'order-edit', component: Stub },
    ],
  })
}

/** A page that walks the run, and the bar, under one router */
async function mountPage(path = '/orders', features = null) {
  const router = makeRouter()
  await router.push(path)
  let api
  const toast = { success: vi.fn(), error: vi.fn(), info: vi.fn(), warn: vi.fn() }
  const orchestrator = {
    toast,
    get: (name) => (name === 'orders' ? { routePrefix: 'order', idField: 'id' } : undefined),
  }
  const Page = defineComponent({
    setup() {
      api = useRun()
      return () => h(QdRunBar, { entityLabel: 'Order' })
    },
  })
  const wrapper = mount(Page, { global: { plugins: [router], provide: { qdadmOrchestrator: orchestrator, qdadmFeatures: features } }, attachTo: document.body })
  await flushPromises()
  return { wrapper, router, api, toast }
}

beforeEach(() => sessionStorage.clear())

describe('a run (#5343)', () => {
  it('is kept in the tab under its key, and read back', () => {
    const run = createRun({ entity: 'orders', items: [1, { id: 2, urgent: true }], label: 'to process' }, ROUTE)
    saveRun(run)
    const back = loadRun(run.key)
    expect(back.items).toEqual([{ id: '1' }, { id: '2', urgent: true }])
    expect(back.label).toBe('to process')
    expect(loadRun('nope')).toBeNull()
  })

  it('goes to the next item still to do, round to the start, and says when none is left', () => {
    const run = createRun({ entity: 'orders', items: ['a', 'b', 'c'] }, ROUTE)
    expect(nextPending(run, 0)).toBe(1)
    run.items[1].done = true
    expect(nextPending(run, 0)).toBe(2)
    expect(nextPending(run, 2)).toBe(0)
    run.items[0].done = true
    run.items[2].done = true
    expect(nextPending(run, 2)).toBeNull()
    expect(runIndexOf(run, 'c')).toBe(2)
  })
})

describe('useRun and the bar (#5343)', () => {
  it('starts on the first item, with the run in the URL, and the bar says where it is', async () => {
    const { wrapper, router, api } = await mountPage()
    expect(wrapper.find('[data-run-bar]').exists()).toBe(false)

    await api.start({ entity: 'orders', items: [10, 11, { id: 12, urgent: true }], label: 'to process', order: 'urgency', filter: 'to process' })
    await flushPromises()
    const at = router.currentRoute.value
    expect(at.name).toBe('order-edit')
    expect(at.params.id).toBe('10')
    expect(typeof at.query.run).toBe('string')

    expect(wrapper.find('.qd-run-heading').text()).toBe('Order core.run.position to process')
    const segs = wrapper.findAll('.qd-run-seg')
    expect(segs.map((s) => s.attributes('data-state'))).toEqual(['current', 'todo', 'urgent'])
    // The state is in the words too, not only the colour
    expect(segs[2].attributes('title')).toContain('core.run.state.urgent')
    expect(wrapper.find('.qd-run-prev').attributes('disabled')).toBeDefined()
  })

  it('Next and K walk forward, J back (#5454: left and right on the keyboard), not while typing in a field', async () => {
    const { wrapper, router, api } = await mountPage()
    await api.start({ entity: 'orders', items: [1, 2, 3] })
    await flushPromises()
    expect(wrapper.find('.qd-run-prev kbd').text()).toBe('J')
    expect(wrapper.find('.qd-run-next kbd').text()).toBe('K')
    expect(wrapper.find('.qd-run-prev').attributes('aria-keyshortcuts')).toBe('J')
    expect(wrapper.find('.qd-run-next').attributes('aria-keyshortcuts')).toBe('K')
    expect(wrapper.find('[data-run-back]').attributes('aria-keyshortcuts')).toBe('L')

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k' }))
    await flushPromises()
    expect(router.currentRoute.value.params.id).toBe('2')

    const input = document.createElement('input')
    document.body.appendChild(input)
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', bubbles: true }))
    await flushPromises()
    expect(router.currentRoute.value.params.id).toBe('2')
    input.remove()

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'J' }))
    await flushPromises()
    expect(router.currentRoute.value.params.id).toBe('1')
    expect(api.position.value).toBe(1)
  })

  it("the keys are the app's, and a run's own over them (#5454); one turned off has no hint and does nothing", async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { wrapper, router, api } = await mountPage('/orders', { run: { keys: { prev: 'ArrowLeft', next: 'ArrowRight', back: null } } })
    await api.start({ entity: 'orders', items: [1, 2, 3] })
    await flushPromises()
    expect(wrapper.find('.qd-run-prev kbd').text()).toBe('←')
    expect(wrapper.find('.qd-run-next kbd').text()).toBe('→')
    expect(wrapper.find('.qd-run-next').attributes('aria-keyshortcuts')).toBe('ArrowRight')
    // back: off, no hint, no shortcut, the key does nothing
    expect(wrapper.find('[data-run-back] kbd').exists()).toBe(false)
    expect(wrapper.find('[data-run-back]').attributes('aria-keyshortcuts')).toBeUndefined()
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }))
    await flushPromises()
    expect(router.currentRoute.value.params.id).toBe('2')
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k' }))
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'l' }))
    await flushPromises()
    expect(router.currentRoute.value.params.id).toBe('2')
    wrapper.unmount()

    // A run's own keys win over the app's, and stay with it in the tab
    const other = await mountPage('/orders', { run: { keys: { prev: 'ArrowLeft', next: 'ArrowRight' } } })
    await other.api.start({ entity: 'orders', items: [1, 2, 3], keys: { next: 'n', back: 'Escape' } })
    await flushPromises()
    expect(other.wrapper.find('.qd-run-next kbd').text()).toBe('N')
    expect(other.wrapper.find('.qd-run-prev kbd').text()).toBe('←')
    expect(other.wrapper.find('[data-run-back] kbd').text()).toBe('Escape')
    expect(loadRun(other.api.run.value.key).keys).toEqual({ next: 'n', back: 'Escape' })
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'N' }))
    await flushPromises()
    expect(other.router.currentRoute.value.params.id).toBe('2')
    other.wrapper.unmount()

    // One key for two actions: a warning, the first one keeps it
    expect(resolveRunKeys({ next: 'j' })).toEqual({ prev: 'j', next: 'j', back: 'l' })
    const dup = await mountPage('/orders', { run: { keys: { next: 'j' } } })
    const env = import.meta.env.DEV
    import.meta.env.DEV = true
    await dup.api.start({ entity: 'orders', items: [1, 2, 3], keys: { prev: 'x', next: 'x' } })
    await flushPromises()
    expect(warn.mock.calls.flat().join(' ')).toMatch(/'x' go to two actions/)
    import.meta.env.DEV = env
    warn.mockRestore()
    dup.wrapper.unmount()
  })

  it('done and next skips what is done; at the end it says so and goes back where it started', async () => {
    const { wrapper, router, api, toast } = await mountPage('/orders?status=todo')
    await api.start({ entity: 'orders', items: [1, 2, 3] })
    await flushPromises()

    await api.goTo(1)
    await api.doneAndNext()
    await flushPromises()
    expect(router.currentRoute.value.params.id).toBe('3')
    expect(wrapper.findAll('.qd-run-seg').map((s) => s.attributes('data-state'))).toEqual(['todo', 'done', 'current'])
    expect(wrapper.find('.qd-run-details').text()).toContain('core.run.doneSince')

    await api.doneAndNext()
    await flushPromises()
    expect(router.currentRoute.value.params.id).toBe('1')
    await api.doneAndNext()
    await flushPromises()
    expect(toast.success).toHaveBeenCalledWith('core.run.finished', undefined, undefined)
    expect(router.currentRoute.value.fullPath).toBe('/orders?status=todo')
    expect(wrapper.find('[data-run-bar]').exists()).toBe(false)
  })

  it('back to the list (#5453): the button and L end the run, back where it started; none without a way back', async () => {
    const { wrapper, router, api } = await mountPage('/orders?status=todo')
    await api.start({ entity: 'orders', items: [1, 2, 3] })
    await flushPromises()
    const back = wrapper.find('[data-run-back]')
    expect(back.attributes('aria-label')).toBe('core.run.back')
    expect(back.find('kbd').text()).toBe('L')
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'l' }))
    await flushPromises()
    expect(router.currentRoute.value.fullPath).toBe('/orders?status=todo')
    expect(wrapper.find('[data-run-bar]').exists()).toBe(false)
    wrapper.unmount()

    // A run with nowhere to go back: no button, L does nothing
    const run = createRun({ entity: 'orders', items: [5, 6] }, ROUTE)
    saveRun(run)
    const other = await mountPage(`/orders/5/edit?run=${run.key}`)
    expect(other.wrapper.find('[data-run-bar]').exists()).toBe(true)
    expect(other.wrapper.find('[data-run-back]').exists()).toBe(false)
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'l' }))
    await flushPromises()
    expect(other.router.currentRoute.value.params.id).toBe('5')
    other.wrapper.unmount()
  })

  it('hosted at the foot (#5453): the layout draws one bar, with the entity label; the page bar draws nothing and listens to nothing', async () => {
    const router = makeRouter()
    await router.push('/orders')
    let api
    const orchestrator = { toast: { success: vi.fn() }, get: (name) => (name === 'orders' ? { routePrefix: 'order', idField: 'id', label: 'Order' } : undefined) }
    // The page's own bar, inside a layout that hosts one at its foot
    const Page = defineComponent({ setup() { api = useRun(); return () => h(QdRunBar, { entityLabel: 'Order' }) } })
    const Layout = defineComponent({
      setup() {
        provide(RUN_BAR_HOST, true)
        return () => h('div', [h('div', { class: 'page' }, [h(Page)]), h(QdRunBar, { placement: 'foot' })])
      },
    })
    const w = mount(Layout, { global: { plugins: [router], provide: { qdadmOrchestrator: orchestrator } }, attachTo: document.body })
    await flushPromises()
    await api.start({ entity: 'orders', items: [1, 2, 3] })
    await flushPromises()
    const bars = w.findAll('[data-run-bar]')
    expect(bars.length).toBe(1)
    expect(bars[0].classes()).toContain('qd-run-bar--foot')
    expect(w.find('.page [data-run-bar]').exists()).toBe(false)
    // Its label from the run's entity
    expect(w.find('.qd-run-heading').text()).toBe('Order core.run.position')
    // One step per K, not two
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k' }))
    await flushPromises()
    expect(router.currentRoute.value.params.id).toBe('2')
    w.unmount()
  })

  it("tones (#5455): each item's colour from the app, to do then done; aliases and the app's own tokens; defaults otherwise; the current one keeps its colour", async () => {
    expect(runToneColor('danger')).toBe('var(--qd-tone-critical)')
    expect(runToneColor('warn')).toBe('var(--qd-tone-watch)')
    expect(runToneColor('success')).toBe('var(--qd-tone-good)')
    expect(runToneColor('secondary')).toBe('var(--qd-tone-neutral)')
    expect(runToneColor('info')).toBe('var(--qd-tone-info)')
    expect(runToneColor('brand-x')).toBe('var(--qd-tone-brand-x)')
    expect(runToneColor('red; x')).toBeNull()
    expect(runToneColor(undefined)).toBeNull()

    const { wrapper, api } = await mountPage()
    await api.start({ entity: 'orders', items: [
      { id: 1, tone: 'danger', doneTone: 'success' },
      { id: 2, tone: 'brand-x' },
      { id: 3, urgent: true },
      4,
    ] })
    await flushPromises()
    const fill = () => wrapper.findAll('.qd-run-seg').map((s) => s.element.style.getPropertyValue('--qd-run-seg-fill') || null)
    const base = () => wrapper.findAll('.qd-run-seg').map((s) => s.attributes('data-base'))
    // The current one (1st) keeps its own colour; the others theirs or their state's
    expect(fill()).toEqual(['var(--qd-tone-critical)', 'var(--qd-tone-brand-x)', null, null])
    expect(base()).toEqual(['todo', 'todo', 'urgent', 'todo'])
    expect(wrapper.findAll('.qd-run-seg')[0].attributes('data-state')).toBe('current')
    // Done: its done colour, and it says so in words
    await api.doneAndNext()
    await flushPromises()
    expect(fill()[0]).toBe('var(--qd-tone-good)')
    expect(base()[0]).toBe('done')
    expect(wrapper.findAll('.qd-run-seg')[0].attributes('title')).toContain('core.run.state.done')
    // Kept in the tab, tones and all
    expect(loadRun(api.run.value.key).items[0]).toEqual({ id: '1', tone: 'danger', doneTone: 'success', done: true })
  })

  it('a reload keeps the run: the URL key reads it back from the tab', async () => {
    const run = createRun({ entity: 'orders', items: [5, 6] }, ROUTE)
    saveRun(run)
    const { wrapper, api } = await mountPage(`/orders/6/edit?run=${run.key}`)
    expect(api.active.value).toBe(true)
    expect(api.position.value).toBe(2)
    expect(wrapper.find('.qd-run-next').attributes('disabled')).toBeDefined()
  })
})
