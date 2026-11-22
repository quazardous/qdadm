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
import { createRun, saveRun, loadRun, nextPending, runIndexOf } from '../../src/run/run'
import { useRun } from '../../src/run/useRun'
import QdRunBar from '../../src/components/run/QdRunBar.vue'
import { RUN_BAR_HOST } from '../../src/components/run/host'

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
async function mountPage(path = '/orders') {
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
  const wrapper = mount(Page, { global: { plugins: [router], provide: { qdadmOrchestrator: orchestrator } }, attachTo: document.body })
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

  it('Next and J walk forward, K back, not while typing in a field', async () => {
    const { router, api } = await mountPage()
    await api.start({ entity: 'orders', items: [1, 2, 3] })
    await flushPromises()

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'j' }))
    await flushPromises()
    expect(router.currentRoute.value.params.id).toBe('2')

    const input = document.createElement('input')
    document.body.appendChild(input)
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'j', bubbles: true }))
    await flushPromises()
    expect(router.currentRoute.value.params.id).toBe('2')
    input.remove()

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k' }))
    await flushPromises()
    expect(router.currentRoute.value.params.id).toBe('1')
    expect(api.position.value).toBe(1)
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
    // One step per J, not two
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'j' }))
    await flushPromises()
    expect(router.currentRoute.value.params.id).toBe('2')
    w.unmount()
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
