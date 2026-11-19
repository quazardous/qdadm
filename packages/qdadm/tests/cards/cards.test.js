/**
 * Cards (#5339): the envelope, the registration with its sheet and schema,
 * the generic cards, and the tooling that keeps the index and the bestiary
 * true to the sheets.
 *
 * Run: npm test
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { QdCard, QdCardView, QdCardsGallery, registerCard, getCard, listCards, validateCardData, BUILTIN_CARDS } from '../../src/cards/index'
import { checkCards, readCards } from '../../src/cards/tools/cardsTool'

const here = path.dirname(fileURLToPath(import.meta.url))
const BUILTIN = path.resolve(here, '../../src/cards/builtin')
const OUTPUTS = { index: path.join(BUILTIN, 'cards-index.json'), bestiary: path.resolve(here, '../../../../docs/cards.md') }

function makeRouter() {
  const Stub = { template: '<div />' }
  return createRouter({ history: createMemoryHistory(), routes: [{ path: '/:p(.*)*', component: Stub }] })
}

async function mountWith(component, props) {
  const router = makeRouter()
  await router.push('/')
  const wrapper = mount(component, { props, global: { plugins: [router] } })
  await flushPromises()
  return { wrapper, router }
}

describe('the cards tooling (#5339)', () => {
  it("qdadm's cards check out: sheets, schemas, examples, index and bestiary up to date", () => {
    expect(checkCards(BUILTIN, OUTPUTS)).toEqual([])
    expect(readCards(BUILTIN).map((c) => c.type).sort()).toEqual([...BUILTIN_CARDS].sort())
  })

  it('says what is wrong with a card folder', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cards-'))
    try {
      fs.mkdirSync(path.join(dir, 'lonely'))
      fs.writeFileSync(path.join(dir, 'lonely', 'Lonely.vue'), '<template><div /></template>')
      fs.mkdirSync(path.join(dir, 'wrong'))
      fs.writeFileSync(path.join(dir, 'wrong', 'Wrong.vue'), '<template><div /></template>')
      fs.writeFileSync(path.join(dir, 'wrong', 'schema.json'), JSON.stringify({ type: 'object', required: ['value'], properties: { value: { type: 'number' } } }))
      const meta = JSON.parse(fs.readFileSync(path.join(BUILTIN, 'metric', 'meta.json'), 'utf8'))
      fs.writeFileSync(path.join(dir, 'wrong', 'meta.json'), JSON.stringify({ ...meta, type: 'wrong', example: { ...meta.example, data: { value: 'twelve' } } }))
      const problems = checkCards(dir, { index: path.join(dir, 'index.json') })
      expect(problems).toEqual(
        expect.arrayContaining([
          "lonely: no meta.json (the card's sheet)",
          'wrong: example.data.value expected number, got string',
          expect.stringContaining('the index'),
        ])
      )
    } finally {
      fs.rmSync(dir, { recursive: true, force: true })
    }
  })
})

describe('validateCardData', () => {
  it('names the path and the reason', () => {
    const schema = { type: 'object', required: ['items'], additionalProperties: false, properties: { items: { type: 'array', items: { type: 'object', required: ['label'], properties: { age: { type: 'number', minimum: 0 } } } } } }
    expect(validateCardData({ items: [{ label: 'a', age: -1 }, {}], extra: 1 }, schema)).toEqual([
      { path: 'data.items[0].age', message: 'must be ≥ 0' },
      { path: 'data.items[1].label', message: 'is required' },
      { path: 'data.extra', message: 'is not allowed' },
    ])
  })
})

describe('QdCard, the envelope', () => {
  it('the title is the surface link; the status is a word, not only a hue', async () => {
    const { wrapper } = await mountWith(QdCard, { title: 'Orders', status: 'critical', to: '/orders', source: 'shop' })
    const surface = wrapper.find('a.qd-card-surface')
    expect(surface.attributes('href')).toBe('/orders')
    expect(wrapper.find('.qd-card-status').text()).toBe('core.cards.status.critical')
    expect(wrapper.classes()).toContain('qd-card--critical')
  })

  it('the action runs its gesture, or opens its route', async () => {
    const run = vi.fn()
    const { wrapper } = await mountWith(QdCard, { title: 'x', action: { verb: 'Process the 1st', run } })
    await wrapper.find('.qd-card-action').trigger('click')
    expect(run).toHaveBeenCalled()

    const mounted = await mountWith(QdCard, { title: 'x', action: { verb: 'Open', to: '/orders/1' } })
    await mounted.wrapper.find('.qd-card-action').trigger('click')
    await flushPromises()
    expect(mounted.router.currentRoute.value.path).toBe('/orders/1')
  })

  it('draws the states instead of the body, without the action', async () => {
    for (const state of ['loading', 'unreachable', 'empty']) {
      const { wrapper } = await mountWith(QdCard, { title: 'x', state, action: { verb: 'Go', to: '/' } })
      expect(wrapper.find(`.qd-card-${state}`).exists()).toBe(true)
      expect(wrapper.find('.qd-card-action').exists()).toBe(false)
    }
  })
})

describe('registered cards', () => {
  it("qdadm's generic cards are registered when qdadm loads", () => {
    expect(listCards().map((c) => c.type)).toEqual(expect.arrayContaining([...BUILTIN_CARDS]))
  })

  it('data that does not fit draws the invalid state with its reasons', async () => {
    const { wrapper } = await mountWith(QdCardView, { type: 'metric', envelope: { title: 'x' }, data: { value: 'twelve' } })
    expect(wrapper.find('[data-card-state="invalid"]').exists()).toBe(true)
    expect(wrapper.find('.qd-card-problems').text()).toContain('data.value')
  })

  it('an unknown type is invalid, not a crash', async () => {
    const { wrapper } = await mountWith(QdCardView, { type: 'nope', envelope: { title: 'x' }, data: {} })
    expect(wrapper.find('.qd-card-problems').text()).toContain("no card of type 'nope'")
  })

  it('an app registers its own card, and options default from the sheet', async () => {
    const Body = { props: ['data', 'options', 'size'], template: '<p class="mine">{{ data.n }} {{ options.unit }}</p>' }
    const meta = { ...getCard('metric').meta, type: 'mine', options: { unit: { type: 'string', default: 'pcs', description: '' } } }
    registerCard({ type: 'mine', component: Body, meta, schema: { type: 'object', required: ['n'], properties: { n: { type: 'number' } } } })
    const { wrapper } = await mountWith(QdCardView, { type: 'mine', envelope: { title: 'Mine' }, data: { n: 3 } })
    expect(wrapper.find('.mine').text()).toBe('3 pcs')
  })
})

describe('the generic cards draw their readings', () => {
  const example = (type) => getCard(type).meta.example

  it('metric: value, the change with its sign and tone, the curve, the hot lines', async () => {
    const { wrapper } = await mountWith(QdCardView, { type: 'metric', envelope: example('metric').envelope, data: example('metric').data, options: example('metric').options })
    expect(wrapper.find('.qd-card-value').text()).toBe('14')
    // higherIs: worse, so a rise is bad news
    expect(wrapper.find('.qd-card-delta').classes()).toContain('qd-tone--critical')
    expect(wrapper.find('.qd-card-delta').text()).toContain('+4')
    expect(wrapper.find('.qd-spark-line').attributes('d')).toMatch(/^M/)
    expect(wrapper.findAll('.qd-card-hot li')).toHaveLength(2)
  })

  it('queue: one line per item, the overdue one says so', async () => {
    const { wrapper } = await mountWith(QdCardView, { type: 'queue', envelope: example('queue').envelope, data: example('queue').data, options: example('queue').options })
    const items = wrapper.findAll('.qd-queue-item')
    expect(items.map((i) => i.attributes('data-warmth'))).toEqual(['overdue', 'warm', 'cool'])
    expect(items[0].find('.qd-queue-age').text()).toContain('core.cards.overdue')
    expect(wrapper.find('.qd-queue-gesture').text()).toBe('Remind')
  })

  it('goal: the share reached against the pace, ahead or behind in words', async () => {
    const { wrapper } = await mountWith(QdCardView, { type: 'goal', envelope: example('goal').envelope, data: example('goal').data, options: example('goal').options })
    expect(wrapper.find('.qd-goal-bar').attributes('aria-valuenow')).toBe('69')
    // 19 of 30 days: 63 % expected, 69 % reached
    expect(wrapper.find('.qd-goal-pace').attributes('style')).toContain('63.33')
    expect(wrapper.find('.qd-goal-verdict').text()).toBe('core.cards.goal.ahead')
  })

  it('bullet: the value in its range, the target tick, the range named', async () => {
    const { wrapper } = await mountWith(QdCardView, { type: 'bullet', envelope: example('bullet').envelope, data: example('bullet').data, options: example('bullet').options })
    expect(wrapper.findAll('.qd-bullet-range').map((r) => r.attributes('data-range'))).toEqual(['poor', 'fair', 'good'])
    expect(wrapper.find('.qd-bullet-target').attributes('style')).toContain('65%')
    expect(wrapper.find('.qd-bullet-verdict').attributes('data-range')).toBe('fair')
  })
})

describe('QdCardsGallery', () => {
  beforeEach(() => vi.spyOn(console, 'warn').mockImplementation(() => {}))
  afterEach(() => vi.restoreAllMocks())

  it('shows each card in each size and state, light and dark', async () => {
    const { wrapper } = await mountWith(QdCardsGallery, { types: ['goal'] })
    const tiles = wrapper.findAll('[data-gallery-card="goal"]')
    // sizes s, m + four states, in two themes
    expect(tiles).toHaveLength(12)
    expect(wrapper.findAll('[data-gallery-theme="dark"].dark-mode')).toHaveLength(1)
    expect(wrapper.findAll('[data-gallery-state="invalid"] [data-card-state="invalid"]')).toHaveLength(2)
  })
})
