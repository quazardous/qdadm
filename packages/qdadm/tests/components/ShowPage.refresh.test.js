/**
 * A record being refreshed stays on screen (#2435).
 *
 * ShowPage used to swap its content for a spinner on every `loading`, so a
 * reload — an action's `show.reload()`, or a live update of the record —
 * unmounted everything inside: the active tab went back to the first one, and
 * open panels, scroll and local state went with it.
 *
 * Run: npm test
 */
import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, h, onMounted, onUnmounted } from 'vue'
import ShowPage from '../../src/components/show/ShowPage.vue'

vi.mock('../../src/components/layout/PageHeader.vue', () => ({
  default: { name: 'PageHeader', template: '<header><slot name="actions" /></header>' },
}))
vi.mock('../../src/components/layout/CardShell.vue', () => ({
  default: { name: 'CardShell', template: '<div class="card-shell"><slot /></div>' },
}))
vi.mock('../../src/components/base/QdButton.vue', () => ({ default: { name: 'QdButton', template: '<button />' } }))
vi.mock('../../src/components/base/QdMessage.vue', () => ({
  default: { name: 'QdMessage', template: '<div class="qd-message"><slot /></div>' },
}))

/** Stands for whatever lives inside the page — tabs, open panels — and counts its lifecycles. */
function probe() {
  const life = { mounted: 0, unmounted: 0 }
  const Content = defineComponent({
    setup() {
      onMounted(() => life.mounted++)
      onUnmounted(() => life.unmounted++)
      return () => h('div', { class: 'probe' }, 'record content')
    },
  })
  return { life, Content }
}

const mountPage = (props, Content) =>
  mount(ShowPage, {
    props,
    slots: { fields: () => h(Content), loading: () => h('div', { class: 'first-load' }, 'loading') },
  })

describe('ShowPage while its record reloads (#2435)', () => {
  it('shows the loading slot on the first load, when there is nothing to show yet', () => {
    const { life, Content } = probe()
    const page = mountPage({ loading: true, data: null }, Content)

    expect(page.find('.first-load').exists()).toBe(true)
    expect(life.mounted).toBe(0)
  })

  it('keeps a loaded record mounted during a reload, and marks it busy', async () => {
    const { life, Content } = probe()
    const page = mountPage({ loading: false, data: { id: 1, title: 'Dune' } }, Content)
    expect(life.mounted).toBe(1)

    await page.setProps({ loading: true })
    // The content — and whatever state it holds — is still the same instance.
    expect(life.unmounted).toBe(0)
    expect(page.find('.probe').exists()).toBe(true)
    expect(page.find('.first-load').exists()).toBe(false)
    // No stripe across the content (#2677): the notification badge shows the activity.
    expect(page.find('.show-refreshing').exists()).toBe(false)
    expect(page.find('.show-content').attributes('aria-busy')).toBe('true')

    await page.setProps({ loading: false, data: { id: 1, title: 'Dune (revised)' } })
    expect(life.mounted).toBe(1)
    expect(life.unmounted).toBe(0)
    expect(page.find('.show-content').attributes('aria-busy')).toBeUndefined()
  })

  it('still shows a fetch error in place of the content', async () => {
    const { Content } = probe()
    const page = mountPage({ loading: false, data: { id: 1 } }, Content)

    await page.setProps({ fetchError: 'Gone' })
    expect(page.find('.probe').exists()).toBe(false)
    expect(page.find('.qd-message').text()).toContain('Gone')
  })
})
