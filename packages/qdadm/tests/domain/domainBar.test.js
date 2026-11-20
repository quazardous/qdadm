/**
 * The domain bar (#5389): a domain declared once, its pages found by module,
 * by entity or by meta; its navigation with the current entry; its indicators
 * as mini cards (pills) whose counts are badges, toned by status and hidden at
 * zero; compact by choice, kept per account.
 *
 * Run: npm test
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { mount, flushPromises } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'
import { registerDomain, domainOfRoute, badgeTone, QdDomainBar, QdBadge } from '../../src/domain/index'
import { resetDomains } from '../../src/domain/registry'
import { getCard } from '../../src/cards/index'
import { KernelContext } from '../../src/kernel/KernelContext'
import { getRoutes } from '../../src/module/moduleRegistry'

const Page = defineComponent({ setup: () => () => h('div') })

function makeRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/board', name: 'board', component: Page, meta: { module: 'library' } },
      { path: '/books', name: 'book', component: Page, meta: { module: 'library', entity: 'books' } },
      { path: '/books/:id', name: 'book-show', component: Page, meta: { module: 'library', entity: 'books' } },
      { path: '/loans', name: 'loan', component: Page, meta: { module: 'loans', entity: 'loans' } },
      { path: '/settings', name: 'settings', component: Page, meta: { module: 'library', domain: false } },
      { path: '/elsewhere', name: 'elsewhere', component: Page, meta: { domain: 'library' } },
      { path: '/other', name: 'other', component: Page, meta: { module: 'shop' } },
    ],
  })
}

async function mountBar(path, config) {
  const router = makeRouter()
  await router.push(path)
  registerDomain('library', config, 'library')
  const w = mount(QdDomainBar, { props: { domain: domainOfRoute(router.currentRoute.value) }, attachTo: document.body, global: { plugins: [router] } })
  await flushPromises()
  return { w, router }
}

beforeEach(() => {
  resetDomains()
  localStorage.clear()
})

describe('domains (#5389)', () => {
  it("a page belongs by its module, by an entity listed, or by its meta; meta.domain false keeps it out", async () => {
    registerDomain('library', { label: 'Library', entities: ['loans'] }, 'library')
    const router = makeRouter()
    const at = async (p) => {
      await router.push(p)
      return domainOfRoute(router.currentRoute.value)?.name ?? null
    }
    expect(await at('/board')).toBe('library')
    expect(await at('/books/1')).toBe('library')
    expect(await at('/loans')).toBe('library')
    expect(await at('/elsewhere')).toBe('library')
    expect(await at('/settings')).toBe(null)
    expect(await at('/other')).toBe(null)
  })

  it('ctx.domain() records the module, and ctx.routes() tags its routes with it', () => {
    const ctx = new KernelContext({ orchestrator: null }, { name: 'shelf' })
    ctx.domain('shelf', { label: 'Shelf' })
    ctx.routes('shelf-page', [{ path: '', name: 'shelf-page', component: Page }])
    expect(getRoutes().find((r) => r.name === 'shelf-page').meta.module).toBe('shelf')
    expect(domainOfRoute({ meta: { module: 'shelf' }, matched: [] })?.name).toBe('shelf')
  })

  it('warns about a nav badge no indicator gives', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    registerDomain('d', { label: 'D', nav: [{ label: 'X', route: 'x', badge: 'nope' }] })
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("'nope', which no indicator is"))
    warn.mockRestore()
  })

  it('the generic cards that count give a pill with a count; a goal gives a value only', () => {
    expect(getCard('metric').pill({ value: 1234 }, {}, 'en')).toEqual({ value: '1,234', count: 1234 })
    expect(getCard('queue').pill({ total: 3, items: [] }, {}, 'en')).toEqual({ value: '3', count: 3 })
    expect(getCard('goal').pill({ value: 7, target: 10 }, {}, 'en')).toEqual({ value: '7 / 10', count: null })
    expect(getCard('split').pill({ parts: [{ label: 'a', value: 2 }, { label: 'b', value: 5 }] }, {}, 'en').count).toBe(7)
    expect(getCard('heat').pill).toBeUndefined()
  })
})

describe('QdBadge (#5389)', () => {
  it('a count toned by status, hidden at zero, said in words', () => {
    const w = mount(QdBadge, { props: { count: 3, title: 'To check', tone: 'critical' } })
    expect(w.find('.qd-badge').classes()).toContain('qd-badge--critical')
    expect(w.find('.qd-card-sr').text()).toBe('3 — To check')
    expect(mount(QdBadge, { props: { count: 0 } }).find('.qd-badge').exists()).toBe(false)
    expect(mount(QdBadge, { props: { count: 250 } }).text()).toContain('99+')
    expect(badgeTone('good')).toBe(null)
    expect(badgeTone('watch')).toBe('watch')
  })
})

describe('QdDomainBar (#5389)', () => {
  const config = () => ({
    label: 'Library',
    nav: [
      { label: 'Board', route: 'board' },
      { label: 'Books', route: 'book', badge: 'toCheck' },
      { label: 'Gone', route: 'nowhere' },
    ],
    indicators: [
      { id: 'toCheck', card: 'queue', title: 'To check', data: { total: 4, items: [] }, status: (d) => (d.total ? 'critical' : null), to: '/books' },
      { id: 'onLoan', card: 'metric', title: 'On loan', load: async () => ({ value: 0 }) },
      { id: 'read', card: 'goal', title: 'Read', data: { value: 2, target: 5 } },
      { id: 'down', card: 'metric', title: 'Down', load: async () => { throw new Error('timeout') } },
      { id: 'bad', card: 'metric', title: 'Bad', data: { value: 'x' } },
    ],
  })

  it('the navigation: entries that exist, the current one marked, a badge from its indicator', async () => {
    const { w } = await mountBar('/books/7', config())
    const entries = w.findAll('[data-domain-nav]')
    expect(entries.map((e) => e.find('.qd-domain-bar-entry-label').text())).toEqual(['Board', 'Books'])
    expect(entries[1].attributes('aria-current')).toBe('page')
    expect(entries[1].find('.qd-badge').classes()).toContain('qd-badge--critical')
  })

  it('the indicators: a badge for a count, the value when it says more, a zero hidden, each state in words', async () => {
    const { w } = await mountBar('/board', config())
    const pill = (id) => w.find(`[data-indicator="${id}"]`)
    expect(pill('toCheck').attributes('data-state')).toBe('ready')
    expect(pill('toCheck').find('.qd-badge').text()).toContain('4')
    expect(pill('toCheck').find('.qd-domain-pill-value').exists()).toBe(false)
    expect(pill('toCheck').find('a').attributes('href')).toBe('/books')
    expect(pill('onLoan').find('.qd-badge').exists()).toBe(false)
    expect(pill('onLoan').find('.qd-domain-pill-value').text()).toBe('0')
    expect(pill('read').find('.qd-domain-pill-value').text()).toBe('2 / 5')
    expect(pill('down').attributes('data-state')).toBe('unreachable')
    expect(pill('down').attributes('title')).toContain('timeout')
    expect(pill('bad').attributes('data-state')).toBe('invalid')
  })

  it('an indicator with a refresh reads again', async () => {
    vi.useFakeTimers()
    let n = 0
    const { w } = await mountBar('/board', { label: 'L', indicators: [{ id: 'n', card: 'metric', title: 'N', refresh: 30, load: async () => ({ value: ++n }) }] })
    expect(w.find('.qd-badge').text()).toContain('1')
    await vi.advanceTimersByTimeAsync(30000)
    await flushPromises()
    expect(w.find('.qd-badge').text()).toContain('2')
    vi.useRealTimers()
    w.unmount()
  })

  it('compact by choice, the choice kept for the account', async () => {
    const { w } = await mountBar('/board', config())
    const toggle = w.find('[data-domain-toggle]')
    expect(w.find('.qd-domain-bar').classes()).not.toContain('qd-domain-bar--compact')
    await toggle.trigger('click')
    expect(w.find('.qd-domain-bar').classes()).toContain('qd-domain-bar--compact')
    expect(toggle.attributes('aria-pressed')).toBe('true')
    expect(localStorage.getItem('qdadm.domainBar.library.anonymous.compact')).toBe('1')
    w.unmount()
    const again = await mountBar('/board', config())
    expect(again.w.find('.qd-domain-bar').attributes('data-compact')).toBe('chosen')
  })
})
